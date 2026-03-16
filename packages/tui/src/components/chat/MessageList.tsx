import { Box, Text } from 'ink';
import type { Message } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import { MessageBubble } from './MessageBubble.js';
import { StatusIndicator } from './StatusIndicator.js';

interface MessageListProps {
  messages: Message[];
  isInitializing: boolean;
  isLoading: boolean;
  currentStatus: string;
  activityLabel: string;
  width: number;
}

export function MessageList({
  messages,
  isInitializing,
  isLoading,
  currentStatus,
  activityLabel,
  width,
}: MessageListProps) {
  return (
    <Box paddingX={1} flexDirection="column" width={Math.max(24, width - 2)}>
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
