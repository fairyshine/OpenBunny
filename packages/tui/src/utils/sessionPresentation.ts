import i18n from '@openbunny/shared/i18n';
import type { Session } from '@openbunny/shared/types';
import type { ExportHistoryVariant } from '@openbunny/shared/utils/messageHistory';

export function isReadOnlySession(session?: Session | null): boolean {
  return session?.sessionType === 'mind' || session?.sessionType === 'agent';
}

export function hasSessionConfigOverride(session?: Session | null): boolean {
  return Boolean(session?.sessionTools || session?.sessionSkills);
}

export function isSessionConfigLocked(session?: Session | null): boolean {
  return Boolean(session && session.messages.length > 0);
}

export function getSessionConfigScopeLabel(session?: Session | null): string {
  return hasSessionConfigOverride(session) ? 'session' : 'global';
}

export function getEffectiveSessionTools(session: Session | null | undefined, fallbackTools: string[]): string[] {
  return session?.sessionTools ?? fallbackTools;
}

export function getEffectiveSessionSkills(session: Session | null | undefined, fallbackSkills: string[]): string[] {
  return session?.sessionSkills ?? fallbackSkills;
}

export function getSessionTypeLabel(session?: Session | null): string {
  switch (session?.sessionType) {
    case 'mind':
      return 'Mind session';
    case 'agent':
      return 'Agent session';
    case 'user':
    default:
      return 'User session';
  }
}

export function getSessionSummary(session?: Session | null): string {
  if (!session) return '';
  if (session.sessionType === 'mind') return session.mindSession?.summary?.trim() || '';
  if (session.sessionType === 'agent') return session.chatSession?.summary?.trim() || '';
  return '';
}

export function getSessionStatusLabel(session?: Session | null): string {
  if (!session) return 'No session';
  if (session.isStreaming) return 'Streaming';
  if (session.interruptedAt) return 'Interrupted';
  return 'Ready';
}

export function getSessionAlternateHistories(session?: Session | null): ExportHistoryVariant[] | undefined {
  if (!session || session.sessionType !== 'mind' || !session.mindSession) return undefined;

  return [
    {
      title: i18n.t('export.mindAssistantHistory'),
      systemPrompt: session.mindSession.assistantHistory?.systemPrompt || session.systemPrompt,
      messages: session.mindSession.assistantHistory?.messages || [],
      rawData: session.mindSession.assistantHistory,
    },
    {
      title: i18n.t('export.mindUserHistory'),
      systemPrompt: session.mindSession.userHistory?.systemPrompt || session.mindSession.userSystemPrompt,
      messages: session.mindSession.userHistory?.messages || [],
      rawData: session.mindSession.userHistory,
    },
  ];
}
