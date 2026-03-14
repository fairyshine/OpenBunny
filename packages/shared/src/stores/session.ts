import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Message, LLMConfig, SessionType, Project, MindSessionMeta, ChatSessionMeta } from '../types';
import { logSettings } from '../services/console/logger';
import { clearAllSessionPersistence, deleteSessionPersistence, deleteSessionPersistenceBatch, flushAllSessionPersistence, persistSessionMessages } from '../services/storage/sessionPersistence';
import { flushSessionMessages, loadNormalizedSessionMessages } from '../services/storage/sessionMessages';
import {
  appendSessionMessageState,
  closeSessionTabState,
  computeSessionStats,
  deleteSessionState,
  getMessageTokenCount,
  markStreamingSessionsInterruptedState,
  mergePersistedSessionMessages,
  permanentlyDeleteSessionState,
  replaceSessionMessagesState,
  restoreSessionState,
  SessionStats,
  stripTransientSessionState,
  updateSessionChatMetaState,
  updateSessionMessageState,
  updateSessionMindMetaState,
  clearDeletedSessionsState,
} from './sessionStateHelpers';

interface SessionState {
  sessions: Session[];
  projects: Project[];
  currentSessionId: string | null;
  openSessionIds: string[]; // 打开的会话标签页
  llmConfig: LLMConfig;
  sessionStats: SessionStats;

  // Session Actions
  createSession: (name?: string, sessionType?: SessionType, projectId?: string) => Session;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  restoreSession: (id: string) => void;
  permanentlyDeleteSession: (id: string) => void;
  clearTrash: () => void;
  setCurrentSession: (id: string) => void;
  clearCurrentSession: () => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setLLMConfig: (config: Partial<LLMConfig>) => void;
  clearAllSessions: () => void;
  setSessionStreaming: (sessionId: string, isStreaming: boolean) => void;
  markStreamingSessionsInterrupted: () => void;
  setSessionSystemPrompt: (sessionId: string, systemPrompt: string) => void;
  openSession: (id: string) => void;
  closeSession: (id: string) => void;
  loadSessionMessages: (sessionId: string) => Promise<void>;
  flushMessages: (sessionId: string) => Promise<void>;
  moveSessionToProject: (sessionId: string, projectId: string | null) => void;
  /** Set per-session tool overrides (undefined to clear) */
  setSessionTools: (sessionId: string, tools: string[] | undefined) => void;
  /** Set per-session skill overrides (undefined to clear) */
  setSessionSkills: (sessionId: string, skills: string[] | undefined) => void;
  setSessionMindMeta: (sessionId: string, mindSession: MindSessionMeta) => void;
  setSessionChatMeta: (sessionId: string, chatSession: ChatSessionMeta) => void;
  /** Recalculate stats from scratch (e.g. after migration or loadSessionMessages) */
  recalcStats: () => void;

  // Project Actions
  createProject: (name: string, description?: string, color?: string, icon?: string) => Project;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
}

// Selector to get current session (derived from sessions + currentSessionId)
export const selectCurrentSession = (state: SessionState): Session | null => {
  if (!state.currentSessionId) return null;
  return state.sessions.find(s => s.id === state.currentSessionId) || null;
};

// Selector to get active sessions (not deleted)
export const selectActiveSessions = (state: SessionState): Session[] => {
  return state.sessions.filter(s => !s.deletedAt);
};

