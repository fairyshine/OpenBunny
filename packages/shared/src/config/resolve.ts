/**
 * Pure-function config resolution — no Node-specific dependencies.
 * CLI, TUI, and tests can all use these without pulling in `conf` or `process`.
 */

import type { LLMConfig } from '../types';

export interface LLMConfigOverrides {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number | string;
  maxTokens?: number | string;
}

export function readString(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function readNumber(...candidates: Array<number | string | undefined>): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

/**
 * Resolve a full LLMConfig from layered sources.
 * @param overrides  CLI flags / programmatic overrides (highest priority)
 * @param env        Environment variables (e.g. process.env)
 * @param getConfigValue  Read a persisted config key
 * @param sessionConfig   In-memory session store config (lowest priority)
 */
export function resolveLLMConfig(
  overrides: LLMConfigOverrides,
  env: Record<string, string | undefined>,
  getConfigValue: <T = string>(key: string) => T | undefined,
  sessionConfig: Partial<LLMConfig>,
): LLMConfig {
  return {
    provider: readString(
      overrides.provider,
      env.OPENBUNNY_PROVIDER,
      getConfigValue<string>('provider'),
      sessionConfig.provider,
      'openai',
    ) || 'openai',
    apiKey: readString(
      overrides.apiKey,
      env.OPENBUNNY_API_KEY,
      getConfigValue<string>('apiKey'),
      sessionConfig.apiKey,
    ) || '',
    model: readString(
      overrides.model,
      env.OPENBUNNY_MODEL,
      getConfigValue<string>('model'),
      sessionConfig.model,
      'gpt-4o',
    ) || 'gpt-4o',
    baseUrl: readString(
      overrides.baseUrl,
      env.OPENBUNNY_BASE_URL,
      getConfigValue<string>('baseUrl'),
      sessionConfig.baseUrl,
    ),
    temperature: readNumber(
      overrides.temperature,
      env.OPENBUNNY_TEMPERATURE,
      getConfigValue<number>('temperature'),
      sessionConfig.temperature,
      0.7,
    ) ?? 0.7,
    maxTokens: readNumber(
      overrides.maxTokens,
      env.OPENBUNNY_MAX_TOKENS,
      getConfigValue<number>('maxTokens'),
      sessionConfig.maxTokens,
      4096,
    ) ?? 4096,
  };
}

export function resolveSystemPrompt(
  override: string | undefined,
  env: Record<string, string | undefined>,
  getConfigValue: <T = string>(key: string) => T | undefined,
): string | undefined {
  return readString(
    override,
    env.OPENBUNNY_SYSTEM_PROMPT,
    getConfigValue<string>('systemPrompt'),
  );
}

export function resolveWorkspace(
  override: string | undefined,
  env: Record<string, string | undefined>,
  getConfigValue: <T = string>(key: string) => T | undefined,
): string | undefined {
  return readString(
    override,
    env.OPENBUNNY_WORKSPACE,
    getConfigValue<string>('workspace'),
  );
}
