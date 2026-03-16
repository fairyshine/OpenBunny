import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { pythonExecutor } from '../python/executor';
import { fileSystem } from '../filesystem';
import { cronManager } from '../cron';
import { heartbeatManager } from '../heartbeat';
import { logPython, logFile, logTool } from '../console/logger';
import type { LLMConfig } from '../../types';
import { runMindConversation, type MindToolContext } from './mind';
import { runChatConversation, type ChatToolContext } from './chat';
import { getErrorMessage } from '../../utils/errors';
import type { AgentRuntimeContext } from './runtimeContext';
import { snapshotScheduledTaskContext } from './scheduledTaskContext';
import i18n from '../../i18n';
import { getPlatformCapabilities, getPlatformContext } from '../../platform';

const t = () => i18n.t.bind(i18n);

export interface ToolExecutionContext {
  sourceSessionId: string;
  llmConfig: LLMConfig;
  enabledToolIds?: string[];
  sessionSkillIds?: string[];
  projectId?: string;
  currentAgentId?: string;
  runtimeContext?: Partial<AgentRuntimeContext>;
}

interface ToolRuntimeSettings {
  toolExecutionTimeout: number;
  execLoginShell: boolean;
  searchProvider: 'exa_free' | 'exa' | 'brave';
  exaApiKey: string;
  braveApiKey: string;
}

const DEFAULT_TOOL_RUNTIME_SETTINGS: ToolRuntimeSettings = {
  toolExecutionTimeout: 300000,
  execLoginShell: true,
  searchProvider: 'exa_free',
  exaApiKey: '',
  braveApiKey: '',
};

function resolveToolRuntimeSettings(context?: ToolExecutionContext): ToolRuntimeSettings {
  const runtime = context?.runtimeContext;
  return {
    toolExecutionTimeout: runtime?.toolExecutionTimeout ?? DEFAULT_TOOL_RUNTIME_SETTINGS.toolExecutionTimeout,
    execLoginShell: runtime?.execLoginShell ?? DEFAULT_TOOL_RUNTIME_SETTINGS.execLoginShell,
    searchProvider: runtime?.searchProvider ?? DEFAULT_TOOL_RUNTIME_SETTINGS.searchProvider,
    exaApiKey: runtime?.exaApiKey ?? DEFAULT_TOOL_RUNTIME_SETTINGS.exaApiKey,
    braveApiKey: runtime?.braveApiKey ?? DEFAULT_TOOL_RUNTIME_SETTINGS.braveApiKey,
  };
}

function getToolTimeout(context?: ToolExecutionContext): number {
  return resolveToolRuntimeSettings(context).toolExecutionTimeout || DEFAULT_TOOL_RUNTIME_SETTINGS.toolExecutionTimeout;
}

