import type { Message, Session, SessionType } from '../../types';
import type { SessionRuntimeContext } from './runtimeContext';
import { resolveSessionRuntimeContext } from './runtimeContext';
import type { SessionOwnerStore } from './sessionOwnerStore';

export interface SessionOps {
  createDetachedSession(
    agentId: string,
    sessionName: string,
    sessionType: SessionType,
    projectId?: string,
  ): Promise<Session>;
  appendSessionMessage(agentId: string, sessionId: string, message: Message): void;
  updateSessionMessage(agentId: string, sessionId: string, messageId: string, updates: Partial<Message>): void;
  setSessionStreaming(agentId: string, sessionId: string, isStreaming: boolean): void;
  setSessionPrompt(agentId: string, sessionId: string, systemPrompt: string): void;
  setSessionMindMeta(agentId: string, sessionId: string, mindMeta: Session['mindSession']): void;
  setSessionChatMeta(agentId: string, sessionId: string, chatMeta: Session['chatSession']): void;
  flushSession(agentId: string, sessionId: string): Promise<void>;
  getSessionByOwner(agentId: string, sessionId: string): Session | null;
  deleteSessionByOwner(agentId: string, sessionId: string): void;
}

export function createSessionOps(sessionOwnerStore: SessionOwnerStore): SessionOps {
  return {
    createDetachedSession(agentId, sessionName, sessionType, projectId) {
      return sessionOwnerStore.createDetachedSession(agentId, sessionName, sessionType, projectId);
    },
    appendSessionMessage(agentId, sessionId, message) {
      sessionOwnerStore.appendMessage(agentId, sessionId, message);
    },
    updateSessionMessage(agentId, sessionId, messageId, updates) {
      sessionOwnerStore.updateMessage(agentId, sessionId, messageId, updates);
    },
    setSessionStreaming(agentId, sessionId, isStreaming) {
      sessionOwnerStore.setStreaming(agentId, sessionId, isStreaming);
    },
    setSessionPrompt(agentId, sessionId, systemPrompt) {
      sessionOwnerStore.setPrompt(agentId, sessionId, systemPrompt);
    },
    setSessionMindMeta(agentId, sessionId, mindMeta) {
      sessionOwnerStore.setMindMeta(agentId, sessionId, mindMeta);
    },
    setSessionChatMeta(agentId, sessionId, chatMeta) {
      sessionOwnerStore.setChatMeta(agentId, sessionId, chatMeta);
    },
    async flushSession(agentId, sessionId) {
      await sessionOwnerStore.flush(agentId, sessionId);
    },
    getSessionByOwner(agentId, sessionId) {
      return sessionOwnerStore.getSession(agentId, sessionId);
    },
    deleteSessionByOwner(agentId, sessionId) {
      sessionOwnerStore.deleteSession(agentId, sessionId);
    },
  };
}

export function resolveSessionOps(overrides: Partial<SessionRuntimeContext> = {}): SessionOps {
  return createSessionOps(resolveSessionRuntimeContext(overrides).sessionOwnerStore);
}
