import { Box, Text } from 'ink';
import { T } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';
import type { LLMConfig } from '@openbunny/shared/types';

interface FooterBarProps {
  runtimeConfig: LLMConfig;
  currentSessionId: string | null;
  workspace?: string;
  isLoading?: boolean;
  width: number;
  totalMessageCount: number;
  panelVisible: boolean;
}

/** Gemini-style footer: compact status items separated by · */
export function FooterBar({
  runtimeConfig,
  currentSessionId,
  workspace,
  isLoading,
  width,
  totalMessageCount,
  panelVisible,
}: FooterBarProps) {
  const items: Array<{ label: string; color: string }> = [];
  const stateLabel = isLoading ? 'streaming' : panelVisible ? 'panel open' : 'idle';
  const stateColor = isLoading ? T.warn : panelVisible ? T.brandLight : T.accent;

  items.push({ label: stateLabel, color: stateColor });
  items.push({ label: `${runtimeConfig.provider}/${truncate(runtimeConfig.model, 18)}`, color: T.fgDim });
  items.push({ label: `${totalMessageCount} msg`, color: T.fgDim });

  if (currentSessionId) {
    items.push({ label: `#${currentSessionId.slice(0, 8)}`, color: T.info });
  }

  if (workspace) {
    const short = workspace.replace(/^\/Users\/[^/]+/, '~');
    items.push({ label: truncate(short, 30), color: T.fgMuted });
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={T.border}>{'─'.repeat(Math.max(1, width - 2))}</Text>
      <Box>
      {items.map((item, i) => (
        <Text key={i}>
          {i > 0 && <Text color={T.fgSubtle}> · </Text>}
          <Text color={item.color}>{item.label}</Text>
        </Text>
      ))}
      </Box>
    </Box>
  );
}