/**
 * Wrap a promise with timeout
 * @param timeoutMs - Timeout in milliseconds, -1 means no timeout (wait forever)
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  if (timeoutMs === -1) {
    return promise;
  }

  const validTimeout = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : 300000;

  if (validTimeout !== timeoutMs) {
    console.warn(`Invalid timeout value: ${timeoutMs}, using default: ${validTimeout}ms`);
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), validTimeout)
    ),
  ]);
}

function createPythonTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Execute Python code using Pyodide (WebAssembly). Supports pandas, numpy, matplotlib, etc.',
    inputSchema: z.object({
      code: z.string().describe('Python code to execute'),
    }),
    execute: async ({ code }) => {
      const timeout = getToolTimeout(context);
      logPython('info', t()('tools.exec.code', { length: code.length }), code.slice(0, 200));
      try {
        const result = await withTimeout(
          pythonExecutor.execute(code),
          timeout,
          `Python execution timed out after ${timeout}ms`
        );
        if (result.error) {
          logPython('error', t()('tools.exec.failed'), result.error);
          return `Error:\n${result.error}`;
        }
        logPython('success', t()('tools.exec.completed'), result.output.slice(0, 200));
        return `Output:\n\`\`\`\n${result.output}\n\`\`\``;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logPython('error', 'Python execution error', errorMsg);
        return `Error:\n${errorMsg}`;
      }
    },
  });
}

function createWebSearchTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Search the web for information using Exa or Brave search API.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => {
      const timeout = getToolTimeout(context);
      const { searchProvider: provider, exaApiKey, braveApiKey } = resolveToolRuntimeSettings(context);
      const apiKey = provider === 'brave' ? braveApiKey : exaApiKey;
      if (provider !== 'exa_free' && !apiKey) {
        return t()('tools.exec.searchNoKey');
      }

      try {
        let results: Array<{title: string; url: string; snippet: string}>;

        const searchPromise = (async () => {
          if (provider === 'exa_free') {
            const response = await fetch('https://mcp.exa.ai/mcp', {
              method: 'POST',
              headers: {
                'accept': 'application/json, text/event-stream',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                  name: 'web_search_exa',
                  arguments: {
                    query,
                    type: 'auto',
                    numResults: 8,
                    livecrawl: 'fallback',
                  },
                },
              }),
            });
            if (!response.ok) {
              const errBody = await response.text();
              throw new Error(`Exa MCP ${response.status}: ${errBody.slice(0, 200)}`);
            }
            const text = await response.text();
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                const content = data?.result?.content?.[0]?.text;
                if (content) {
                  return parseExaMcpResults(content);
                }
              }
            }
            try {
              const data = JSON.parse(text);
              const content = data?.result?.content?.[0]?.text;
              if (content) return parseExaMcpResults(content);
            } catch { }
            throw new Error('Failed to parse Exa MCP response');
          } else if (provider === 'brave') {
            const params = new URLSearchParams({ q: query, count: '5' });
            const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
              headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey,
              },
            });
            if (!response.ok) {
              const errBody = await response.text();
              throw new Error(`Brave ${response.status}: ${errBody.slice(0, 200)}`);
            }
            const data = await response.json();
            return (data?.web?.results || []).slice(0, 5).map((r: any) => ({
              title: r.title || r.url,
              url: r.url,
              snippet: r.description || '',
            }));
          } else {
            const response = await fetch('https://api.exa.ai/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
              },
              body: JSON.stringify({
                query,
                type: 'auto',
                numResults: 5,
                livecrawl: 'fallback',
              }),
            });
            if (!response.ok) {
              const errBody = await response.text();
              throw new Error(`Exa ${response.status}: ${errBody.slice(0, 200)}`);
            }
            const data = await response.json();
            return (data?.results || []).map((r: any) => ({
              title: r.title || r.url,
              url: r.url,
              snippet: r.text || r.snippet || '',
            }));
          }
        })();

        results = await withTimeout(
          searchPromise,
          timeout,
          `Search timed out after ${timeout}ms`
        );

        if (!results || results.length === 0) {
          return t()('tools.exec.searchResults', { query });
        }

        const formatted = results.map((r, index) =>
          `${index + 1}. ${r.title}\n${r.url}\n${r.snippet}`
        ).join('\n\n');

        return `${t()('tools.exec.searchResults', { query })}${formatted}`;
      } catch (error) {
        return t()('tools.exec.searchFailed', { error: getErrorMessage(error) });
      }
    },
  });
}

function parseExaMcpResults(text: string): Array<{title: string; url: string; snippet: string}> {
  const results: Array<{title: string; url: string; snippet: string}> = [];
  const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    const title = match[1];
    const url = match[2];
    const afterIdx = match.index + match[0].length;
    const nextMatch = linkRegex.exec(text);
    const endIdx = nextMatch ? nextMatch.index : text.length;
    linkRegex.lastIndex = nextMatch ? nextMatch.index : linkRegex.lastIndex;
    const snippet = text.slice(afterIdx, endIdx).replace(/\n/g, ' ').trim().slice(0, 200);
    results.push({ title, url, snippet });
  }
  if (results.length > 0) return results;
  return [{ title: 'Search Results', url: '', snippet: text.slice(0, 500) }];
}

function createFileManagerTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Manage files: read, write, list, mkdir, delete operations on the virtual file system. The root directory is /root.',
    inputSchema: z.object({
      operation: z.enum(['read', 'write', 'list', 'mkdir', 'delete']).describe('File operation to perform'),
      path: z.string().describe('File or directory path'),
      content: z.string().optional().describe('Content for write operation'),
    }),
    execute: async ({ operation, path, content }) => {
      const timeout = getToolTimeout(context);
      try {
        const normalizedPath = path.trim();
        if (normalizedPath.includes('/.memory') || normalizedPath === '/root/.memory') {
          return '[Error] Access to .memory directory is restricted';
        }

        const fileOperation = (async () => {
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
        })();

        return await withTimeout(
          fileOperation,
          timeout,
          `File operation timed out after ${timeout}ms`
        );
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
}

function createMemoryTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Read/write persistent memory and diary entries. Memory persists across sessions.',
    inputSchema: z.object({
      operation: z.enum(['read_memory', 'write_memory', 'read_diary', 'write_diary', 'list_diaries']).describe('Memory operation'),
      content: z.string().optional().describe('Content to write'),
      date: z.string().optional().describe('Date for diary (YYYY-MM-DD format)'),
      mode: z.enum(['append', 'overwrite']).optional().describe('Write mode'),
    }),
    execute: async ({ operation, content, date, mode }) => {
      const timeout = getToolTimeout(context);
      const MEMORY_DIR = '/root/.memory';
      const MEMORY_FILE = '/root/.memory/MEMORY.md';

      try {
        const memoryOperation = (async () => {
          await fileSystem.initialize();
          await fileSystem.mkdir(MEMORY_DIR);

          switch (operation) {
            case 'read_memory': {
              const memory = await fileSystem.readFileText(MEMORY_FILE);
              if (memory == null || memory.trim() === '') {
                return t()('tools.exec.noMemory');
              }
              return t()('tools.exec.memoryRead', { content: memory.slice(0, 5000) });
            }
            case 'write_memory': {
              if (!content) return t()('tools.exec.writeNeedsContent');
              const current = (await fileSystem.readFileText(MEMORY_FILE)) || '';
              const next = mode === 'overwrite' ? content : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${content}`;
              await fileSystem.writeFile(MEMORY_FILE, next);
              return t()('tools.exec.memoryUpdated');
            }
            case 'read_diary': {
              const targetDate = date || new Date().toISOString().slice(0, 10);
              const diaryPath = `${MEMORY_DIR}/${targetDate}.md`;
              const diary = await fileSystem.readFileText(diaryPath);
              if (diary == null || diary.trim() === '') {
                return t()('tools.exec.noDiary', { date: targetDate });
              }
              return t()('tools.exec.diaryRead', { date: targetDate, content: diary.slice(0, 5000) });
            }
            case 'write_diary': {
              if (!content) return t()('tools.exec.writeNeedsContent');
              const targetDate = date || new Date().toISOString().slice(0, 10);
              const diaryPath = `${MEMORY_DIR}/${targetDate}.md`;
              const current = (await fileSystem.readFileText(diaryPath)) || '';
              const next = mode === 'overwrite' ? content : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${content}`;
              await fileSystem.writeFile(diaryPath, next);
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
        })();

        return await withTimeout(
          memoryOperation,
          timeout,
          `Memory operation timed out after ${timeout}ms`
        );
      } catch (error) {
        if (error instanceof SyntaxError) {
          return t()('tools.exec.jsonError', { error: error.message });
        }
        return t()('tools.exec.memoryOpFailed', { error: getErrorMessage(error) });
      }
    },
  });
}

export function createMindTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Run an internal self-dialogue: a user-role model talks to the assistant until it emits [END_SESSION] plus a <SUMMARY> block. Returns the summary answer.',
    inputSchema: z.object({
      text: z.string().describe('Seed text for the internal dialogue'),
    }),
    execute: async ({ text }) => {
      if (!context) {
        return 'Error: mind tool requires runtime context.';
      }

      try {
        const result = await runMindConversation(text, context as MindToolContext);
        return result.summary || result.finalAssistantReply || '[mind] Session ended without a summary.';
      } catch (error) {
        const msg = getErrorMessage(error);
        logTool('error', 'Mind session failed', msg);
        return `Error:\n${msg}`;
      }
    },
  });
}

export function createChatTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Start an agent-to-agent conversation. Creates a read-only chat session for both agents and returns the final <SUMMARY> produced when the active side ends the dialogue.',
    inputSchema: z.object({
      agentName: z.string().describe('Target agent name'),
      text: z.string().describe('Initial conversation objective or opening message'),
    }),
    execute: async ({ agentName, text }) => {
      if (!context) {
        return 'Error: chat tool requires runtime context.';
      }

      try {
        const result = await runChatConversation(agentName, text, context as ChatToolContext);
        const finalReply = result.summary || result.finalTargetReply || '[chat] Session ended without a summary.';
        return [
          `Agent: ${result.targetAgentName}`,
          `Source Session: ${result.sourceSessionId}`,
          `Target Session: ${result.targetSessionId}`,
          '',
          finalReply,
        ].join('\n');
      } catch (error) {
        const msg = getErrorMessage(error);
        logTool('error', 'Chat session failed', msg);
        return `Error:\n${msg}`;
      }
    },
  });
}

function createExecTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Execute shell commands in a persistent session on supported desktop or terminal platforms. By default the shell session is bound to the current conversation session, so shell state persists across exec calls within the same chat.',
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
      sessionId: z.string().optional().describe('Optional shell session override. Defaults to the current conversation session ID.'),
    }),
    execute: async ({ command, sessionId }) => {
      const { toolExecutionTimeout: timeout, execLoginShell } = resolveToolRuntimeSettings(context);
      const effectiveSessionId = sessionId || context?.sourceSessionId;
      if (typeof window !== 'undefined' && (window as any).electronAPI?.exec) {
        try {
          const execPromise = (window as any).electronAPI.exec.execute(command, effectiveSessionId, execLoginShell, timeout);
          const result = await execPromise as any;
          if (result.error) {
            return `Error:\n${result.error}`;
          }
          return `Session: ${result.sessionId}\nExit Code: ${result.exitCode}\n\nOutput:\n\`\`\`\n${result.output}\n\`\`\``;
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      try {
        const platformContext = getPlatformContext();
        const capabilities = getPlatformCapabilities(platformContext.info);
        if (!capabilities.supportsExec || !platformContext.api.executeShell) {
          return 'Error: exec tool is not available on this platform';
        }

        const result = await platformContext.api.executeShell(command, {
          sessionId: effectiveSessionId,
          loginShell: execLoginShell,
          timeoutMs: timeout,
        });

        if (result.error) {
          return `Error:\n${result.error}`;
        }

        return `Session: ${result.sessionId}\nExit Code: ${result.exitCode}\n\nOutput:\n\`\`\`\n${result.output}\n\`\`\``;
      } catch {
        return 'Error: exec tool is only available on supported desktop or terminal platforms';
      }
    },
  });
}

function createCronTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Schedule periodic tasks using cron expressions. When a job fires, OpenBunny launches a background mind session to execute the task. Supports add, remove, list, and clear operations.',
    inputSchema: z.object({
      operation: z.enum(['add', 'remove', 'list', 'clear']).describe('Cron operation to perform'),
      expression: z.string().optional().describe('Cron expression for scheduling (e.g. "*/5 * * * *" for every 5 minutes, "0 9 * * *" for daily at 9am). Required for add operation.'),
      description: z.string().optional().describe('Human-readable description of what this task does. Required for add operation.'),
      id: z.string().optional().describe('Job ID for remove operation'),
    }),
    execute: async ({ operation, expression, description, id }) => {
      try {
        switch (operation) {
          case 'add': {
            if (!expression) return t()('tools.exec.cronNeedExpression');
            if (!description) return t()('tools.exec.cronNeedDescription');
            const job = await cronManager.add(expression, description, snapshotScheduledTaskContext(context));
            logTool('success', t()('tools.exec.cronAdded', { description, expression }));
            const nextStr = job.nextRun ? new Date(job.nextRun).toLocaleString() : '-';
            return t()('tools.exec.cronAddedResult', { id: job.id, expression, description, nextRun: nextStr });
          }
          case 'remove': {
            if (!id) return t()('tools.exec.cronNeedId');
            const removed = await cronManager.remove(id);
            if (!removed) return t()('tools.exec.cronNotFound', { id });
            logTool('success', t()('tools.exec.cronRemoved', { id }));
            return t()('tools.exec.cronRemovedResult', { id });
          }
          case 'list': {
            const jobs = await cronManager.list();
            if (jobs.length === 0) return t()('tools.exec.cronEmpty');
            const lines = jobs.map((j) => {
              const next = j.nextRun ? new Date(j.nextRun).toLocaleString() : '-';
              const last = j.lastRun ? new Date(j.lastRun).toLocaleString() : '-';
              return `- **${j.description}**\n  ID: \`${j.id}\`\n  Schedule: \`${j.expression}\` | Runs: ${j.runCount} | Next: ${next} | Last: ${last}`;
            });
            return t()('tools.exec.cronListResult', { count: jobs.length, list: lines.join('\n\n') });
          }
          case 'clear': {
            await cronManager.clear();
            logTool('success', t()('tools.exec.cronCleared'));
            return t()('tools.exec.cronClearedResult');
          }
        }
      } catch (error) {
        const msg = getErrorMessage(error);
        logTool('error', t()('tools.exec.cronFailed'), msg);
        return t()('tools.exec.cronFailedResult', { error: msg });
      }
    },
  });
}

