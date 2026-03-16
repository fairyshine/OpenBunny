import { Box, Text } from 'ink';
import { T } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';
import type { LLMConfig } from '@openbunny/shared/types';

interface StatusLineProps {
  agentName: string;
  runtimeConfig: LLMConfig;
  currentSessionId: string | null;
  workspace?: string;
}

export function StatusLine({ agentName, runtimeConfig, currentSessionId, workspace }: StatusLineProps) {
  return (
    <Box>
      <Text bold color={T.brand}>🐰 Bunny</Text>
      <Text color={T.fgMuted}> </Text>
      <Text color={T.fgDim}>{runtimeConfig.provider}</Text>
      <Text color={T.fgMuted}>/</Text>
      <Text color={T.fg}>{truncate(runtimeConfig.model, 20)}</Text>
      {agentName !== 'OpenBunny' && (
        <>
          <Text color={T.fgMuted}> · </Text>
          <Text color={T.accent}>{agentName}</Text>
        </>
      )}
      {currentSessionId && (
        <>
          <Text color={T.fgMuted}> · </Text>
          <Text color={T.info}>#{currentSessionId.slice(0, 8)}</Text>
        </>
      )}
      {workspace && (
        <>
          <Text color={T.fgMuted}> · </Text>
          <Text color={T.fgDim}>{truncate(workspace, 24)}</Text>
        </>
      )}
    </Box>
  );
}
