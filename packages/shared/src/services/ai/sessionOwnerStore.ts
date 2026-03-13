import type { Message, Session, SessionType } from '../../types';
import { useAgentStore, DEFAULT_AGENT_ID } from '../../stores/agent';
import { useSessionStore } from '../../stores/session';

export interface SessionOwnerStore {
  createDetachedSession(
    agentId: string,
    sessionName: string,
    sessionType: SessionType,
    projectId?: string,
  ): Promise<Session>;
  appendMessage(agentId: string, sessionId: string, message: Message): void;
  updateMessage(agentId: string, sessionId: string, messageId: string, updates: Partial<Message>): void;
  setStreaming(agentId: string, sessionId: string, isStreaming: boolean): void;
  setPrompt(agentId: string, sessionId: string, systemPrompt: string): void;
  setMindMeta(agentId: string, sessionId: string, mindMeta: Session['mindSession']): void;
  setChatMeta(agentId: string, sessionId: string, chatMeta: Session['chatSession']): void;
  flush(agentId: string, sessionId: string): Promise<void>;
  getSession(agentId: string, sessionId: string): Session | null;
  deleteSession(agentId: string, sessionId: string): void;
}

export const zustandSessionOwnerStore: SessionOwnerStore = {
  async createDetachedSession(agentId, sessionName, sessionType, projectId) {
    if (agentId === DEFAULT_AGENT_ID) {
      const store = useSessionStore.getState();
      const previousCurrentId = store.currentSessionId;
      const previousOpenIds = [...store.openSessionIds];
      const session = store.createSession(sessionName, sessionType, projectId);
      useSessionStore.setState({
        currentSessionId: previousCurrentId,
        openSessionIds: previousOpenIds.filter((id) => id !== session.id),
      });
      return session;
    }

    const store = useAgentStore.getState();
    const previousCurrentId = store.agentCurrentSessionId[agentId] ?? null;
    const session = store.createAgentSession(agentId, sessionName, projectId, sessionType);
    useAgentStore.setState((state) => ({
      agentCurrentSessionId: { ...state.agentCurrentSessionId, [agentId]: previousCurrentId },
    }));
    return session;
  },

  appendMessage(agentId, sessionId, message) {
    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().addMessage(sessionId, message);
      return;
    }

    useAgentStore.getState().addAgentMessage(agentId, sessionId, message);
  },

  updateMessage(agentId, sessionId, messageId, updates) {
    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().updateMessage(sessionId, messageId, updates);
      return;
    }

    useAgentStore.getState().updateAgentMessage(agentId, sessionId, messageId, updates);
  },

  setStreaming(agentId, sessionId, isStreaming) {
    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().setSessionStreaming(sessionId, isStreaming);
      return;
    }

    useAgentStore.getState().setAgentSessionStreaming(agentId, sessionId, isStreaming);
  },

  setPrompt(agentId, sessionId, systemPrompt) {
    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
      return;
    }

    useAgentStore.getState().setAgentSessionSystemPrompt(agentId, sessionId, systemPrompt);
  },

  setMindMeta(agentId, sessionId, mindMeta) {
    if (!mindMeta) return;

    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().setSessionMindMeta(sessionId, mindMeta);
      return;
    }

    useAgentStore.getState().setAgentSessionMindMeta(agentId, sessionId, mindMeta);
  },

  setChatMeta(agentId, sessionId, chatMeta) {
    if (!chatMeta) return;

    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().setSessionChatMeta(sessionId, chatMeta);
      return;
    }

    useAgentStore.getState().setAgentSessionChatMeta(agentId, sessionId, chatMeta);
  },

  async flush(agentId, sessionId) {
    if (agentId === DEFAULT_AGENT_ID) {
      await useSessionStore.getState().flushMessages(sessionId);
      return;
    }

    await useAgentStore.getState().flushAgentMessages(agentId, sessionId);
  },

  getSession(agentId, sessionId) {
    if (agentId === DEFAULT_AGENT_ID) {
      return useSessionStore.getState().sessions.find((session) => session.id === sessionId) || null;
    }

    return (useAgentStore.getState().agentSessions[agentId] || []).find((session) => session.id === sessionId) || null;
  },

  deleteSession(agentId, sessionId) {
    if (agentId === DEFAULT_AGENT_ID) {
      useSessionStore.getState().permanentlyDeleteSession(sessionId);
      return;
    }

    useAgentStore.getState().deleteAgentSession(agentId, sessionId);
  },
};