function createHeartbeatTool(context?: ToolExecutionContext) {
  return tool({
    description: 'Manage a heartbeat watchlist. On each tick, OpenBunny launches a background mind session to review the tracked items. Add/remove/list text items, and set a periodic interval (30/60/120 minutes) to process all items.',
    inputSchema: z.object({
      operation: z.enum(['add', 'remove', 'list', 'clear', 'set_interval', 'status']).describe('Heartbeat operation'),
      text: z.string().optional().describe('Text content for add operation'),
      id: z.string().optional().describe('Item ID for remove operation'),
      interval: z.number().optional().describe('Interval in minutes (30, 60, or 120) for set_interval operation'),
    }),
    execute: async ({ operation, text, id, interval }) => {
      try {
        switch (operation) {
          case 'add': {
            if (!text) return t()('tools.exec.heartbeatNeedText');
            const item = heartbeatManager.add(text, snapshotScheduledTaskContext(context));
            logTool('success', t()('tools.exec.heartbeatAdded', { text }));
            return t()('tools.exec.heartbeatAddedResult', { id: item.id, text });
          }
          case 'remove': {
            if (!id) return t()('tools.exec.heartbeatNeedId');
            const removed = heartbeatManager.remove(id);
            if (!removed) return t()('tools.exec.heartbeatNotFound', { id });
            logTool('success', t()('tools.exec.heartbeatRemoved', { id }));
            return t()('tools.exec.heartbeatRemovedResult', { id });
          }
          case 'list': {
            const items = heartbeatManager.list();
            if (items.length === 0) return t()('tools.exec.heartbeatEmpty');
            const lines = items.map(i =>
              `- **${i.text}**\n  ID: \`${i.id}\` | Created: ${new Date(i.createdAt).toLocaleString()}`
            );
            return t()('tools.exec.heartbeatListResult', { count: items.length, list: lines.join('\n\n') });
          }
          case 'clear': {
            heartbeatManager.clear();
            logTool('success', t()('tools.exec.heartbeatCleared'));
            return t()('tools.exec.heartbeatClearedResult');
          }
          case 'set_interval': {
            if (!interval || ![30, 60, 120].includes(interval)) {
              return t()('tools.exec.heartbeatInvalidInterval');
            }
            heartbeatManager.setInterval(interval as 30 | 60 | 120);
            logTool('success', t()('tools.exec.heartbeatIntervalSet', { interval }));
            return t()('tools.exec.heartbeatIntervalSetResult', { interval });
          }
          case 'status': {
            const items = heartbeatManager.list();
            const iv = heartbeatManager.getInterval();
            const lastTick = heartbeatManager.getLastTick();
            const nextTick = heartbeatManager.getNextTick();
            return t()('tools.exec.heartbeatStatus', {
              count: items.length,
              interval: iv,
              lastTick: lastTick ? new Date(lastTick).toLocaleString() : '-',
              nextTick: nextTick ? new Date(nextTick).toLocaleString() : '-',
            });
          }
        }
      } catch (error) {
        const msg = getErrorMessage(error);
        logTool('error', t()('tools.exec.heartbeatFailed'), msg);
        return t()('tools.exec.heartbeatFailedResult', { error: msg });
      }
    },
  });
}

const builtinToolFactories = {
  python: createPythonTool,
  web_search: createWebSearchTool,
  file_manager: createFileManagerTool,
  memory: createMemoryTool,
  mind: createMindTool,
  chat: createChatTool,
  exec: createExecTool,
  cron: createCronTool,
  heartbeat: createHeartbeatTool,
} as const;

export const builtinTools = {
  python: createPythonTool(),
  web_search: createWebSearchTool(),
  file_manager: createFileManagerTool(),
  memory: createMemoryTool(),
  mind: createMindTool(),
  chat: createChatTool(),
  exec: createExecTool(),
  cron: createCronTool(),
  heartbeat: createHeartbeatTool(),
} as const;

export function getEnabledTools(enabledToolIds: string[], context?: ToolExecutionContext): Record<string, Tool> {
  const tools: Record<string, Tool> = {};
  for (const id of enabledToolIds) {
    if (id in builtinToolFactories) {
      const createTool = builtinToolFactories[id as keyof typeof builtinToolFactories] as (ctx?: ToolExecutionContext) => Tool;
      tools[id] = createTool(context);
    }
  }
  return tools;
}
