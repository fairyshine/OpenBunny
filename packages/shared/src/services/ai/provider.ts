import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LLMConfig } from '../../types';

export function createProvider(config: LLMConfig) {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
    case 'openai':
    case 'custom':
    default:
      return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }
}

export function createModel(config: LLMConfig) {
  const provider = createProvider(config);
  return provider(config.model);
}
