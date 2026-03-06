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
): Promise<string> {
  // Validate configuration
  if (!llmConfig.apiKey) {
    callbacks.addMessage(sessionId, {
      id: callbacks.generateId(),
      role: 'assistant',
      content: t('chat.configRequired'),
      timestamp: Date.now(),
    });
    return '';
  }

  if (!llmConfig.model || !llmConfig.model.trim()) {
    callbacks.addMessage(sessionId, {
      id: callbacks.generateId(),
      role: 'assistant',
      content: t('chat.modelRequired'),
      timestamp: Date.now(),
    });
    return '';
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
  let lastChunkLogTime = 0;
  let totalChunks = 0;

  // Track tool calls for streaming display
  const toolCallMessages = new Map<string, string>(); // toolCallId -> messageId
  const toolCallInputs = new Map<string, string>(); // toolCallId -> accumulated input

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
        totalChunks++;
        const now = Date.now();

        // Log chunk info every 30 seconds or on first chunk
        if (totalChunks === 1 || now - lastChunkLogTime >= 30000) {
          console.log(`[Agent] Chunk received (${totalChunks} total), type:`, chunk.type);
          logLLM('debug', `Chunk received: ${chunk.type} (${totalChunks} total)`);
          lastChunkLogTime = now;
        }

        // Handle tool-call chunks - create tool call message immediately
        if (chunk.type === 'tool-call') {
          console.log('[Agent] Tool call chunk received:', {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
          });

          // Create tool call message immediately when we first see it
          if (!toolCallMessages.has(chunk.toolCallId)) {
            const toolCallMsgId = callbacks.generateId();
            toolCallMessages.set(chunk.toolCallId, toolCallMsgId);
            toolCallInputs.set(chunk.toolCallId, '');

            const toolDescription = (tools[chunk.toolName] as any)?.description || '';
            callbacks.addMessage(sessionId, {
              id: toolCallMsgId,
              role: 'assistant',
              content: t('chat.callTool', { toolName: chunk.toolName }),
              timestamp: Date.now(),
              type: 'tool_call',
              toolName: chunk.toolName,
              toolInput: '',
              toolCallId: chunk.toolCallId,
              groupId,
              metadata: { toolDescription, streaming: true },
            });

            logTool('info', `Tool call started: ${chunk.toolName}`, {
              toolCallId: chunk.toolCallId,
            });
          }
        }

        // Handle tool-call-delta chunks - stream tool input parameters
        if (chunk.type === 'tool-call-delta') {
          const currentInput = toolCallInputs.get(chunk.toolCallId) || '';
          const newInput = currentInput + chunk.argsTextDelta;
          toolCallInputs.set(chunk.toolCallId, newInput);

          const toolCallMsgId = toolCallMessages.get(chunk.toolCallId);
          if (toolCallMsgId) {
            callbacks.updateMessage(sessionId, toolCallMsgId, {
              toolInput: newInput,
            });
          }
        }

        // Handle tool-result chunks - stream tool output
        if (chunk.type === 'tool-result') {
          console.log('[Agent] Tool result chunk received:', {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
          });

          const resultContent = typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result);
          const toolResultMsgId = callbacks.generateId();

          // Create tool result message immediately
          callbacks.addMessage(sessionId, {
            id: toolResultMsgId,
            role: 'tool',
            content: resultContent,
            timestamp: Date.now(),
            type: 'tool_result',
            toolName: chunk.toolName,
            toolOutput: resultContent,
            toolCallId: chunk.toolCallId,
            groupId,
            metadata: { streaming: false },
          });

          // Mark tool call message as complete
          const toolCallMsgId = toolCallMessages.get(chunk.toolCallId);
          if (toolCallMsgId) {
            callbacks.updateMessage(sessionId, toolCallMsgId, {
              metadata: { streaming: false },
            });
          }

          logTool('success', `Tool ${chunk.toolName} completed`, { resultLength: resultContent.length });
        }

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
      onStepFinish: async ({ text, toolCalls, toolResults, finishReason }) => {
        console.log('[Agent] onStepFinish called:', {
          hasText: !!text,
          textLength: text?.length || 0,
          toolCallsCount: toolCalls?.length || 0,
          toolResultsCount: toolResults?.length || 0,
          finishReason,
          stepCount,
        });
        logLLM('info', `Agent loop - step ${stepCount} finished, text: ${text ? text.slice(0, 50) : 'none'}, toolCalls: ${toolCalls?.length || 0}, finishReason: ${finishReason}`);

        // Finalize the current step's text message
        if (currentStepMessageId && text) {
          callbacks.updateMessage(sessionId, currentStepMessageId, {
            content: text,
            type: 'response',
          });
        }

        // Tool calls and results are now handled in onChunk for streaming
        // This section is kept as a fallback for any missed tool calls
        if (toolCalls && toolCalls.length > 0) {
          console.log('[Agent] Verifying tool calls in onStepFinish:', toolCalls.length);

          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i];
            const tr = toolResults?.[i];

            // Only add if not already added via streaming
            if (!toolCallMessages.has(tc.toolCallId)) {
              console.log(`[Agent] Adding missed tool call ${tc.toolName} in onStepFinish`);

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
                metadata: { toolDescription, streaming: false },
              });

              if (tr) {
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
                  metadata: { streaming: false },
                });
              }
            } else {
              // Ensure tool call input is finalized with proper formatting
              const toolCallMsgId = toolCallMessages.get(tc.toolCallId);
              if (toolCallMsgId) {
                callbacks.updateMessage(sessionId, toolCallMsgId, {
                  toolInput: JSON.stringify(tc.input, null, 2),
                  metadata: { streaming: false },
                });
              }
            }
          }

          callbacks.setStatus('');
        }

        // Reset for next step
        currentStepMessageId = null;
        currentStepContent = '';
        toolCallMessages.clear();
        toolCallInputs.clear();
        console.log('[Agent] Step finished, reset for next step');
      },
    });

    // Consume the stream (callbacks handle UI updates via onChunk)
    let chunkCount = 0;
    let hasError = false;
    console.log('[Agent] Starting to consume textStream...');

    try {
      for await (const chunk of result.textStream) {
        // textStream must be consumed to drive the stream
        chunkCount++;
        if (chunkCount === 1) {
          console.log('[Agent] First chunk received from textStream:', chunk.slice(0, 50));
        }
      }
    } catch (streamError) {
      hasError = true;
      console.error('[Agent] Error consuming textStream:', streamError);
      logLLM('error', `Stream consumption error: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
    }

    console.log('[Agent] Stream consumed, total chunks:', chunkCount, 'hasError:', hasError);
    logLLM('info', `Stream consumed, total chunks: ${chunkCount}`);

    // Check if we got any response at all
    if (chunkCount === 0 && !hasError) {
      console.warn('[Agent] WARNING: No chunks received and no error. Possible causes:');
      console.warn('  1. API request failed silently');
      console.warn('  2. Model returned empty response');
      console.warn('  3. Network/CORS issue');
      console.warn('  4. Invalid API key or model name');

      // Try to get more info from the result object
      try {
        const usage = await result.usage;
        console.log('[Agent] Token usage:', usage);
      } catch (e) {
        console.error('[Agent] Could not get usage info:', e);
      }

      try {
        const finishReason = await result.finishReason;
        console.log('[Agent] Finish reason:', finishReason);
      } catch (e) {
        console.error('[Agent] Could not get finish reason:', e);
      }
    }

    logLLM('success', 'Agent loop completed');
    return systemPrompt;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Agent] Error in agent loop:', error);

    // Log more details about the error
    if (error instanceof Error) {
      console.error('[Agent] Error name:', error.name);
      console.error('[Agent] Error message:', error.message);
      console.error('[Agent] Error stack:', error.stack);
    }

    logLLM('error', `Agent loop error: ${errorMsg}`);
    console.error('[Agent] Full error:', error);

    // Parse API error for user-friendly message
    let userMessage = errorMsg;

    // Check for common API errors
    if (errorMsg.includes('Invalid max_tokens')) {
      const match = errorMsg.match(/valid range.*?\[(\d+),\s*(\d+)\]/);
      if (match) {
        const [, min, max] = match;
        userMessage = `模型的 max_tokens 设置超出限制。\n当前设置: ${llmConfig.maxTokens}\n允许范围: ${min} - ${max}\n\n请在设置中调整 "最大 Token" 的值。`;
      } else {
        userMessage = `模型的 max_tokens 设置无效。\n当前设置: ${llmConfig.maxTokens}\n\n请在设置中调整 "最大 Token" 的值。`;
      }
    } else if (errorMsg.includes('API key')) {
      userMessage = `API Key 错误: ${errorMsg}\n\n请检查设置中的 API Key 是否正确。`;
    } else if (errorMsg.includes('model')) {
      userMessage = `模型错误: ${errorMsg}\n\n请检查设置中的模型名称是否正确。`;
    } else if (errorMsg.includes('rate limit') || errorMsg.includes('quota')) {
      userMessage = `API 配额或速率限制: ${errorMsg}\n\n请稍后重试或检查您的 API 配额。`;
    }

    // Add error message to UI
    callbacks.addMessage(sessionId, {
      id: callbacks.generateId(),
      role: 'assistant',
      content: `❌ 错误\n\n${userMessage}`,
      timestamp: Date.now(),
    });

    throw error;
  } finally {
    callbacks.setStatus('');
  }
}
