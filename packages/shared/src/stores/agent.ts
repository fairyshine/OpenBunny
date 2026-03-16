/**
 * Agent Store — manages independent agent workspaces.
 * Each agent has its own sessions, files, LLM config, tools, and skills.
 * A built-in default agent always exists and cannot be deleted.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Agent, LLMConfig, Session, Message, SessionType, AgentRelationship, AgentGroup, MindSessionMeta, ChatSessionMeta } from '../types';
import { deleteSessionPersistence, flushAllSessionPersistence, persistSessionMessages } from '../services/storage/sessionPersistence';
import { flushSessionMessages, loadNormalizedSessionMessages } from '../services/storage/sessionMessages';
import { deleteAgentSessionState, deleteAgentState, markStreamingAgentSessionsInterruptedState, normalizeHydratedAgentState } from './agentStateHelpers';
import { appendSessionMessageState, replaceSessionMessagesState, stripTransientSessionState, updateSessionChatMetaState, updateSessionMessageState, updateSessionMindMetaState } from './sessionStateHelpers';

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
  clearAgentSessionMessages: (agentId: string, sessionId: string) => void;
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
        const agent = get().agents.find((candidate) => candidate.id === id);
        if (!agent || agent.isDefault) return;

        for (const session of get().agentSessions[id] || []) {
          void deleteSessionPersistence(session.id);
        }

        set((state) => deleteAgentState(state, id, DEFAULT_AGENT_ID));
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
        void deleteSessionPersistence(sessionId);
        set((state) => {
          const nextSessionState = deleteAgentSessionState({
            sessions: state.agentSessions[agentId] || [],
            currentSessionId: state.agentCurrentSessionId[agentId] ?? null,
          }, sessionId);

          return {
            agentSessions: { ...state.agentSessions, [agentId]: nextSessionState.sessions },
            agentCurrentSessionId: { ...state.agentCurrentSessionId, [agentId]: nextSessionState.currentSessionId },
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
            persistSessionMessages(sessionId, updated.messages);
          }
          return { agentSessions: { ...state.agentSessions, [agentId]: sessions } };
        });
      },

      clearAgentSessionMessages: (agentId, sessionId) => {
        set((state) => {
          const session = (state.agentSessions[agentId] || []).find((candidate) => candidate.id === sessionId);
          if (!session || session.messages.length === 0) {
            return state;
          }

          const clearedAt = Date.now();
          const { sessions } = replaceSessionMessagesState(
            state.agentSessions[agentId] || [],
            sessionId,
            [],
          );

          persistSessionMessages(sessionId, []);

          return {
            agentSessions: {
              ...state.agentSessions,
              [agentId]: sessions.map((candidate) => (
                candidate.id === sessionId
                  ? { ...candidate, updatedAt: clearedAt }
                  : candidate
              )),
            },
          };
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
            persistSessionMessages(sessionId, updated.messages);
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
        set((state) => {
          const { agentSessions, changed } = markStreamingAgentSessionsInterruptedState(
            state.agentSessions,
            persistSessionMessages,
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

        const messages = await loadNormalizedSessionMessages(sessionId);
        if (messages.length === 0) return;

        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentId]: replaceSessionMessagesState(state.agentSessions[agentId] || [], sessionId, messages).sessions,
          },
        }));
      },

      flushAgentMessages: async (_agentId, sessionId) => {
        await flushSessionMessages(sessionId);
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
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined'
          ? localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
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

          const normalizedState = normalizeHydratedAgentState({
            agents: state.agents,
            agentSessions: state.agentSessions,
            agentCurrentSessionId: state.agentCurrentSessionId,
            agentProjects: state.agentProjects,
            defaultAgentId: DEFAULT_AGENT_ID,
            createDefaultAgent,
          });

          state.agents = normalizedState.agents;
          state.agentSessions = normalizedState.agentSessions;
          state.agentCurrentSessionId = normalizedState.agentCurrentSessionId;
          state.agentProjects = normalizedState.agentProjects;
        };
      },
    }
  )
);


if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useAgentStore.getState().markStreamingAgentSessionsInterrupted();
    void flushAllSessionPersistence();
  });
}
