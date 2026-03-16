import { Box, Text } from 'ink';
import type { Session } from '@openbunny/shared/types';
import { T } from '../../theme.js';
import { getSlidingWindow, truncate } from '../../utils/formatting.js';

interface SessionStripProps {
  sessions: Session[];
  currentSessionId: string | null;
  width: number;
  modeLabel: string;
}

function getSessionStatusMarker(session: Session) {
  if (session.isStreaming) return '~';
  if (session.interruptedAt) return '!';
  return ' ';
}

function getSessionTypeMarker(session: Session) {
  switch (session.sessionType) {
    case 'mind':
      return 'M';
    case 'agent':
      return 'A';
    default:
      return 'U';
  }
}

export function SessionStrip({ sessions, currentSessionId, width, modeLabel }: SessionStripProps) {
  if (sessions.length === 0) return null;

  const currentIndex = Math.max(0, sessions.findIndex((session) => session.id === currentSessionId));
  const window = getSlidingWindow(sessions, currentIndex, width < 104 ? 3 : 5);

  return (
    <Box paddingX={1} marginBottom={1} flexDirection="column" width={Math.max(24, width - 2)}>
      <Text color={T.fgSubtle}>
        Sessions
        <Text color={T.fgMuted}> · {modeLabel}</Text>
        <Text color={T.fgMuted}> · {sessions.length} open</Text>
        {(window.hiddenBefore > 0 || window.hiddenAfter > 0) && (
          <Text color={T.fgMuted}>
            {' · '}
            {window.hiddenBefore > 0 ? `${window.hiddenBefore} left` : ''}
            {window.hiddenBefore > 0 && window.hiddenAfter > 0 ? ' · ' : ''}
            {window.hiddenAfter > 0 ? `${window.hiddenAfter} right` : ''}
          </Text>
        )}
      </Text>
      <Box flexWrap="wrap">
        {window.items.map((session) => {
          const isActive = session.id === currentSessionId;
          const marker = getSessionStatusMarker(session);
          const typeMarker = getSessionTypeMarker(session);
          const tabColor = isActive
            ? T.brandLight
            : session.isStreaming
              ? T.warn
              : session.interruptedAt
                ? T.info
                : T.fgDim;

          return (
            <Box key={session.id} marginRight={1}>
              <Text color={tabColor} bold={isActive}>
                {isActive ? '[' : ''}
                {typeMarker}
                {marker !== ' ' ? marker : '·'}
                {truncate(session.name, isActive ? 20 : 18)}
                {isActive ? ']' : ''}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
