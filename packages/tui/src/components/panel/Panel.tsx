import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { LLMConfig } from '@openbunny/shared/types';
import type { PanelEditorState, PanelItem, PanelSection } from '../../types.js';
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
  sessionConfigScope: string;
  sessionConfigState: string;
  enabledToolCount: number;
  connectedMcpCount: number;
  mcpCount: number;
  builtinToolCount: number;
  skillCount: number;
  enabledSkillCount: number;
  execLoginShell: boolean;
  toolExecutionTimeout: number;
  searchProvider: string;
  fileBrowserPath: string;
  fileEntryCount: number;
  editor: PanelEditorState | null;
  onEditorChange: (value: string) => void;
  onEditorSubmit: (value: string) => void;
  previewTitle?: string;
  previewMeta?: string;
  previewLines?: string[];
  previewTone?: string;
}

export function Panel(props: PanelProps) {
  const { section, items, selectedItemKey, panelWidth, hiddenBefore, hiddenAfter, editor } = props;
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
        sessionConfigScope={props.sessionConfigScope}
        sessionConfigState={props.sessionConfigState}
        enabledToolCount={props.enabledToolCount}
        connectedMcpCount={props.connectedMcpCount}
        mcpCount={props.mcpCount}
        builtinToolCount={props.builtinToolCount}
        skillCount={props.skillCount}
        enabledSkillCount={props.enabledSkillCount}
        execLoginShell={props.execLoginShell}
        toolExecutionTimeout={props.toolExecutionTimeout}
        searchProvider={props.searchProvider}
        fileBrowserPath={props.fileBrowserPath}
        fileEntryCount={props.fileEntryCount}
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

      {editor && (
        <>
          <Text color={T.border}>{divider}</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color={sectionColor} bold>Edit {editor.label}</Text>
            <Text color={T.fgSubtle}>{editor.help || 'Enter apply · Esc cancel'}</Text>
            <Box borderStyle="round" borderColor={sectionColor} paddingX={1} marginTop={1}>
              <Text color={sectionColor}>❯ </Text>
              <TextInput
                value={editor.value}
                onChange={props.onEditorChange}
                onSubmit={props.onEditorSubmit}
                placeholder={editor.placeholder}
              />
            </Box>
          </Box>
        </>
      )}

      {props.previewLines && props.previewLines.length > 0 && (
        <>
          <Text color={T.border}>{divider}</Text>
          <Box flexDirection="column" marginTop={1}>
            {props.previewTitle && (
              <Text color={props.previewTone || sectionColor} bold>{props.previewTitle}</Text>
            )}
            {props.previewMeta && (
              <Text color={T.fgSubtle}>{props.previewMeta}</Text>
            )}
            <Box
              borderStyle="round"
              borderColor={props.previewTone || sectionColor}
              paddingX={1}
              marginTop={1}
              flexDirection="column"
            >
              {props.previewLines.map((line, index) => (
                <Text key={`${index}-${line}`} color={T.fgDim} wrap="truncate-end">
                  {line}
                </Text>
              ))}
            </Box>
          </Box>
        </>
      )}

      <Text color={T.border}>{divider}</Text>
      <Text color={T.fgSubtle}>
        {editor
          ? 'Type edit · ↩ apply · Esc/right click cancel · click tab/item switch'
          : 'Click select · wheel scroll · right click close · ↑↓/←→ keys · 1-7 sections'}
      </Text>
    </Box>
  );
}
