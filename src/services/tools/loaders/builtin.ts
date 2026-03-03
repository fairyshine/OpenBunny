// 内置工具加载器

import { BaseTool, IToolLoader, ITool } from '../base';
import { ToolContext, ToolExecuteResult } from '../../../types';
import { pythonExecutor } from '../../python/executor';
import { logFile, logPython } from '../../console/logger';
import { fileSystem } from '../../filesystem';
import { getErrorMessage } from '../../../utils/errors';
import i18n from '../../../i18n';

const t = i18n.t.bind(i18n);

/**
 * 内置工具加载器
 */
export class BuiltinToolLoader implements IToolLoader {
  readonly type = 'builtin';

  async load(_source: string): Promise<ITool[]> {
    return [
      new PythonTool(),
      new WebSearchTool(),
      new CalculatorTool(),
      new FileManagerTool(),
      new MemoryTool(),
    ];
  }
}

// Python 执行工具
class PythonTool extends BaseTool {
  constructor() {
    super({
      id: 'python',
      name: t('tools.python.name'),
      description: t('tools.python.description'),
      icon: 'python',
      parameters: [
        {
          name: 'code',
          type: 'string',
          description: t('tools.python.param.code'),
          required: true,
        }
      ],
    });
  }

  async execute(code: string, _context: ToolContext): Promise<ToolExecuteResult> {
    logPython('info', t('tools.exec.code', { length: code.length }), code.slice(0, 200));
    const result = await pythonExecutor.execute(code);
    if (result.error) {
      logPython('error', t('tools.exec.failed'), result.error);
    } else {
      logPython('success', t('tools.exec.completed'), result.output.slice(0, 200));
    }
    return {
      content: result.error
        ? `❌ Error:\n${result.error}`
        : `✅ Output:\n\`\`\`\n${result.output}\n\`\`\``,
      metadata: { plots: result.plots }
    };
  }
}

// 网页搜索工具 (Exa / Brave)
class WebSearchTool extends BaseTool {
  constructor() {
    super({
      id: 'web_search',
      name: t('tools.webSearch.name'),
      description: t('tools.webSearch.description'),
      icon: 'search',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: t('tools.webSearch.param.query'),
          required: true,
        }
      ],
    });
  }

  private getSearchConfig(): { provider: 'exa' | 'brave'; apiKey: string } {
    try {
      const raw = localStorage.getItem('webagent-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed?.state;
        const provider = state?.searchProvider || 'exa';
        const apiKey = provider === 'brave' ? (state?.braveApiKey || '') : (state?.exaApiKey || '');
        return { provider, apiKey };
      }
    } catch { /* ignore */ }
    return { provider: 'exa', apiKey: '' };
  }

  async execute(query: string, _context: ToolContext): Promise<ToolExecuteResult> {
    const { provider, apiKey } = this.getSearchConfig();
    if (!apiKey) {
      return {
        content: t('tools.exec.searchNoKey'),
        metadata: { error: true }
      };
    }

    try {
      const results = provider === 'brave'
        ? await this.searchBrave(query, apiKey)
        : await this.searchExa(query, apiKey);

      return {
        content: `${t('tools.exec.searchResults', { query })}${results.map((r, i) =>
          `${i + 1}. [${r.title}](${r.url})\n${r.snippet}\n`
        ).join('\n')}`,
        metadata: { results }
      };
    } catch (error) {
      return {
        content: t('tools.exec.searchFailed', { error: error instanceof Error ? error.message : String(error) }),
        metadata: { error: true }
      };
    }
  }

  private async searchExa(query: string, apiKey: string): Promise<Array<{title: string; url: string; snippet: string}>> {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: 5,
        contents: { text: { maxCharacters: 1000 } },
      }),
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Exa API ${response.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.text || '').slice(0, 200),
    }));
  }

  private async searchBrave(query: string, apiKey: string): Promise<Array<{title: string; url: string; snippet: string}>> {
    const params = new URLSearchParams({ q: query, count: '5' });
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Brave API ${response.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await response.json();
    return (data.web?.results || []).slice(0, 5).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: (r.description || '').slice(0, 200),
    }));
  }
}

// 计算器工具
class CalculatorTool extends BaseTool {
  constructor() {
    super({
      id: 'calculator',
      name: t('tools.calculator.name'),
      description: t('tools.calculator.description'),
      icon: 'calculator',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: t('tools.calculator.param.expression'),
          required: true,
        }
      ],
    });
  }

  async execute(expression: string, _context: ToolContext): Promise<ToolExecuteResult> {
    try {
      const code = `import math\nresult = ${expression}\nprint(f"Result: {result}")\nresult`;
      const pyResult = await pythonExecutor.execute(code);
      return {
        content: `🧮 ${expression} = ${pyResult.output.replace('Result: ', '')}`,
        metadata: { expression, result: pyResult.output }
      };
    } catch (error) {
      return {
        content: t('tools.exec.calcError', { error: error instanceof Error ? error.message : String(error) }),
        metadata: { error: true }
      };
    }
  }
}

