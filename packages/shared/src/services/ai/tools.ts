import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { pythonExecutor } from '../python/executor';
import { fileSystem } from '../filesystem';
import { logPython, logFile } from '../console/logger';
import { getErrorMessage } from '../../utils/errors';
import i18n from '../../i18n';

const t = () => i18n.t.bind(i18n);

export const pythonTool = tool({
  description: 'Execute Python code using Pyodide (WebAssembly). Supports pandas, numpy, matplotlib, etc.',
  inputSchema: z.object({
    code: z.string().describe('Python code to execute'),
  }),
  execute: async ({ code }) => {
    logPython('info', t()('tools.exec.code', { length: code.length }), code.slice(0, 200));
    const result = await pythonExecutor.execute(code);
    if (result.error) {
      logPython('error', t()('tools.exec.failed'), result.error);
      return `Error:\n${result.error}`;
    }
    logPython('success', t()('tools.exec.completed'), result.output.slice(0, 200));
    return `Output:\n\`\`\`\n${result.output}\n\`\`\``;
  },
});

export const webSearchTool = tool({
  description: 'Search the web for information using Exa or Brave search API.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    const getSearchConfig = () => {
      try {
        if (typeof localStorage === 'undefined') return { provider: 'exa' as const, apiKey: '' };
        const raw = localStorage.getItem('webagent-settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          const state = parsed?.state;
          const provider = state?.searchProvider || 'exa';
          const apiKey = provider === 'brave' ? (state?.braveApiKey || '') : (state?.exaApiKey || '');
          return { provider: provider as 'exa' | 'brave', apiKey };
        }
      } catch { /* ignore */ }
      return { provider: 'exa' as const, apiKey: '' };
    };

    const { provider, apiKey } = getSearchConfig();
    if (!apiKey) {
      return t()('tools.exec.searchNoKey');
    }

    try {
      let results: Array<{title: string; url: string; snippet: string}>;

      if (provider === 'brave') {
        const params = new URLSearchParams({ q: query, count: '5' });
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
          headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
        });
        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Brave API ${response.status}: ${errBody.slice(0, 200)}`);
        }
        const data = await response.json();
        results = (data.web?.results || []).slice(0, 5).map((r: any) => ({
          title: r.title || '', url: r.url || '', snippet: (r.description || '').slice(0, 200),
        }));
      } else {
        const response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ query, type: 'auto', numResults: 5, contents: { text: { maxCharacters: 1000 } } }),
        });
        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Exa API ${response.status}: ${errBody.slice(0, 200)}`);
        }
        const data = await response.json();
        results = (data.results || []).map((r: any) => ({
          title: r.title || '', url: r.url || '', snippet: (r.text || '').slice(0, 200),
        }));
      }

      return `${t()('tools.exec.searchResults', { query })}${results.map((r, i) =>
        `${i + 1}. [${r.title}](${r.url})\n${r.snippet}\n`
      ).join('\n')}`;
    } catch (error) {
      return t()('tools.exec.searchFailed', { error: error instanceof Error ? error.message : String(error) });
    }
  },
});

export const calculatorTool = tool({
  description: 'Calculate mathematical expressions using Python.',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression to evaluate'),
  }),
  execute: async ({ expression }) => {
    try {
      const code = `import math\nresult = ${expression}\nprint(f"Result: {result}")\nresult`;
      const pyResult = await pythonExecutor.execute(code);
      return `${expression} = ${pyResult.output.replace('Result: ', '')}`;
    } catch (error) {
      return t()('tools.exec.calcError', { error: error instanceof Error ? error.message : String(error) });
    }
  },
});

