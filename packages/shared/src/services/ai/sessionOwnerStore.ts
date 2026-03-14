import type { Message, Session, SessionType } from '../../types';

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

const UNCONFIGURED_SESSION_OWNER_STORE_MESSAGE =
  'AI session owner store is not configured. Initialize platform runtime or call setDefaultSessionOwnerStore().';

function throwUnconfiguredSessionOwnerStore(): never {
  throw new Error(UNCONFIGURED_SESSION_OWNER_STORE_MESSAGE);
}

const unconfiguredSessionOwnerStore: SessionOwnerStore = {
  createDetachedSession: async () => throwUnconfiguredSessionOwnerStore(),
  appendMessage: () => throwUnconfiguredSessionOwnerStore(),
  updateMessage: () => throwUnconfiguredSessionOwnerStore(),
  setStreaming: () => throwUnconfiguredSessionOwnerStore(),
  setPrompt: () => throwUnconfiguredSessionOwnerStore(),
  setMindMeta: () => throwUnconfiguredSessionOwnerStore(),
  setChatMeta: () => throwUnconfiguredSessionOwnerStore(),
  flush: async () => throwUnconfiguredSessionOwnerStore(),
  getSession: () => throwUnconfiguredSessionOwnerStore(),
  deleteSession: () => throwUnconfiguredSessionOwnerStore(),
};

let defaultSessionOwnerStore: SessionOwnerStore = unconfiguredSessionOwnerStore;

export function setDefaultSessionOwnerStore(sessionOwnerStore: SessionOwnerStore): void {
  defaultSessionOwnerStore = sessionOwnerStore;
}

export function getDefaultSessionOwnerStore(): SessionOwnerStore {
  return defaultSessionOwnerStore;
}

export function resetDefaultSessionOwnerStoreForTests(): void {
  defaultSessionOwnerStore = unconfiguredSessionOwnerStore;
}
