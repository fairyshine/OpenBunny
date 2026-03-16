import { Box, Text } from 'ink';
import type { Notice } from '../../types.js';
import { T, getNoticeColor } from '../../theme.js';
import { MAX_VISIBLE_NOTICES } from '../../constants.js';

interface NoticePanelProps {
  notices: Notice[];
  error: string;
  width: number;
}

const TONE_ICON: Record<string, string> = {
  error: '✕',
  success: '✓',
  warning: '!',
  info: 'ℹ',
};

export function NoticePanel({ notices, error, width }: NoticePanelProps) {
  const visibleNotices = notices.slice(-MAX_VISIBLE_NOTICES);
  const hiddenCount = Math.max(0, notices.length - visibleNotices.length);

  if (visibleNotices.length === 0 && !error) return null;

  return (
    <Box
      marginX={1}
      marginTop={1}
      borderStyle="round"
      borderColor={error ? T.err : T.borderLight}
      paddingX={1}
      flexDirection="column"
      width={Math.max(24, width - 4)}
    >
      <Box justifyContent="space-between">
        <Text color={error ? T.err : T.info} bold>Activity</Text>
        <Text color={T.fgSubtle}>{error ? 'error present' : `${visibleNotices.length} recent`}</Text>
      </Box>
      {hiddenCount > 0 && (
        <Text color={T.fgSubtle} italic>+{hiddenCount} older</Text>
      )}
      {visibleNotices.map((notice) => (
        <Box key={notice.id} marginTop={1}>
          <Text color={getNoticeColor(notice.tone)}>
            {TONE_ICON[notice.tone] || 'ℹ'}{' '}
          </Text>
          <Text color={T.fgDim} wrap="wrap">{notice.content}</Text>
        </Box>
      ))}
      {error && (
        <Box marginTop={1}>
          <Text color={T.err}>✕ </Text>
          <Text color={T.err} wrap="wrap">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
