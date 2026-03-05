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
  toolTimeout?: number
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

  const timeout = toolTimeout || 300000; // Default 5 minutes
  const groupId = callbacks.generateId();
  const model = createModel(llmConfig, proxyUrl);
  const tools = getEnabledTools(enabledTools);

  const toolCount = Object.keys(tools).length;
  logTool('info', `${toolCount} tools enabled (timeout: ${timeout}ms)`, {
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

  console.log('[Agent] Starting agent loop with config:', {
    provider: llmConfig.provider,
    model: llmConfig.model,
    temperature: llmConfig.temperature,
    maxTokens: llmConfig.maxTokens,
    toolCount,
    systemPromptLength: systemPrompt.length,
    userInputLength: userInput.length,
  });

  let stepCount = 0;
  let currentStepMessageId: string | null = null;
  let currentStepContent = '';

  try {
    console.log('[Agent] Creating streamText with:', {
      hasModel: !!model,
      hasSystemPrompt: !!systemPrompt,
      hasMessages: true,
      toolCount: Object.keys(tools).length,
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userInput }],
      tools: tools as ToolSet,
      stopWhen: stepCountIs(10),
      temperature: llmConfig.temperature ?? 0.7,
      maxOutputTokens: llmConfig.maxTokens ?? 4096,
      experimental_telemetry: {
        isEnabled: false,
      },
      onChunk: ({ chunk }) => {
        console.log('[Agent] onChunk called, type:', chunk.type);
        logLLM('debug', `Chunk received: ${chunk.type}`);
        // Create step message on first text-delta if not yet created
        if (chunk.type === 'text-delta') {
          if (!currentStepMessageId) {
            stepCount++;
            console.log('[Agent] Creating new step message, stepCount:', stepCount);
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
        console.log('[Agent] onStepFinish called:', {
          hasText: !!text,
          textLength: text?.length || 0,
          toolCallsCount: toolCalls?.length || 0,
          toolResultsCount: toolResults?.length || 0,
        });
        logLLM('info', `Agent loop - step ${stepCount} finished, text: ${text ? text.slice(0, 50) : 'none'}, toolCalls: ${toolCalls?.length || 0}`);

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
              metadata: { toolDescription },
            });

            callbacks.setStatus(t('chat.executing', { toolName: tc.toolName }));

            const resultContent = typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output);
            const toolResultMsgId = callbacks.generateId();

            // Display tool result immediately (no streaming delay)
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

        // Reset for next step
        currentStepMessageId = null;
        currentStepContent = '';
      },
    });

    // Consume the stream (callbacks handle UI updates via onChunk)
    let chunkCount = 0;
    console.log('[Agent] Starting to consume textStream...');
    for await (const chunk of result.textStream) {
      // textStream must be consumed to drive the stream
      chunkCount++;
      if (chunkCount === 1) {
        console.log('[Agent] First chunk received from textStream:', chunk.slice(0, 50));
      }
    }
    console.log('[Agent] Stream consumed, total chunks:', chunkCount);
    logLLM('info', `Stream consumed, total chunks: ${chunkCount}`);

    logLLM('success', 'Agent loop completed');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Agent] Error in agent loop:', error);
    logLLM('error', `Agent loop error: ${errorMsg}`);
    console.error('[Agent] Full error:', error);
    throw error;
  } finally {
    callbacks.setStatus('');
  }
}
