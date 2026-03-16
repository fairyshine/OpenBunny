import { Box, Text } from 'ink';
import { T } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';
import type { LLMConfig } from '@openbunny/shared/types';

interface AppHeaderProps {
  agentName: string;
  runtimeConfig: LLMConfig;
  workspace?: string;
  width: number;
  totalMessageCount: number;
  isLoading: boolean;
  panelVisible: boolean;
}

export function AppHeader({
  agentName,
  runtimeConfig,
  workspace,
  width,
  totalMessageCount,
  isLoading,
  panelVisible,
}: AppHeaderProps) {
  const status = isLoading ? 'streaming' : panelVisible ? 'panel open' : 'ready';

  return (
    <Box paddingX={1} marginBottom={1} flexDirection="column" width={Math.max(24, width - 2)}>
      <Text color={T.fgDim}>
        {runtimeConfig.provider}/{truncate(runtimeConfig.model, 36)}
        <Text color={T.fgSubtle}> · </Text>
        <Text color={panelVisible ? T.brandLight : isLoading ? T.warn : T.accent}>{status}</Text>
        <Text color={T.fgSubtle}> · </Text>
        <Text color={T.fgMuted}>{totalMessageCount} msg</Text>
      </Text>
      {agentName !== 'OpenBunny' && (
        <Text color={T.fgMuted}>agent {truncate(agentName, 20)}</Text>
      )}
      {workspace && agentName !== 'OpenBunny' && (
        <Text color={T.fgSubtle}>{truncate(workspace.replace(/^\/Users\/[^/]+/, '~'), Math.max(24, width - 6))}</Text>
      )}
    </Box>
  );
}
