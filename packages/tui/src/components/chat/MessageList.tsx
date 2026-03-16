import { Box, Text } from 'ink';
import type { Message, Session } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import { MessageBubble } from './MessageBubble.js';
import { StatusIndicator } from './StatusIndicator.js';
import type { MessageSearchResults } from '../../hooks/useMessageViewport.js';
import { getSessionSummary } from '../../utils/sessionPresentation.js';

interface MessageListProps {
  session: Session | null;
  messages: Message[];
  visibleMessages: Array<{ message: Message; absoluteIndex: number }>;
  focusedMessageId: string | null;
  activeSearchMessageId: string | null;
  searchState: (MessageSearchResults & { activeIndex: number }) | null;
  isInitializing: boolean;
  isLoading: boolean;
  currentStatus: string;
  activityLabel: string;
  width: number;
}

export function MessageList({
  session,
  messages,
  visibleMessages,
  focusedMessageId,
  activeSearchMessageId,
  searchState,
  isInitializing,
  isLoading,
  currentStatus,
  activityLabel,
  width,
}: MessageListProps) {
  const sessionSummary = getSessionSummary(session);
  const summaryLines = sessionSummary
    ? sessionSummary
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trimEnd())
    : [];
  const searchActiveLabel = searchState && searchState.matchIds.length > 0
    ? `${searchState.activeIndex + 1}/${searchState.matchIds.length}`
    : null;

  return (
    <Box
      paddingX={1}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      overflow="hidden"
      width={Math.max(24, width - 2)}
    >
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
        <Box
          marginBottom={1}
          paddingLeft={1}
          flexDirection="column"
        >
          <Text bold color={T.brand}>OpenBunny</Text>
          <Text color={T.fgDim}>Terminal workspace for tools, search, files, and multi-agent sessions.</Text>
          <Text color={T.fgMuted}>Features: python · search · shell · files · MCP · skills</Text>
          <Text color={T.fgMuted}>Quick access: Ctrl+O scope · Ctrl+T tools · Ctrl+K skills · Ctrl+F files</Text>
          <Box>
            <Text color={T.fgMuted}>Start a conversation or use </Text>
            <Text color={T.accent}>/help</Text>
            <Text color={T.fgMuted}> to inspect commands.</Text>
          </Box>
        </Box>
      )}

      {visibleMessages.map(({ message, absoluteIndex }) => (
        <MessageBubble
          key={message.id}
          message={message}
          isFocused={message.id === focusedMessageId}
          focusLabel={message.id === activeSearchMessageId ? `Search hit ${searchActiveLabel || ''}`.trim() : `Message ${absoluteIndex + 1}`}
        />
      ))}

      {summaryLines.length > 0 && (
        <Box
          marginBottom={1}
          marginTop={messages.length > 0 ? 1 : 0}
          paddingLeft={1}
          flexDirection="column"
        >
          <Text bold color={T.assistant}>Summary</Text>
          <Text color={T.fgSubtle}>Session summary mirrored from paired dialogue state.</Text>
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
