import type { Agent, Message, Session } from '@openbunny/shared/types';
import type { BubbleAppearance } from './types';

function getAgentAvatar(agentId: string | undefined, agents: Agent[]): string | null {
  if (!agentId) return null;
  return agents.find((agent) => agent.id === agentId)?.avatar || null;
}

function getSpeakerAgentId(message: Message, session: Session | undefined, currentAgentId: string, index: number): string | undefined {
  const taggedSpeakerId = typeof message.metadata?.speakerAgentId === 'string' ? message.metadata.speakerAgentId : undefined;
  if (taggedSpeakerId) return taggedSpeakerId;
  if (session?.sessionType !== 'agent') return undefined;

  const counterpartAgentId = session.chatSession?.counterpartAgentId || session.chatSession?.peerAgentId;

  if (message.role === 'assistant' || message.role === 'tool') {
    return currentAgentId;
  }

  if (message.role === 'user') {
    if (session.chatSession?.role === 'source') {
      if (index === 0 && session.chatSession?.sourceTask && message.content === session.chatSession.sourceTask) {
        return currentAgentId;
      }
      return counterpartAgentId || currentAgentId;
    }

    if (session.chatSession?.role === 'target') {
      return counterpartAgentId || currentAgentId;
    }
  }

  return undefined;
}

export function getBubbleAppearance(
  message: Message,
  session: Session | undefined,
  currentAgentId: string,
  agents: Agent[],
  userAvatar: string,
  index: number,
): BubbleAppearance {
  if (session?.sessionType === 'agent') {
    const speakerAgentId = getSpeakerAgentId(message, session, currentAgentId, index);
    const isSelf = speakerAgentId === currentAgentId;
    const avatar = getAgentAvatar(speakerAgentId || currentAgentId, agents) || '🐰';

    return {
      align: isSelf ? 'right' : 'left',
      avatar,
      accent: isSelf ? 'self' : 'other',
    };
  }

  if (message.role === 'user') {
    return {
      align: 'right',
      avatar: userAvatar || 'U',
      accent: 'self',
    };
  }

  return {
    align: 'left',
    avatar: getAgentAvatar(currentAgentId, agents) || '🐰',
    accent: 'other',
  };
}
