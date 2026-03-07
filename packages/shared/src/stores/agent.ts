/**
 * Agent Store — manages independent agent workspaces.
 * Each agent has its own sessions, files, LLM config, tools, and skills.
 * A built-in default agent always exists and cannot be deleted.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, LLMConfig, Session, Message, SessionType } from '../types';
import { messageStorage } from '../services/storage/messageStorage';

const DEFAULT_AGENT_ID = 'default';

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
};

const DEFAULT_TOOLS = ['python', 'web_search', 'file_manager', 'memory'];

function createDefaultAgent(): Agent {
  return {
    id: DEFAULT_AGENT_ID,
    name: 'CyberBunny',
    avatar: '🐰',
    description: '',
    systemPrompt: '',
    color: '#3b82f6',
    isDefault: true,
    llmConfig: { ...DEFAULT_LLM_CONFIG },
    enabledTools: [...DEFAULT_TOOLS],
    enabledSkills: [],
    filesRoot: '/root',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

interface AgentState {
  agents: Agent[];
  currentAgentId: string;

  // Agent CRUD
  createAgent: (data: Pick<Agent, 'name' | 'avatar' | 'description' | 'systemPrompt' | 'color'>) => Agent;
  updateAgent: (id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt' | 'isDefault'>>) => void;
  deleteAgent: (id: string) => void;
  setCurrentAgent: (id: string) => void;

  // Per-agent sessions
  agentSessions: Record<string, Session[]>;
  agentCurrentSessionId: Record<string, string | null>;
  createAgentSession: (agentId: string, name?: string, projectId?: string) => Session;
  deleteAgentSession: (agentId: string, sessionId: string) => void;
  setAgentCurrentSession: (agentId: string, sessionId: string) => void;
  addAgentMessage: (agentId: string, sessionId: string, message: Message) => void;
  updateAgentMessage: (agentId: string, sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setAgentSessionStreaming: (agentId: string, sessionId: string, isStreaming: boolean) => void;
  moveAgentSessionToProject: (agentId: string, sessionId: string, projectId: string | null) => void;

  // Per-agent projects
  agentProjects: Record<string, import('../types').Project[]>;
  createAgentProject: (agentId: string, name: string, description?: string, color?: string, icon?: string) => import('../types').Project;
  updateAgentProject: (agentId: string, projectId: string, updates: Partial<Omit<import('../types').Project, 'id' | 'createdAt' | 'agentId'>>) => void;
  deleteAgentProject: (agentId: string, projectId: string) => void;

  // Per-agent config
  setAgentLLMConfig: (agentId: string, config: Partial<LLMConfig>) => void;
  setAgentEnabledTools: (agentId: string, tools: string[]) => void;
  setAgentEnabledSkills: (agentId: string, skills: string[]) => void;
}

export { DEFAULT_AGENT_ID };

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [createDefaultAgent()],
      currentAgentId: DEFAULT_AGENT_ID,
      agentSessions: { [DEFAULT_AGENT_ID]: [] },
      agentCurrentSessionId: { [DEFAULT_AGENT_ID]: null },
      agentProjects: { [DEFAULT_AGENT_ID]: [] },

      createAgent: (data) => {
        const id = crypto.randomUUID();
        const agent: Agent = {
          ...data,
          id,
          llmConfig: { ...DEFAULT_LLM_CONFIG },
          enabledTools: [...DEFAULT_TOOLS],
          enabledSkills: [],
          filesRoot: `/root/.agents/${id}/files`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          agents: [...state.agents, agent],
          agentSessions: { ...state.agentSessions, [id]: [] },
          agentCurrentSessionId: { ...state.agentCurrentSessionId, [id]: null },
          agentProjects: { ...state.agentProjects, [id]: [] },
        }));
        return agent;
      },

      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
          ),
        }));
      },

      deleteAgent: (id) => {
        // Cannot delete the default agent
        const agent = get().agents.find((a) => a.id === id);
        if (!agent || agent.isDefault) return;

        // Clean up sessions from IndexedDB
        const sessions = get().agentSessions[id] || [];
        for (const s of sessions) {
          messageStorage.delete(s.id);
        }
        set((state) => {
          const { [id]: _sessions, ...restSessions } = state.agentSessions;
          const { [id]: _currentId, ...restCurrentIds } = state.agentCurrentSessionId;
          const { [id]: _projects, ...restProjects } = state.agentProjects;
          return {
            agents: state.agents.filter((a) => a.id !== id),
            currentAgentId: state.currentAgentId === id ? DEFAULT_AGENT_ID : state.currentAgentId,
            agentSessions: restSessions,
            agentCurrentSessionId: restCurrentIds,
            agentProjects: restProjects,
          };
        });
      },

      setCurrentAgent: (id) => set({ currentAgentId: id }),

      // Per-agent sessions
      createAgentSession: (agentId, name = '新会话', projectId) => {
        const session: Session = {
          id: crypto.randomUUID(),
          name,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sessionType: 'user' as SessionType,
          projectId,
        };
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: [session, ...(state.agentSessions[agentId] || [])],
          },
          agentCurrentSessionId: {
            ...state.agentCurrentSessionId,
            [agentId]: session.id,
          },
        }));
        return session;
      },

      deleteAgentSession: (agentId, sessionId) => {
        messageStorage.delete(sessionId);
        set((state) => {
          const sessions = (state.agentSessions[agentId] || []).filter((s) => s.id !== sessionId);
          const currentId = state.agentCurrentSessionId[agentId] === sessionId
            ? (sessions[0]?.id || null)
            : state.agentCurrentSessionId[agentId];
          return {
            agentSessions: { ...state.agentSessions, [agentId]: sessions },
            agentCurrentSessionId: { ...state.agentCurrentSessionId, [agentId]: currentId },
          };
        });
      },

      setAgentCurrentSession: (agentId, sessionId) => {
        set((state) => ({
          agentCurrentSessionId: { ...state.agentCurrentSessionId, [agentId]: sessionId },
        }));
      },

      addAgentMessage: (agentId, sessionId, message) => {
        set((state) => {
          const sessions = (state.agentSessions[agentId] || []).map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
              : s
          );
          const updated = sessions.find((s) => s.id === sessionId);
          if (updated) {
            messageStorage.save(sessionId, updated.messages);
          }
          return { agentSessions: { ...state.agentSessions, [agentId]: sessions } };
        });
      },

      updateAgentMessage: (agentId, sessionId, messageId, updates) => {
        set((state) => {
          const sessions = (state.agentSessions[agentId] || []).map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId
                      ? { ...m, ...updates, metadata: updates.metadata ? { ...m.metadata, ...updates.metadata } : m.metadata }
                      : m
                  ),
                }
              : s
          );
          const updated = sessions.find((s) => s.id === sessionId);
          if (updated) {
            messageStorage.save(sessionId, updated.messages);
          }
          return { agentSessions: { ...state.agentSessions, [agentId]: sessions } };
        });
      },

      setAgentSessionStreaming: (agentId, sessionId, isStreaming) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((s) =>
              s.id === sessionId ? { ...s, isStreaming } : s
            ),
          },
        }));
      },

      moveAgentSessionToProject: (agentId, sessionId, projectId) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((s) =>
              s.id === sessionId ? { ...s, projectId: projectId || undefined, updatedAt: Date.now() } : s
            ),
          },
        }));
      },

      // Per-agent projects
      createAgentProject: (agentId, name, description, color, icon) => {
        const project: import('../types').Project = {
          id: crypto.randomUUID(),
          name,
          description,
          color: color || '#3b82f6',
          icon: icon || 'folder-open',
          agentId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          agentProjects: {
            ...state.agentProjects,
            [agentId]: [...(state.agentProjects[agentId] || []), project],
          },
        }));

        return project;
      },

      updateAgentProject: (agentId, projectId, updates) => {
        set((state) => ({
          agentProjects: {
            ...state.agentProjects,
            [agentId]: (state.agentProjects[agentId] || []).map((p) =>
              p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p
            ),
          },
        }));
      },

      deleteAgentProject: (agentId, projectId) => {
        set((state) => ({
          agentProjects: {
            ...state.agentProjects,
            [agentId]: (state.agentProjects[agentId] || []).filter((p) => p.id !== projectId),
          },
          // Remove projectId from sessions in this project
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((s) =>
              s.projectId === projectId ? { ...s, projectId: undefined } : s
            ),
          },
        }));
      },

      // Per-agent config
      setAgentLLMConfig: (agentId, config) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, llmConfig: { ...a.llmConfig, ...config }, updatedAt: Date.now() } : a
          ),
        }));
      },

      setAgentEnabledTools: (agentId, tools) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, enabledTools: tools, updatedAt: Date.now() } : a
          ),
        }));
      },

      setAgentEnabledSkills: (agentId, skills) => {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, enabledSkills: skills, updatedAt: Date.now() } : a
          ),
        }));
      },
    }),
    {
      name: 'webagent-agents',
      partialize: (state) => ({
        agents: state.agents,
        currentAgentId: state.currentAgentId,
        agentSessions: Object.fromEntries(
          Object.entries(state.agentSessions).map(([agentId, sessions]) => [
            agentId,
            sessions.map((s) => ({ ...s, messages: [] })),
          ])
        ),
        agentCurrentSessionId: state.agentCurrentSessionId,
        agentProjects: state.agentProjects,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return;
          // Ensure default agent always exists after rehydration
          const hasDefault = state.agents.some((a) => a.isDefault);
          if (!hasDefault) {
            state.agents = [createDefaultAgent(), ...state.agents];
          }
          // Ensure default agent has sessions entry
          if (!state.agentSessions[DEFAULT_AGENT_ID]) {
            state.agentSessions[DEFAULT_AGENT_ID] = [];
          }
          if (state.agentCurrentSessionId[DEFAULT_AGENT_ID] === undefined) {
            state.agentCurrentSessionId[DEFAULT_AGENT_ID] = null;
          }
          // Ensure default agent has projects entry
          if (!state.agentProjects[DEFAULT_AGENT_ID]) {
            state.agentProjects[DEFAULT_AGENT_ID] = [];
          }
        };
      },
    }
  )
);
