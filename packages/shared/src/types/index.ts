// 用户身份信息
export interface UserProfile {
  nickname: string;
  bio: string;
  avatar: string; // emoji or URL
  email: string;
  location: string;
}

// Agent 身份配置
export interface AgentProfile {
  id: string;
  name: string;
  avatar: string; // emoji
  description: string;
  systemPrompt: string;
  isActive: boolean;
  createdAt: number;
}

// Agent 消息类型 (UI layer)
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
  toolCallId?: string;

  // 分组字段
  groupId?: string;
  parentId?: string;

  // 元数据
  metadata?: {
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    plots?: string[];
    model?: string;
    tokens?: number;
    duration?: number;
    streaming?: boolean;
    toolDescription?: string;
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

// Python 执行结果
export interface PythonResult {
  output: string;
  error?: string;
  plots?: string[]; // base64 encoded images
}

// LLM 配置
export interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// 会话类型
export type SessionType = 'user' | 'agent' | 'mind';

// 会话
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  isStreaming?: boolean; // 是否正在进行对话
  systemPrompt?: string; // 系统提示词
  sessionType?: SessionType; // 会话类型：user=用户对话, agent=外部Agent对话(只读), mind=Agent内心计划
}
