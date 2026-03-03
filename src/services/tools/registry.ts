// 新的工具注册表
// 支持多种工具加载方式

import { ITool, IToolLoader, ToolSource } from './base';
import { ToolContext, ToolExecuteResult } from '../../types';
import { pythonExecutor } from '../python/executor';
import { mcpClient } from '../mcp/client';
import { logTool, logSystem } from '../console/logger';
import {
  BuiltinToolLoader,
  FileToolLoader,
  HttpToolLoader,
  MCPToolLoader,
  CodeToolLoader,
} from './loaders';

/**
 * 工具注册表
 * 管理所有工具的加载、卸载和执行
 */
export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();
  private sources: Map<string, ToolSource> = new Map();
  private loaders: Map<string, IToolLoader> = new Map();

  constructor() {
    // 注册内置加载器
    this.registerLoader(new BuiltinToolLoader());
    this.registerLoader(new FileToolLoader());
    this.registerLoader(new HttpToolLoader());
    this.registerLoader(new MCPToolLoader());
    this.registerLoader(new CodeToolLoader());

    // 自动加载内置工具
    this.loadBuiltinTools();
  }

  /**
   * 注册工具加载器
   */
  registerLoader(loader: IToolLoader): void {
    this.loaders.set(loader.type, loader);
  }

  /**
   * 加载工具源
   */
  async loadSource(source: ToolSource): Promise<void> {
    const loader = this.loaders.get(source.type);
    if (!loader) {
      throw new Error(`No loader found for type: ${source.type}`);
    }

    try {
      // code 类型的源，代码存在 metadata.code 中
      const loadTarget = source.type === 'code' && source.metadata?.code
        ? source.metadata.code as string
        : source.source;
      const tools = await loader.load(loadTarget);

      // 注册所有工具
      for (const tool of tools) {
        this.tools.set(tool.metadata.id, tool);
      }

      // 保存源配置
      this.sources.set(source.id, { ...source, enabled: true });

      logSystem('success', `加载 ${tools.length} 个工具 (${source.name})`, tools.map(t => t.metadata.id));
    } catch (error) {
      logSystem('error', `加载工具源失败: ${source.name}`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * 卸载工具源
   */
  async unloadSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const loader = this.loaders.get(source.type);

    // 找到并卸载该源的所有工具
    const toolsToRemove: string[] = [];
    for (const [toolId, tool] of this.tools.entries()) {
      // 检查工具是否属于该源
      if (this.isToolFromSource(tool, source)) {
        toolsToRemove.push(toolId);

        // 调用工具的卸载钩子
        await tool.onUnload?.();

        // 调用加载器的卸载方法
        await loader?.unload?.(toolId);
      }
    }

    // 从注册表中移除
    toolsToRemove.forEach(id => this.tools.delete(id));
    this.sources.delete(sourceId);

    logSystem('info', `卸载 ${toolsToRemove.length} 个工具 (${source.name})`);
  }

  /**
   * 注册单个工具
   */
  register(tool: ITool): void {
    this.tools.set(tool.metadata.id, tool);
  }

  /**
   * 注销单个工具
   */
  async unregister(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (tool) {
      await tool.onUnload?.();
      this.tools.delete(toolId);
    }
  }

  /**
   * 获取工具
   */
  get(toolId: string): ITool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 获取所有工具
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具源
   */
  getAllSources(): ToolSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * 执行工具
   */
  async execute(toolId: string, input: string): Promise<ToolExecuteResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    // 验证输入
    if (tool.validate) {
      const isValid = await tool.validate(input);
      if (!isValid) {
        throw new Error(`Invalid input for tool: ${toolId}`);
      }
    }

    // 构建上下文
    const context: ToolContext = {
      messages: [],
      python: {
        execute: (code: string) => pythonExecutor.execute(code)
      },
      mcp: {
        callTool: (serverId: string, toolName: string, args: object) =>
          mcpClient.callTool(serverId, toolName, args)
      }
    };

    // 执行工具
    logTool('info', `执行工具: ${toolId}`, { input: input.slice(0, 200) });
    const result = await tool.execute(input, context);
    logTool('success', `工具 ${toolId} 完成`, { output: result.content.slice(0, 200) });
    return result;
  }

  /**
   * 自动加载内置工具
   */
  private async loadBuiltinTools(): Promise<void> {
    const builtinSource: ToolSource = {
      id: 'builtin',
      type: 'builtin',
      name: '内置工具',
      source: '',
      enabled: true,
    };

    try {
      await this.loadSource(builtinSource);
    } catch (error) {
      console.error('Failed to load builtin tools:', error);
    }
  }

  /**
   * 获取属于指定源的所有工具
   */
  getToolsBySource(source: ToolSource): ITool[] {
    return this.getAll().filter(tool => this.isToolFromSource(tool, source));
  }

  /**
   * 检查工具是否属于指定源
   */
  private isToolFromSource(tool: ITool, source: ToolSource): boolean {
    // 根据工具 ID 或标签判断
    if (source.type === 'builtin') {
      return !tool.metadata.id.startsWith('mcp_') &&
             !tool.metadata.tags?.includes('file') &&
             !tool.metadata.tags?.includes('http') &&
             !tool.metadata.tags?.includes('code');
    }

    if (source.type === 'mcp') {
      return tool.metadata.id.startsWith(`mcp_${source.id}_`) ||
             (tool.metadata.tags?.includes(source.id) ?? false);
    }

    if (source.type === 'file' || source.type === 'http' || source.type === 'code') {
      return tool.metadata.tags?.includes(source.id) ?? false;
    }

    return false;
  }
}

// 单例导出
export const toolRegistry = new ToolRegistry();

// 向后兼容
export const skillRegistry = toolRegistry;

// 导出类型
export * from './base';
