import { Box, Text } from 'ink';
import { T } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';
import type { LLMConfig } from '@openbunny/shared/types';

const LOGO_LINES = [
  '   (\\_/)',
  "  (='.'=)",
  '  (")_(")',
];

interface AppHeaderProps {
  agentName: string;
  runtimeConfig: LLMConfig;
  workspace?: string;
  width: number;
  totalMessageCount: number;
  currentSessionId: string | null;
  isLoading: boolean;
  panelVisible: boolean;
}

export function AppHeader({
  agentName,
  runtimeConfig,
  workspace,
  width,
  totalMessageCount,
  currentSessionId,
  isLoading,
  panelVisible,
}: AppHeaderProps) {
  const shortWorkspace = workspace?.replace(/^\/Users\/[^/]+/, '~');
  const status = isLoading ? 'thinking' : panelVisible ? 'panel open' : 'ready';
  const tips = panelVisible
    ? 'Tab switch · ↑↓ select · Enter apply · Esc close'
    : 'Enter send · session strip · /help commands · /files · Esc/Tab panel';

  return (
    <Box paddingX={1} marginBottom={1} width={Math.max(24, width - 2)}>
      <Box
        borderStyle="round"
        borderColor={T.borderFocus}
        paddingX={1}
        flexDirection="column"
        width={Math.max(24, width - 2)}
      >
        <Text color={T.brand} bold>OpenBunny</Text>
        {LOGO_LINES.map((line) => (
          <Text key={line} color={T.brandLight}>{line}</Text>
        ))}
        <Text color={T.fgDim}>
          {runtimeConfig.provider}/{truncate(runtimeConfig.model, 32)}
          <Text color={T.fgSubtle}> · </Text>
          <Text color={panelVisible ? T.brandLight : isLoading ? T.warn : T.accent}>{status}</Text>
          <Text color={T.fgSubtle}> · </Text>
          <Text color={T.fgMuted}>{totalMessageCount} msg</Text>
        </Text>
        {agentName !== 'OpenBunny' && (
          <Text color={T.accent}>Agent: {truncate(agentName, 24)}</Text>
        )}
        {currentSessionId && (
          <Text color={T.info}>Session: {currentSessionId.slice(0, 8)}</Text>
        )}
        {shortWorkspace && (
          <Text color={T.fgMuted}>{truncate(shortWorkspace, Math.max(24, width - 10))}</Text>
        )}
        <Text color={T.border}>{'─'.repeat(Math.max(1, width - 8))}</Text>
        <Text color={T.fgSubtle}>{tips}</Text>
        <Text color={T.fgSubtle}>/new session · /resume &lt;id&gt; · /search · /export · /files</Text>
      </Box>
    </Box>
  );
}
