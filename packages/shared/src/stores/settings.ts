import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logSettings } from '../services/console/logger';

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'zh-CN' | 'en-US' | 'system';

const SUPPORTED_TOOL_IDS = new Set(['python', 'web_search', 'file_manager', 'memory', 'exec']);
const DEFAULT_ENABLED_TOOLS = ['python', 'web_search', 'file_manager', 'memory'];

// Platform-injected callbacks
let onThemeChange: ((theme: Theme) => void) | null = null;
let onLanguageChange: ((lang: string) => void) | null = null;

export function setThemeHandler(handler: (theme: Theme) => void) {
  onThemeChange = handler;
}

export function setLanguageHandler(handler: (lang: string) => void) {
  onLanguageChange = handler;
}

export function resolveLanguage(lang: Language): string {
  if (lang !== 'system') return lang;
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language || '';
    return nav.startsWith('zh') ? 'zh-CN' : 'en-US';
  }
  return 'en-US';
}

interface SettingsState {
  // Python settings
  initializePython: boolean;
  setInitializePython: (value: boolean) => void;

  // Exec settings
  execLoginShell: boolean;
  setExecLoginShell: (value: boolean) => void;

  // Tool execution settings
  toolExecutionTimeout: number;
  setToolExecutionTimeout: (timeout: number) => void;

  // UI settings
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Language settings
  language: Language;
  setLanguage: (lang: Language) => void;

  // Session tabs settings
  enableSessionTabs: boolean;
  setEnableSessionTabs: (value: boolean) => void;

  // Tool settings
  enabledTools: string[];
  toggleTool: (toolId: string) => void;
  enableAllTools: () => void;
  disableAllTools: () => void;

  // CORS proxy settings
  proxyUrl: string;
  setProxyUrl: (url: string) => void;

  // Web search settings
  searchProvider: 'exa' | 'brave';
  setSearchProvider: (provider: 'exa' | 'brave') => void;
  exaApiKey: string;
  setExaApiKey: (key: string) => void;
  braveApiKey: string;
  setBraveApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      initializePython: true,
      setInitializePython: (value) => {
        logSettings('info', `Python preload: ${value ? 'enabled' : 'disabled'}`);
        set({ initializePython: value });
      },

      execLoginShell: true,
      setExecLoginShell: (value) => {
        logSettings('info', `Exec login shell: ${value ? 'enabled' : 'disabled'}`);
        set({ execLoginShell: value });
      },

      toolExecutionTimeout: 300000, // 5 minutes default
      setToolExecutionTimeout: (timeout) => {
        logSettings('info', `Tool execution timeout: ${timeout}ms`);
        set({ toolExecutionTimeout: timeout });
      },

      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        onThemeChange?.(theme);
      },

      language: 'system',
      setLanguage: (lang) => {
        set({ language: lang });
        onLanguageChange?.(resolveLanguage(lang));
      },

      enableSessionTabs: true,
      setEnableSessionTabs: (value) => {
        logSettings('info', `Session tabs: ${value ? 'enabled' : 'disabled'}`);
        set({ enableSessionTabs: value });
      },

      enabledTools: [...DEFAULT_ENABLED_TOOLS],
      toggleTool: (toolId) =>
        set((state) => {
          if (!SUPPORTED_TOOL_IDS.has(toolId)) {
            return state;
          }
          const isEnabling = !state.enabledTools.includes(toolId);
          logSettings('info', `Tool ${toolId}: ${isEnabling ? 'enabled' : 'disabled'}`);
          return {
            enabledTools: isEnabling
              ? [...state.enabledTools, toolId]
              : state.enabledTools.filter((id) => id !== toolId),
          };
        }),
      enableAllTools: () => set({
        enabledTools: Array.from(SUPPORTED_TOOL_IDS)
      }),
      disableAllTools: () => set({ enabledTools: [] }),

      proxyUrl: '',
      setProxyUrl: (url) => {
        logSettings('info', `CORS proxy URL: ${url || '(not set)'}`);
        set({ proxyUrl: url });
      },

      exaApiKey: '',
      setExaApiKey: (key) => {
        logSettings('info', `Exa API Key: ${key ? 'configured' : '(not set)'}`);
        set({ exaApiKey: key });
      },

      braveApiKey: '',
      setBraveApiKey: (key) => {
        logSettings('info', `Brave API Key: ${key ? 'configured' : '(not set)'}`);
        set({ braveApiKey: key });
      },

      searchProvider: 'exa',
      setSearchProvider: (provider) => {
        logSettings('info', `Search provider: ${provider}`);
        set({ searchProvider: provider });
      },
    }),
    {
      name: 'webagent-settings',
    }
  )
);
