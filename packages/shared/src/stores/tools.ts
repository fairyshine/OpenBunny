/**
 * Tool Store — manages enabled built-in tools and MCP connections
 * Simplified for AI SDK integration
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { builtinTools } from '../services/ai/tools';

interface MCPConnection {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'connecting';
}

interface ToolState {
  mcpConnections: MCPConnection[];
  loading: boolean;
  error: string | null;

  addMCPConnection: (name: string, url: string) => void;
  removeMCPConnection: (id: string) => void;
  updateMCPStatus: (id: string, status: MCPConnection['status']) => void;
}

export const useToolStore = create<ToolState>()(
  persist(
    (set, _get) => ({
      mcpConnections: [],
      loading: false,
      error: null,

      addMCPConnection: (name, url) => {
        const id = `mcp_${Date.now()}`;
        set(state => ({
          mcpConnections: [...state.mcpConnections, { id, name, url, status: 'disconnected' }],
        }));
      },

      removeMCPConnection: (id) => {
        set(state => ({
          mcpConnections: state.mcpConnections.filter(c => c.id !== id),
        }));
      },

      updateMCPStatus: (id, status) => {
        set(state => ({
          mcpConnections: state.mcpConnections.map(c =>
            c.id === id ? { ...c, status } : c
          ),
        }));
      },
    }),
    {
      name: 'tool-storage',
      partialize: (state) => ({
        mcpConnections: state.mcpConnections,
      }),
    }
  )
);

/**
 * Get list of all available built-in tool IDs
 */
export function getBuiltinToolIds(): string[] {
  return Object.keys(builtinTools);
}
