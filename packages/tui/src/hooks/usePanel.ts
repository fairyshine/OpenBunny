import path from 'node:path';
import { useState, useCallback, useEffect } from 'react';
import { useInput } from 'ink';
import type { PanelSection, PanelItem, PanelEditorState } from '../types.js';
import { providerRegistry, getProviderMeta } from '@openbunny/shared/services/ai';
import { PANEL_SECTIONS, MAX_VISIBLE_SECTION_ITEMS, SEARCH_PROVIDER_ORDER, SESSION_TYPE_FILTERS, TOOL_TIMEOUT_PRESETS, TOOL_DESCRIPTIONS, TEMPERATURE_PRESETS, MAX_TOKEN_PRESETS } from '../constants.js';
import { truncate, formatTimeout, getSlidingWindow } from '../utils/formatting.js';
import { useMouse } from './useMouse.js';
import type { LLMConfig, Session } from '@openbunny/shared/types';
import type { MCPConnection, MCPTransportType } from '@openbunny/shared/stores/tools';
import { getSectionTabLabel } from '../theme.js';
import type { FileBrowserController } from './useFileBrowser.js';
import {
  getEffectiveSessionSkills,
  getEffectiveSessionTools,
  getSessionConfigScopeLabel,
  getSessionStatusLabel,
  getSessionSummary,
  getSessionTypeLabel,
  isSessionConfigLocked,
  isReadOnlySession,
} from '../utils/sessionPresentation.js';

type SessionTypeFilter = (typeof SESSION_TYPE_FILTERS)[number];

interface UsePanelOptions {
  terminalWidth: number;
  panelTop: number;
  sessions: Session[];
  currentSession: Session | null;
  currentSessionId: string | null;
  currentAgent: { name: string; id: string; llmConfig: LLMConfig; isDefault?: boolean; enabledTools?: string[]; enabledSkills?: string[] } | null;
  agents: Array<{ id: string; name: string; llmConfig: LLMConfig; isDefault?: boolean }>;
  enabledTools: string[];
  enabledSkills: string[];
  builtinToolIds: string[];
  skills: Array<{ id: string; description: string }>;
  mcpConnections: MCPConnection[];
  execLoginShell: boolean;
  toolExecutionTimeout: number;
  searchProvider: 'exa_free' | 'exa' | 'brave';
  runtimeConfig: LLMConfig;
  workspace?: string;
  capabilities: { supportsExec: boolean };
  connectedMcpCount: number;
  // actions
  isDefaultAgent: boolean;
  currentAgentId: string;
  systemPrompt?: string;
  addNotice: (content: string, tone?: 'info' | 'success' | 'warning' | 'error') => void;
  createSession: (name: string) => Session;
  loadSessionMessages: (id: string) => Promise<void>;
  openSession: (id: string) => void;
  setSessionSystemPrompt: (sessionId: string, prompt: string) => void;
  setSessionTools: (sessionId: string, tools: string[] | undefined) => void;
  setSessionSkills: (sessionId: string, skills: string[] | undefined) => void;
  loadAgentSessionMessages: (agentId: string, id: string) => Promise<void>;
  setAgentCurrentSession: (agentId: string, id: string) => void;
  setCurrentAgent: (id: string) => void;
  agentSessions: Record<string, Session[]>;
  createAgentSession: (agentId: string, name: string) => Session;
  setAgentSessionSystemPrompt: (agentId: string, sessionId: string, prompt: string) => void;
  setAgentSessionTools: (agentId: string, sessionId: string, tools: string[] | undefined) => void;
  setAgentSessionSkills: (agentId: string, sessionId: string, skills: string[] | undefined) => void;
  toggleGlobalTool: (id: string) => void;
  setAgentEnabledTools: (agentId: string, tools: string[]) => void;
  toggleGlobalSkill: (id: string) => void;
  setAgentEnabledSkills: (agentId: string, skills: string[]) => void;
  syncMCPConnection: (connection: { id: string; name: string; url: string; transport: MCPTransportType }) => Promise<void>;
  setExecLoginShell: (value: boolean) => void;
  setToolExecutionTimeout: (value: number) => void;
  setSearchProvider: (provider: 'exa_free' | 'exa' | 'brave') => void;
  // runtime config actions
  applyRuntimeConfig: (updates: Partial<LLMConfig>) => LLMConfig;
  saveRuntimeConfig: (config: LLMConfig) => void;
  fileBrowser: FileBrowserController;
  // input state
  input: string;
  isInitializing: boolean;
  isLoading: boolean;
}

interface PanelMouseTabHit {
  section: PanelSection;
  xStart: number;
  xEnd: number;
}

interface PanelMouseRowHit {
  type: 'item' | 'scroll';
  yStart: number;
  yEnd: number;
  itemKey?: string;
  delta?: number;
}

const PANEL_BORDER_AND_PADDING_X = 2;
const PANEL_EDITOR_HEIGHT = 7;

