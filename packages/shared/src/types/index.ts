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

// LLM 配置预设
export interface LLMPreset extends LLMConfig {
  id: string;
  name: string;
  createdAt: number;
}

// 智能体分组
export interface AgentGroup {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

// 智能体关系
export interface AgentRelationship {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  label?: string; // 关系标签，如 "协作"、"依赖" 等
  createdAt: number;
}

// 智能体（独立工作空间）
export interface Agent {
  id: string;
  name: string;
  avatar: string; // emoji
  description: string;
  systemPrompt: string;
  color: string;
  isDefault?: boolean; // 默认智能体，不可删除
  // 独立配置
  llmConfig: LLMConfig;
  enabledTools: string[];
  enabledSkills: string[];
  // 文件系统根目录（沙盒隔离）
  filesRoot: string; // e.g. /root/.agents/<id>/files
  // 关系图位置（用于持久化节点位置）
  graphPosition?: { x: number; y: number };
  // 所属分组
  groupId?: string;
  createdAt: number;
  updatedAt: number;
}

// 会话类型
export type SessionType = 'user' | 'agent' | 'mind';

// 项目分组
export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string; // 项目颜色标识
  icon?: string; // lucide icon name (e.g. 'folder-open', 'rocket')
  agentId?: string; // 所属智能体ID（undefined表示属于默认智能体/全局）
  createdAt: number;
  updatedAt: number;
}

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
  projectId?: string; // 所属项目ID
  /** 会话级工具配置（首次发消息时快照，之后锁定） */
  sessionTools?: string[];
  /** 会话级技能配置（首次发消息时快照，之后锁定） */
  sessionSkills?: string[];
}
