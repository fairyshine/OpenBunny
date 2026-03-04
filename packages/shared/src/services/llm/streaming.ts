/**
 * Non-React LLM caller for CLI/TUI — uses AI SDK streamText
 */

import { streamText, type ModelMessage } from 'ai';
import { createModel } from '../ai/provider';
import { logLLM } from '../console/logger';
import type { LLMConfig } from '../../types';

export interface StreamOptions {
  onChunk?: (fullContent: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export async function callLLM(
  config: LLMConfig,
  messages: ModelMessage[],
  options: StreamOptions = {}
): Promise<string> {
  const { onChunk, onComplete, onError } = options;

  if (!config.apiKey) {
    throw new Error('API Key not configured');
  }

  try {
    const model = createModel(config);

    logLLM('info', `Calling API`, { model: config.model, messages: messages.length });

    const result = streamText({
      model,
      messages,
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxTokens ?? 4096,
    });

    let fullContent = '';
    for await (const chunk of result.textStream) {
      fullContent += chunk;
      onChunk?.(fullContent);
    }

    onComplete?.();
    logLLM('success', 'Response completed');
    return fullContent;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logLLM('error', errorMsg);
    onError?.(errorMsg);
    throw error;
  }
}
