// 内置工具加载器

import { BaseTool, IToolLoader, ITool } from '../base';
import { ToolContext, ToolExecuteResult } from '../../../types';
import { pythonExecutor } from '../../python/executor';
import { mcpClient } from '../../mcp/client';
import { proxiedFetch } from '../../../utils/api';
import { logFile, logPython } from '../../console/logger';
import { fileSystem } from '../../filesystem';
import { getErrorMessage } from '../../../utils/errors';

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
      new MCPToolCallTool(),
    ];
  }
}

// Python 执行工具
class PythonTool extends BaseTool {
  constructor() {
    super({
      id: 'python',
      name: 'Python 代码执行',
      description: '执行 Python 代码并返回结果，支持数学计算、数据分析、绘图等',
      icon: '🐍',
      parameters: [
        {
          name: 'code',
          type: 'string',
          description: 'Python 代码字符串',
          required: true,
        }
      ],
    });
  }

  async execute(code: string, _context: ToolContext): Promise<ToolExecuteResult> {
    logPython('info', `执行代码 (${code.length} 字符)`, code.slice(0, 200));
    const result = await pythonExecutor.execute(code);
    if (result.error) {
      logPython('error', `执行失败`, result.error);
    } else {
      logPython('success', `执行完成`, result.output.slice(0, 200));
    }
    return {
      content: result.error
        ? `❌ 错误:\n${result.error}`
        : `✅ 输出:\n\`\`\`\n${result.output}\n\`\`\``,
      metadata: { plots: result.plots }
    };
  }
}

// 网页搜索工具
class WebSearchTool extends BaseTool {
  constructor() {
    super({
      id: 'web_search',
      name: '网页搜索',
      description: '使用 DuckDuckGo 搜索网络信息，获取实时资讯',
      icon: '🔍',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: '搜索关键词',
          required: true,
        }
      ],
    });
  }

  async execute(query: string, _context: ToolContext): Promise<ToolExecuteResult> {
    try {
      const response = await proxiedFetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Accept': 'text/html',
            'User-Agent': 'Mozilla/5.0 (compatible; CyberBunny/0.1)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractSearchResults(html);

      return {
        content: `🔍 搜索结果 "${query}":\n\n${results.map((r, i) =>
          `${i + 1}. [${r.title}](${r.url})\n${r.snippet}\n`
        ).join('\n')}`,
        metadata: { results }
      };
    } catch (error) {
      return {
        content: `❌ 搜索失败: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: true }
      };
    }
  }

  private extractSearchResults(html: string): Array<{title: string; url: string; snippet: string}> {
    const results: Array<{title: string; url: string; snippet: string}> = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      results.push({
        url: decodeURIComponent(match[1].replace(/^\/l\/\?kh=-?\d+&uddg=/, '')),
        title: this.stripHtml(match[2]),
        snippet: this.stripHtml(match[3])
      });
    }
    return results;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
  }
}

// 计算器工具
class CalculatorTool extends BaseTool {
  constructor() {
    super({
      id: 'calculator',
      name: '计算器',
      description: '执行数学计算表达式，支持 Python math 库',
      icon: '🧮',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: '数学表达式，如 2**10 或 math.sqrt(144)',
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
        content: `❌ 计算错误: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: true }
      };
    }
  }
}

// 文件管理工具（统一的文件操作）
class FileManagerTool extends BaseTool {
  constructor() {
    super({
      id: 'file_manager',
      name: '文件管理',
      description: '管理沙盒文件系统：读取、写入、列出、创建文件夹、删除文件',
      icon: '📁',
      parameters: [
        {
          name: 'operation',
          type: 'string',
          description: '操作类型：read（读取文件）、write（写入文件）、list（列出目录）、mkdir（创建文件夹）、delete（删除）',
          required: true,
          enum: ['read', 'write', 'list', 'mkdir', 'delete'],
        },
        {
          name: 'path',
          type: 'string',
          description: '文件或目录路径，如 /workspace/data.txt',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: '文件内容（仅 write 操作需要）',
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
          content: `❌ 参数错误：需要 operation 和 path 参数`,
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
              content: `❌ write 操作需要 content 参数`,
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
            content: `❌ 未知操作: ${operation}。支持的操作：read, write, list, mkdir, delete`,
            metadata: { error: true }
          };
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          content: `❌ JSON 解析错误：${error.message}`,
          metadata: { error: true }
        };
      }
      const errorMsg = getErrorMessage(error);
      logFile('error', '文件管理操作失败', errorMsg);
      return {
        content: `❌ 操作失败: ${errorMsg}`,
        metadata: { error: true }
      };
    }
  }

