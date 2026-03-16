import { useState, useCallback, useEffect } from 'react';
import { useInput } from 'ink';
import type { PanelSection, PanelItem, PanelEditorState } from '../types.js';
import { providerRegistry, getProviderMeta } from '@openbunny/shared/services/ai';
import { PANEL_SECTIONS, MAX_VISIBLE_SECTION_ITEMS, SEARCH_PROVIDER_ORDER, TOOL_TIMEOUT_PRESETS, TOOL_DESCRIPTIONS, TEMPERATURE_PRESETS, MAX_TOKEN_PRESETS } from '../constants.js';
import { truncate, formatTimeout, getSlidingWindow } from '../utils/formatting.js';
import { useMouse } from './useMouse.js';
import type { LLMConfig, Session } from '@openbunny/shared/types';
import type { MCPConnection, MCPTransportType } from '@openbunny/shared/stores/tools';

interface UsePanelOptions {
  sessions: Session[];
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
  loadAgentSessionMessages: (agentId: string, id: string) => Promise<void>;
  setAgentCurrentSession: (agentId: string, id: string) => void;
  setCurrentAgent: (id: string) => void;
  agentSessions: Record<string, Session[]>;
  createAgentSession: (agentId: string, name: string) => Session;
  setAgentSessionSystemPrompt: (agentId: string, sessionId: string, prompt: string) => void;
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
  // input state
  input: string;
  isInitializing: boolean;
  isLoading: boolean;
}

export function usePanel(opts: UsePanelOptions) {
  const [panelSection, setPanelSection] = useState<PanelSection>('general');
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelEditor, setPanelEditor] = useState<PanelEditorState | null>(null);
  const [panelSelections, setPanelSelections] = useState<Record<PanelSection, number>>({
    general: 0, llm: 0, tools: 0, skills: 0, network: 0, about: 0,
  });

  const terminalWidth = process.stdout.columns ?? 120;
  const panelWidth = Math.min(72, Math.max(40, Math.floor(terminalWidth * 0.7)));
  const providerMeta = getProviderMeta(opts.runtimeConfig.provider);
  const providerModels = providerMeta?.models?.length ? providerMeta.models : [opts.runtimeConfig.model];
  const providerScope = opts.isDefaultAgent ? 'global default' : `agent ${opts.currentAgent?.name || opts.currentAgentId}`;

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

  /* ── General section ───────────────────────────────── */
  const generalItems: PanelItem[] = [
    { key: 'session:new', label: 'New session', meta: 'create', type: 'action', hint: 'Create a fresh TUI chat session' },
    { key: 'workspace', label: 'Workspace', meta: truncate(opts.workspace || process.cwd(), 30), type: 'info' },
    { key: 'exec-login-shell', label: 'Exec login shell', meta: opts.execLoginShell ? 'on' : 'off', active: opts.execLoginShell, type: 'toggle', hint: 'Use login shell for /shell commands' },
    { key: 'tool-timeout', label: 'Tool timeout', meta: formatTimeout(opts.toolExecutionTimeout), type: 'cycle', hint: 'Max execution time per tool call' },
    { key: 'search-provider', label: 'Search provider', meta: opts.searchProvider, type: 'cycle', hint: 'Web search backend' },
    { key: 'sessions-header', label: '── Sessions', type: 'header' },
    ...opts.sessions.slice(0, 8).map((s) => ({
      key: `session:${s.id}`,
      label: truncate(s.name, 28),
      meta: `${s.id.slice(0, 8)}  ${s.messages.length} msg`,
      active: s.id === opts.currentSessionId,
      type: 'action' as const,
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
    meta: opts.enabledTools.includes(id) ? 'on' : 'off',
    active: opts.enabledTools.includes(id),
    type: 'toggle' as const,
    hint: TOOL_DESCRIPTIONS[id] || '',
  }));

  /* ── Skills section ────────────────────────────────── */
  const skillItems: PanelItem[] = opts.skills.map((s) => ({
    key: s.id,
    label: truncate(s.id, 28),
    meta: opts.enabledSkills.includes(s.id) ? 'on' : 'off',
    active: opts.enabledSkills.includes(s.id),
    type: 'toggle' as const,
    hint: truncate(s.description || '', 40),
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

  /* ── About section ─────────────────────────────────── */
  const aboutItems: PanelItem[] = [
    { key: 'about-name', label: '🐰 OpenBunny', type: 'info', meta: 'AI-powered assistant' },
    { key: 'about-version', label: 'Version', meta: '0.1.0', type: 'info' },
    { key: 'about-agent', label: 'Current agent', meta: opts.currentAgent?.name || 'OpenBunny', type: 'info' },
    { key: 'about-session', label: 'Session', meta: opts.currentSessionId ? opts.currentSessionId.slice(0, 8) : '(none)', type: 'info' },
    { key: 'about-tools', label: 'Tools', meta: `${opts.enabledTools.filter((id) => id !== 'file_manager').length} enabled`, type: 'info' },
    { key: 'about-skills', label: 'Skills', meta: `${opts.enabledSkills.length}/${opts.skills.length} enabled`, type: 'info' },
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
      case 'about':     return aboutItems;
      default:          return [];
    }
  }, [generalItems, llmItems, toolItems, skillItems, networkItems, aboutItems]);

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

  const submitEditor = useCallback((value: string) => {
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
    }
  }, [opts, panelEditor]);

  useEffect(() => {
    if (!panelVisible && panelEditor) {
      setPanelEditor(null);
    }
  }, [panelEditor, panelVisible]);

  useEffect(() => {
    if (panelEditor && panelSection !== 'llm') {
      setPanelEditor(null);
    }
  }, [panelEditor, panelSection]);

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
      const isEnabled = opts.enabledTools.includes(toolId);
      if (opts.isDefaultAgent) {
        opts.toggleGlobalTool(toolId);
      } else if (opts.currentAgent) {
        opts.setAgentEnabledTools(
          opts.currentAgent.id,
          isEnabled ? opts.enabledTools.filter((id) => id !== toolId) : [...opts.enabledTools, toolId],
        );
      }
      opts.addNotice(`Tool ${toolId} ${isEnabled ? 'disabled' : 'enabled'}.`, 'success');
      return;
    }

    // Skills section
    if (panelSection === 'skills') {
      const skillId = selectedItem.key;
      const isEnabled = opts.enabledSkills.includes(skillId);
      if (opts.isDefaultAgent) {
        opts.toggleGlobalSkill(skillId);
      } else if (opts.currentAgent) {
        opts.setAgentEnabledSkills(
          opts.currentAgent.id,
          isEnabled ? opts.enabledSkills.filter((id) => id !== skillId) : [...opts.enabledSkills, skillId],
        );
      }
      opts.addNotice(`Skill ${skillId} ${isEnabled ? 'disabled' : 'enabled'}.`, 'success');
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
  }, [cycleValue, getSelectedItem, nearestNumericIndex, openEditor, panelSection, providerMeta, providerModels, opts, setPanelVisible]);

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

  useMouse((event) => {
    if (!panelVisible) return;
    if (panelEditor) return;
    if (event.type === 'wheel') {
      selectItemByOffset(event.button === 'scrollDown' ? 1 : -1);
      return;
    }
    if (event.type === 'press' && event.button === 'left') {
      void runAction('select');
    }
  }, panelVisible && !panelEditor);

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
    getItems, runAction,
  };
}
