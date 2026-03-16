import { Box, Text } from 'ink';
import { T } from '../../theme.js';

interface HintBarProps {
  panelVisible: boolean;
  width: number;
  panelEditing?: boolean;
}

export function HintBar({ panelVisible, width, panelEditing }: HintBarProps) {
  const compact = width < 96;

  return (
    <Box paddingX={1}>
      <Text color={T.fgSubtle}>
        {compact ? '^C quit' : '^C quit · Enter send'}
        {' · '}
        {panelEditing
          ? 'Esc/right click cancel edit · Enter apply'
          : panelVisible
            ? 'Click select · wheel scroll · e edit file · right click close'
            : 'Esc/Tab panel · PgUp/PgDn scroll · Home/End jump'}
        {' · '}
        {compact ? '/help · Ctrl+B/Ctrl+N search' : '/help · /scope · Ctrl+O scope · Ctrl+B/Ctrl+N search'}
        {!compact && ' · /trash · /files workspace · Ctrl+F files'}
      </Text>
    </Box>
  );
}
