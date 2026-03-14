import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logSettings } from '../services/console/logger';
import { isMCPToolId } from '../services/ai/mcpToolId';
import type { UserProfile, AgentProfile, LLMPreset } from '../types';

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'zh-CN' | 'en-US' | 'system';
export type CodeThemePreset = 'github' | 'vscode' | 'one' | 'rose-pine' | 'kanagawa' | 'aurora';

const SUPPORTED_TOOL_IDS = new Set(['python', 'web_search', 'file_manager', 'memory', 'mind', 'chat', 'exec', 'cron', 'heartbeat']);
const DEFAULT_ENABLED_TOOLS = ['python', 'web_search', 'file_manager', 'memory', 'mind', 'chat'];

function isSupportedToolId(toolId: string): boolean {
  return SUPPORTED_TOOL_IDS.has(toolId) || isMCPToolId(toolId);
}

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
  codeThemePreset: CodeThemePreset;
  setCodeThemePreset: (preset: CodeThemePreset) => void;

  // Language settings
  language: Language;
  setLanguage: (lang: Language) => void;

  // Session tabs settings
  enableSessionTabs: boolean;
  setEnableSessionTabs: (value: boolean) => void;

  // Audio settings
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  masterMuted: boolean;
  setMasterMuted: (muted: boolean) => void;
  soundEffectsEnabled: boolean;
  setSoundEffectsEnabled: (value: boolean) => void;

  // Tool settings
  enabledTools: string[];
  toggleTool: (toolId: string) => void;
  enableAllTools: () => void;
  disableAllTools: () => void;

  // CORS proxy settings
  proxyUrl: string;
  setProxyUrl: (url: string) => void;

  // Web search settings
  searchProvider: 'exa_free' | 'exa' | 'brave';
  setSearchProvider: (provider: 'exa_free' | 'exa' | 'brave') => void;
  exaApiKey: string;
  setExaApiKey: (key: string) => void;
  braveApiKey: string;
  setBraveApiKey: (key: string) => void;

  // Dashboard settings
  dashboardCardOrder: string[];
  dashboardVisibleCards: string[];
  setDashboardCardOrder: (order: string[]) => void;
  setDashboardVisibleCards: (cards: string[]) => void;
  toggleDashboardCard: (cardId: string) => void;
  resetDashboardLayout: () => void;

  // User profile
  userProfile: UserProfile;
  setUserProfile: (profile: Partial<UserProfile>) => void;

  // Agent profiles
  agentProfiles: AgentProfile[];
  addAgentProfile: (profile: Omit<AgentProfile, 'id' | 'createdAt'>) => void;
  updateAgentProfile: (id: string, updates: Partial<AgentProfile>) => void;
  removeAgentProfile: (id: string) => void;
  setActiveAgentProfile: (id: string) => void;

  // LLM presets
  llmPresets: LLMPreset[];
  addLLMPreset: (preset: Omit<LLMPreset, 'id' | 'createdAt'>) => LLMPreset;
  updateLLMPreset: (id: string, updates: Partial<Omit<LLMPreset, 'id' | 'createdAt'>>) => void;
  removeLLMPreset: (id: string) => void;
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

      codeThemePreset: 'github',
      setCodeThemePreset: (preset) => {
        logSettings('info', `Code theme preset: ${preset}`);
        set({ codeThemePreset: preset });
      },

      language: 'system',
      setLanguage: (lang) => {
        set({ language: lang });
        onLanguageChange?.(resolveLanguage(lang));
      },

      enableSessionTabs: false,
      setEnableSessionTabs: (value) => {
        logSettings('info', `Session tabs: ${value ? 'enabled' : 'disabled'}`);
        set({ enableSessionTabs: value });
      },

      masterVolume: 0.5,
      setMasterVolume: (volume) => {
        set({ masterVolume: Math.max(0, Math.min(1, volume)) });
      },
      masterMuted: false,
      setMasterMuted: (muted) => {
        logSettings('info', `Master mute: ${muted ? 'on' : 'off'}`);
        set({ masterMuted: muted });
      },
      soundEffectsEnabled: true,
      setSoundEffectsEnabled: (value) => {
        logSettings('info', `Sound effects: ${value ? 'enabled' : 'disabled'}`);
        set({ soundEffectsEnabled: value });
      },

      enabledTools: [...DEFAULT_ENABLED_TOOLS],
      toggleTool: (toolId) =>
        set((state) => {
          if (!isSupportedToolId(toolId)) {
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

      searchProvider: 'exa_free',
      setSearchProvider: (provider) => {
        logSettings('info', `Search provider: ${provider}`);
        set({ searchProvider: provider });
      },

      dashboardCardOrder: [],
      dashboardVisibleCards: [],
      setDashboardCardOrder: (order) => set({ dashboardCardOrder: order }),
      setDashboardVisibleCards: (cards) => set({ dashboardVisibleCards: cards }),
      toggleDashboardCard: (cardId) =>
        set((state) => ({
          dashboardVisibleCards: state.dashboardVisibleCards.includes(cardId)
            ? state.dashboardVisibleCards.filter((id) => id !== cardId)
            : [...state.dashboardVisibleCards, cardId],
        })),
      resetDashboardLayout: () =>
        set({ dashboardCardOrder: [], dashboardVisibleCards: [] }),

      userProfile: { nickname: '', callName: '', bio: '', avatar: '🐰', email: '', location: '' },
      setUserProfile: (profile) =>
        set((state) => ({ userProfile: { ...state.userProfile, ...profile } })),

      agentProfiles: [],
      addAgentProfile: (profile) =>
        set((state) => ({
          agentProfiles: [
            ...state.agentProfiles,
            { ...profile, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      updateAgentProfile: (id, updates) =>
        set((state) => ({
          agentProfiles: state.agentProfiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      removeAgentProfile: (id) =>
        set((state) => ({
          agentProfiles: state.agentProfiles.filter((p) => p.id !== id),
        })),
      setActiveAgentProfile: (id) =>
        set((state) => ({
          agentProfiles: state.agentProfiles.map((p) => ({
            ...p,
            isActive: p.id === id,
          })),
        })),

      llmPresets: [],
      addLLMPreset: (preset) => {
        const newPreset: LLMPreset = { ...preset, id: crypto.randomUUID(), createdAt: Date.now() };
        set((state) => ({ llmPresets: [...state.llmPresets, newPreset] }));
        return newPreset;
      },
      updateLLMPreset: (id, updates) =>
        set((state) => ({
          llmPresets: state.llmPresets.map((p) => p.id === id ? { ...p, ...updates } : p),
        })),
      removeLLMPreset: (id) =>
        set((state) => ({
          llmPresets: state.llmPresets.filter((p) => p.id !== id),
        })),
    }),
    {
      name: 'webagent-settings',
      migrate: (persisted: any, version: number) => {
        if (persisted) {
          // Clean up legacy tool IDs from enabledTools
          if (Array.isArray(persisted.enabledTools)) {
            persisted.enabledTools = persisted.enabledTools.filter(
              (id: string) => isSupportedToolId(id)
            );
          }
          // v1 → v2: migrate soundEnabled/soundVolume to new audio settings
          if (version < 2) {
            if ('soundVolume' in persisted) {
              persisted.masterVolume = persisted.soundVolume;
              delete persisted.soundVolume;
            }
            if ('soundEnabled' in persisted) {
              persisted.soundEffectsEnabled = persisted.soundEnabled;
              delete persisted.soundEnabled;
            }
          }
          if (version < 3 && !persisted.codeThemePreset) {
            persisted.codeThemePreset = 'github';
          }
        }
        return persisted;
      },
      version: 3,
    }
  )
);
