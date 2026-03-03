import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Message, LLMConfig } from '../types';
import { logSettings } from '../services/console/logger';

interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  llmConfig: LLMConfig;

  // Actions
  createSession: (name?: string) => Session;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setLLMConfig: (config: Partial<LLMConfig>) => void;
  clearAllSessions: () => void;
}

// Selector to get current session (derived from sessions + currentSessionId)
export const selectCurrentSession = (state: SessionState): Session | null => {
  if (!state.currentSessionId) return null;
  return state.sessions.find(s => s.id === state.currentSessionId) || null;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSession: null,
      llmConfig: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4',
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
          currentSession: session,
        }));

        return session;
      },

      deleteSession: (id: string) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          const newCurrent = state.currentSession?.id === id 
            ? newSessions[0] || null 
            : state.currentSession;
          
          return {
            sessions: newSessions,
            currentSession: newCurrent,
          };
        });
      },

      setCurrentSession: (id: string) => {
        const session = get().sessions.find((s) => s.id === id);
        if (session) {
          set({ currentSession: session });
        }
      },

      addMessage: (sessionId: string, message: Message) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: [...session.messages, message],
                  updatedAt: Date.now(),
                }
              : session
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  messages: [...state.currentSession.messages, message],
                  updatedAt: Date.now(),
                }
              : state.currentSession,
        }));
      },

      updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                }
              : session
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  messages: state.currentSession.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                }
              : state.currentSession,
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
        set({ sessions: [], currentSession: null });
      },
    }),
    {
      name: 'webagent-sessions',
    }
  )
);
