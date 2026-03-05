import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Message, LLMConfig } from '../types';
import { logSettings } from '../services/console/logger';

interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  openSessionIds: string[]; // 打开的会话标签页
  llmConfig: LLMConfig;

  // Actions
  createSession: (name?: string) => Session;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  restoreSession: (id: string) => void;
  permanentlyDeleteSession: (id: string) => void;
  clearTrash: () => void;
  setCurrentSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setLLMConfig: (config: Partial<LLMConfig>) => void;
  clearAllSessions: () => void;
  setSessionStreaming: (sessionId: string, isStreaming: boolean) => void;
  setSessionSystemPrompt: (sessionId: string, systemPrompt: string) => void;
  openSession: (id: string) => void;
  closeSession: (id: string) => void;
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
      currentSessionId: null,
      openSessionIds: [],
      llmConfig: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
      },

      createSession: (name = '新会话') => {
        const session: Session = {
          id: crypto.randomUUID(),
          name,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          openSessionIds: [...state.openSessionIds, session.id],
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
        set((state) => {
          const newSessions = state.sessions.map((s) =>
            s.id === id ? { ...s, deletedAt: Date.now() } : s
          );
          const activeSessions = newSessions.filter(s => !s.deletedAt);
          const newCurrentId = state.currentSessionId === id
            ? (activeSessions[0]?.id || null)
            : state.currentSessionId;

          return {
            sessions: newSessions,
            currentSessionId: newCurrentId,
          };
        });
      },

      restoreSession: (id: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, deletedAt: undefined, updatedAt: Date.now() } : s
          ),
        }));
      },

      permanentlyDeleteSession: (id: string) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
        }));
      },

      clearTrash: () => {
        set((state) => ({
          sessions: state.sessions.filter((s) => !s.deletedAt),
        }));
      },

      setCurrentSession: (id: string) => {
        const session = get().sessions.find((s) => s.id === id);
        if (session) {
          set({ currentSessionId: id });
        }
      },

      addMessage: (sessionId: string, message: Message) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId && !session.deletedAt
              ? {
                  ...session,
                  messages: [...session.messages, message],
                  updatedAt: Date.now(),
                }
              : session
          ),
        }));
      },

      updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId && !session.deletedAt
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                }
              : session
          ),
        }));
      },

      setLLMConfig: (config: Partial<LLMConfig>) => {
        const keys = Object.keys(config).join(', ');
        logSettings('info', `LLM 配置变更: ${keys}`, config);
        set((state) => ({
          llmConfig: { ...state.llmConfig, ...config },
        }));
      },

      clearAllSessions: () => {
        set({ sessions: [], currentSessionId: null });
      },

      setSessionStreaming: (sessionId: string, isStreaming: boolean) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, isStreaming } : s
          ),
        }));
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
        set((state) => {
          const newOpenIds = state.openSessionIds.filter(sid => sid !== id);
          // 如果关闭的是当前会话，切换到下一个打开的会话
          const newCurrentId = state.currentSessionId === id
            ? (newOpenIds[newOpenIds.length - 1] || null)
            : state.currentSessionId;
          return {
            openSessionIds: newOpenIds,
            currentSessionId: newCurrentId,
          };
        });
      },
    }),
    {
      name: 'webagent-sessions',
    }
  )
);
