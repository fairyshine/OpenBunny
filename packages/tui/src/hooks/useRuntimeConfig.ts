import { useState, useCallback, useEffect, useRef } from 'react';
import type { LLMConfig } from '@openbunny/shared/types';
import {
  setConfigValue,
  deleteConfigValue,
} from '@openbunny/shared/terminal';

interface UseRuntimeConfigOptions {
  initialConfig: LLMConfig;
  isDefaultAgent: boolean;
  currentAgentId: string;
  globalLLMConfig: LLMConfig;
  currentAgentLLMConfig: LLMConfig | undefined;
  setGlobalLLMConfig: (updates: Partial<LLMConfig>) => void;
  setAgentLLMConfig: (agentId: string, updates: Partial<LLMConfig>) => void;
}

export function useRuntimeConfig({
  initialConfig,
  isDefaultAgent,
  currentAgentId,
  globalLLMConfig,
  currentAgentLLMConfig,
  setGlobalLLMConfig,
  setAgentLLMConfig,
}: UseRuntimeConfigOptions) {
  const [runtimeConfig, setRuntimeConfig] = useState<LLMConfig>(initialConfig);
  const runtimeConfigRef = useRef<LLMConfig>(initialConfig);

  // Sync from initial config prop
  useEffect(() => {
    runtimeConfigRef.current = initialConfig;
    setRuntimeConfig(initialConfig);
    setGlobalLLMConfig(initialConfig);
  }, [initialConfig, setGlobalLLMConfig]);

  // Sync from agent/global config changes
  useEffect(() => {
    const nextConfig = isDefaultAgent
      ? globalLLMConfig
      : (currentAgentLLMConfig || globalLLMConfig);
    runtimeConfigRef.current = nextConfig;
    setRuntimeConfig(nextConfig);
  }, [currentAgentLLMConfig, globalLLMConfig, isDefaultAgent]);

  const applyRuntimeConfig = useCallback((updates: Partial<LLMConfig>) => {
    const nextConfig = { ...runtimeConfigRef.current, ...updates };
    runtimeConfigRef.current = nextConfig;
    setRuntimeConfig(nextConfig);
    if (isDefaultAgent) {
      setGlobalLLMConfig(updates);
    } else {
      setAgentLLMConfig(currentAgentId, updates);
    }
    return nextConfig;
  }, [currentAgentId, isDefaultAgent, setAgentLLMConfig, setGlobalLLMConfig]);

  const saveRuntimeConfig = useCallback((config: LLMConfig) => {
    setConfigValue('provider', config.provider);
    setConfigValue('model', config.model);
    setConfigValue('temperature', config.temperature ?? 0.7);
    setConfigValue('maxTokens', config.maxTokens ?? 4096);
    if (config.apiKey) {
      setConfigValue('apiKey', config.apiKey);
    } else {
      deleteConfigValue('apiKey');
    }
    if (config.baseUrl) {
      setConfigValue('baseUrl', config.baseUrl);
    } else {
      deleteConfigValue('baseUrl');
    }
  }, []);

  return { runtimeConfig, runtimeConfigRef, applyRuntimeConfig, saveRuntimeConfig };
}
