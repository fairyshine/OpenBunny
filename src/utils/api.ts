/**
 * Centralized API URL building and proxy routing.
 *
 * - Dev mode without custom baseUrl → Vite proxy
 * - Production with proxy worker configured → Cloudflare Worker
 * - Custom baseUrl → direct call (or proxied if worker configured)
 */

import { LLMConfig } from '../types';
import { useSettingsStore } from '../stores/settings';

/** Get the configured proxy worker URL from settings store or env var */
export function getProxyWorkerUrl(): string | undefined {
  const proxyUrl = useSettingsStore.getState().proxyWorkerUrl;

  if (proxyUrl) return proxyUrl;

  // Fallback to env var
  const envUrl = import.meta.env.VITE_PROXY_WORKER_URL;
  return envUrl || undefined;
}

interface BuildResult {
  /** URL to actually fetch (may be the worker URL) */
  url: string;
  /** If proxied, the real target URL to put in X-Target-URL header */
  targetUrl?: string;
}

/** Build the chat completions URL, routing through proxy when appropriate */
export function buildChatCompletionsUrl(config: LLMConfig): BuildResult {
  const workerUrl = getProxyWorkerUrl();

  if (config.baseUrl) {
    // Custom endpoint (vLLM, Anthropic, etc.)
    const baseUrlClean = config.baseUrl.replace(/\/$/, '');
    const path = baseUrlClean.endsWith('/v1')
      ? '/chat/completions'
      : '/v1/chat/completions';
    const directUrl = `${baseUrlClean}${path}`;

    if (workerUrl) {
      return { url: `${workerUrl.replace(/\/$/, '')}/proxy`, targetUrl: directUrl };
    }
    return { url: directUrl };
  }

  // Anthropic provider
  if (config.provider === 'anthropic') {
    const directUrl = 'https://api.anthropic.com/v1/messages';
    if (workerUrl) {
      return { url: `${workerUrl.replace(/\/$/, '')}/proxy`, targetUrl: directUrl };
    }
    return { url: directUrl };
  }

  // Default OpenAI
  if (import.meta.env.DEV) {
    // Vite dev proxy handles CORS
    return { url: '/api/openai/v1/chat/completions' };
  }

  const directUrl = 'https://api.openai.com/v1/chat/completions';
  if (workerUrl) {
    return { url: `${workerUrl.replace(/\/$/, '')}/proxy`, targetUrl: directUrl };
  }
  return { url: directUrl };
}

/**
 * Fetch wrapper that routes through the proxy worker when configured.
 * For non-LLM requests (e.g. DuckDuckGo web search).
 */
export async function proxiedFetch(targetUrl: string, init?: RequestInit): Promise<Response> {
  const workerUrl = getProxyWorkerUrl();

  if (!workerUrl) {
    return fetch(targetUrl, init);
  }

  const proxyUrl = `${workerUrl.replace(/\/$/, '')}/proxy`;
  const headers = new Headers(init?.headers);
  headers.set('X-Target-URL', targetUrl);

  return fetch(proxyUrl, {
    ...init,
    method: init?.method || 'POST',
    headers,
  });
}
