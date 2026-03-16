import type { Session } from '@openbunny/shared/types';
import { useSessionStore } from '@openbunny/shared/stores/session';

export async function resolveSessionOnStartup(
  sessionName: string,
  systemPrompt: string | undefined,
  resumeIdPrefix: string | undefined,
): Promise<Session> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const store = useSessionStore.getState();

  if (resumeIdPrefix) {
    const existing = store.sessions.find((session) => session.id.startsWith(resumeIdPrefix));
    if (!existing) {
      throw new Error(`No session found matching "${resumeIdPrefix}"`);
    }
    if (existing.messages.length === 0) {
      await store.loadSessionMessages(existing.id);
    }
    store.openSession(existing.id);
    return useSessionStore.getState().sessions.find((session) => session.id === existing.id) || existing;
  }

  const session = store.createSession(sessionName);
  if (systemPrompt) {
    store.setSessionSystemPrompt(session.id, systemPrompt);
  }
  return session;
}
