import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { LLMConfig } from '@openbunny/shared/types';
import type { PanelEditorState, PanelItem, PanelSection } from '../../types.js';
import { T, getSectionColor, getSectionSurfaceColor } from '../../theme.js';
import { PanelTabs } from './PanelTabs.js';
import { PanelSummary } from './PanelSummary.js';
import { PanelItemList } from './PanelItemList.js';

interface PanelProps {
  section: PanelSection;
  items: PanelItem[];
  selectedItemKey: string | null;
  panelWidth: number;
  panelHeight: number;
  hiddenBefore: number;
  hiddenAfter: number;
  // summary data
  agentName: string;
  runtimeConfig: LLMConfig;
  sessionCount: number;
  sessionConfigScope: string;
  sessionConfigState: string;
  enabledToolCount: number;
  availableToolCount: number;
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
  previewBodyHeight?: number;
}

export function Panel(props: PanelProps) {
  const {
    section,
    items,
    selectedItemKey,
    panelWidth,
    panelHeight,
    hiddenBefore,
    hiddenAfter,
    editor,
    previewBodyHeight = 5,
  } = props;
  const sectionColor = getSectionColor(section);
  const sectionSurface = getSectionSurfaceColor(section);
  const divider = '─'.repeat(Math.max(1, panelWidth - 4));

  return (
    <Box
      borderStyle="round"
      borderColor={sectionColor}
      paddingX={1}
      flexDirection="column"
      width={panelWidth}
      height={panelHeight}
      overflow="hidden"
      backgroundColor={sectionSurface}
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
        availableToolCount={props.availableToolCount}
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

      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {hiddenBefore > 0 && (
          <Text color={T.fgSubtle}>↑ {hiddenBefore} item{hiddenBefore === 1 ? '' : 's'} above</Text>
        )}

        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          <PanelItemList
            section={section}
            items={items}
            selectedItemKey={selectedItemKey}
            panelWidth={panelWidth}
          />
        </Box>

        {hiddenAfter > 0 && (
          <Text color={T.fgSubtle}>↓ {hiddenAfter} more item{hiddenAfter === 1 ? '' : 's'}</Text>
        )}
      </Box>

      {editor && (
        <>
          <Text color={T.border}>{divider}</Text>
          <Text color={sectionColor} bold wrap="truncate-end">
            Edit {editor.label} · {editor.help || 'Enter apply · Esc cancel'}
          </Text>
          <Box
            borderStyle="round"
            borderColor={sectionColor}
            paddingX={1}
            height={3}
            overflow="hidden"
            backgroundColor={T.surfaceAlt}
          >
            <Box>
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

      {!editor && props.previewLines && props.previewLines.length > 0 && (
        <>
          <Text color={T.border}>{divider}</Text>
          <Text color={props.previewTone || sectionColor} bold wrap="truncate-end">
            {props.previewTitle || 'Preview'}{props.previewMeta ? ` · ${props.previewMeta}` : ''}
          </Text>
          <Box
            borderStyle="round"
            borderColor={props.previewTone || sectionColor}
            paddingX={1}
            flexDirection="column"
            height={previewBodyHeight}
            overflow="hidden"
            backgroundColor={T.surfaceAlt}
          >
            {props.previewLines.map((line, index) => (
              <Text key={`${index}-${line}`} color={T.fgDim} wrap="truncate-end">
                {line}
              </Text>
            ))}
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
