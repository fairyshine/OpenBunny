/**
 * Node.js config store factory — wraps a generic IConfigStore (backed by `conf`, etc.)
 * and wires it to the pure resolve functions + env + session store.
 */

import type { IPlatformStorage } from '../platform';
import type { LLMConfig } from '../types';
import { useSessionStore } from '../stores/session';
import {
  type LLMConfigOverrides,
  resolveLLMConfig as _resolveLLMConfig,
  resolveSystemPrompt as _resolveSystemPrompt,
  resolveWorkspace as _resolveWorkspace,
} from './resolve';

export type ConfigValue = string | number | boolean | null;

export interface IConfigStore {
  get(key: string): any;
  set(key: string, value: any): void;
  delete(key: string): void;
  clear(): void;
  all(): Record<string, any>;
}

export interface NodeConfigFunctions {
  getConfigValue: <T = ConfigValue>(key: string) => T | undefined;
  getAllConfig: () => Record<string, any>;
  setConfigValue: (key: string, value: ConfigValue) => void;
  deleteConfigValue: (key: string) => void;
  clearConfig: () => void;
  createConfigStorage: () => IPlatformStorage;
  resolveLLMConfig: (overrides?: LLMConfigOverrides) => LLMConfig;
  resolveSystemPrompt: (override?: string) => string | undefined;
  resolveWorkspace: (override?: string) => string | undefined;
}

export function createNodeConfigFunctions(
  store: IConfigStore,
  env: Record<string, string | undefined> = {},
): NodeConfigFunctions {
  function getConfigValue<T = ConfigValue>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  }

  function getAllConfig(): Record<string, any> {
    return store.all();
  }

  function setConfigValue(key: string, value: ConfigValue): void {
    store.set(key, value);
  }

  function deleteConfigValue(key: string): void {
    store.delete(key);
  }

  function clearConfig(): void {
    store.clear();
  }

  function createConfigStorage(): IPlatformStorage {
    return {
      getItem(key) {
        const value = store.get(key);
        return value == null ? null : String(value);
      },
      setItem(key, value) {
        store.set(key, value);
      },
      removeItem(key) {
        store.delete(key);
      },
    };
  }

  function resolveLLMConfig(overrides: LLMConfigOverrides = {}): LLMConfig {
    return _resolveLLMConfig(
      overrides,
      env,
      getConfigValue,
      useSessionStore.getState().llmConfig,
    );
  }

  function resolveSystemPrompt(override?: string): string | undefined {
    return _resolveSystemPrompt(override, env, getConfigValue);
  }

  function resolveWorkspace(override?: string): string | undefined {
    return _resolveWorkspace(override, env, getConfigValue);
  }

  return {
    getConfigValue,
    getAllConfig,
    setConfigValue,
    deleteConfigValue,
    clearConfig,
    createConfigStorage,
    resolveLLMConfig,
    resolveSystemPrompt,
    resolveWorkspace,
  };
}