export const fileManagerTool = tool({
  description: 'Manage files: read, write, list, mkdir, delete operations on the virtual file system. The root directory is /root.',
  inputSchema: z.object({
    operation: z.enum(['read', 'write', 'list', 'mkdir', 'delete']).describe('File operation to perform'),
    path: z.string().describe('File or directory path'),
    content: z.string().optional().describe('Content for write operation'),
  }),
  execute: async ({ operation, path, content }) => {
    try {
      const normalizedPath = path.trim();
      if (normalizedPath.includes('/.memory') || normalizedPath === '/root/.memory') {
        return '[Error] Access to .memory directory is restricted';
      }

      await fileSystem.initialize();

      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      switch (operation) {
        case 'read': {
          const fileContent = await fileSystem.readFileText(normalizedPath);
          if (fileContent === null) {
            logFile('warning', t()('tools.exec.fileNotFound', { path }));
            return t()('tools.exec.fileNotFoundError', { path });
          }
          logFile('success', t()('tools.exec.readFile', { path }), { size: fileContent.length });
          return `${path}:\n\`\`\`\n${fileContent.slice(0, 5000)}\n\`\`\``;
        }
        case 'write': {
          if (!content && content !== '') {
            return t()('tools.exec.writeNeedsContent');
          }
          await fileSystem.writeFile(normalizedPath, content!);
          logFile('success', t()('tools.exec.writeFile', { path }), { size: content!.length });
          return t()('tools.exec.fileSaved', { path, length: content!.length });
        }
        case 'list': {
          const targetPath = normalizedPath || '/root';
          const entries = await fileSystem.readdir(targetPath);
          const filtered = entries.filter((e: any) => e.name !== '.memory');
          if (filtered.length === 0) {
            return `${targetPath}\n${t()('tools.exec.emptyFolder')}`;
          }
          const sorted = filtered.sort((a: any, b: any) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          });
          const lines = sorted.map((e: any) => {
            const size = e.type === 'file' ? ` (${formatSize(e.size)})` : '';
            return `${e.type === 'directory' ? 'DIR' : 'FILE'} ${e.name}${size}`;
          });
          logFile('info', t()('tools.exec.listDir', { path: targetPath }), { count: filtered.length });
          return `${targetPath} (${t()('tools.exec.dirItems', { count: filtered.length })}):\n\n${lines.join('\n')}`;
        }
        case 'mkdir': {
          await fileSystem.mkdir(normalizedPath);
          logFile('success', t()('tools.exec.createFolder', { path }));
          return t()('tools.exec.folderCreated', { path });
        }
        case 'delete': {
          const entry = await fileSystem.stat(normalizedPath);
          if (!entry) {
            return t()('tools.exec.notFound', { path });
          }
          await fileSystem.rm(normalizedPath, entry.type === 'directory');
          logFile('success', t()('tools.exec.deleted', { path }), { type: entry.type });
          return t()('tools.exec.deletedOk', { path });
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return t()('tools.exec.jsonError', { error: error.message });
      }
      const errorMsg = getErrorMessage(error);
      logFile('error', t()('tools.exec.fileOpFailed'), errorMsg);
      return t()('tools.exec.opFailed', { error: errorMsg });
    }
  },
});