// Selector to get deleted sessions (in trash)
export const selectDeletedSessions = (state: SessionState): Session[] => {
  return state.sessions.filter(s => s.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      projects: [],
      currentSessionId: null,
      openSessionIds: [],
      sessionStats: { sessionCount: 0, totalMessages: 0, totalTokens: 0 },
      llmConfig: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
      },

      recalcStats: () => {
        set((state) => ({ sessionStats: computeSessionStats(state.sessions) }));
      },

      createSession: (name = '新会话', sessionType: SessionType = 'user', projectId?: string) => {
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
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          openSessionIds: [...state.openSessionIds, session.id],
          sessionStats: {
            ...state.sessionStats,
            sessionCount: state.sessionStats.sessionCount + 1,
          },
        }));

        return session;
      },

      renameSession: (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s
          ),
        }));
      },

      deleteSession: (id: string) => {
        set((state) => deleteSessionState(state, id));
      },

      restoreSession: (id: string) => {
        set((state) => restoreSessionState(state, id));
      },

      permanentlyDeleteSession: (id: string) => {
        void deleteSessionPersistence(id, { includeStats: true });
        set((state) => permanentlyDeleteSessionState(state, id));
      },

      clearTrash: () => {
        const trashed = get().sessions.filter((session) => session.deletedAt);
        void deleteSessionPersistenceBatch(trashed.map((session) => session.id), { includeStats: true });
        set((state) => ({
          sessions: clearDeletedSessionsState(state.sessions),
        }));
      },

      setCurrentSession: (id: string) => {
        const session = get().sessions.find((s) => s.id === id);
        if (session) {
          set({ currentSessionId: id });
        }
      },

      clearCurrentSession: () => {
        set({ currentSessionId: null });
      },

      addMessage: (sessionId: string, message: Message) => {
        set((state) => {
          const target = state.sessions.find(s => s.id === sessionId);
          const isActive = target && !target.deletedAt;
          const { sessions: newSessions, updatedSession: updated } = appendSessionMessageState(
            state.sessions,
            sessionId,
            message,
            { skipDeleted: true },
          );

          // Async persist to IndexedDB (debounced)
          if (updated) {
            persistSessionMessages(sessionId, updated.messages);
          }

          const sessionStats = isActive ? {
            ...state.sessionStats,
            totalMessages: state.sessionStats.totalMessages + 1,
            totalTokens: state.sessionStats.totalTokens + getMessageTokenCount(message),
          } : state.sessionStats;

          return { sessions: newSessions, sessionStats };
        });
      },

      updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
        set((state) => {
          // Find old token count for delta calculation
          const session = state.sessions.find(s => s.id === sessionId);
          const previousMessage = session?.messages.find(m => m.id === messageId);
          const oldTokens = previousMessage ? getMessageTokenCount(previousMessage) : 0;

          const {
            sessions: newSessions,
            updatedSession: updated,
            nextMessage: newMsg,
          } = updateSessionMessageState(state.sessions, sessionId, messageId, updates, { skipDeleted: true });

          // Async persist to IndexedDB (debounced)
          if (updated) {
            persistSessionMessages(sessionId, updated.messages);
          }

          // Calculate new token count from the updated message
          const newTokens = newMsg ? getMessageTokenCount(newMsg) : 0;
          const tokenDelta = newTokens - oldTokens;

          const sessionStats = tokenDelta !== 0 ? {
            ...state.sessionStats,
            totalTokens: state.sessionStats.totalTokens + tokenDelta,
          } : state.sessionStats;

          return { sessions: newSessions, sessionStats };
        });
      },

      setLLMConfig: (config: Partial<LLMConfig>) => {
        const keys = Object.keys(config).join(', ');
        logSettings('info', `LLM 配置变更: ${keys}`, config);
        set((state) => ({
          llmConfig: { ...state.llmConfig, ...config },
        }));
      },

      clearAllSessions: () => {
        void clearAllSessionPersistence({ includeStats: true });
        set({
          sessions: [],
          currentSessionId: null,
          sessionStats: { sessionCount: 0, totalMessages: 0, totalTokens: 0 },
        });
      },

      setSessionStreaming: (sessionId: string, isStreaming: boolean) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, isStreaming, interruptedAt: isStreaming ? undefined : s.interruptedAt }
              : s
          ),
        }));
      },

      markStreamingSessionsInterrupted: () => {
        set((state) => {
          const { sessions, changed } = markStreamingSessionsInterruptedState(
            state.sessions,
            persistSessionMessages,
          );
          return changed ? { sessions } : state;
        });
      },

      setSessionSystemPrompt: (sessionId: string, systemPrompt: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, systemPrompt } : s
          ),
        }));
      },

      openSession: (id: string) => {
        set((state) => {
          // 如果已经打开，只切换到该会话
          if (state.openSessionIds.includes(id)) {
            return { currentSessionId: id };
          }
          // 否则添加到打开列表并切换
          return {
            openSessionIds: [...state.openSessionIds, id],
            currentSessionId: id,
          };
        });
      },

      closeSession: (id: string) => {
        void flushSessionMessages(id);
        set((state) => closeSessionTabState(state, id));
      },

      /**
       * Load messages from IndexedDB into the in-memory session.
       * Called when switching to a session whose messages haven't been loaded yet.
       */
      loadSessionMessages: async (sessionId: string) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;
        // Skip if messages are already loaded
        if (session.messages.length > 0) return;

        const messages = await loadNormalizedSessionMessages(sessionId);
        if (messages.length === 0) return;

        set((state) => {
          const { sessions: newSessions } = replaceSessionMessagesState(state.sessions, sessionId, messages);
          return { sessions: newSessions, sessionStats: computeSessionStats(newSessions) };
        });
      },

      /**
       * Force-flush pending message writes for a session.
       * Call on step finish or before navigation.
       */
      flushMessages: async (sessionId: string) => {
        await flushSessionMessages(sessionId);
      },

      moveSessionToProject: (sessionId: string, projectId: string | null) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, projectId: projectId || undefined, updatedAt: Date.now() } : s
          ),
        }));
      },

      setSessionTools: (sessionId: string, tools: string[] | undefined) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, sessionTools: tools, updatedAt: Date.now() } : s
          ),
        }));
      },

      setSessionSkills: (sessionId: string, skills: string[] | undefined) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, sessionSkills: skills, updatedAt: Date.now() } : s
          ),
        }));
      },

      setSessionMindMeta: (sessionId: string, mindSession: MindSessionMeta) => {
        set((state) => ({
          sessions: updateSessionMindMetaState(state.sessions, sessionId, mindSession),
        }));
      },

      setSessionChatMeta: (sessionId: string, chatSession: ChatSessionMeta) => {
        set((state) => ({
          sessions: updateSessionChatMetaState(state.sessions, sessionId, chatSession),
        }));
      },

      // Project Actions
      createProject: (name: string, description?: string, color?: string, icon?: string) => {
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          description,
          color: color || '#3b82f6',
          icon: icon || 'folder-open',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          projects: [...state.projects, project],
        }));

        return project;
      },

      updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        }));
      },

      deleteProject: (id: string) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          // Remove projectId from sessions in this project
          sessions: state.sessions.map((s) =>
            s.projectId === id ? { ...s, projectId: undefined } : s
          ),
        }));
      },
    }),
    {
      name: 'webagent-sessions',
      // Exclude messages from localStorage persistence — they live in IndexedDB
      partialize: (state) => ({
        sessions: state.sessions.map((s) => ({
          ...stripTransientSessionState(s),
          messages: [], // never persist messages to localStorage
        })),
        projects: state.projects,
        currentSessionId: state.currentSessionId,
        openSessionIds: state.openSessionIds,
        llmConfig: state.llmConfig,
        sessionStats: state.sessionStats,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return;
          state.sessions = state.sessions.map((session) => stripTransientSessionState(session));
          // Recalc stats from rehydrated sessions (messages are empty at this point,
          // but sessionCount is correct; tokens/messages will update as sessions load)
          state.recalcStats();
          // Migrate: if localStorage still has messages (old format), move them to IndexedDB
          migrateMessagesToIndexedDB();
        };
      },
    }
  )
);

