/**
 * useLLM Hook — simplified with AI SDK streamText
 * No more manual SSE parsing or provider-specific format handling
 */

import { useState, useCallback, useRef } from 'react';
import { streamText, type ModelMessage } from 'ai';
import { createModel } from '../services/ai/provider';
import { logLLM } from '../services/console/logger';
import { getErrorMessage, isAbortError } from '../utils/errors';
import type { LLMConfig } from '../types';

interface UseLLMOptions {
  onChunk?: (fullContent: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
}

export function useLLM(config: LLMConfig) {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      logLLM('warning', 'User aborted request');
    }
  }, []);

  const sendMessage = useCallback(async (
    messages: ModelMessage[],
    options: UseLLMOptions = {}
  ): Promise<{ content: string }> => {
    const { onChunk, onError, onComplete } = options;

    if (!config.apiKey) {
      throw new Error('API Key not configured');
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsLoading(true);

    try {
      const model = createModel(config);

      logLLM('info', `Calling API`, {
        model: config.model,
        provider: config.provider,
        messages: messages.length,
      });

      const result = streamText({
        model,
        messages,
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens ?? 4096,
        abortSignal: abortController.signal,
      });

      let fullContent = '';
      for await (const chunk of result.textStream) {
        fullContent += chunk;
        onChunk?.(fullContent);
      }

      onComplete?.();
      logLLM('success', 'Response completed');
      return { content: fullContent };

    } catch (error) {
      if (isAbortError(error)) {
        logLLM('warning', 'Request aborted by user');
        onError?.('Request aborted');
        throw new Error('Request aborted');
      }

      const errorMsg = getErrorMessage(error);
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