// 文件管理工具
class FileManagerTool extends BaseTool {
  constructor() {
    super({
      id: 'file_manager',
      name: t('tools.fileManager.name'),
      description: t('tools.fileManager.description'),
      icon: 'folder',
      parameters: [
        {
          name: 'operation',
          type: 'string',
          description: t('tools.fileManager.param.operation'),
          required: true,
          enum: ['read', 'write', 'list', 'mkdir', 'delete'],
        },
        {
          name: 'path',
          type: 'string',
          description: t('tools.fileManager.param.path'),
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: t('tools.fileManager.param.content'),
          required: false,
        }
      ],
    });
  }

  async execute(input: string, _context: ToolContext): Promise<ToolExecuteResult> {
    try {
      const params = JSON.parse(input);
      const { operation, path, content } = params;

      if (!operation || !path) {
        return {
          content: t('tools.exec.paramError'),
          metadata: { error: true }
        };
      }

      await fileSystem.initialize();

      switch (operation) {
        case 'read':
          return await this.readFile(path);
        case 'write':
          if (!content && content !== '') {
            return {
              content: t('tools.exec.writeNeedsContent'),
              metadata: { error: true }
            };
          }
          return await this.writeFile(path, content);
        case 'list':
          return await this.listFiles(path);
        case 'mkdir':
          return await this.createFolder(path);
        case 'delete':
          return await this.deleteFile(path);
        default:
          return {
            content: t('tools.exec.unknownOp', { operation }),
            metadata: { error: true }
          };
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          content: t('tools.exec.jsonError', { error: error.message }),
          metadata: { error: true }
        };
      }
      const errorMsg = getErrorMessage(error);
      logFile('error', t('tools.exec.fileOpFailed'), errorMsg);
      return {
        content: t('tools.exec.opFailed', { error: errorMsg }),
        metadata: { error: true }
      };
    }
  }

  private async readFile(path: string): Promise<ToolExecuteResult> {
    const content = await fileSystem.readFileText(path);
    if (content === null) {
      logFile('warning', t('tools.exec.fileNotFound', { path }));
      return { content: t('tools.exec.fileNotFoundError', { path }), metadata: { error: true } };
    }
    logFile('success', t('tools.exec.readFile', { path }), { size: content.length });
    return {
      content: `📄 ${path}:\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\``,
      metadata: { operation: 'read', path, size: content.length }
    };
  }

  private async writeFile(path: string, content: string): Promise<ToolExecuteResult> {
    await fileSystem.writeFile(path, content);
    logFile('success', t('tools.exec.writeFile', { path }), { size: content.length });
    return {
      content: t('tools.exec.fileSaved', { path, length: content.length }),
      metadata: { operation: 'write', path, size: content.length }
    };
  }

  private async listFiles(path: string): Promise<ToolExecuteResult> {
    const targetPath = path.trim() || '/sandbox';
    const entries = await fileSystem.readdir(targetPath);

    if (entries.length === 0) {
      return {
        content: `📁 ${targetPath}\n${t('tools.exec.emptyFolder')}`,
        metadata: { operation: 'list', path: targetPath, count: 0 }
      };
    }

    const sorted = entries.sort((a: any, b: any) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    const lines = sorted.map((e: any) => {
      const icon = e.type === 'directory' ? '📂' : '📄';
      const size = e.type === 'file' ? ` (${this.formatSize(e.size)})` : '';
      return `${icon} ${e.name}${size}`;
    });

    logFile('info', t('tools.exec.listDir', { path: targetPath }), { count: entries.length });
    return {
      content: `📁 ${targetPath} (${t('tools.exec.dirItems', { count: entries.length })}):\n\n${lines.join('\n')}`,
      metadata: { operation: 'list', path: targetPath, count: entries.length, entries }
    };
  }

  private async createFolder(path: string): Promise<ToolExecuteResult> {
    await fileSystem.mkdir(path.trim());
    logFile('success', t('tools.exec.createFolder', { path }));
    return {
      content: t('tools.exec.folderCreated', { path }),
      metadata: { operation: 'mkdir', path }
    };
  }

  private async deleteFile(path: string): Promise<ToolExecuteResult> {
    const entry = await fileSystem.stat(path.trim());
    if (!entry) {
      return {
        content: t('tools.exec.notFound', { path }),
        metadata: { error: true }
      };
    }
    await fileSystem.rm(path, entry.type === 'directory');
    logFile('success', t('tools.exec.deleted', { path }), { type: entry.type });
    return {
      content: t('tools.exec.deletedOk', { path }),
      metadata: { operation: 'delete', path, type: entry.type }
    };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
