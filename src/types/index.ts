// Agent 消息类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;

  // 消息类型标记
  type?: 'thought' | 'response' | 'tool_call' | 'tool_result' | 'normal';

  // 工具相关字段
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  toolCallId?: string; // 关联工具调用和结果

  // 分组字段
  groupId?: string; // 同一轮对话的消息共享 groupId
  parentId?: string; // 父消息 ID（用于嵌套关系）

  // 元数据
  metadata?: {
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    plots?: string[];
    model?: string;
    tokens?: number;
    duration?: number;
    [key: string]: unknown;
  };
}

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// MCP 相关类型
export interface MCPServer {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'connecting';
  tools: MCPTool[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

// Tool 类型
export interface Tool {
  id: string;
  name: string;
  description: string;
  icon?: string;
  execute: (input: string, context: ToolContext) => Promise<ToolExecuteResult>;
}

export interface ToolContext {
  messages: Message[];
  python: {
    execute: (code: string) => Promise<PythonResult>;
  };
  mcp: {
    callTool: (serverId: string, toolName: string, args: object) => Promise<unknown>;
  };
}

// 工具执行结果（不带 toolCallId）
export interface ToolExecuteResult {
  content: string;
  metadata?: Record<string, unknown>;
}

// 向后兼容的别名
export type Skill = Tool;
export type SkillContext = ToolContext;
export type SkillResult = ToolExecuteResult;

// Python 执行结果
export interface PythonResult {
  output: string;
  error?: string;
  plots?: string[]; // base64 encoded images
}

// LLM 配置
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// LLM 消息格式（OpenAI 标准）
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

// 会话
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
