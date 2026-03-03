// LLM 调用 Hook
import { useState, useCallback, useRef } from 'react';
import { LLMConfig, LLMMessage } from '../types';
import { buildChatCompletionsUrl } from '../utils/api';
import { logLLM } from '../services/console/logger';
import { OpenAITool, OpenAIToolCall } from '../services/tools/openai-format';
import { AnthropicTool, AnthropicToolUse } from '../services/tools/anthropic-format';
import { getErrorMessage, isAbortError } from '../utils/errors';

interface UseLLMOptions {
  onChunk?: (chunk: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  onToolCalls?: (toolCalls: OpenAIToolCall[]) => void;
  tools?: OpenAITool[];
  anthropicTools?: AnthropicTool[];
}

export function useLLM(config: LLMConfig) {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      logLLM('warning', '用户中断了请求');
    }
  }, []);

  const sendMessage = useCallback(async (
    messages: LLMMessage[],
    options: UseLLMOptions = {}
  ): Promise<{ content: string; toolCalls?: OpenAIToolCall[] }> => {
    const { onChunk, onError, onComplete, onToolCalls, tools, anthropicTools } = options;

    if (!config.apiKey) {
      throw new Error('未配置 API Key');
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      const { url: apiUrl, targetUrl } = buildChatCompletionsUrl(config);

      logLLM('info', `请求 API: ${apiUrl}`, { model: config.model, messages: messages.length, maxTokens: config.maxTokens ?? 4096 });
      if (targetUrl) {
        logLLM('debug', `代理目标: ${targetUrl}`);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };

      // Anthropic 使用不同的认证头
      if (config.provider === 'anthropic') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      if (targetUrl) {
        headers['X-Target-URL'] = targetUrl;
      }

      // 准备请求体，处理 max_tokens
      let maxTokens = config.maxTokens ?? 4096;

      const makeRequest = async (tokens: number) => {
        let requestBody: Record<string, unknown>;

        if (config.provider === 'anthropic') {
          // Anthropic Messages API 格式
          // 提取 system 消息
          const systemMessages = messages.filter(m => m.role === 'system');
          const nonSystemMessages = messages.filter(m => m.role !== 'system');

          requestBody = {
            model: config.model,
            messages: nonSystemMessages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content || '',
            })),
            max_tokens: tokens,
            temperature: config.temperature ?? 0.7,
            stream: true,
          };

          // 添加 system prompt
          if (systemMessages.length > 0) {
            requestBody.system = systemMessages.map(m => m.content).join('\n\n');
          }

          // 添加工具定义
          if (anthropicTools && anthropicTools.length > 0) {
            requestBody.tools = anthropicTools;
          }
        } else {
          // OpenAI Chat Completions API 格式
          requestBody = {
            model: config.model,
            messages,
            stream: true,
            temperature: config.temperature ?? 0.7,
            max_tokens: tokens,
          };

          // 如果提供了工具定义，添加到请求中
          if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto';
          }
        }

        return fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current!.signal,
        });
      };

      let response = await makeRequest(maxTokens);

      logLLM('info', `响应状态: ${response.status}`);

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        let errorData: { error?: { message?: string } | string } | undefined;
        try {
          errorData = await response.json();
          errorMsg = (typeof errorData?.error === 'object' ? errorData.error.message : errorData?.error) || errorMsg;
        } catch {
          const errorText = await response.text();
          errorMsg = errorText.slice(0, 200) || errorMsg;
        }

        // 检测 max_tokens 范围错误并自动重试
        if (errorMsg.includes('max_tokens') && errorMsg.includes('valid range')) {
          const match = errorMsg.match(/\[(\d+),\s*(\d+)\]/);
          if (match) {
            const serverMax = parseInt(match[2]);
            logLLM('warning', `max_tokens ${maxTokens} 超出限制，自动调整为 ${serverMax}`);

            // 重试使用服务端允许的最大值
            response = await makeRequest(serverMax);

            if (!response.ok) {
              const retryError = await response.text();
              throw new Error(retryError.slice(0, 200));
            }

            // 重试成功，继续处理流式响应
          } else {
            throw new Error(errorMsg);
          }
        } else {
          throw new Error(errorMsg);
        }
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let toolCalls: OpenAIToolCall[] = [];
      let currentToolCall: Partial<OpenAIToolCall> | null = null;

      // Anthropic 特有状态
      let anthropicToolUses: AnthropicToolUse[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码新数据并加入缓冲区
        buffer += decoder.decode(value, { stream: true });

        // 处理缓冲区中的完整行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.slice(6);

          if (data === '[DONE]') {
            logLLM('success', '流式响应完成');
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (config.provider === 'anthropic') {
              // Anthropic Messages API 流式响应格式
              const eventType = parsed.type;

              if (eventType === 'content_block_start') {
                const contentBlock = parsed.content_block;
                if (contentBlock?.type === 'tool_use') {
                  // 开始工具调用
                  anthropicToolUses.push({
                    id: contentBlock.id,
                    type: 'tool_use',
                    name: contentBlock.name,
                    input: {},
                  });
                  console.log('[LLM] 🔧 开始工具调用:', contentBlock.name);
                }
              } else if (eventType === 'content_block_delta') {
                const delta = parsed.delta;
                if (delta?.type === 'text_delta') {
                  // 文本内容增量
                  fullContent += delta.text;
                  onChunk?.(fullContent);
                } else if (delta?.type === 'input_json_delta') {
                  // 工具输入增量 - 累积 JSON 字符串
                  const index = parsed.index;
                  if (anthropicToolUses[index]) {
                    // 初始化 inputBuffer 如果不存在
                    if (!anthropicToolUses[index].inputBuffer) {
                      anthropicToolUses[index].inputBuffer = '';
                    }
                    anthropicToolUses[index].inputBuffer += delta.partial_json;
                  }
                }
              } else if (eventType === 'content_block_stop') {
                // 内容块结束，解析完整的工具输入
                const index = parsed.index;
                if (anthropicToolUses[index]?.inputBuffer) {
                  try {
                    anthropicToolUses[index].input = JSON.parse(anthropicToolUses[index].inputBuffer);
                  } catch (e) {
                    console.warn('[LLM] Failed to parse tool input:', e);
                    anthropicToolUses[index].input = {};
                  }
                  delete anthropicToolUses[index].inputBuffer;
                }
              } else if (eventType === 'message_delta') {
                const stopReason = parsed.delta?.stop_reason;
                if (stopReason === 'tool_use') {
                  // 转换为 OpenAI 格式的 tool calls
                  toolCalls = anthropicToolUses.map(tu => ({
                    id: tu.id,
                    type: 'function' as const,
                    function: {
                      name: tu.name,
                      arguments: JSON.stringify(tu.input),
                    },
                  }));

                  logLLM('info', '模型请求调用工具', { count: toolCalls.length });
                  console.group('[LLM] 🔧 完整工具调用');
                  toolCalls.forEach((tc, i) => {
                    console.log(`[${i}] ${tc.function.name}:`, tc.function.arguments);
                  });
                  console.groupEnd();
                  onToolCalls?.(toolCalls);
                } else if (stopReason === 'end_turn') {
                  logLLM('debug', 'stop_reason: end_turn');
                  if (fullContent) {
                    console.log('[LLM] 💬 完整响应内容:', fullContent);
                  }
                }
              }
            } else {
              // OpenAI Chat Completions API 流式响应格式
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;

              // 处理文本内容
              if (delta?.content) {
                fullContent += delta.content;
                onChunk?.(fullContent);
              }

              // 处理工具调用
              if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index;

                  // 初始化新的工具调用
                  if (toolCallDelta.id) {
                    currentToolCall = {
                      id: toolCallDelta.id,
                      type: 'function',
                      function: {
                        name: toolCallDelta.function?.name || '',
                        arguments: toolCallDelta.function?.arguments || '',
                      },
                    };
                    toolCalls[index] = currentToolCall as OpenAIToolCall;
                    console.log('[LLM] 🔧 开始工具调用:', toolCallDelta.function?.name);
                  } else if (currentToolCall && toolCalls[index]) {
                    // 累积参数
                    if (toolCallDelta.function?.arguments) {
                      toolCalls[index].function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                }
              }

              // 完成原因
              if (finishReason === 'tool_calls') {
                logLLM('info', '模型请求调用工具', { count: toolCalls.length });
                console.group('[LLM] 🔧 完整工具调用');
                toolCalls.forEach((tc, i) => {
                  console.log(`[${i}] ${tc.function.name}:`, tc.function.arguments);
                });
                console.groupEnd();
                onToolCalls?.(toolCalls);
              } else if (finishReason === 'stop') {
                logLLM('debug', 'finish_reason: stop');
                if (fullContent) {
                  console.log('[LLM] 💬 完整响应内容:', fullContent);
                }
              }
            }
          } catch (e) {
            // 忽略解析错误，继续处理
            console.warn('[LLM] Parse error:', e);
          }
        }
      }

      // 处理最后可能剩余的缓冲区
      if (buffer.trim()) {
        const trimmedLine = buffer.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullContent += delta.content;
              }
            } catch (e) {
              // 忽略
            }
          }
        }
      }

      onComplete?.();
      return {
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

    } catch (error) {
      // 检查是否是用户中断
      if (isAbortError(error)) {
        logLLM('warning', '请求已被用户中断');
        onError?.('请求已中断');
        throw new Error('请求已中断');
      }

      let errorMsg = getErrorMessage(error);

      // 为 "Failed to fetch" 提供更有用的诊断信息
      if (errorMsg === 'Failed to fetch') {
        const hints: string[] = [];
        if (config.baseUrl) {
          hints.push(`无法连接到 ${config.baseUrl}`);
          hints.push('请检查: 1) 服务是否已启动 2) 地址是否正确 3) 服务端是否已启用 CORS 或配置代理 Worker');
        } else if (!import.meta.env.DEV) {
          hints.push('无法连接到 OpenAI API');
          hints.push('请检查: 1) 网络连接 2) 是否需要在设置中配置 CORS 代理 Worker URL');
        } else {
          hints.push('开发代理请求失败，请确认 Vite 开发服务器正在运行');
        }
        errorMsg = hints.join('。');
      }

      console.error('[LLM] Error:', errorMsg);
      logLLM('error', errorMsg);
      onError?.(errorMsg);
      throw new Error(errorMsg);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [config]);

  return { sendMessage, isLoading, abort };
}

export default useLLM;
