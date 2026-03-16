import { Box, Text } from 'ink';
import type { Message, Session } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import { MessageBubble } from './MessageBubble.js';
import { StatusIndicator } from './StatusIndicator.js';
import {
  getSessionSummary,
  getSessionTypeLabel,
  isReadOnlySession,
} from '../../utils/sessionPresentation.js';

interface MessageListProps {
  session: Session | null;
  messages: Message[];
  sessionConfigScope: string;
  sessionConfigState: string;
  enabledToolCount: number;
  enabledSkillCount: number;
  isInitializing: boolean;
  isLoading: boolean;
  currentStatus: string;
  activityLabel: string;
  width: number;
}

export function MessageList({
  session,
  messages,
  sessionConfigScope,
  sessionConfigState,
  enabledToolCount,
  enabledSkillCount,
  isInitializing,
  isLoading,
  currentStatus,
  activityLabel,
  width,
}: MessageListProps) {
  const sessionSummary = getSessionSummary(session);
  const readOnly = isReadOnlySession(session);
  const linkedAgent = session?.chatSession?.counterpartAgentName || session?.chatSession?.peerAgentId;
  const sourceTask = session?.mindSession?.sourceTask || session?.chatSession?.sourceTask;
  const sourceSessionId = session?.mindSession?.sourceSessionId || session?.chatSession?.sourceSessionId;
  const summaryLines = sessionSummary
    ? sessionSummary
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trimEnd())
    : [];
  const showSessionMeta = Boolean(
    session && (
      readOnly
      || linkedAgent
      || sourceTask
      || sourceSessionId
      || session.sessionTools?.length
      || session.sessionSkills?.length
      || (session.interruptedAt && !session.isStreaming)
    ),
  );

  return (
    <Box paddingX={1} flexDirection="column" width={Math.max(24, width - 2)}>
      {showSessionMeta && session && (
        <Box
          marginBottom={1}
          paddingX={1}
          paddingY={0}
          borderStyle="round"
          borderColor={readOnly ? T.warn : T.info}
          flexDirection="column"
        >
          <Text bold color={readOnly ? T.warn : T.info}>
            {getSessionTypeLabel(session)}
            <Text color={T.fgSubtle}>  {session.isStreaming ? 'streaming' : 'idle'}</Text>
          </Text>
          {readOnly && (
            <Text color={T.fgDim}>
              Read-only conversation. Use `/stop`, `/export`, or `/search`.
            </Text>
          )}
          {session.interruptedAt && !session.isStreaming && (
            <Text color={T.warn}>
              Interrupted at {new Date(session.interruptedAt).toLocaleString()}.
            </Text>
          )}
          {linkedAgent && (
            <Text color={T.fgDim}>Counterpart: {linkedAgent}</Text>
          )}
          {sourceTask && (
            <Text color={T.fgDim}>Source task: {sourceTask}</Text>
          )}
          {sourceSessionId && (
            <Text color={T.fgDim}>Source session: {sourceSessionId.slice(0, 8)}</Text>
          )}
          {(session.sessionTools?.length || session.sessionSkills?.length) ? (
            <Text color={T.fgDim}>
              Session snapshot:
              {session.sessionTools?.length ? ` ${session.sessionTools.length} tool(s)` : ''}
              {session.sessionSkills?.length ? ` ${session.sessionSkills.length} skill(s)` : ''}
            </Text>
          ) : null}
          <Text color={T.fgDim}>
            Active config: {sessionConfigScope} · {sessionConfigState} · {enabledToolCount} tool(s) · {enabledSkillCount} skill(s)
          </Text>
        </Box>
      )}

      {currentStatus && (
        <Box marginBottom={1}>
          <StatusIndicator
            isInitializing={false}
            isLoading={false}
            currentStatus={currentStatus}
            activityLabel=""
          />
        </Box>
      )}

      {messages.length === 0 && !isInitializing && (
        <Box marginBottom={1} flexDirection="column">
          <Text color={T.fgDim}>No messages yet.</Text>
          <Box>
            <Text color={T.fgMuted}>Start a conversation or use </Text>
            <Text color={T.accent}>/help</Text>
            <Text color={T.fgMuted}> to inspect commands.</Text>
          </Box>
        </Box>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {summaryLines.length > 0 && (
        <Box
          marginBottom={1}
          marginTop={messages.length > 0 ? 1 : 0}
          borderStyle="round"
          borderColor={T.assistant}
          paddingX={1}
          flexDirection="column"
        >
          <Text bold color={T.assistant}>Summary</Text>
          {summaryLines.map((line, index) => (
            <Text key={`${index}-${line}`} wrap="wrap" color={T.fgDim}>
              {line || ' '}
            </Text>
          ))}
        </Box>
      )}

      {isInitializing && (
        <Box marginBottom={1}>
          <StatusIndicator
            isInitializing={true}
            isLoading={false}
            currentStatus=""
            activityLabel=""
          />
        </Box>
      )}

      {isLoading && !currentStatus && !isInitializing && (
        <Box marginBottom={1}>
          <StatusIndicator
            isInitializing={false}
            isLoading={true}
            currentStatus=""
            activityLabel={activityLabel}
          />
        </Box>
      )}
    </Box>
  );
}
