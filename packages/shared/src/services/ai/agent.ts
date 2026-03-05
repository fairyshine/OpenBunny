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
  streamToolOutput?(sessionId: string, msgId: string, chunk: string): void;
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
  t: TFunction,
  proxyUrl?: string,
  _toolTimeout?: number
): Promise<void> {
  // Validate configuration
  if (!llmConfig.apiKey) {
    callbacks.addMessage(sessionId, {
      id: callbacks.generateId(),
      role: 'assistant',
      content: t('chat.configRequired'),
      timestamp: Date.now(),
    });
    return;
  }

  if (!llmConfig.model || !llmConfig.model.trim()) {
    callbacks.addMessage(sessionId, {
      id: callbacks.generateId(),
      role: 'assistant',
      content: t('chat.modelRequired'),
      timestamp: Date.now(),
    });
    return;
  }

  const groupId = callbacks.generateId();
  const model = createModel(llmConfig, proxyUrl);
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

  let stepCount = 0;
  let currentStepMessageId: string | null = null;
  let currentStepContent = '';

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userInput }],
      tools: tools as ToolSet,
      stopWhen: stepCountIs(10),
      temperature: llmConfig.temperature ?? 0.7,
      maxOutputTokens: llmConfig.maxTokens ?? 4096,
      onChunk: ({ chunk }) => {
        // Create step message on first text-delta if not yet created
        if (chunk.type === 'text-delta') {
          if (!currentStepMessageId) {
            stepCount++;
            currentStepMessageId = callbacks.generateId();
            currentStepContent = '';
            callbacks.addMessage(sessionId, {
              id: currentStepMessageId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              type: 'thought',
              groupId,
            });
          }
          currentStepContent += chunk.text;
          callbacks.updateMessage(sessionId, currentStepMessageId, {
            content: currentStepContent,
          });
        }
      },
      onStepFinish: async ({ text, toolCalls, toolResults }) => {
        logLLM('info', `Agent loop - step ${stepCount} finished`);

        // Finalize the current step's text message
        if (currentStepMessageId && text) {
          callbacks.updateMessage(sessionId, currentStepMessageId, {
            content: text,
            type: 'response',
          });
        }

        if (toolCalls && toolCalls.length > 0 && toolResults) {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            const tr = toolResults[i];

            logTool('info', `Tool call: ${tc.toolName}`, {
              input: JSON.stringify(tc.input).slice(0, 200),
            });

            const toolCallMsgId = callbacks.generateId();
            const toolDescription = (tools[tc.toolName] as any)?.description || '';
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
              metadata: { toolDescription, streaming: true },
            });

            callbacks.setStatus(t('chat.executing', { toolName: tc.toolName }));

            const resultContent = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
            const toolResultMsgId = callbacks.generateId();

            // Create tool result message with streaming flag
            callbacks.addMessage(sessionId, {
              id: toolResultMsgId,
              role: 'tool',
              content: '',
              timestamp: Date.now(),
              type: 'tool_result',
              toolName: tc.toolName,
              toolOutput: '',
              toolCallId: tc.toolCallId,
              groupId,
              metadata: { streaming: true },
            });

            // Stream the result content character by character
            if (callbacks.streamToolOutput) {
              const chunkSize = 50; // Characters per chunk
              for (let pos = 0; pos < resultContent.length; pos += chunkSize) {
                const chunk = resultContent.slice(pos, pos + chunkSize);
                callbacks.streamToolOutput(sessionId, toolResultMsgId, chunk);
                await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for visual effect
              }
            }

            // Finalize the tool result message
            callbacks.updateMessage(sessionId, toolResultMsgId, {
              content: resultContent,
              toolOutput: resultContent,
              metadata: { streaming: false },
            });

            logTool('success', `Tool ${tc.toolName} completed`, { resultLength: resultContent.length });
          }

          callbacks.setStatus('');
        }

        // Reset for next step
        currentStepMessageId = null;
        currentStepContent = '';
      },
    });

    // Consume the stream (callbacks handle UI updates via onChunk)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of result.textStream) {
      // textStream must be consumed to drive the stream
    }

    logLLM('success', 'Agent loop completed');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logLLM('error', `Agent loop error: ${errorMsg}`);
    throw error;
  } finally {
    callbacks.setStatus('');
  }
}
