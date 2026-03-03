import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setProxyWorkerUrl as persistProxyUrl } from '../utils/api';
import { logSettings } from '../services/console/logger';

interface SettingsState {
  // Python 设置
  initializePython: boolean;
  setInitializePython: (value: boolean) => void;

  // MCP 设置
  mcpServers: Array<{
    id: string;
    name: string;
    url: string;
    autoConnect: boolean;
  }>;
  addMCPServer: (server: { name: string; url: string; autoConnect?: boolean }) => void;
  removeMCPServer: (id: string) => void;
  toggleAutoConnect: (id: string) => void;

  // 界面设置
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // 工具设置
  enabledTools: string[];
  toggleTool: (toolId: string) => void;
  enableAllTools: () => void;
  disableAllTools: () => void;

  // CORS 代理设置
  proxyWorkerUrl: string;
  setProxyWorkerUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      initializePython: true,
      setInitializePython: (value) => {
        logSettings('info', `Python 预加载: ${value ? '启用' : '禁用'}`);
        set({ initializePython: value });
      },

      mcpServers: [],
      addMCPServer: (server) =>
        set((state) => ({
          mcpServers: [
            ...state.mcpServers,
            { ...server, id: crypto.randomUUID(), autoConnect: server.autoConnect ?? false },
          ],
        })),
      removeMCPServer: (id) =>
        set((state) => ({
          mcpServers: state.mcpServers.filter((s) => s.id !== id),
        })),
      toggleAutoConnect: (id) =>
        set((state) => ({
          mcpServers: state.mcpServers.map((s) =>
            s.id === id ? { ...s, autoConnect: !s.autoConnect } : s
          ),
        })),

      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          root.classList.add(systemTheme);
        } else {
          root.classList.add(theme);
        }
      },

      enabledTools: ['python', 'calculator', 'web_search', 'read_file', 'write_file', 'list_files', 'create_folder'],
      toggleTool: (toolId) =>
        set((state) => {
          const isEnabling = !state.enabledTools.includes(toolId);
          logSettings('info', `工具 ${toolId}: ${isEnabling ? '启用' : '禁用'}`);
          return {
            enabledTools: isEnabling
              ? [...state.enabledTools, toolId]
              : state.enabledTools.filter((id) => id !== toolId),
          };
        }),
      enableAllTools: () => set({ 
        enabledTools: ['python', 'calculator', 'web_search', 'read_file', 'write_file', 
          'list_files', 'create_folder', 'delete_file', 'mcp_tool'] 
      }),
      disableAllTools: () => set({ enabledTools: [] }),

      proxyWorkerUrl: '',
      setProxyWorkerUrl: (url) => {
        logSettings('info', `CORS 代理 URL: ${url || '(未设置)'}`);
        persistProxyUrl(url);
        set({ proxyWorkerUrl: url });
      },
    }),
    {
      name: 'webagent-settings',
    }
  )
);
