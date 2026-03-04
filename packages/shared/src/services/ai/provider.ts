import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
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

/**
 * Quick connection test — sends a minimal request and returns the response text.
 */
export async function testConnection(config: LLMConfig): Promise<string> {
  const model = createModel(config);
  const { text } = await generateText({
    model,
    messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
    maxOutputTokens: 10,
  });
  return text;
}
