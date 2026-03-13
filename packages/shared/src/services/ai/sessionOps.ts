import type { Message, Session, SessionType } from '../../types';
import { useAgentStore, DEFAULT_AGENT_ID } from '../../stores/agent';
import { useSessionStore } from '../../stores/session';

export async function createDetachedSession(
  agentId: string,
  sessionName: string,
  sessionType: SessionType,
  projectId?: string,
): Promise<Session> {
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
}

export function appendSessionMessage(agentId: string, sessionId: string, message: Message): void {
  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().addMessage(sessionId, message);
    return;
  }
  useAgentStore.getState().addAgentMessage(agentId, sessionId, message);
}

export function updateSessionMessage(agentId: string, sessionId: string, messageId: string, updates: Partial<Message>): void {
  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().updateMessage(sessionId, messageId, updates);
    return;
  }
  useAgentStore.getState().updateAgentMessage(agentId, sessionId, messageId, updates);
}

export function setSessionStreaming(agentId: string, sessionId: string, isStreaming: boolean): void {
  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().setSessionStreaming(sessionId, isStreaming);
    return;
  }
  useAgentStore.getState().setAgentSessionStreaming(agentId, sessionId, isStreaming);
}

export function setSessionPrompt(agentId: string, sessionId: string, systemPrompt: string): void {
  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().setSessionSystemPrompt(sessionId, systemPrompt);
    return;
  }
  useAgentStore.getState().setAgentSessionSystemPrompt(agentId, sessionId, systemPrompt);
}

export function setSessionMindMeta(agentId: string, sessionId: string, mindMeta: Session['mindSession']): void {
  if (!mindMeta) return;

  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().setSessionMindMeta(sessionId, mindMeta);
    return;
  }

  useAgentStore.getState().setAgentSessionMindMeta(agentId, sessionId, mindMeta);
}

export function setSessionChatMeta(agentId: string, sessionId: string, chatMeta: Session['chatSession']): void {
  if (!chatMeta) return;

  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().setSessionChatMeta(sessionId, chatMeta);
    return;
  }

  useAgentStore.getState().setAgentSessionChatMeta(agentId, sessionId, chatMeta);
}

export async function flushSession(agentId: string, sessionId: string): Promise<void> {
  if (agentId === DEFAULT_AGENT_ID) {
    await useSessionStore.getState().flushMessages(sessionId);
    return;
  }
  await useAgentStore.getState().flushAgentMessages(agentId, sessionId);
}

export function getSessionByOwner(agentId: string, sessionId: string): Session | null {
  if (agentId === DEFAULT_AGENT_ID) {
    return useSessionStore.getState().sessions.find((session) => session.id === sessionId) || null;
  }

  return (useAgentStore.getState().agentSessions[agentId] || []).find((session) => session.id === sessionId) || null;
}

export function deleteSessionByOwner(agentId: string, sessionId: string): void {
  if (agentId === DEFAULT_AGENT_ID) {
    useSessionStore.getState().permanentlyDeleteSession(sessionId);
    return;
  }

  useAgentStore.getState().deleteAgentSession(agentId, sessionId);
}
