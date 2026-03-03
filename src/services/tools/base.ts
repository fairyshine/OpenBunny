// 工具基础类型和接口定义

import { ToolContext, ToolExecuteResult } from '../../types';

/**
 * 工具参数定义
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  properties?: Record<string, ToolParameter>; // For object type
  items?: ToolParameter; // For array type
}

/**
 * 工具元数据
 */
export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  parameters?: ToolParameter[]; // 工具参数定义
  icon?: string;
  version?: string;
  author?: string;
  tags?: string[];
}

/**
 * 工具接口
 */
export interface ITool {
  readonly metadata: ToolMetadata;
  execute(input: string, context: ToolContext): Promise<ToolExecuteResult>;
  validate?(input: string): Promise<boolean>;
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
}

/**
 * 工具基类
 */
export abstract class BaseTool implements ITool {
  constructor(public readonly metadata: ToolMetadata) {}

  abstract execute(input: string, context: ToolContext): Promise<ToolExecuteResult>;

  async validate(_input: string): Promise<boolean> {
    return true;
  }

  async onLoad(): Promise<void> {
    // 默认空实现
  }

  async onUnload(): Promise<void> {
    // 默认空实现
  }
}

/**
 * 工具加载器接口
 */
export interface IToolLoader {
  readonly type: string;
  load(source: string): Promise<ITool[]>;
  unload?(toolId: string): Promise<void>;
}

/**
 * 工具源配置
 */
export interface ToolSource {
  id: string;
  type: 'builtin' | 'mcp' | 'file' | 'http';
  name: string;
  source: string; // URL, file path, etc.
  enabled: boolean;
  metadata?: Record<string, unknown>;
}
