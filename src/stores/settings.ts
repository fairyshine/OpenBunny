import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setProxyWorkerUrl as persistProxyUrl } from '../utils/api';
import { logSettings } from '../services/console/logger';
import { applyTheme, type Theme } from '../utils/theme';
import i18n from '../i18n';

export type Language = 'zh-CN' | 'en-US' | 'system';

function resolveLanguage(lang: Language): string {
  if (lang !== 'system') return lang;
  const nav = navigator.language || '';
  return nav.startsWith('zh') ? 'zh-CN' : 'en-US';
}

interface SettingsState {
  // Python settings
  initializePython: boolean;
  setInitializePython: (value: boolean) => void;

  // UI settings
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Language settings
  language: Language;
  setLanguage: (lang: Language) => void;

  // Tool settings
  enabledTools: string[];
  toggleTool: (toolId: string) => void;
  enableAllTools: () => void;
  disableAllTools: () => void;

  // CORS proxy settings
  proxyWorkerUrl: string;
  setProxyWorkerUrl: (url: string) => void;

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

      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      language: 'system',
      setLanguage: (lang) => {
        set({ language: lang });
        i18n.changeLanguage(resolveLanguage(lang));
      },

      enabledTools: ['python', 'calculator', 'web_search', 'read_file', 'write_file', 'list_files', 'create_folder', 'memory'],
      toggleTool: (toolId) =>
        set((state) => {
          const isEnabling = !state.enabledTools.includes(toolId);
          logSettings('info', `Tool ${toolId}: ${isEnabling ? 'enabled' : 'disabled'}`);
          return {
            enabledTools: isEnabling
              ? [...state.enabledTools, toolId]
              : state.enabledTools.filter((id) => id !== toolId),
          };
        }),
      enableAllTools: () => set({
        enabledTools: ['python', 'calculator', 'web_search', 'read_file', 'write_file',
          'list_files', 'create_folder', 'delete_file', 'memory']
      }),
      disableAllTools: () => set({ enabledTools: [] }),

      proxyWorkerUrl: '',
      setProxyWorkerUrl: (url) => {
        logSettings('info', `CORS proxy URL: ${url || '(not set)'}`);
        persistProxyUrl(url);
        set({ proxyWorkerUrl: url });
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