function formatByteSize(size: number): string {
  if (size < 1024) return `${size}b`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}k`;
  return `${(size / (1024 * 1024)).toFixed(1)}m`;
}

function getPanelItemHeight(item: PanelItem, isSelected: boolean): number {
  if (item.type === 'header') {
    return 2;
  }

  return 1 + (isSelected && item.hint ? 1 : 0);
}

function buildPanelMouseLayout(args: {
  terminalWidth: number;
  panelWidth: number;
  panelTop: number;
  section: PanelSection;
  items: PanelItem[];
  selectedItemKey: string | null;
  hiddenBefore: number;
  hiddenAfter: number;
  editor: PanelEditorState | null;
}) {
  const panelLeft = Math.max(1, Math.floor((args.terminalWidth - args.panelWidth) / 2) + 1);
  const panelRight = panelLeft + args.panelWidth - 1;
  const contentLeft = panelLeft + PANEL_BORDER_AND_PADDING_X;
  const tabY = args.panelTop + 1;
  const tabHits: PanelMouseTabHit[] = [];
  let tabCursorX = contentLeft;

  for (const section of PANEL_SECTIONS) {
    const label = args.section === section
      ? `[${getSectionTabLabel(section)}]`
      : getSectionTabLabel(section);

    tabHits.push({
      section,
      xStart: tabCursorX,
      xEnd: tabCursorX + label.length - 1,
    });

    tabCursorX += label.length + 1;
  }

  const rowHits: PanelMouseRowHit[] = [];
  let cursorY = args.panelTop + 4;

  if (args.hiddenBefore > 0) {
    rowHits.push({ type: 'scroll', delta: -1, yStart: cursorY, yEnd: cursorY });
    cursorY += 1;
  }

  for (const item of args.items) {
    if (item.type === 'header') {
      cursorY += 2;
      continue;
    }

    const height = getPanelItemHeight(item, item.key === args.selectedItemKey);
    rowHits.push({
      type: 'item',
      itemKey: item.key,
      yStart: cursorY,
      yEnd: cursorY + height - 1,
    });
    cursorY += height;
  }

  if (args.hiddenAfter > 0) {
    rowHits.push({ type: 'scroll', delta: 1, yStart: cursorY, yEnd: cursorY });
    cursorY += 1;
  }

  if (args.editor) {
    cursorY += PANEL_EDITOR_HEIGHT;
  }

  return {
    panelLeft,
    panelRight,
    panelTop: args.panelTop,
    panelBottom: cursorY + 2,
    tabY,
    editorTop: args.editor ? cursorY - PANEL_EDITOR_HEIGHT : null,
    editorBottom: args.editor ? cursorY - 1 : null,
    tabHits,
    rowHits,
  };
}

function isFileEntryKey(itemKey: string): boolean {
  return itemKey.startsWith('files:file:') || itemKey.startsWith('files:directory:');
}

function getFileEntryPath(itemKey: string): string | null {
  if (!isFileEntryKey(itemKey)) {
    return null;
  }

  return itemKey.replace(/^files:(?:file|directory):/, '');
}

export function usePanel(opts: UsePanelOptions) {
  const [panelSection, setPanelSection] = useState<PanelSection>('general');
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelEditor, setPanelEditor] = useState<PanelEditorState | null>(null);
  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionTypeFilter>('all');
  const [fileActionTargetPath, setFileActionTargetPath] = useState<string | null>(null);
  const [panelSelections, setPanelSelections] = useState<Record<PanelSection, number>>({
    general: 0, llm: 0, tools: 0, skills: 0, network: 0, files: 0, about: 0,
  });

  const terminalWidth = opts.terminalWidth;
  const panelWidth = Math.min(72, Math.max(40, Math.floor(terminalWidth * 0.7)));
  const providerMeta = getProviderMeta(opts.runtimeConfig.provider);
  const providerModels = providerMeta?.models?.length ? providerMeta.models : [opts.runtimeConfig.model];
  const providerScope = opts.isDefaultAgent ? 'global default' : `agent ${opts.currentAgent?.name || opts.currentAgentId}`;
  const fileBrowser = opts.fileBrowser;
  const sessionConfigScope = getSessionConfigScopeLabel(opts.currentSession);
  const sessionConfigLocked = isSessionConfigLocked(opts.currentSession);
  const sessionConfigReadOnly = isReadOnlySession(opts.currentSession);
  const effectiveToolIds = getEffectiveSessionTools(opts.currentSession, opts.enabledTools);
  const effectiveSkillIds = getEffectiveSessionSkills(opts.currentSession, opts.enabledSkills);
  const visibleEffectiveToolIds = effectiveToolIds.filter((id) => id !== 'file_manager');
  const filteredSessions = opts.sessions.filter((session) => (
    sessionTypeFilter === 'all' ? true : (session.sessionType || 'user') === sessionTypeFilter
  ));
  const selectedFileTargetPath = fileActionTargetPath || fileBrowser.preview?.path || null;
  const selectedFileTargetLabel = selectedFileTargetPath
    ? truncate(path.basename(selectedFileTargetPath) || selectedFileTargetPath, 26)
    : '(select item)';
  const filePreviewMeta = fileBrowser.preview
    ? `${fileBrowser.preview.kind} · ${formatByteSize(fileBrowser.preview.size)}${fileBrowser.preview.truncated ? ' · truncated' : ''}`
    : undefined;

  const cycleValue = useCallback(<T,>(
    values: readonly T[],
    current: T,
    delta: number,
    getFallbackIndex?: () => number,
  ) => {
    if (values.length === 0) return current;
    let index = values.findIndex((value) => value === current);
    if (index < 0) {
      index = getFallbackIndex ? getFallbackIndex() : 0;
    }
    return values[(index + delta + values.length) % values.length];
  }, []);

  const nearestNumericIndex = useCallback((values: readonly number[], current: number) => {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    values.forEach((value, index) => {
      const distance = Math.abs(value - current);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }, []);

  const setSessionOverrideConfig = useCallback((session: Session, tools: string[] | undefined, skills: string[] | undefined) => {
    if (opts.isDefaultAgent) {
      opts.setSessionTools(session.id, tools);
      opts.setSessionSkills(session.id, skills);
      return;
    }

    opts.setAgentSessionTools(opts.currentAgentId, session.id, tools);
    opts.setAgentSessionSkills(opts.currentAgentId, session.id, skills);
  }, [
    opts.currentAgentId,
    opts.isDefaultAgent,
    opts.setAgentSessionSkills,
    opts.setAgentSessionTools,
    opts.setSessionSkills,
    opts.setSessionTools,
  ]);

  const ensureSessionOverrides = useCallback((session: Session) => {
    const nextTools = session.sessionTools ?? [...opts.enabledTools];
    const nextSkills = session.sessionSkills ?? [...opts.enabledSkills];
    setSessionOverrideConfig(session, nextTools, nextSkills);
    return { tools: nextTools, skills: nextSkills };
  }, [opts.enabledSkills, opts.enabledTools, setSessionOverrideConfig]);

  const canMutateSessionOverrides = useCallback((session: Session | null) => {
    if (!session) {
      opts.addNotice('No active session selected.', 'warning');
      return false;
    }

    if (isReadOnlySession(session)) {
      opts.addNotice(`${getSessionTypeLabel(session)} is read-only. Session-scoped tools and skills cannot be edited.`, 'warning');
      return false;
    }

    if (isSessionConfigLocked(session)) {
      opts.addNotice('Current session already started. Session-scoped tools and skills are locked, matching the WEB input behavior.', 'warning');
      return false;
    }

    return true;
  }, [opts]);

  /* ── General section ───────────────────────────────── */
  const generalItems: PanelItem[] = [
    { key: 'session:new', label: 'New session', meta: 'create', type: 'action', hint: 'Create a fresh TUI chat session' },
    { key: 'workspace', label: 'Workspace', meta: truncate(opts.workspace || process.cwd(), 30), type: 'info' },
    { key: 'current-session-type', label: 'Session type', meta: getSessionTypeLabel(opts.currentSession), type: 'info' },
    { key: 'current-session-status', label: 'Session status', meta: getSessionStatusLabel(opts.currentSession), type: 'info' },
    {
      key: 'session-scope',
      label: 'Tool/skill scope',
      meta: sessionConfigScope,
      type: 'cycle',
      hint: sessionConfigReadOnly
        ? 'Read-only sessions keep their snapshot'
        : sessionConfigLocked
          ? 'Session already started; this snapshot is locked'
          : 'Switch between global defaults and a session snapshot',
    },
    {
      key: 'session-config-state',
      label: 'Config state',
      meta: sessionConfigReadOnly ? 'read-only' : sessionConfigLocked ? 'locked' : 'editable',
      type: 'info',
      hint: `Effective: ${visibleEffectiveToolIds.length} tool(s), ${effectiveSkillIds.length} skill(s)`,
    },
    { key: 'session-filter', label: 'Session filter', meta: sessionTypeFilter, type: 'cycle', hint: 'Match the WEB session filter bar in TUI' },
    ...(getSessionSummary(opts.currentSession)
      ? [{
          key: 'current-session-summary',
          label: 'Summary',
          meta: truncate(getSessionSummary(opts.currentSession), 26),
          type: 'info' as const,
          hint: 'Live session summary from paired dialogue sessions',
        }]
      : []),
    { key: 'exec-login-shell', label: 'Exec login shell', meta: opts.execLoginShell ? 'on' : 'off', active: opts.execLoginShell, type: 'toggle', hint: 'Use login shell for /shell commands' },
    { key: 'tool-timeout', label: 'Tool timeout', meta: formatTimeout(opts.toolExecutionTimeout), type: 'cycle', hint: 'Max execution time per tool call' },
    { key: 'search-provider', label: 'Search provider', meta: opts.searchProvider, type: 'cycle', hint: 'Web search backend' },
    { key: 'sessions-header', label: '── Sessions', type: 'header' },
    ...filteredSessions.slice(0, 10).map((s) => ({
      key: `session:${s.id}`,
      label: truncate(s.name, 28),
      meta: `${s.id.slice(0, 8)}  ${(s.sessionType || 'user').slice(0, 1)}  ${s.messages.length} msg`,
      active: s.id === opts.currentSessionId,
      type: 'action' as const,
      hint: `${getSessionTypeLabel(s)} · ${getSessionStatusLabel(s)}${s.projectId ? ` · project ${s.projectId.slice(0, 6)}` : ''}`,
    })),
  ];

  /* ── LLM section ───────────────────────────────────── */
  const llmItems: PanelItem[] = [
    { key: 'llm-scope', label: 'Scope', meta: truncate(providerScope, 26), type: 'info' },
    { key: 'llm-provider', label: 'Provider', meta: providerMeta ? `${providerMeta.name} (${providerMeta.id})` : opts.runtimeConfig.provider, type: 'cycle', hint: 'Left/Right or Enter to cycle provider presets' },
    { key: 'llm-model', label: 'Model', meta: truncate(opts.runtimeConfig.model, 24), type: 'input', hint: `Enter edits custom model · Left/Right cycles ${providerModels.length} preset${providerModels.length === 1 ? '' : 's'}` },
    { key: 'llm-temperature', label: 'Temperature', meta: String(opts.runtimeConfig.temperature ?? 0.7), type: 'input', hint: 'Enter edits numeric value · Left/Right cycles presets' },
    { key: 'llm-max-tokens', label: 'Max tokens', meta: String(opts.runtimeConfig.maxTokens ?? 4096), type: 'input', hint: 'Enter edits numeric value · Left/Right cycles presets' },
    { key: 'llm-base-url', label: 'Base URL', meta: opts.runtimeConfig.baseUrl ? truncate(opts.runtimeConfig.baseUrl, 24) : '(default)', type: 'input', hint: 'Enter edits base URL · submit empty to reset to default' },
    { key: 'llm-api-key', label: 'API key', meta: opts.runtimeConfig.apiKey ? `${opts.runtimeConfig.apiKey.slice(0, 8)}...` : (providerMeta?.requiresApiKey ? '(required)' : '(optional)'), type: 'input', hint: 'Enter edits API key · submit empty to clear' },
    { key: 'llm-save', label: '💾 Save current config', type: 'action', hint: 'Persist to disk' },
    { key: 'llm-hint', label: '── Panel edits apply immediately; save to persist', type: 'header' },
  ];

  /* ── Tools section ─────────────────────────────────── */
  const toolItems: PanelItem[] = opts.builtinToolIds.map((id) => ({
    key: id,
    label: id,
    meta: effectiveToolIds.includes(id) ? 'on' : 'off',
    active: effectiveToolIds.includes(id),
    type: 'toggle' as const,
    hint: `${TOOL_DESCRIPTIONS[id] || ''}${sessionConfigScope === 'session' ? ' · session scope' : ' · global scope'}`,
  }));

  /* ── Skills section ────────────────────────────────── */
  const skillItems: PanelItem[] = opts.skills.map((s) => ({
    key: s.id,
    label: truncate(s.id, 28),
    meta: effectiveSkillIds.includes(s.id) ? 'on' : 'off',
    active: effectiveSkillIds.includes(s.id),
    type: 'toggle' as const,
    hint: truncate(`${s.description || ''}${sessionConfigScope === 'session' ? ' · session scope' : ' · global scope'}`, 56),
  }));

  /* ── Network section (agents + MCP) ────────────────── */
  const networkItems: PanelItem[] = [
    { key: 'agents-header', label: '── Agents', type: 'header' },
    ...opts.agents.map((a) => ({
      key: `agent:${a.id}`,
      label: truncate(a.name, 24),
      meta: a.isDefault
        ? `default  ${a.llmConfig.provider}/${truncate(a.llmConfig.model, 10)}`
        : `${a.id.slice(0, 6)}  ${a.llmConfig.provider}/${truncate(a.llmConfig.model, 10)}`,
      active: a.id === opts.currentAgentId,
      type: 'action' as const,
    })),
    { key: 'mcp-header', label: '── MCP Connections', type: 'header' },
    ...(opts.mcpConnections.length === 0
      ? [{ key: 'mcp-empty', label: 'No MCP connections', type: 'info' as const, meta: 'Use /mcp add' }]
      : opts.mcpConnections.map((c) => ({
          key: `mcp:${c.id}`,
          label: truncate(c.name, 24),
          meta: `${c.status}  ${c.tools.length} tool${c.tools.length === 1 ? '' : 's'}`,
          active: c.status === 'connected',
          status: c.status,
          type: 'action' as const,
        }))),
  ];

  /* ── Files section ─────────────────────────────────── */
  const fileItems: PanelItem[] = [
    { key: 'files:root', label: 'Workspace root', meta: truncate(fileBrowser.rootPath, 24), type: 'action', hint: 'Jump back to workspace root' },
    { key: 'files:up', label: 'Parent directory', meta: fileBrowser.currentPath === fileBrowser.rootPath ? '(root)' : '..', type: 'action', hint: 'Go up one directory' },
    { key: 'files:refresh', label: 'Refresh', meta: fileBrowser.isLoading ? 'loading' : `${fileBrowser.entries.length} item(s)`, type: 'action', hint: 'Reload current directory listing' },
    { key: 'files:new-file', label: 'New file', meta: 'create', type: 'action', hint: 'Create a file inside the current directory' },
    { key: 'files:new-dir', label: 'New folder', meta: 'create', type: 'action', hint: 'Create a directory inside the current directory' },
    { key: 'files:rename', label: 'Rename selected', meta: selectedFileTargetLabel, type: 'action', hint: 'Rename the last selected file or directory' },
    { key: 'files:delete', label: 'Delete selected', meta: selectedFileTargetLabel, type: 'action', hint: 'Delete the last selected file or directory recursively' },
    { key: 'files:path', label: 'Current path', meta: truncate(fileBrowser.currentDisplayPath, 26), type: 'info', hint: fileBrowser.currentPath },
    ...(selectedFileTargetPath
      ? [{
          key: 'files:selection',
          label: 'Selected item',
          meta: selectedFileTargetLabel,
          type: 'info' as const,
          hint: selectedFileTargetPath,
        }]
      : []),
    ...(fileBrowser.error
      ? [{ key: 'files:error', label: 'File browser error', meta: truncate(fileBrowser.error, 24), type: 'info' as const }]
      : []),
    { key: 'files-header', label: '── Workspace Files', type: 'header' },
    ...(fileBrowser.entries.length === 0
      ? [{ key: 'files:empty', label: fileBrowser.isLoading ? 'Loading directory...' : '(empty directory)', type: 'info' as const }]
      : fileBrowser.entries.map((entry) => ({
          key: `files:${entry.kind}:${entry.path}`,
          label: truncate(entry.kind === 'directory' ? `${entry.name}/` : entry.name, 28),
          meta: entry.kind === 'directory'
            ? 'dir'
            : `${formatByteSize(entry.size)}  ${new Date(entry.modifiedAt).toLocaleDateString()}`,
          type: 'action' as const,
          hint: entry.path,
        }))),
  ];

  /* ── About section ─────────────────────────────────── */
  const aboutItems: PanelItem[] = [
    { key: 'about-name', label: '🐰 OpenBunny', type: 'info', meta: 'AI-powered assistant' },
    { key: 'about-version', label: 'Version', meta: '0.1.0', type: 'info' },
    { key: 'about-agent', label: 'Current agent', meta: opts.currentAgent?.name || 'OpenBunny', type: 'info' },
    { key: 'about-session', label: 'Session', meta: opts.currentSessionId ? opts.currentSessionId.slice(0, 8) : '(none)', type: 'info' },
    { key: 'about-scope', label: 'Config scope', meta: sessionConfigScope, type: 'info' },
    { key: 'about-tools', label: 'Tools', meta: `${visibleEffectiveToolIds.length} enabled`, type: 'info' },
    { key: 'about-skills', label: 'Skills', meta: `${effectiveSkillIds.length}/${opts.skills.length} enabled`, type: 'info' },
    { key: 'about-mcp', label: 'MCP', meta: `${opts.connectedMcpCount}/${opts.mcpConnections.length} connected`, type: 'info' },
    { key: 'about-exec', label: 'Exec', meta: opts.capabilities.supportsExec ? 'available' : 'unavailable', active: opts.capabilities.supportsExec, type: 'info' },
  ];

  const getItems = useCallback((section: PanelSection): PanelItem[] => {
    switch (section) {
      case 'general':   return generalItems;
      case 'llm':       return llmItems;
      case 'tools':     return toolItems;
      case 'skills':    return skillItems;
      case 'network':   return networkItems;
      case 'files':     return fileItems;
      case 'about':     return aboutItems;
      default:          return [];
    }
  }, [generalItems, llmItems, toolItems, skillItems, networkItems, fileItems, aboutItems]);

  /* ── Clamp selections when items change ────────────── */
  useEffect(() => {
    setPanelSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of PANEL_SECTIONS) {
        const items = getItems(section);
        // Skip header items for selection
        const selectableCount = items.filter((i) => i.type !== 'header').length;
        const lastIndex = selectableCount - 1;
        const clamped = lastIndex < 0 ? 0 : Math.min(prev[section] ?? 0, lastIndex);
        if (clamped !== prev[section]) {
          next[section] = clamped;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [getItems]);

  // Map selection index to actual item index (skipping headers)
  const getSelectableItems = useCallback((section: PanelSection) => {
    return getItems(section).filter((i) => i.type !== 'header');
  }, [getItems]);

  const getSelectedItem = useCallback(() => {
    const selectable = getSelectableItems(panelSection);
    return selectable[panelSelections[panelSection]] || null;
  }, [getSelectableItems, panelSection, panelSelections]);

  const openEditor = useCallback((editor: PanelEditorState) => {
    setPanelEditor(editor);
  }, []);

  const cancelEditor = useCallback(() => {
    setPanelEditor(null);
  }, []);

  const submitEditor = useCallback(async (value: string) => {
    if (!panelEditor) return;
    const trimmed = value.trim();

    if (panelEditor.itemKey === 'llm-model') {
      if (!trimmed) {
        opts.addNotice('Model cannot be empty.', 'warning');
        return;
      }
      opts.applyRuntimeConfig({ model: trimmed });
      opts.addNotice(`Model set to ${trimmed}.`, 'success');
      setPanelEditor(null);
      return;
    }

    if (panelEditor.itemKey === 'llm-temperature') {
      const temperature = Number(trimmed);
      if (!Number.isFinite(temperature)) {
        opts.addNotice(`Invalid temperature "${value}".`, 'warning');
        return;
      }
      opts.applyRuntimeConfig({ temperature });
      opts.addNotice(`Temperature set to ${temperature}.`, 'success');
      setPanelEditor(null);
      return;
    }

    if (panelEditor.itemKey === 'llm-max-tokens') {
      const maxTokens = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
        opts.addNotice(`Invalid max tokens "${value}".`, 'warning');
        return;
      }
      opts.applyRuntimeConfig({ maxTokens });
      opts.addNotice(`Max tokens set to ${maxTokens}.`, 'success');
      setPanelEditor(null);
      return;
    }

    if (panelEditor.itemKey === 'llm-base-url') {
      opts.applyRuntimeConfig({ baseUrl: trimmed || undefined });
      opts.addNotice(trimmed ? `Base URL set to ${trimmed}.` : 'Base URL reset to provider default.', 'success');
      setPanelEditor(null);
      return;
    }

    if (panelEditor.itemKey === 'llm-api-key') {
      opts.applyRuntimeConfig({ apiKey: trimmed || undefined });
      opts.addNotice(trimmed ? 'API key updated for current runtime config.' : 'API key cleared from current runtime config.', 'success');
      setPanelEditor(null);
      return;
    }

    if (panelEditor.itemKey === 'files:new-file') {
      if (!trimmed) {
        opts.addNotice('File path cannot be empty.', 'warning');
        return;
      }

      try {
        const nextPath = await fileBrowser.createFile(trimmed);
        setFileActionTargetPath(nextPath);
        opts.addNotice(`Created file ${nextPath}.`, 'success');
        setPanelEditor(null);
      } catch (fileError) {
        opts.addNotice(`Create file failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
      }
      return;
    }

    if (panelEditor.itemKey === 'files:new-dir') {
      if (!trimmed) {
        opts.addNotice('Directory path cannot be empty.', 'warning');
        return;
      }

      try {
        const nextPath = await fileBrowser.createDirectory(trimmed);
        setFileActionTargetPath(nextPath);
        opts.addNotice(`Created directory ${nextPath}.`, 'success');
        setPanelEditor(null);
      } catch (fileError) {
        opts.addNotice(`Create directory failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
      }
      return;
    }

    if (panelEditor.itemKey === 'files:rename') {
      if (!panelEditor.targetPath) {
        opts.addNotice('Select a file or directory before renaming.', 'warning');
        return;
      }
      if (!trimmed) {
        opts.addNotice('New name cannot be empty.', 'warning');
        return;
      }

      try {
        const nextPath = await fileBrowser.renamePath(panelEditor.targetPath, trimmed);
        setFileActionTargetPath(nextPath);
        opts.addNotice(`Renamed to ${nextPath}.`, 'success');
        setPanelEditor(null);
      } catch (fileError) {
        opts.addNotice(`Rename failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
      }
    }
  }, [fileBrowser, opts, panelEditor]);

  useEffect(() => {
    if (!panelVisible && panelEditor) {
      setPanelEditor(null);
    }
  }, [panelEditor, panelVisible]);

  useEffect(() => {
    if (panelEditor && panelSection !== 'llm' && panelSection !== 'files') {
      setPanelEditor(null);
    }
  }, [panelEditor, panelSection]);

  useEffect(() => {
    if (!panelVisible || panelSection !== 'files' || panelEditor) return;
    const selectedItem = getSelectedItem();
    const entryPath = selectedItem ? getFileEntryPath(selectedItem.key) : null;
    if (entryPath) {
      setFileActionTargetPath(entryPath);
    }
    if (!selectedItem?.key.startsWith('files:file:') || !entryPath) return;
    void fileBrowser.previewFile(entryPath).catch(() => {});
  }, [fileBrowser.previewFile, getSelectedItem, panelEditor, panelSection, panelVisible]);

  /* ── Run action on Enter ───────────────────────────── */
  const runAction = useCallback(async (mode: 'select' | 'next' | 'prev' = 'select') => {
    const selectedItem = getSelectedItem();
    if (!selectedItem) return;
    const delta = mode === 'prev' ? -1 : 1;

    // General section
    if (panelSection === 'general') {
      if (selectedItem.key === 'session:new') {
        const next = opts.isDefaultAgent
          ? opts.createSession('TUI Chat')
          : opts.createAgentSession(opts.currentAgentId, 'TUI Chat');
        if (opts.isDefaultAgent) {
          if (opts.systemPrompt) {
            opts.setSessionSystemPrompt(next.id, opts.systemPrompt);
            opts.addNotice(`Created session ${next.id.slice(0, 8)}.`, 'success');
          } else {
            opts.addNotice(`Created session ${next.id.slice(0, 8)}.`, 'success');
          }
        } else if (opts.systemPrompt) {
          opts.setAgentSessionSystemPrompt(opts.currentAgentId, next.id, opts.systemPrompt);
          opts.addNotice(`Created session ${next.id.slice(0, 8)} for ${opts.currentAgent?.name || opts.currentAgentId}.`, 'success');
        } else {
          opts.addNotice(`Created session ${next.id.slice(0, 8)} for ${opts.currentAgent?.name || opts.currentAgentId}.`, 'success');
        }
        return;
      }
      if (selectedItem.key === 'session-filter') {
        const nextFilter = cycleValue<(typeof SESSION_TYPE_FILTERS)[number]>(SESSION_TYPE_FILTERS, sessionTypeFilter, delta);
        setSessionTypeFilter(nextFilter);
        opts.addNotice(`Session filter set to ${nextFilter}.`, 'success');
        return;
      }
      if (selectedItem.key === 'session-scope') {
        if (!opts.currentSession) {
          opts.addNotice('No active session selected.', 'warning');
          return;
        }

        const nextScope = cycleValue(['global', 'session'] as const, sessionConfigScope, delta);
        if (nextScope === sessionConfigScope) {
          return;
        }

        if (!canMutateSessionOverrides(opts.currentSession)) {
          return;
        }

        if (nextScope === 'session') {
          const { tools, skills } = ensureSessionOverrides(opts.currentSession);
          opts.addNotice(`Session scope enabled. Snapshot: ${tools.filter((id) => id !== 'file_manager').length} tool(s), ${skills.length} skill(s).`, 'success');
          return;
        }

        setSessionOverrideConfig(opts.currentSession, undefined, undefined);
        opts.addNotice('Reverted current session back to global defaults.', 'success');
        return;
      }
      if (selectedItem.key === 'exec-login-shell') {
        opts.setExecLoginShell(!opts.execLoginShell);
        opts.addNotice(`Exec login shell ${!opts.execLoginShell ? 'enabled' : 'disabled'}.`, 'success');
        return;
      }
      if (selectedItem.key === 'tool-timeout') {
        const next = cycleValue(
          TOOL_TIMEOUT_PRESETS,
          opts.toolExecutionTimeout,
          delta,
          () => nearestNumericIndex(TOOL_TIMEOUT_PRESETS, opts.toolExecutionTimeout),
        );
        opts.setToolExecutionTimeout(next);
        opts.addNotice(`Tool timeout set to ${formatTimeout(next)}.`, 'success');
        return;
      }
      if (selectedItem.key === 'search-provider') {
        const next = cycleValue<(typeof SEARCH_PROVIDER_ORDER)[number]>(SEARCH_PROVIDER_ORDER, opts.searchProvider, delta);
        opts.setSearchProvider(next);
        opts.addNotice(`Search provider set to ${next}.`, 'success');
        return;
      }
      if (selectedItem.key.startsWith('session:')) {
        const sessionId = selectedItem.key.slice(8);
        const target = opts.sessions.find((s) => s.id === sessionId);
        if (!target) return;
        if (opts.isDefaultAgent) {
          await opts.loadSessionMessages(target.id);
          opts.openSession(target.id);
        } else {
          await opts.loadAgentSessionMessages(opts.currentAgentId, target.id);
          opts.setAgentCurrentSession(opts.currentAgentId, target.id);
        }
        opts.addNotice(`Switched to session ${target.id.slice(0, 8)} (${target.name}).`, 'success');
        setPanelVisible(false);
        return;
      }
      return;
    }

    // LLM section
    if (panelSection === 'llm') {
      if (selectedItem.key === 'llm-provider') {
        const nextProviderId = cycleValue(
          providerRegistry.map((provider) => provider.id),
          opts.runtimeConfig.provider,
          delta,
        );
        const nextProvider = getProviderMeta(nextProviderId);
        if (!nextProvider) return;
        const currentConfig = opts.runtimeConfig;
        const previousProvider = getProviderMeta(currentConfig.provider);
        const shouldResetBaseUrl = !currentConfig.baseUrl || currentConfig.baseUrl === previousProvider?.defaultBaseUrl;
        const nextModel = nextProvider.models.includes(currentConfig.model)
          ? currentConfig.model
          : (nextProvider.models[0] || currentConfig.model);
        const nextConfig = opts.applyRuntimeConfig({
          provider: nextProvider.id,
          model: nextModel,
          baseUrl: shouldResetBaseUrl ? nextProvider.defaultBaseUrl : currentConfig.baseUrl,
        });
        const warnings = [];
        if (nextProvider.requiresApiKey && !nextConfig.apiKey) {
          warnings.push('API key is still missing.');
        }
        opts.addNotice([
          `Provider set to ${nextProvider.name} (${nextProvider.id})`,
          `Model: ${nextConfig.model}`,
          nextConfig.baseUrl ? `Base URL: ${nextConfig.baseUrl}` : 'Base URL: default',
          ...warnings,
        ].join('\n'), warnings.length > 0 ? 'warning' : 'success');
        return;
      }
      if (selectedItem.key === 'llm-model') {
        if (mode === 'select') {
          openEditor({
            itemKey: 'llm-model',
            label: 'Model',
            value: opts.runtimeConfig.model,
            placeholder: providerModels[0] || 'Enter model name',
            help: 'Enter apply custom model · Esc cancel · Left/Right still cycles provider presets outside edit mode',
          });
          return;
        }
        if (providerModels.length <= 1) {
          opts.addNotice('Current provider does not expose multiple preset models. Use /model <name> for a custom model.', 'info');
          return;
        }
        const nextModel = cycleValue(providerModels, opts.runtimeConfig.model, delta);
        opts.applyRuntimeConfig({ model: nextModel });
        opts.addNotice(`Model set to ${nextModel}.`, 'success');
        return;
      }
      if (selectedItem.key === 'llm-temperature') {
        if (mode === 'select') {
          openEditor({
            itemKey: 'llm-temperature',
            label: 'Temperature',
            value: String(opts.runtimeConfig.temperature ?? 0.7),
            placeholder: '0.7',
            help: 'Enter a numeric value such as 0, 0.7, or 1.2',
          });
          return;
        }
        const currentTemperature = Number(opts.runtimeConfig.temperature ?? 0.7);
        const nextTemperature = cycleValue(
          TEMPERATURE_PRESETS,
          currentTemperature,
          delta,
          () => nearestNumericIndex(TEMPERATURE_PRESETS, currentTemperature),
        );
        opts.applyRuntimeConfig({ temperature: nextTemperature });
        opts.addNotice(`Temperature set to ${nextTemperature}.`, 'success');
        return;
      }
      if (selectedItem.key === 'llm-max-tokens') {
        if (mode === 'select') {
          openEditor({
            itemKey: 'llm-max-tokens',
            label: 'Max tokens',
            value: String(opts.runtimeConfig.maxTokens ?? 4096),
            placeholder: '4096',
            help: 'Enter a positive integer token limit',
          });
          return;
        }
        const currentMaxTokens = Number(opts.runtimeConfig.maxTokens ?? 4096);
        const nextMaxTokens = cycleValue(
          MAX_TOKEN_PRESETS,
          currentMaxTokens,
          delta,
          () => nearestNumericIndex(MAX_TOKEN_PRESETS, currentMaxTokens),
        );
        opts.applyRuntimeConfig({ maxTokens: nextMaxTokens });
        opts.addNotice(`Max tokens set to ${nextMaxTokens}.`, 'success');
        return;
      }
      if (selectedItem.key === 'llm-base-url') {
        if (mode !== 'select') return;
        openEditor({
          itemKey: 'llm-base-url',
          label: 'Base URL',
          value: opts.runtimeConfig.baseUrl || '',
          placeholder: providerMeta?.defaultBaseUrl || 'Use provider default',
          help: 'Submit empty to restore the provider default base URL',
        });
        return;
      }
      if (selectedItem.key === 'llm-api-key') {
        if (mode !== 'select') return;
        openEditor({
          itemKey: 'llm-api-key',
          label: 'API key',
          value: opts.runtimeConfig.apiKey || '',
          placeholder: providerMeta?.requiresApiKey ? 'Required for this provider' : 'Optional for this provider',
          help: 'Submit empty to clear the API key from current runtime config',
        });
        return;
      }
      if (selectedItem.key === 'llm-save') {
        opts.saveRuntimeConfig(opts.runtimeConfig);
        opts.addNotice('Runtime config saved to disk.', 'success');
        return;
      }
      opts.addNotice('Panel currently exposes direct controls for provider, model, temperature, max tokens, and save.', 'info');
      return;
    }

    // Tools section
    if (panelSection === 'tools') {
      const toolId = selectedItem.key;
      const isEnabled = effectiveToolIds.includes(toolId);

      if (sessionConfigScope === 'session') {
        if (!canMutateSessionOverrides(opts.currentSession)) {
          return;
        }

        const session = opts.currentSession;
        if (!session) {
          return;
        }

        const { tools, skills } = ensureSessionOverrides(session);
        const nextTools = isEnabled
          ? tools.filter((id) => id !== toolId)
          : [...tools, toolId];
        setSessionOverrideConfig(session, nextTools, skills);
      } else if (opts.isDefaultAgent) {
        opts.toggleGlobalTool(toolId);
      } else if (opts.currentAgent) {
        opts.setAgentEnabledTools(
          opts.currentAgent.id,
          isEnabled ? opts.enabledTools.filter((id) => id !== toolId) : [...opts.enabledTools, toolId],
        );
      }
      opts.addNotice(`Tool ${toolId} ${isEnabled ? 'disabled' : 'enabled'} in ${sessionConfigScope} scope.`, 'success');
      return;
    }

    // Skills section
    if (panelSection === 'skills') {
      const skillId = selectedItem.key;
      const isEnabled = effectiveSkillIds.includes(skillId);

      if (sessionConfigScope === 'session') {
        if (!canMutateSessionOverrides(opts.currentSession)) {
          return;
        }

        const session = opts.currentSession;
        if (!session) {
          return;
        }

        const { tools, skills } = ensureSessionOverrides(session);
        const nextSkills = isEnabled
          ? skills.filter((id) => id !== skillId)
          : [...skills, skillId];
        setSessionOverrideConfig(session, tools, nextSkills);
      } else if (opts.isDefaultAgent) {
        opts.toggleGlobalSkill(skillId);
      } else if (opts.currentAgent) {
        opts.setAgentEnabledSkills(
          opts.currentAgent.id,
          isEnabled ? opts.enabledSkills.filter((id) => id !== skillId) : [...opts.enabledSkills, skillId],
        );
      }
      opts.addNotice(`Skill ${skillId} ${isEnabled ? 'disabled' : 'enabled'} in ${sessionConfigScope} scope.`, 'success');
      return;
    }

    // Network section
    if (panelSection === 'network') {
      if (selectedItem.key.startsWith('agent:')) {
        const agentId = selectedItem.key.slice(6);
        const target = opts.agents.find((a) => a.id === agentId);
        if (!target) return;
        opts.setCurrentAgent(target.id);
        if (!target.isDefault && !(opts.agentSessions[target.id] || []).length) {
          const s = opts.createAgentSession(target.id, 'TUI Chat');
          if (opts.systemPrompt) opts.setAgentSessionSystemPrompt(target.id, s.id, opts.systemPrompt);
        }
        opts.addNotice(`Switched to agent ${target.name}.`, 'success');
        return;
      }
      if (selectedItem.key.startsWith('mcp:')) {
        const mcpId = selectedItem.key.slice(4);
        const connection = opts.mcpConnections.find((c) => c.id === mcpId);
        if (!connection) return;
        if (connection.status !== 'connected' || connection.tools.length === 0) {
          await opts.syncMCPConnection(connection);
          return;
        }
        opts.addNotice([
          `MCP: ${connection.name}`,
          `Status: ${connection.status}  Transport: ${connection.transport}`,
          `URL: ${connection.url}`,
          `Tools: ${connection.tools.length > 0 ? connection.tools.map((t) => t.name).join(', ') : '(none)'}`,
          connection.lastError ? `Error: ${connection.lastError}` : null,
        ].filter(Boolean).join('\n'), connection.lastError ? 'warning' : 'info');
        return;
      }
    }

    // Files section
    if (panelSection === 'files') {
      if (selectedItem.key === 'files:new-file') {
        if (mode !== 'select') return;
        openEditor({
          itemKey: 'files:new-file',
          label: 'New file',
          value: '',
          placeholder: 'notes.md',
          help: 'Enter a relative path inside the current workspace directory',
        });
        return;
      }
      if (selectedItem.key === 'files:new-dir') {
        if (mode !== 'select') return;
        openEditor({
          itemKey: 'files:new-dir',
          label: 'New folder',
          value: '',
          placeholder: 'docs',
          help: 'Enter a relative path inside the current workspace directory',
        });
        return;
      }
      if (selectedItem.key === 'files:rename') {
        if (mode !== 'select') return;
        if (!selectedFileTargetPath) {
          opts.addNotice('Select a file or directory before renaming.', 'warning');
          return;
        }
        openEditor({
          itemKey: 'files:rename',
          label: 'Rename selected',
          value: path.basename(selectedFileTargetPath),
          placeholder: path.basename(selectedFileTargetPath),
          help: 'Rename the selected file or directory. Use a simple name or a relative path.',
          targetPath: selectedFileTargetPath,
        });
        return;
      }
      if (selectedItem.key === 'files:delete') {
        if (!selectedFileTargetPath) {
          opts.addNotice('Select a file or directory before deleting.', 'warning');
          return;
        }
        try {
          const deletedPath = await opts.fileBrowser.deletePath(selectedFileTargetPath);
          if (fileBrowser.preview?.path === deletedPath) {
            opts.fileBrowser.clearPreview();
          }
          setFileActionTargetPath(null);
          opts.addNotice(`Deleted ${deletedPath}.`, 'success');
        } catch (fileError) {
          opts.addNotice(`Delete failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        return;
      }
      if (selectedItem.key === 'files:root') {
        await opts.fileBrowser.changeDirectory(opts.fileBrowser.rootPath);
        await opts.fileBrowser.refresh(opts.fileBrowser.rootPath);
        setFileActionTargetPath(null);
        opts.addNotice(`Jumped to workspace root ${opts.fileBrowser.rootPath}.`, 'success');
        return;
      }
      if (selectedItem.key === 'files:up') {
        const nextPath = await opts.fileBrowser.goUp();
        await opts.fileBrowser.refresh(nextPath);
        setFileActionTargetPath(null);
        opts.addNotice(`Current directory: ${nextPath}`, 'success');
        return;
      }
      if (selectedItem.key === 'files:refresh') {
        await opts.fileBrowser.refresh();
        opts.addNotice(`Reloaded ${opts.fileBrowser.currentPath}.`, 'success');
        return;
      }
      if (selectedItem.key.startsWith('files:file:') || selectedItem.key.startsWith('files:directory:')) {
        const entryPath = selectedItem.key.replace(/^files:(?:file|directory):/, '');
        setFileActionTargetPath(entryPath);
        const result = await opts.fileBrowser.openPath(entryPath);
        if (result.kind === 'directory') {
          await opts.fileBrowser.refresh(result.path);
          opts.addNotice(`Opened directory ${result.path}.`, 'success');
          return;
        }
        opts.addNotice(`Previewing ${result.preview?.displayPath || result.path}.`, 'info');
      }
      return;
    }
  }, [
    canMutateSessionOverrides,
    cycleValue,
    effectiveSkillIds,
    effectiveToolIds,
    ensureSessionOverrides,
    getSelectedItem,
    nearestNumericIndex,
    openEditor,
    opts,
    panelSection,
    providerMeta,
    providerModels,
    sessionConfigScope,
    sessionTypeFilter,
    selectedFileTargetPath,
    setPanelVisible,
    setSessionOverrideConfig,
  ]);

  /* ── Keyboard navigation ───────────────────────────── */
  useInput((inputChar, key) => {
    const hasTypedInput = opts.input.trim().length > 0;

    if (key.escape) {
      if (panelEditor) {
        cancelEditor();
        return;
      }
      if (hasTypedInput) return;
      setPanelVisible((prev) => !prev);
      return;
    }

    if (key.tab) {
      if (panelEditor) return;
      if (!panelVisible) {
        setPanelVisible(true);
        return;
      }
      const idx = PANEL_SECTIONS.indexOf(panelSection);
      setPanelSection(PANEL_SECTIONS[(idx + 1) % PANEL_SECTIONS.length]);
      return;
    }

    if (!panelVisible || opts.isInitializing || opts.isLoading) return;
    if (hasTypedInput) return;
    if (panelEditor) return;

    const sectionShortcut = Number.parseInt(inputChar, 10);
    if (sectionShortcut >= 1 && sectionShortcut <= PANEL_SECTIONS.length) {
      setPanelSection(PANEL_SECTIONS[sectionShortcut - 1]);
      return;
    }

    if (key.upArrow || key.downArrow || inputChar === 'j' || inputChar === 'k') {
      const selectable = getSelectableItems(panelSection);
      if (selectable.length === 0) return;
      setPanelSelections((prev) => {
        const current = prev[panelSection] ?? 0;
        const delta = key.upArrow || inputChar === 'k' ? -1 : 1;
        const next = (current + delta + selectable.length) % selectable.length;
        return { ...prev, [panelSection]: next };
      });
      return;
    }

    if (panelSection === 'files' && (key.leftArrow || inputChar === 'h')) {
      void opts.fileBrowser.goUp().then((nextPath) => opts.fileBrowser.refresh(nextPath));
      return;
    }

    if (panelSection === 'files') {
      if (inputChar === 'n') {
        openEditor({
          itemKey: 'files:new-file',
          label: 'New file',
          value: '',
          placeholder: 'notes.md',
          help: 'Enter a relative path inside the current workspace directory',
        });
        return;
      }

      if (inputChar === 'd') {
        openEditor({
          itemKey: 'files:new-dir',
          label: 'New folder',
          value: '',
          placeholder: 'docs',
          help: 'Enter a relative path inside the current workspace directory',
        });
        return;
      }

      if (inputChar === 'r') {
        if (!selectedFileTargetPath) {
          opts.addNotice('Select a file or directory before renaming.', 'warning');
          return;
        }
        openEditor({
          itemKey: 'files:rename',
          label: 'Rename selected',
          value: path.basename(selectedFileTargetPath),
          placeholder: path.basename(selectedFileTargetPath),
          help: 'Rename the selected file or directory. Use a simple name or a relative path.',
          targetPath: selectedFileTargetPath,
        });
        return;
      }

      if (inputChar === 'x') {
        if (!selectedFileTargetPath) {
          opts.addNotice('Select a file or directory before deleting.', 'warning');
          return;
        }
        void opts.fileBrowser.deletePath(selectedFileTargetPath)
          .then((deletedPath) => {
            if (fileBrowser.preview?.path === deletedPath) {
              opts.fileBrowser.clearPreview();
            }
            setFileActionTargetPath(null);
            opts.addNotice(`Deleted ${deletedPath}.`, 'success');
          })
          .catch((fileError) => {
            opts.addNotice(`Delete failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
          });
        return;
      }
    }

    if (key.leftArrow || key.rightArrow || inputChar === 'h' || inputChar === 'l') {
      void runAction(key.leftArrow || inputChar === 'h' ? 'prev' : 'next');
      return;
    }

    if (key.return) {
      void runAction('select');
      return;
    }

    if (inputChar === ' ') {
      void runAction('select');
      return;
    }

    if (key.ctrl) {
      const c = inputChar.toLowerCase();
      if (c === 'g') setPanelSection('general');
      else if (c === 'l') setPanelSection('llm');
      else if (c === 't') setPanelSection('tools');
      else if (c === 'k') setPanelSection('skills');
      else if (c === 'p') setPanelSection('network');
      else if (c === 'f') setPanelSection('files');
    }
  });

  /* ── Mouse support ─────────────────────────────────── */
  const selectItemByOffset = useCallback((delta: number) => {
    const selectable = getSelectableItems(panelSection);
    if (selectable.length === 0) return;
    setPanelSelections((prev) => {
      const current = prev[panelSection] ?? 0;
      const next = Math.max(0, Math.min(selectable.length - 1, current + delta));
      return { ...prev, [panelSection]: next };
    });
  }, [getSelectableItems, panelSection]);

  const selectItemByKey = useCallback((itemKey: string) => {
    const selectable = getSelectableItems(panelSection);
    const nextIndex = selectable.findIndex((item) => item.key === itemKey);
    if (nextIndex < 0) return;

    setPanelSelections((prev) => {
      if ((prev[panelSection] ?? 0) === nextIndex) {
        return prev;
      }

      return { ...prev, [panelSection]: nextIndex };
    });
  }, [getSelectableItems, panelSection]);

  /* ── Computed for rendering ────────────────────────── */
  const currentItems = getItems(panelSection);
  const selectableItems = getSelectableItems(panelSection);
  const currentSelection = panelSelections[panelSection] ?? 0;
  const window = getSlidingWindow(selectableItems, currentSelection, MAX_VISIBLE_SECTION_ITEMS);
  const selectedItemKey = selectableItems[currentSelection]?.key ?? null;
  const visibleKeys = new Set(window.items.map((item) => item.key));
  const visibleItems: PanelItem[] = [];
  let pendingHeader: PanelItem | null = null;

  for (const item of currentItems) {
    if (item.type === 'header') {
      pendingHeader = item;
      continue;
    }

    if (!visibleKeys.has(item.key)) {
      continue;
    }

    if (pendingHeader) {
      visibleItems.push(pendingHeader);
      pendingHeader = null;
    }

    visibleItems.push(item);
  }

  const panelMouseLayout = buildPanelMouseLayout({
    terminalWidth,
    panelWidth,
    panelTop: opts.panelTop,
    section: panelSection,
    items: visibleItems,
    selectedItemKey,
    hiddenBefore: window.hiddenBefore,
    hiddenAfter: window.hiddenAfter,
    editor: panelEditor,
  });
  const previewTitle = panelSection === 'files' && fileBrowser.preview
    ? `Preview ${fileBrowser.preview.displayPath}`
    : undefined;
  const previewMeta = panelSection === 'files' && fileBrowser.preview
    ? filePreviewMeta
    : (panelSection === 'files' && fileBrowser.error ? fileBrowser.error : undefined);
  const previewLines = panelSection === 'files'
    ? (fileBrowser.preview?.lines || (fileBrowser.error
        ? ['File browser error.']
        : [
            'Select a file to preview it here.',
            'Shortcuts: n new file · d new folder · r rename · x delete',
            'Commands: /touch /mkdir /rename /rm /write',
          ]))
    : undefined;

  useMouse((event) => {
    if (!panelVisible) return;

    const isInsidePanel = event.x >= panelMouseLayout.panelLeft
      && event.x <= panelMouseLayout.panelRight
      && event.y >= panelMouseLayout.panelTop
      && event.y <= panelMouseLayout.panelBottom;
    const isInsideEditor = panelMouseLayout.editorTop !== null
      && panelMouseLayout.editorBottom !== null
      && event.y >= panelMouseLayout.editorTop
      && event.y <= panelMouseLayout.editorBottom;

    if (event.type === 'wheel') {
      if (!isInsidePanel) return;
      if (panelEditor) return;
      selectItemByOffset(event.button === 'scrollDown' ? 1 : -1);
      return;
    }

    if (event.type === 'press' && event.button === 'right') {
      if (panelEditor) {
        cancelEditor();
        return;
      }

      setPanelVisible(false);
      return;
    }

    if (event.type === 'press' && event.button === 'left') {
      if (!isInsidePanel) {
        if (panelEditor) {
          cancelEditor();
          return;
        }

        setPanelVisible(false);
        return;
      }

      if (event.y === panelMouseLayout.tabY) {
        const clickedTab = panelMouseLayout.tabHits.find((tab) => event.x >= tab.xStart && event.x <= tab.xEnd);
        if (!clickedTab) return;
        if (panelEditor) {
          cancelEditor();
        }
        if (clickedTab.section !== panelSection) {
          setPanelSection(clickedTab.section);
        }
        return;
      }

      if (isInsideEditor) {
        return;
      }

      const rowHit = panelMouseLayout.rowHits.find((row) => event.y >= row.yStart && event.y <= row.yEnd);
      if (!rowHit) return;

      if (rowHit.type === 'scroll') {
        if (panelEditor) return;
        selectItemByOffset(rowHit.delta ?? 0);
        return;
      }

      if (!rowHit.itemKey) return;

      if (panelEditor) {
        if (rowHit.itemKey !== panelEditor.itemKey) {
          cancelEditor();
          selectItemByKey(rowHit.itemKey);
        }
        return;
      }

      if (rowHit.itemKey === selectedItemKey) {
        void runAction('select');
        return;
      }

      selectItemByKey(rowHit.itemKey);
    }
  }, panelVisible);

  return {
    panelVisible, setPanelVisible,
    panelSection, setPanelSection,
    panelEditor,
    setPanelEditor,
    submitPanelEditor: submitEditor,
    cancelPanelEditor: cancelEditor,
    panelWidth,
    currentItems: visibleItems, currentSelection, window,
    selectedItemKey,
    previewTitle,
    previewMeta,
    previewLines,
    previewTone: panelSection === 'files' && fileBrowser.preview?.kind === 'binary' ? 'yellow' : undefined,
    getItems, runAction,
  };
}
