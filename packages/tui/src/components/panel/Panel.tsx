import { Box, Text } from 'ink';
import type { LLMConfig } from '@openbunny/shared/types';
import type { PanelItem, PanelSection } from '../../types.js';
import { T, getSectionColor } from '../../theme.js';
import { PanelTabs } from './PanelTabs.js';
import { PanelSummary } from './PanelSummary.js';
import { PanelItemList } from './PanelItemList.js';

interface PanelProps {
  section: PanelSection;
  items: PanelItem[];
  selectedItemKey: string | null;
  panelWidth: number;
  hiddenBefore: number;
  hiddenAfter: number;
  // summary data
  agentName: string;
  runtimeConfig: LLMConfig;
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

export function Panel(props: PanelProps) {
  const { section, items, selectedItemKey, panelWidth, hiddenBefore, hiddenAfter } = props;
  const sectionColor = getSectionColor(section);
  const divider = '─'.repeat(Math.max(1, panelWidth - 4));

  return (
    <Box
      borderStyle="round"
      borderColor={sectionColor}
      paddingX={1}
      flexDirection="column"
      width={panelWidth}
    >
      <PanelTabs currentSection={section} />

      <PanelSummary
        section={section}
        agentName={props.agentName}
        runtimeConfig={props.runtimeConfig}
        sessionCount={props.sessionCount}
        enabledToolCount={props.enabledToolCount}
        connectedMcpCount={props.connectedMcpCount}
        mcpCount={props.mcpCount}
        builtinToolCount={props.builtinToolCount}
        skillCount={props.skillCount}
        enabledSkillCount={props.enabledSkillCount}
        execLoginShell={props.execLoginShell}
        toolExecutionTimeout={props.toolExecutionTimeout}
        searchProvider={props.searchProvider}
      />

      <Text color={T.border}>{divider}</Text>

      {hiddenBefore > 0 && (
        <Text color={T.fgSubtle}>↑ {hiddenBefore} item{hiddenBefore === 1 ? '' : 's'} above</Text>
      )}

      <PanelItemList
        section={section}
        items={items}
        selectedItemKey={selectedItemKey}
        panelWidth={panelWidth}
      />

      {hiddenAfter > 0 && (
        <Text color={T.fgSubtle}>↓ {hiddenAfter} more item{hiddenAfter === 1 ? '' : 's'}</Text>
      )}

      <Text color={T.border}>{divider}</Text>
      <Text color={T.fgSubtle}>↑↓ navigate · ↩ select · Tab switch · Esc close</Text>
    </Box>
  );
}
