import { useMemo } from 'react';
import { useSessionStore, selectCurrentSession } from '@openbunny/shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@openbunny/shared/stores/agent';

export function useWorkspaceSession() {
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const agentSessions = useAgentStore((s) => s.agentSessions);
  const agentCurrentSessionId = useAgentStore((s) => s.agentCurrentSessionId);
  const globalSessions = useSessionStore((s) => s.sessions);
  const globalCurrentSession = useSessionStore(selectCurrentSession);
  const globalCurrentSessionId = useSessionStore((s) => s.currentSessionId);

  const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;
  const sessions = isDefaultAgent ? globalSessions : (agentSessions[currentAgentId] || []);
  const currentSessionId = isDefaultAgent
    ? globalCurrentSessionId
    : (agentCurrentSessionId[currentAgentId] ?? null);

  const currentSession = useMemo(() => {
    if (isDefaultAgent) return globalCurrentSession;
    if (!currentSessionId) return null;
    return sessions.find((session) => session.id === currentSessionId) || null;
  }, [currentSessionId, globalCurrentSession, isDefaultAgent, sessions]);

  return {
    currentAgentId,
    currentSession,
    currentSessionId,
    isDefaultAgent,
    sessions,
  };
}
