import { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { Message, Session } from '@openbunny/shared/types';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useSkillStore } from '@openbunny/shared/stores/skills';
import { useAgentStore } from '@openbunny/shared/stores/agent';
import EmptyState from './message-list/EmptyState';
import MessageItem from './message-list/MessageItem';
import { normalizeMessageForRender } from './message-list/normalizeMessage';
import SessionSummaryCard from './message-list/SessionSummaryCard';
import type { MessageListItemData } from './message-list/types';

interface MessageListProps {
  messages: Message[];
  session?: Session;
}

const VIRTUALIZATION_THRESHOLD = 50;

function getSessionSummary(session: Session | undefined): string {
  if (!session) return '';
  if (session.sessionType === 'mind') return session.mindSession?.summary?.trim() || '';
  if (session.sessionType === 'agent') return session.chatSession?.summary?.trim() || '';
  return '';
}

export default function MessageList({ messages, session }: MessageListProps) {
  const agents = useAgentStore((state) => state.agents);
  const currentAgentId = useAgentStore((state) => state.currentAgentId);
  const userAvatar = useSettingsStore((state) => state.userProfile.avatar);
  const skills = useSkillStore((state) => state.skills);
  const shouldVirtualize = messages.length > VIRTUALIZATION_THRESHOLD;
  const sessionSummary = getSessionSummary(session);

  const skillDescriptions = useMemo(
    () => Object.fromEntries(skills.map((skill) => [skill.name, skill.description || ''])),
    [skills],
  );

  const renderedMessages = useMemo<MessageListItemData[]>(
    () => messages.map((message, index) => ({
      message,
      standardized: normalizeMessageForRender(message, {
        session,
        index,
        agents,
        currentAgentId,
        userAvatar,
        skillDescriptions,
      }),
    })),
    [agents, currentAgentId, messages, session, skillDescriptions, userAvatar],
  );

  if (messages.length === 0 && !sessionSummary) {
    return (
      <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6">
        <EmptyState />
      </div>
    );
  }

  if (shouldVirtualize) {
    return (
      <Virtuoso
        data={renderedMessages}
        itemContent={(_, item) => (
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-2 md:py-3">
            <MessageItem message={item.standardized} />
          </div>
        )}
        components={sessionSummary ? {
          Footer: () => (
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">
              <SessionSummaryCard summary={sessionSummary} />
            </div>
          ),
        } : undefined}
        className="h-full"
        initialTopMostItemIndex={renderedMessages.length - 1}
        followOutput="smooth"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6 space-y-4 md:space-y-6">
      {renderedMessages.map((item) => (
        <MessageItem key={item.message.id} message={item.standardized} />
      ))}
      {sessionSummary && <SessionSummaryCard summary={sessionSummary} />}
    </div>
  );
}