/**
 * One-time migration: move messages from localStorage (old format) to IndexedDB.
 * After migration, re-save the localStorage entry without messages.
 */
async function migrateMessagesToIndexedDB(): Promise<void> {
  const MIGRATION_KEY = 'webagent-messages-migrated';
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(MIGRATION_KEY)) return;

    const raw = localStorage.getItem('webagent-sessions');
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const sessions = parsed?.state?.sessions as Array<{ id: string; messages: Message[] }> | undefined;
    if (!sessions) return;

    let migrated = 0;
    for (const session of sessions) {
      if (session.messages && session.messages.length > 0) {
        persistSessionMessages(session.id, session.messages);
        migrated++;
      }
    }

    if (migrated > 0) {
      // Flush all migrated messages to IndexedDB
      await flushAllSessionPersistence();

      // Load migrated messages into Zustand state so UI shows them immediately
      const state = useSessionStore.getState();
      const updatedSessions = mergePersistedSessionMessages(state.sessions, sessions);
      useSessionStore.setState({ sessions: updatedSessions, sessionStats: computeSessionStats(updatedSessions) });

      console.log(`[Migration] Migrated messages for ${migrated} sessions to IndexedDB`);
    }

    localStorage.setItem(MIGRATION_KEY, '1');
  } catch (err) {
    console.error('[Migration] Failed to migrate messages:', err);
  }
}

// Flush all dirty messages on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useSessionStore.getState().markStreamingSessionsInterrupted();
    void flushAllSessionPersistence();
  });
}