export const memoryTool = tool({
  description: 'Read/write persistent memory and diary entries. Memory persists across sessions.',
  inputSchema: z.object({
    operation: z.enum(['read_memory', 'write_memory', 'read_diary', 'write_diary', 'list_diaries']).describe('Memory operation'),
    content: z.string().optional().describe('Content to write'),
    date: z.string().optional().describe('Date for diary (YYYY-MM-DD format)'),
    mode: z.enum(['append', 'overwrite']).optional().describe('Write mode'),
  }),
  execute: async ({ operation, content, date, mode }) => {
    const MEMORY_DIR = '/root/.memory';
    const MEMORY_FILE = '/root/.memory/MEMORY.md';

    try {
      await fileSystem.initialize();
      if (!(await fileSystem.exists(MEMORY_DIR))) {
        await fileSystem.mkdir(MEMORY_DIR);
      }

      switch (operation) {
        case 'read_memory': {
          const memContent = await fileSystem.readFileText(MEMORY_FILE);
          if (!memContent) return t()('tools.exec.noMemory');
          return t()('tools.exec.memoryRead', { content: memContent });
        }
        case 'write_memory': {
          if (mode === 'overwrite') {
            await fileSystem.writeFile(MEMORY_FILE, content || '');
          } else {
            const existing = await fileSystem.readFileText(MEMORY_FILE);
            const timestamp = new Date().toLocaleString();
            const newContent = existing
              ? `${existing}\n\n---\n_${timestamp}_\n${content || ''}`
              : `_${timestamp}_\n${content || ''}`;
            await fileSystem.writeFile(MEMORY_FILE, newContent);
          }
          return t()('tools.exec.memoryUpdated');
        }
        case 'read_diary': {
          const targetDate = date || new Date().toISOString().slice(0, 10);
          const diaryPath = `${MEMORY_DIR}/${targetDate}.md`;
          const diaryContent = await fileSystem.readFileText(diaryPath);
          if (!diaryContent) return t()('tools.exec.noDiary', { date: targetDate });
          return t()('tools.exec.diaryRead', { date: targetDate, content: diaryContent });
        }
        case 'write_diary': {
          const targetDate = date || new Date().toISOString().slice(0, 10);
          const diaryPath = `${MEMORY_DIR}/${targetDate}.md`;
          const existing = await fileSystem.readFileText(diaryPath);
          const timestamp = new Date().toLocaleTimeString();
          const newContent = existing
            ? `${existing}\n\n**${timestamp}**\n${content || ''}`
            : `# ${targetDate}\n\n**${timestamp}**\n${content || ''}`;
          await fileSystem.writeFile(diaryPath, newContent);
          return t()('tools.exec.diaryUpdated', { date: targetDate });
        }
        case 'list_diaries': {
          const entries = await fileSystem.readdir(MEMORY_DIR);
          const diaries = entries
            .filter(e => e.type === 'file' && e.name !== 'MEMORY.md' && e.name.endsWith('.md'))
            .sort((a, b) => b.name.localeCompare(a.name));
          if (diaries.length === 0) {
            return t()('tools.exec.noDiary', { date: '' }).replace('  ', ' ');
          }
          const list = diaries.map(d => {
            const diaryDate = d.name.replace('.md', '');
            const size = d.size < 1024 ? `${d.size} B` : `${(d.size / 1024).toFixed(1)} KB`;
            return `- ${diaryDate} (${size})`;
          }).join('\n');
          return t()('tools.exec.diariesListed', { count: diaries.length, list });
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return t()('tools.exec.jsonError', { error: error.message });
      }
      return t()('tools.exec.memoryOpFailed', { error: getErrorMessage(error) });
    }
  },
});

export const execTool = tool({
  description: 'Execute shell commands in a persistent session (Desktop only: macOS/Linux). Maintains shell state across commands.',
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
    sessionId: z.string().optional().describe('Session ID for persistent shell (optional, auto-generated if not provided)'),
  }),
  execute: async ({ command, sessionId }) => {
    // Check if running on desktop platform
    if (typeof window !== 'undefined' && (window as any).electronAPI?.exec) {
      try {
        const result = await (window as any).electronAPI.exec.execute(command, sessionId);
        if (result.error) {
          return `Error:\n${result.error}`;
        }
        return `Session: ${result.sessionId}\nExit Code: ${result.exitCode}\n\nOutput:\n\`\`\`\n${result.output}\n\`\`\``;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    return 'Error: exec tool is only available on desktop platforms (macOS/Linux)';
  },
});

/**
 * All built-in tools keyed by tool ID
 */
export const builtinTools = {
  python: pythonTool,
  web_search: webSearchTool,
  calculator: calculatorTool,
  file_manager: fileManagerTool,
  memory: memoryTool,
  exec: execTool,
} as const;

/**
 * Get enabled tools as a record for AI SDK
 */
export function getEnabledTools(enabledToolIds: string[]): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  for (const id of enabledToolIds) {
    if (id in builtinTools) {
      tools[id] = builtinTools[id as keyof typeof builtinTools];
    }
  }
  return tools;
}
