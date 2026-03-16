import { Text } from 'ink';
import type { LLMConfig } from '@openbunny/shared/types';
import type { PanelSection } from '../../types.js';
import { T } from '../../theme.js';
import { truncate, formatTimeout } from '../../utils/formatting.js';

interface PanelSummaryProps {
  section: PanelSection;
  runtimeConfig: LLMConfig;
  agentName: string;
  sessionCount: number;
  enabledToolCount: number;
  connectedMcpCount: number;
  mcpCount: number;
  builtinToolCount: number;
  skillCount: number;
  enabledSkillCount: number;
  execLoginShell: boolean;
  toolExecutionTimeout: number;
  searchProvider: string;
}

export function PanelSummary(props: PanelSummaryProps) {
  const { section } = props;

  switch (section) {
    case 'general':
      return <Text color={T.fgDim}>Agent {props.agentName} · {props.sessionCount} sessions · search {props.searchProvider}</Text>;
    case 'llm':
      return <Text color={T.fgDim}>{props.runtimeConfig.provider}/{truncate(props.runtimeConfig.model, 20)} · temp {props.runtimeConfig.temperature}</Text>;
    case 'tools':
      return <Text color={T.fgDim}>{props.enabledToolCount}/{props.builtinToolCount} enabled · timeout {formatTimeout(props.toolExecutionTimeout)}</Text>;
    case 'skills':
      return <Text color={T.fgDim}>{props.enabledSkillCount}/{props.skillCount} enabled</Text>;
    case 'network':
      return <Text color={T.fgDim}>agents active · MCP {props.connectedMcpCount}/{props.mcpCount} connected</Text>;
    case 'about':
      return <Text color={T.fgDim}>OpenBunny v0.1.0 · exec {props.execLoginShell ? 'login-shell' : 'plain-shell'}</Text>;
    default:
      return null;
  }
}
