/**
 * Agent Store — manages independent agent workspaces.
 * Each agent has its own sessions, files, LLM config, tools, and skills.
 * A built-in default agent always exists and cannot be deleted.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, LLMConfig, Session, Message, SessionType, AgentRelationship, AgentGroup, MindSessionMeta, ChatSessionMeta } from '../types';
import { messageStorage } from '../services/storage/messageStorage';
import { normalizeMessagePresentation } from '../utils/messagePresentation';
import { appendSessionMessageState, clearStreamingMessageFlags, stripTransientSessionState, updateSessionChatMetaState, updateSessionMessageState, updateSessionMindMetaState } from './sessionStateHelpers';

const DEFAULT_AGENT_ID = 'default';
const AGENT_FILES_BASE = '/root/.agents';
const AGENT_GROUP_FILES_BASE = '/root/.agent-groups';

export function getAgentFilesRoot(agentId: string) {
  return `${AGENT_FILES_BASE}/${agentId}/files`;
}

export function getAgentGroupFilesRoot(groupId: string) {
  return `${AGENT_GROUP_FILES_BASE}/${groupId}/shared`;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
};

const DEFAULT_TOOLS = ['python', 'web_search', 'file_manager', 'memory', 'mind', 'chat'];

function createDefaultAgent(): Agent {
  return {
    id: DEFAULT_AGENT_ID,
    name: 'OpenBunny',
    avatar: '🐰',
    description: '',
    systemPrompt: '',
    mindUserPrompt: '',
    chatActiveAssistantPrompt: '',
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
  createAgent: (data: Pick<Agent, 'name' | 'avatar' | 'description' | 'systemPrompt' | 'mindUserPrompt' | 'chatActiveAssistantPrompt' | 'color'>) => Agent;
  updateAgent: (id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt' | 'isDefault'>>) => void;
  deleteAgent: (id: string) => void;
  setCurrentAgent: (id: string) => void;

  // Agent relationships
  relationships: AgentRelationship[];
  createRelationship: (sourceAgentId: string, targetAgentId: string, label?: string) => AgentRelationship;
  deleteRelationship: (relationshipId: string) => void;
  updateRelationship: (relationshipId: string, updates: Partial<Pick<AgentRelationship, 'label'>>) => void;

  // Agent groups
  agentGroups: AgentGroup[];
  createAgentGroup: (name: string, color?: string) => AgentGroup;
  updateAgentGroup: (id: string, updates: Partial<Pick<AgentGroup, 'name' | 'color' | 'coreAgentId'>>) => void;
  deleteAgentGroup: (id: string) => void;

  // Per-agent sessions
  agentSessions: Record<string, Session[]>;
  agentCurrentSessionId: Record<string, string | null>;
  createAgentSession: (agentId: string, name?: string, projectId?: string, sessionType?: SessionType) => Session;
  renameAgentSession: (agentId: string, sessionId: string, name: string) => void;
  deleteAgentSession: (agentId: string, sessionId: string) => void;
  setAgentCurrentSession: (agentId: string, sessionId: string | null) => void;
  addAgentMessage: (agentId: string, sessionId: string, message: Message) => void;
  updateAgentMessage: (agentId: string, sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setAgentSessionStreaming: (agentId: string, sessionId: string, isStreaming: boolean) => void;
  markStreamingAgentSessionsInterrupted: () => void;
  setAgentSessionSystemPrompt: (agentId: string, sessionId: string, systemPrompt: string) => void;
  setAgentSessionTools: (agentId: string, sessionId: string, tools: string[] | undefined) => void;
  setAgentSessionSkills: (agentId: string, sessionId: string, skills: string[] | undefined) => void;
  setAgentSessionMindMeta: (agentId: string, sessionId: string, mindSession: MindSessionMeta) => void;
  setAgentSessionChatMeta: (agentId: string, sessionId: string, chatSession: ChatSessionMeta) => void;
  loadAgentSessionMessages: (agentId: string, sessionId: string) => Promise<void>;
  flushAgentMessages: (agentId: string, sessionId: string) => Promise<void>;
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
      relationships: [],
      agentGroups: [],

      createAgent: (data) => {
        const id = crypto.randomUUID();
        const agent: Agent = {
          ...data,
          id,
          mindUserPrompt: data.mindUserPrompt || '',
          chatActiveAssistantPrompt: data.chatActiveAssistantPrompt || '',
          llmConfig: { ...DEFAULT_LLM_CONFIG },
          enabledTools: [...DEFAULT_TOOLS],
          enabledSkills: [],
          filesRoot: getAgentFilesRoot(id),
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
        set((state) => {
          const newAgents = state.agents.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
          );
          // Auto-set as core if joining a group that has no core yet
          let newGroups = state.agentGroups;
          if (updates.groupId) {
            const targetGroup = newGroups.find((g) => g.id === updates.groupId);
            if (targetGroup && !targetGroup.coreAgentId) {
              newGroups = newGroups.map((g) =>
                g.id === updates.groupId ? { ...g, coreAgentId: id } : g
              );
            }
          }
          return { agents: newAgents, agentGroups: newGroups };
        });
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
          const remainingAgents = state.agents.filter((a) => a.id !== id);
          return {
            agents: remainingAgents,
            currentAgentId: state.currentAgentId === id ? DEFAULT_AGENT_ID : state.currentAgentId,
            agentSessions: restSessions,
            agentCurrentSessionId: restCurrentIds,
            agentProjects: restProjects,
            agentGroups: state.agentGroups.map((g) => {
              if (g.coreAgentId !== id) return g;
              // Re-assign core to first remaining member
              const nextCore = remainingAgents.find((a) => a.groupId === g.id);
              return { ...g, coreAgentId: nextCore?.id };
            }),
          };
        });
      },

      setCurrentAgent: (id) => set({ currentAgentId: id }),

      // Agent relationships
      createRelationship: (sourceAgentId, targetAgentId, label) => {
        if (sourceAgentId === targetAgentId) {
          return {
            id: '',
            sourceAgentId,
            targetAgentId,
            label,
            createdAt: Date.now(),
          };
        }

        const existing = get().relationships.find(
          (relationship) =>
            (relationship.sourceAgentId === sourceAgentId && relationship.targetAgentId === targetAgentId) ||
            (relationship.sourceAgentId === targetAgentId && relationship.targetAgentId === sourceAgentId)
        );

        if (existing) {
          return existing;
        }

        const relationship: AgentRelationship = {
          id: crypto.randomUUID(),
          sourceAgentId,
          targetAgentId,
          label,
          createdAt: Date.now(),
        };
        set((state) => ({
          relationships: [...state.relationships, relationship],
        }));
        return relationship;
      },

      deleteRelationship: (relationshipId) => {
        set((state) => ({
          relationships: state.relationships.filter((r) => r.id !== relationshipId),
        }));
      },

      updateRelationship: (relationshipId, updates) => {
        set((state) => ({
          relationships: state.relationships.map((r) =>
            r.id === relationshipId ? { ...r, ...updates } : r
          ),
        }));
      },

      // Agent groups
      createAgentGroup: (name, color) => {
        const group: AgentGroup = {
          id: crypto.randomUUID(),
          name,
          color,
          createdAt: Date.now(),
        };
        set((state) => ({ agentGroups: [...state.agentGroups, group] }));
        return group;
      },

      updateAgentGroup: (id, updates) => {
        set((state) => ({
          agentGroups: state.agentGroups.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
      },

      deleteAgentGroup: (id) => {
        set((state) => ({
          agentGroups: state.agentGroups.filter((g) => g.id !== id),
          // Ungroup agents in this group
          agents: state.agents.map((a) =>
            a.groupId === id ? { ...a, groupId: undefined, updatedAt: Date.now() } : a
          ),
        }));
      },

      // Per-agent sessions
      createAgentSession: (agentId, name = '新会话', projectId, sessionType: SessionType = 'user') => {
        const session: Session = {
          id: crypto.randomUUID(),
          name,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sessionType,
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

      renameAgentSession: (agentId, sessionId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((session) =>
              session.id === sessionId
                ? { ...session, name: trimmed, updatedAt: Date.now() }
                : session
            ),
          },
        }));
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
          const { sessions, updatedSession: updated } = appendSessionMessageState(
            state.agentSessions[agentId] || [],
            sessionId,
            message,
          );
          if (updated) {
            messageStorage.save(sessionId, updated.messages);
          }
          return { agentSessions: { ...state.agentSessions, [agentId]: sessions } };
        });
      },

      updateAgentMessage: (agentId, sessionId, messageId, updates) => {
        set((state) => {
          const { sessions, updatedSession: updated } = updateSessionMessageState(
            state.agentSessions[agentId] || [],
            sessionId,
            messageId,
            updates,
          );
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
              s.id === sessionId
                ? { ...s, isStreaming, interruptedAt: isStreaming ? undefined : s.interruptedAt }
                : s
            ),
          },
        }));
      },

      markStreamingAgentSessionsInterrupted: () => {
        const now = Date.now();
        set((state) => {
          let changed = false;
          const agentSessions = Object.fromEntries(
            Object.entries(state.agentSessions).map(([agentId, sessions]) => [
              agentId,
              sessions.map((session) => {
                if (!session.isStreaming) return session;
                changed = true;
                const messages = clearStreamingMessageFlags(session.messages);
                messageStorage.save(session.id, messages);
                return {
                  ...session,
                  messages,
                  isStreaming: false,
                  interruptedAt: now,
                  updatedAt: now,
                };
              }),
            ])
          );

          return changed ? { agentSessions } : state;
        });
      },

      setAgentSessionSystemPrompt: (agentId, sessionId, systemPrompt) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((session) =>
              session.id === sessionId
                ? { ...session, systemPrompt, updatedAt: Date.now() }
                : session
            ),
          },
        }));
      },

      setAgentSessionTools: (agentId, sessionId, tools) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((session) =>
              session.id === sessionId
                ? { ...session, sessionTools: tools, updatedAt: Date.now() }
                : session
            ),
          },
        }));
      },

      setAgentSessionSkills: (agentId, sessionId, skills) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((session) =>
              session.id === sessionId
                ? { ...session, sessionSkills: skills, updatedAt: Date.now() }
                : session
            ),
          },
        }));
      },

      setAgentSessionMindMeta: (agentId, sessionId, mindSession) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: updateSessionMindMetaState(state.agentSessions[agentId] || [], sessionId, mindSession),
          },
        }));
      },

      setAgentSessionChatMeta: (agentId, sessionId, chatSession) => {
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: updateSessionChatMetaState(state.agentSessions[agentId] || [], sessionId, chatSession),
          },
        }));
      },

      loadAgentSessionMessages: async (agentId, sessionId) => {
        const session = (get().agentSessions[agentId] || []).find((s) => s.id === sessionId);
        if (!session || session.messages.length > 0) return;

        const messages = (await messageStorage.load(sessionId)).map((message) => normalizeMessagePresentation(message));
        if (messages.length === 0) return;

        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: (state.agentSessions[agentId] || []).map((s) =>
              s.id === sessionId ? { ...s, messages } : s
            ),
          },
        }));
      },

      flushAgentMessages: async (_agentId, sessionId) => {
        await messageStorage.flush(sessionId);
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
        relationships: state.relationships,
        agentGroups: state.agentGroups,
        agentSessions: Object.fromEntries(
          Object.entries(state.agentSessions).map(([agentId, sessions]) => [
            agentId,
            sessions.map((s) => ({ ...stripTransientSessionState(s), messages: [] })),
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

          const defaultAgent = state.agents.find((a) => a.id === DEFAULT_AGENT_ID || a.isDefault);
          if (defaultAgent) {
            defaultAgent.id = DEFAULT_AGENT_ID;
            defaultAgent.isDefault = true;
            if (!defaultAgent.name || defaultAgent.name === 'CyberBunny') {
              defaultAgent.name = 'OpenBunny';
            }
            defaultAgent.mindUserPrompt = defaultAgent.mindUserPrompt || '';
            defaultAgent.chatActiveAssistantPrompt = defaultAgent.chatActiveAssistantPrompt || '';
          }

          state.agents = state.agents.map((agent) => ({
            ...agent,
            mindUserPrompt: agent.mindUserPrompt || '',
            chatActiveAssistantPrompt: agent.chatActiveAssistantPrompt || '',
          }));

          // Ensure default agent has sessions entry
          if (!state.agentSessions[DEFAULT_AGENT_ID]) {
            state.agentSessions[DEFAULT_AGENT_ID] = [];
          }
          state.agentSessions = Object.fromEntries(
            Object.entries(state.agentSessions).map(([agentId, sessions]) => [
              agentId,
              sessions.map((session) => stripTransientSessionState(session)),
            ])
          );
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


if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useAgentStore.getState().markStreamingAgentSessionsInterrupted();
    messageStorage.flushAll();
  });
}
