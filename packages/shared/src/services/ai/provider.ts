import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { LLMConfig } from '../../types';
import { getProviderMeta } from './providers';

/**
 * In browser environments, AI API calls are blocked by CORS.
 * Routes through the appropriate proxy based on environment:
 * - localhost → Vite dev proxy (/api/proxy?target=<url>)
 * - production + proxyUrl → Cloudflare Worker (POST <proxyUrl>/proxy, X-Target-URL header)
 * - otherwise → direct fetch (works for CORS-enabled providers like Ollama)
 */
function createBrowserFetch(proxyUrl?: string): typeof globalThis.fetch | undefined {
  if (typeof window === 'undefined') return undefined;

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // No proxy needed in dev (Vite handles it) or when no proxyUrl configured
  if (isLocalhost) {
    // Vite dev proxy
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const originalUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const encodedTarget = encodeURIComponent(originalUrl);
      return globalThis.fetch(`/api/proxy?target=${encodedTarget}`, init);
    };
  }

  if (proxyUrl) {
    // Cloudflare Worker proxy
    const workerBase = proxyUrl.replace(/\/+$/, '');
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const originalUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      return globalThis.fetch(`${workerBase}/proxy`, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          'X-Target-URL': originalUrl,
        },
      });
    };
  }

  // No proxy — direct fetch (for CORS-enabled providers)
  return undefined;
}

export function createProvider(config: LLMConfig, proxyUrl?: string) {
  const customFetch = createBrowserFetch(proxyUrl);
  const meta = getProviderMeta(config.provider);

  if (!meta) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }

  // baseURL priority: config.baseUrl (user override) > meta.defaultBaseUrl (registry default) > SDK default
  const baseURL = config.baseUrl || meta.defaultBaseUrl;
  const fetchOpt = customFetch ? { fetch: customFetch } : {};

  switch (meta.sdkType) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey, baseURL, ...fetchOpt });
    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL, ...fetchOpt });
    case 'openai':
    case 'openai-compatible':
    default:
      return createOpenAI({ apiKey: config.apiKey, baseURL, ...fetchOpt });
  }
}

export function createModel(config: LLMConfig, proxyUrl?: string) {
  const provider = createProvider(config, proxyUrl);
  // Use .chat() for OpenAI-compatible providers to use /chat/completions instead of /responses
  // OpenAI's new SDK defaults to /responses which most providers don't support yet
  const meta = getProviderMeta(config.provider);
  if (meta?.sdkType === 'openai-compatible') {
    return (provider as any).chat(config.model);
  }
  return provider(config.model);
}

/**
 * Quick connection test — sends a minimal request and returns the response text.
 */
export async function testConnection(config: LLMConfig, proxyUrl?: string): Promise<string> {
  const model = createModel(config, proxyUrl);
  const { text } = await generateText({
    model,
    messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
    maxOutputTokens: 10,
  });
  return text;
}
