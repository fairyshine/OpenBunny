import { Box, Text } from 'ink';
import type { Message } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import { MAX_VISIBLE_MESSAGES } from '../../constants.js';
import { MessageBubble } from './MessageBubble.js';
import { StatusIndicator } from './StatusIndicator.js';

interface MessageListProps {
  messages: Message[];
  totalCount: number;
  isInitializing: boolean;
  isLoading: boolean;
  currentStatus: string;
  activityLabel: string;
  width: number;
}

export function MessageList({
  messages,
  totalCount,
  isInitializing,
  isLoading,
  currentStatus,
  activityLabel,
  width,
}: MessageListProps) {
  const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES);
  const hiddenCount = Math.max(0, totalCount - visibleMessages.length);
  const visibleLabel = totalCount === 0 ? 'empty' : `${visibleMessages.length}/${totalCount} visible`;

  return (
    <Box paddingX={1} flexDirection="column" flexGrow={1}>
      <Box
        borderStyle="round"
        borderColor={T.borderLight}
        paddingX={1}
        flexDirection="column"
        flexGrow={1}
        width={Math.max(24, width - 4)}
      >
        <Box justifyContent="space-between">
          <Text color={T.brand} bold>Conversation</Text>
          <Text color={T.fgSubtle}>{visibleLabel}</Text>
        </Box>

        {hiddenCount > 0 && (
          <Box marginTop={1}>
            <Text color={T.fgSubtle}>↑ {hiddenCount} older messages hidden</Text>
          </Box>
        )}

        {currentStatus && (
          <Box marginTop={1}>
            <StatusIndicator
              isInitializing={false}
              isLoading={false}
              currentStatus={currentStatus}
              activityLabel=""
            />
          </Box>
        )}

        {visibleMessages.length === 0 && !isInitializing && (
          <Box marginTop={1} flexDirection="column">
            <Text color={T.fgDim}>No messages yet.</Text>
            <Box>
              <Text color={T.fgMuted}>Start a conversation or use </Text>
              <Text color={T.accent}>/help</Text>
              <Text color={T.fgMuted}> to inspect commands.</Text>
            </Box>
          </Box>
        )}

        {visibleMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isInitializing && (
          <Box marginTop={1}>
            <StatusIndicator
              isInitializing={true}
              isLoading={false}
              currentStatus=""
              activityLabel=""
            />
          </Box>
        )}

        {isLoading && !currentStatus && !isInitializing && (
          <Box marginTop={1}>
            <StatusIndicator
              isInitializing={false}
              isLoading={true}
              currentStatus=""
              activityLabel={activityLabel}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