  private async readFile(path: string): Promise<ToolExecuteResult> {
    const content = await fileSystem.readFileText(path);
    if (content === null) {
      logFile('warning', `文件不存在: ${path}`);
      return { content: `❌ 文件不存在: ${path}`, metadata: { error: true } };
    }
    logFile('success', `读取文件: ${path}`, { size: content.length });
    return {
      content: `📄 ${path}:\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\``,
      metadata: { operation: 'read', path, size: content.length }
    };
  }

  private async writeFile(path: string, content: string): Promise<ToolExecuteResult> {
    await fileSystem.writeFile(path, content);
    logFile('success', `写入文件: ${path}`, { size: content.length });
    return {
      content: `✅ 文件已保存: ${path} (${content.length} 字符)`,
      metadata: { operation: 'write', path, size: content.length }
    };
  }

  private async listFiles(path: string): Promise<ToolExecuteResult> {
    const targetPath = path.trim() || '/workspace';
    const entries = await fileSystem.readdir(targetPath);

    if (entries.length === 0) {
      return {
        content: `📁 ${targetPath}\n(空文件夹)`,
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

    logFile('info', `列出目录: ${targetPath}`, { count: entries.length });
    return {
      content: `📁 ${targetPath} (${entries.length} 项):\n\n${lines.join('\n')}`,
      metadata: { operation: 'list', path: targetPath, count: entries.length, entries }
    };
  }

  private async createFolder(path: string): Promise<ToolExecuteResult> {
    await fileSystem.mkdir(path.trim());
    logFile('success', `创建文件夹: ${path}`);
    return {
      content: `✅ 文件夹已创建: ${path}`,
      metadata: { operation: 'mkdir', path }
    };
  }

  private async deleteFile(path: string): Promise<ToolExecuteResult> {
    const entry = await fileSystem.stat(path.trim());
    if (!entry) {
      return {
        content: `❌ 不存在: ${path}`,
        metadata: { error: true }
      };
    }
    await fileSystem.rm(path, entry.type === 'directory');
    logFile('success', `删除: ${path}`, { type: entry.type });
    return {
      content: `🗑️ 已删除: ${path}`,
      metadata: { operation: 'delete', path, type: entry.type }
    };
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// MCP 工具调用工具
class MCPToolCallTool extends BaseTool {
  constructor() {
    super({
      id: 'mcp_tool',
      name: 'MCP 工具调用',
      description: '调用已连接的 MCP 服务器工具',
      icon: '🔌',
      parameters: [
        {
          name: 'serverId',
          type: 'string',
          description: 'MCP 服务器 ID',
          required: true,
        },
        {
          name: 'toolName',
          type: 'string',
          description: '工具名称',
          required: true,
        },
        {
          name: 'args',
          type: 'object',
          description: '工具参数对象',
          required: true,
        }
      ],
    });
  }

  async execute(input: string, _context: ToolContext): Promise<ToolExecuteResult> {
    try {
      const params = JSON.parse(input);
      const result = await mcpClient.callTool(params.serverId, params.toolName, params.args);
      return {
        content: `🔌 MCP 工具调用结果:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
        metadata: { result }
      };
    } catch (error) {
      return { content: `❌ MCP 调用失败: ${error instanceof Error ? error.message : String(error)}`, metadata: { error: true } };
    }
  }
}
