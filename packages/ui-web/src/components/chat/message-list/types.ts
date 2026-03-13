import type { Agent, Message, MessageFileAttachment, MessageSkillResource, Session } from '@openbunny/shared/types';

export interface BubbleAppearance {
  align: 'left' | 'right';
  avatar: string;
  accent: 'self' | 'other';
}

export type MessageFile = MessageFileAttachment;

export type SkillResource = MessageSkillResource;

export interface MessageRenderContext {
  session?: Session;
  index: number;
  agents: Agent[];
  currentAgentId: string;
  userAvatar: string;
  skillDescriptions: Record<string, string>;
}

interface StandardizedMessageBase {
  id: string;
  timestamp: number;
  appearance: BubbleAppearance;
}

export interface SystemRenderMessage extends StandardizedMessageBase {
  kind: 'system';
  content: string;
}

export interface SelfRenderMessage extends StandardizedMessageBase {
  kind: 'self';
  content: string;
}

export interface ResponseRenderMessage extends StandardizedMessageBase {
  kind: 'response';
  content: string;
  plots: string[];
}

export interface ProcessRenderMessage extends StandardizedMessageBase {
  kind: 'process';
  content: string;
  toolInput?: string;
  toolName?: string;
  toolDescription?: string;
  isToolCall: boolean;
  isStreaming: boolean;
}

export interface ToolResultRenderMessage extends StandardizedMessageBase {
  kind: 'tool_result';
  content: string;
  previewText: string;
  toolName?: string;
  isError: boolean;
  isStreaming: boolean;
  imageFiles: MessageFile[];
}

export interface SkillActivationRenderMessage extends StandardizedMessageBase {
  kind: 'skill_activation';
  skillName: string;
  resourcePath?: string;
  skillDescription: string;
  isStreaming: boolean;
}

export interface SkillResultErrorRenderMessage extends StandardizedMessageBase {
  kind: 'skill_result_error';
  content: string;
}

export interface SkillResourceResultRenderMessage extends StandardizedMessageBase {
  kind: 'skill_resource_result';
  skillName: string;
  resourcePath: string;
  fileContent: string;
  resourceFormat: 'image' | 'markdown' | 'text';
  imageFiles: MessageFile[];
}

export interface SkillActivationResultRenderMessage extends StandardizedMessageBase {
  kind: 'skill_activation_result';
  skillName: string;
  skillBody: string;
  resources: SkillResource[];
}

export type StandardizedMessage =
  | SystemRenderMessage
  | SelfRenderMessage
  | ResponseRenderMessage
  | ProcessRenderMessage
  | ToolResultRenderMessage
  | SkillActivationRenderMessage
  | SkillResultErrorRenderMessage
  | SkillResourceResultRenderMessage
  | SkillActivationResultRenderMessage;

export interface MessageListItemData {
  message: Message;
  standardized: StandardizedMessage;
}
