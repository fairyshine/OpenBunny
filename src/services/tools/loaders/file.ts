// 文件工具加载器
// 支持动态导入 .ts 文件中定义的工具

import { IToolLoader, ITool } from '../base';

/**
 * 文件工具加载器
 * 动态导入 TypeScript 文件中定义的工具
 */
export class FileToolLoader implements IToolLoader {
  readonly type = 'file';

  async load(source: string): Promise<ITool[]> {
    try {
      // 动态导入模块
      // source 应该是相对于项目根目录的路径，如 '/tools/my-tool.ts'
      const module = await import(/* @vite-ignore */ source);

      // 支持多种导出方式
      const tools: ITool[] = [];

      // 1. 默认导出单个工具
      if (module.default && this.isValidTool(module.default)) {
        tools.push(module.default);
      }

      // 2. 命名导出 tools 数组
      if (Array.isArray(module.tools)) {
        tools.push(...module.tools.filter((t: unknown) => this.isValidTool(t)));
      }

      // 3. 导出所有符合 ITool 接口的对象
      for (const key of Object.keys(module)) {
        if (key !== 'default' && key !== 'tools') {
          const exported = module[key] as unknown;
          if (this.isValidTool(exported)) {
            tools.push(exported);
          }
        }
      }

      if (tools.length === 0) {
        throw new Error(`No valid tools found in ${source}`);
      }

      // 调用工具的 onLoad 钩子
      await Promise.all(tools.map(tool => tool.onLoad?.()));

      return tools;
    } catch (error) {
      throw new Error(
        `Failed to load tool from ${source}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async unload(toolId: string): Promise<void> {
    // 文件工具卸载时调用 onUnload 钩子
    console.log(`Unloading file tool: ${toolId}`);
  }

  private isValidTool(obj: unknown): obj is ITool {
    if (!obj || typeof obj !== 'object') return false;

    const tool = obj as Partial<ITool>;
    return (
      typeof tool.metadata === 'object' &&
      tool.metadata !== null &&
      typeof tool.metadata.id === 'string' &&
      typeof tool.metadata.name === 'string' &&
      typeof tool.execute === 'function'
    );
  }
}

/**
 * HTTP 工具加载器
 * 从远程 URL 加载工具定义
 */
export class HttpToolLoader implements IToolLoader {
  readonly type = 'http';

  async load(source: string): Promise<ITool[]> {
    try {
      // 从 URL 获取工具定义
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');

      // 支持 JSON 格式的工具定义
      if (contentType?.includes('application/json')) {
        const toolDef = await response.json();
        return this.parseToolDefinition(toolDef);
      }

      // 支持 JavaScript 模块
      if (contentType?.includes('javascript') || contentType?.includes('text/plain')) {
        const code = await response.text();
        return this.loadFromCode(code, source);
      }

      throw new Error(`Unsupported content type: ${contentType}`);
    } catch (error) {
      throw new Error(
        `Failed to load tool from ${source}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseToolDefinition(def: unknown): ITool[] {
    // 解析 JSON 格式的工具定义
    // 这里可以定义一个标准的 JSON schema
    if (!def || typeof def !== 'object') {
      throw new Error('Invalid tool definition');
    }

    // 简单实现：假设是工具数组或单个工具
    const tools = Array.isArray(def) ? def : [def];

    return tools.map(t => this.createToolFromDefinition(t));
  }

  private createToolFromDefinition(_def: unknown): ITool {
    // 从 JSON 定义创建工具实例
    // 这里需要实现一个通用的工具包装器
    throw new Error('JSON tool definition not yet implemented');
  }

  private async loadFromCode(code: string, source: string): Promise<ITool[]> {
    // 从 JavaScript 代码创建模块
    // 注意：这在浏览器中有安全限制
    try {
      // 创建 blob URL
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);

      try {
        const module = await import(/* @vite-ignore */ url);

        const tools: ITool[] = [];
        if (module.default) tools.push(module.default);
        if (Array.isArray(module.tools)) tools.push(...module.tools);

        return tools;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      throw new Error(
        `Failed to execute tool code from ${source}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * 代码工具加载器
 * 直接从用户输入的 JavaScript 代码加载工具
 * 代码通过 Blob URL 动态执行
 */
export class CodeToolLoader implements IToolLoader {
  readonly type = 'code';

  async load(source: string): Promise<ITool[]> {
    if (!source) {
      throw new Error('No code provided');
    }

    try {
      const blob = new Blob([source], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);

      try {
        const module = await import(/* @vite-ignore */ url);

        const tools: ITool[] = [];

        if (module.default && this.isValidTool(module.default)) {
          tools.push(module.default);
        }

        if (Array.isArray(module.tools)) {
          tools.push(...module.tools.filter((t: unknown) => this.isValidTool(t)));
        }

        for (const key of Object.keys(module)) {
          if (key !== 'default' && key !== 'tools') {
            const exported = module[key] as unknown;
            if (this.isValidTool(exported)) {
              tools.push(exported);
            }
          }
        }

        if (tools.length === 0) {
          throw new Error('No valid tools found in code');
        }

        await Promise.all(tools.map(tool => tool.onLoad?.()));

        return tools;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      throw new Error(
        `Failed to load tool from code: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private isValidTool(obj: unknown): obj is ITool {
    if (!obj || typeof obj !== 'object') return false;

    const tool = obj as Partial<ITool>;
    return (
      typeof tool.metadata === 'object' &&
      tool.metadata !== null &&
      typeof tool.metadata.id === 'string' &&
      typeof tool.metadata.name === 'string' &&
      typeof tool.execute === 'function'
    );
  }
}
