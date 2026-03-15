import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { LLMConfig } from '../../types';
import { getPlatformContext } from '../../platform';
import { getProviderMeta } from './providers';
import { logLLM } from '../console/logger';

export interface ProviderDependencies {
  createOpenAI: typeof createOpenAI;
  createAnthropic: typeof createAnthropic;
  createGoogleGenerativeAI: typeof createGoogleGenerativeAI;
  generateText: typeof generateText;
  getPlatformContext: typeof getPlatformContext;
  getProviderMeta: typeof getProviderMeta;
}

const defaultProviderDependencies: ProviderDependencies = {
  createOpenAI,
  createAnthropic,
  createGoogleGenerativeAI,
  generateText,
  getPlatformContext,
  getProviderMeta,
};

function resolveProviderFetch(
  proxyUrl?: string,
  deps: Pick<ProviderDependencies, 'getPlatformContext'> = defaultProviderDependencies,
): typeof globalThis.fetch | undefined {
  try {
    return deps.getPlatformContext().api.createExternalFetch?.({
      service: 'llm-provider',
      proxyUrl,
    });
  } catch {
    return undefined;
  }
}

export function createProvider(
  config: LLMConfig,
  proxyUrl?: string,
  deps: ProviderDependencies = defaultProviderDependencies,
) {
  const customFetch = resolveProviderFetch(proxyUrl, deps);
  const meta = deps.getProviderMeta(config.provider);

  if (!meta) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }

  const baseURL = config.baseUrl || meta.defaultBaseUrl;
  const fetchOpt = customFetch ? { fetch: customFetch } : {};
  const apiKey = config.apiKey || (meta.requiresApiKey ? '' : 'openbunny-local');

  logLLM('debug', 'Creating provider', {
    provider: config.provider,
    sdkType: meta.sdkType,
    baseURL,
    hasCustomFetch: !!customFetch,
    model: config.model,
  });

  switch (meta.sdkType) {
    case 'anthropic':
      return deps.createAnthropic({ apiKey, baseURL, ...fetchOpt });
    case 'google':
      return deps.createGoogleGenerativeAI({ apiKey, baseURL, ...fetchOpt });
    case 'openai':
    case 'openai-compatible':
    default:
      return deps.createOpenAI({ apiKey, baseURL, ...fetchOpt });
  }
}

export function createModel(
  config: LLMConfig,
  proxyUrl?: string,
  deps: ProviderDependencies = defaultProviderDependencies,
) {
  if (!config.model || !config.model.trim()) {
    throw new Error('Model name is required');
  }

  const provider = createProvider(config, proxyUrl, deps);
  const meta = deps.getProviderMeta(config.provider);
  if (meta?.sdkType === 'openai-compatible') {
    return (provider as any).chat(config.model);
  }
  return provider(config.model);
}

export async function testConnection(
  config: LLMConfig,
  proxyUrl?: string,
  deps: ProviderDependencies = defaultProviderDependencies,
): Promise<string> {
  const model = createModel(config, proxyUrl, deps);
  const { text } = await deps.generateText({
    model,
    messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
    maxOutputTokens: 10,
  });
  return text;
}
