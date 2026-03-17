import { Box, Text } from 'ink';
import type { Message } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import type { MessageSearchResults } from '../../hooks/useMessageViewport.js';
import type { TranscriptLine } from '../../utils/transcript.js';

interface MessageListProps {
  messages: Message[];
  visibleLines: TranscriptLine[];
  hiddenBefore: number;
  hiddenAfter: number;
  rangeStart: number;
  rangeEnd: number;
  totalLines: number;
  searchState: (MessageSearchResults & { activeIndex: number }) | null;
  isInitializing: boolean;
  isLoading: boolean;
  currentStatus: string;
  activityLabel: string;
  width: number;
}

export function MessageList({
  messages,
  visibleLines,
  hiddenBefore,
  hiddenAfter,
  rangeStart,
  rangeEnd,
  totalLines,
  searchState,
  isInitializing,
  isLoading,
  currentStatus,
  activityLabel,
  width,
}: MessageListProps) {
  const contentWidth = Math.max(20, width - 4);
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
          <Text color={T.info}>{currentStatus}</Text>
          {activityLabel && !currentStatus.includes(activityLabel) && (
            <Text color={T.fgMuted}>  {activityLabel}</Text>
          )}
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

      {totalLines > 0 && (
        <Box marginBottom={1} paddingLeft={1} flexDirection="column">
          <Text color={T.fgSubtle}>
            Lines {rangeStart}-{rangeEnd} of {totalLines} · {messages.length} message{messages.length === 1 ? '' : 's'}
            {searchState && searchState.matchIds.length > 0 ? ` · Search ${searchActiveLabel}` : ''}
          </Text>
          {hiddenBefore > 0 && (
            <Text color={T.info}>↑ {hiddenBefore} earlier line(s) above · wheel, drag, PgUp, or Ctrl+U to inspect history</Text>
          )}
        </Box>
      )}

      {visibleLines.map((line) => (
        <Box key={line.key} width={contentWidth}>
          <Text
            color={line.color}
            bold={line.bold}
            italic={line.italic}
            dimColor={line.dimColor}
            wrap="truncate-end"
          >
            {line.text}
          </Text>
        </Box>
      ))}

      {hiddenAfter > 0 && (
        <Box marginTop={visibleLines.length > 0 ? 1 : 0} paddingLeft={1}>
          <Text color={T.fgSubtle}>↓ {hiddenAfter} newer line(s) below · wheel down, drag down, PgDn, or End to return</Text>
        </Box>
      )}

      {isInitializing && (
        <Box marginTop={visibleLines.length > 0 ? 1 : 0}>
          <Text color={T.info}>Initializing...</Text>
        </Box>
      )}

      {isLoading && !currentStatus && !isInitializing && (
        <Box marginTop={visibleLines.length > 0 ? 1 : 0}>
          <Text color={T.info}>{activityLabel || 'Working...'}</Text>
        </Box>
      )}
    </Box>
  );
}
