import { Box, Text } from 'ink';
import { T } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';
import type { LLMConfig } from '@openbunny/shared/types';

interface FooterBarProps {
  runtimeConfig: LLMConfig;
  currentSessionId: string | null;
  workspace?: string;
  isLoading?: boolean;
  sessionConfigScope: string;
  sessionConfigState: string;
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
  sessionConfigScope,
  sessionConfigState,
  width,
  totalMessageCount,
  panelVisible,
}: FooterBarProps) {
  if (!panelVisible) {
    return null;
  }

  const items: Array<{ label: string; color: string }> = [];
  const stateLabel = isLoading ? 'streaming' : panelVisible ? 'panel open' : 'idle';
  const stateColor = isLoading ? T.warn : panelVisible ? T.brandLight : T.accent;

  items.push({ label: stateLabel, color: stateColor });
  items.push({ label: `${sessionConfigScope}/${sessionConfigState}`, color: T.info });
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
    <Box paddingX={1} marginTop={1} width={Math.max(24, width - 2)}>
      {items.map((item, i) => (
        <Text key={i}>
          {i > 0 && <Text color={T.fgSubtle}> · </Text>}
          <Text color={item.color}>{item.label}</Text>
        </Text>
      ))}
      {currentSessionId && <Text color={T.fgSubtle}> · </Text>}
      {currentSessionId && <Text color={T.info}>/resume {currentSessionId.slice(0, 8)}</Text>}
    </Box>
  );
}
