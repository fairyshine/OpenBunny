import type { Message } from '@openbunny/shared/types';
import { deriveMessagePresentation } from '@openbunny/shared/utils/messagePresentation';
import { getBubbleAppearance } from './appearance';
import type {
  MessageRenderContext,
  ProcessRenderMessage,
  ResponseRenderMessage,
  SelfRenderMessage,
  SkillActivationRenderMessage,
  SkillActivationResultRenderMessage,
  SkillResourceResultRenderMessage,
  StandardizedMessage,
  SystemRenderMessage,
  ToolResultRenderMessage,
} from './types';

export function normalizeMessageForRender(message: Message, context: MessageRenderContext): StandardizedMessage {
  const appearance = getBubbleAppearance(
    message,
    context.session,
    context.currentAgentId,
    context.agents,
    context.userAvatar,
    context.index,
  );
  const presentation = deriveMessagePresentation(message);
  const timestamp = message.timestamp;
  const content = message.content || '';

  if (presentation.kind === 'system') {
    const standardized: SystemRenderMessage = {
      kind: 'system',
      id: message.id,
      timestamp,
      appearance,
      content,
    };
    return standardized;
  }

  if (presentation.kind === 'skill_activation') {
    const standardized: SkillActivationRenderMessage = {
      kind: 'skill_activation',
      id: message.id,
      timestamp,
      appearance,
      skillName: presentation.skillName,
      resourcePath: presentation.resourcePath,
      skillDescription: presentation.skillDescription || context.skillDescriptions[presentation.skillName] || '',
      isStreaming: presentation.isStreaming,
    };
    return standardized;
  }

  if (presentation.kind === 'skill_result_error') {
    return {
      kind: 'skill_result_error',
      id: message.id,
      timestamp,
      appearance,
      content: presentation.content,
    };
  }

  if (presentation.kind === 'skill_resource_result') {
    const standardized: SkillResourceResultRenderMessage = {
      kind: 'skill_resource_result',
      id: message.id,
      timestamp,
      appearance,
      skillName: presentation.skillName,
      resourcePath: presentation.resourcePath,
      fileContent: presentation.fileContent,
      resourceFormat: presentation.resourceFormat,
      imageFiles: presentation.files,
    };
    return standardized;
  }

  if (presentation.kind === 'skill_activation_result') {
    const standardized: SkillActivationResultRenderMessage = {
      kind: 'skill_activation_result',
      id: message.id,
      timestamp,
      appearance,
      skillName: presentation.skillName,
      skillBody: presentation.skillBody,
      resources: presentation.resources,
    };
    return standardized;
  }

  if (presentation.kind === 'process') {
    const standardized: ProcessRenderMessage = {
      kind: 'process',
      id: message.id,
      timestamp,
      appearance,
      content,
      toolInput: presentation.toolInput,
      toolName: presentation.toolName,
      toolDescription: presentation.toolDescription,
      isToolCall: presentation.stage === 'tool_call',
      isStreaming: presentation.isStreaming,
    };
    return standardized;
  }

  if (presentation.kind === 'tool_result') {
    const standardized: ToolResultRenderMessage = {
      kind: 'tool_result',
      id: message.id,
      timestamp,
      appearance,
      content: presentation.content,
      previewText: presentation.previewText,
      toolName: presentation.toolName,
      isError: presentation.isError,
      isStreaming: presentation.isStreaming,
      imageFiles: presentation.files,
    };
    return standardized;
  }

  if (appearance.align === 'right') {
    const standardized: SelfRenderMessage = {
      kind: 'self',
      id: message.id,
      timestamp,
      appearance,
      content,
    };
    return standardized;
  }

  const standardized: ResponseRenderMessage = {
    kind: 'response',
    id: message.id,
    timestamp,
    appearance,
    content,
    plots: presentation.plots,
  };
  return standardized;
}
