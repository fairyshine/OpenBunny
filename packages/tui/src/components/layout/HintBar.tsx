import { Box, Text } from 'ink';
import { T } from '../../theme.js';

interface HintBarProps {
  panelVisible: boolean;
  width: number;
}

export function HintBar({ panelVisible, width }: HintBarProps) {
  const compact = width < 96;

  return (
    <Box paddingX={1} marginTop={1}>
      <Text color={T.fgSubtle}>
        {compact ? '^C quit' : '^C quit · Enter send'}
        {' · '}
        {panelVisible ? 'Esc close · Tab switch · ↑↓ select' : 'Esc/Tab panel'}
        {' · '}
        {compact ? '/help' : '/help commands'}
      </Text>
    </Box>
  );
}
