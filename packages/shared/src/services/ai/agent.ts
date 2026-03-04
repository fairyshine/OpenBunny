/**
 * Agent Loop — uses AI SDK streamText with stopWhen for automatic tool calling
 */

import { streamText, stepCountIs, type ToolSet } from 'ai';
import { createModel } from './provider';
import { getEnabledTools } from './tools';
import { generateSkillsSystemPrompt } from './skills';
import { logLLM, logTool } from '../console/logger';
import type { Message, LLMConfig } from '../../types';
import type { TFunction } from 'i18next';

/**
 * Agent callbacks — decouple UI layer
 */
export interface AgentCallbacks {
  addMessage(sessionId: string, msg: Message): void;
  updateMessage(sessionId: string, msgId: string, updates: Partial<Message>): void;
  setStatus(status: string): void;
  generateId(): string;
}

/**
 * Run the agent loop using AI SDK streamText + stopWhen
 */
export async function runAgentLoop(
  userInput: string,
  sessionId: string,
  llmConfig: LLMConfig,
  enabledTools: string[],
  callbacks: AgentCallbacks,
  t: TFunction
): Promise<void> {
  if (!llmConfig.apiKey) {
    callbacks.addMessage(sessionId, {
      id: callbacks.generateId(),
      role: 'assistant',
      content: t('chat.configRequired'),
      timestamp: Date.now(),
    });
    return;
  }

  const groupId = callbacks.generateId();
  const model = createModel(llmConfig);
  const tools = getEnabledTools(enabledTools);

  const toolCount = Object.keys(tools).length;
  logTool('info', `${toolCount} tools enabled`, {
    provider: llmConfig.provider,
    tools: Object.keys(tools).join(', '),
  });

  // Build system prompt
  const systemPromptBase = t('systemPrompt.assistant');
  let systemPrompt = systemPromptBase;

  if (toolCount > 0) {
    const toolDescriptions = Object.entries(tools).map(([name, tool]) => {
      return `### ${name}\n${(tool as any).description}`;
    }).join('\n\n');
    systemPrompt = t('systemPrompt.withTools', { toolDescriptions });
  }

  systemPrompt += generateSkillsSystemPrompt();

  // Create a message to show streaming text
  const responseMessageId = callbacks.generateId();
  callbacks.addMessage(sessionId, {
    id: responseMessageId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    type: 'thought',
    groupId,
  });

  let stepCount = 0;

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userInput }],
      tools: tools as ToolSet,
      stopWhen: stepCountIs(10),
      temperature: llmConfig.temperature ?? 0.7,
      maxOutputTokens: llmConfig.maxTokens ?? 4096,
      onStepFinish: ({ toolCalls, toolResults }) => {
        stepCount++;
        logLLM('info', `Agent loop - step ${stepCount}`);

        if (toolCalls && toolCalls.length > 0 && toolResults) {
          // Show tool calls in UI
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            const tr = toolResults[i];

            logTool('info', `Tool call: ${tc.toolName}`, {
              input: JSON.stringify(tc.input).slice(0, 200),
            });

            // Add tool call message
            const toolCallMsgId = callbacks.generateId();
            callbacks.addMessage(sessionId, {
              id: toolCallMsgId,
              role: 'assistant',
              content: t('chat.callTool', { toolName: tc.toolName }),
              timestamp: Date.now(),
              type: 'tool_call',
              toolName: tc.toolName,
              toolInput: JSON.stringify(tc.input, null, 2),
              toolCallId: tc.toolCallId,
              groupId,
            });

            callbacks.setStatus(t('chat.executing', { toolName: tc.toolName }));

            // Add tool result message
            const resultContent = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
            const toolResultMsgId = callbacks.generateId();
            callbacks.addMessage(sessionId, {
              id: toolResultMsgId,
              role: 'tool',
              content: resultContent,
              timestamp: Date.now(),
              type: 'tool_result',
              toolName: tc.toolName,
              toolOutput: resultContent,
              toolCallId: tc.toolCallId,
              groupId,
            });

            logTool('success', `Tool ${tc.toolName} completed`, { resultLength: resultContent.length });
          }

          callbacks.setStatus('');
        }
      },
    });

    // Stream text chunks to UI
    let fullContent = '';
    for await (const chunk of result.textStream) {
      fullContent += chunk;
      callbacks.updateMessage(sessionId, responseMessageId, { content: fullContent });
    }

    // Final update
    callbacks.updateMessage(sessionId, responseMessageId, {
      type: 'response',
      content: fullContent,
      groupId,
    });

    logLLM('success', 'Agent loop completed');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logLLM('error', `Agent loop error: ${errorMsg}`);
    throw error;
  } finally {
    callbacks.setStatus('');
  }
}
