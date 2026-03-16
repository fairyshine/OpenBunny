import { Box, Text } from 'ink';
import { T, GRADIENT } from '../../theme.js';
import { truncate } from '../../utils/formatting.js';
import type { LLMConfig } from '@openbunny/shared/types';

/* ── Bunny ASCII logo (compact, fits narrow terminals) ─── */
const LOGO_LINES = [
  '  (\\(\\  ',
  '  ( -.-)',
  '  o_(")(") ',
];

/** Interpolate between two hex colors */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const ca = parse(a), cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function gradientColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  const segment = t * (GRADIENT.length - 1);
  const i = Math.min(Math.floor(segment), GRADIENT.length - 2);
  return lerpColor(GRADIENT[i], GRADIENT[i + 1], segment - i);
}

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

function HeaderBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Box marginLeft={1}>
      <Text color={T.fgSubtle}>{label}</Text>
      <Text color={T.fgMuted}>:</Text>
      <Text color={color}> {value}</Text>
    </Box>
  );
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
  const identityWidth = Math.max(32, width - 18);
  const sessionLabel = currentSessionId ? currentSessionId.slice(0, 8) : 'new';
  const modeLabel = isLoading ? 'thinking' : panelVisible ? 'panel' : 'ready';
  const modeColor = isLoading ? T.warn : panelVisible ? T.brandLight : T.accent;

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Box flexDirection="row" justifyContent="space-between" width={width - 2}>
      {/* Logo with gradient */}
        <Box flexDirection="row">
          <Box flexDirection="column" marginRight={2}>
            {LOGO_LINES.map((line, i) => (
              <Text key={i} color={gradientColor(i, LOGO_LINES.length)}>{line}</Text>
            ))}
          </Box>

          <Box flexDirection="column" justifyContent="center" width={identityWidth}>
            <Box>
              <Text bold color={T.brand}>OpenBunny</Text>
              <Text color={T.fgMuted}> v0.1.0</Text>
              {agentName !== 'OpenBunny' && (
                <>
                  <Text color={T.fgSubtle}> · </Text>
                  <Text color={T.accent}>{truncate(agentName, 20)}</Text>
                </>
              )}
            </Box>
            <Box>
              <Text color={T.fgDim}>{runtimeConfig.provider}</Text>
              <Text color={T.fgSubtle}>/</Text>
              <Text color={T.fg}>{truncate(runtimeConfig.model, 32)}</Text>
            </Box>
            {workspace && (
              <Text color={T.fgMuted}>{truncate(workspace, Math.max(24, identityWidth - 4))}</Text>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" justifyContent="center" alignItems="flex-end">
          <HeaderBadge label="mode" value={modeLabel} color={modeColor} />
          <HeaderBadge label="session" value={sessionLabel} color={T.info} />
          <HeaderBadge label="messages" value={String(totalMessageCount)} color={T.fgDim} />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={T.border}>{'═'.repeat(Math.max(1, width - 2))}</Text>
      </Box>
    </Box>
  );
}
