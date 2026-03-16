import { useState, useCallback, useRef } from 'react';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LLMConfig, Message, Session } from '@openbunny/shared/types';
import { discoverMCPConnection } from '@openbunny/shared';
import { getProviderMeta } from '@openbunny/shared/services/ai';
import { getEnabledTools } from '@openbunny/shared/services/ai/tools';
import { flushAllSessionPersistence } from '@openbunny/shared/services/storage/sessionPersistence';
import { getPlatformCapabilities, getPlatformContext } from '@openbunny/shared/platform';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useAgentStore } from '@openbunny/shared/stores/agent';
import type { MCPTransportType } from '@openbunny/shared/stores/tools';
import {
  parseCommand,
  getHelpInfo,
  getHistoryInfo,
  getProviderList,
} from '@openbunny/shared/terminal';
import { MessageHistoryManager } from '@openbunny/shared/utils/messageHistory';
import { getMessageDisplayType, getMessageToolName } from '@openbunny/shared/utils/messagePresentation';
import { formatConfigSummary, truncate } from '../utils/formatting.js';
import type { NoticeTone } from '../types.js';
import type { FileBrowserController } from './useFileBrowser.js';
import {
  getEffectiveSessionSkills,
  getEffectiveSessionTools,
  getSessionAlternateHistories,
  getSessionConfigScopeLabel,
  getSessionStatusLabel,
  getSessionSummary,
  getSessionTypeLabel,
  isSessionConfigLocked,
  isReadOnlySession,
} from '../utils/sessionPresentation.js';

interface UseCommandHandlerOptions {
  workspace?: string;
  configDir?: string;
  systemPrompt?: string;
  isDefaultAgent: boolean;
  currentAgentId: string;
  currentAgent: { id: string; name: string; enabledTools?: string[]; enabledSkills?: string[] } | null;
  sessions: Session[];
  enabledTools: string[];
  enabledSkills: string[];
  execLoginShell: boolean;
  toolExecutionTimeout: number;
  proxyUrl: string;
  // store actions
  exit: () => void;
  createSession: (name: string) => Session;
  createAgentSession: (agentId: string, name: string) => Session;
  setSessionSystemPrompt: (sessionId: string, prompt: string) => void;
  setSessionTools: (sessionId: string, tools: string[] | undefined) => void;
  setSessionSkills: (sessionId: string, skills: string[] | undefined) => void;
  setAgentSessionSystemPrompt: (agentId: string, sessionId: string, prompt: string) => void;
  setAgentSessionTools: (agentId: string, sessionId: string, tools: string[] | undefined) => void;
  setAgentSessionSkills: (agentId: string, sessionId: string, skills: string[] | undefined) => void;
  clearSessionMessages: (sessionId: string) => void;
  loadSessionMessages: (sessionId: string) => Promise<void>;
  openSession: (sessionId: string) => void;
  loadAgentSessionMessages: (agentId: string, sessionId: string) => Promise<void>;
  setAgentCurrentSession: (agentId: string, sessionId: string) => void;
  flushMessages: (sessionId: string) => Promise<void>;
  flushAgentMessages: (agentId: string, sessionId: string) => Promise<void>;
  permanentlyDeleteSession: (sessionId: string) => void;
  deleteAgentSession: (agentId: string, sessionId: string) => void;
  agents: Array<{ id: string; name: string; isDefault?: boolean }>;
  setCurrentAgent: (id: string) => void;
  agentSessions: Record<string, Session[]>;
  createAgent: (opts: { name: string; avatar: string; description: string; systemPrompt: string; color: string }) => { id: string; name: string };
  toggleGlobalTool: (id: string) => void;
  setAgentEnabledTools: (agentId: string, tools: string[]) => void;
  toggleGlobalSkill: (id: string) => void;
  setAgentEnabledSkills: (agentId: string, skills: string[]) => void;
  skills: Array<{ id: string; description: string }>;
  mcpConnections: Array<{ id: string; name: string; url: string; transport: MCPTransportType; status: 'connected' | 'disconnected' | 'connecting'; tools: Array<{ id: string; name: string }>; lastError?: string | null }>;
  addMCPConnection: (name: string, url: string, transport: MCPTransportType) => string;
  removeMCPConnection: (id: string) => void;
  updateMCPStatus: (id: string, status: 'connected' | 'disconnected' | 'connecting') => void;
  setMCPTools: (id: string, tools: Array<{ id: string; name: string; title?: string; description?: string }>) => void;
  setMCPError: (id: string, error: string | null) => void;
  // UI callbacks
  addNotice: (content: string, tone?: NoticeTone) => void;
  clearNotices: () => void;
  setIsLoading: (v: boolean) => void;
  setActivityLabel: (v: string) => void;
  // runtime config
  runtimeConfigRef: React.RefObject<LLMConfig>;
  applyRuntimeConfig: (updates: Partial<LLMConfig>) => LLMConfig;
  saveRuntimeConfig: (config: LLMConfig) => void;
  fileBrowser: FileBrowserController;
  // agent loop
  handleStop: (sessionId: string | null) => void;
  sendMessage: (trimmed: string, session: Session, config: LLMConfig) => Promise<void>;
}

type ExportFormat = 'json' | 'markdown' | 'text';

function parseExportArgs(rawArgs: string): { format: ExportFormat; outputPath?: string } {
  const trimmed = rawArgs.trim();
  if (!trimmed) return { format: 'markdown' };

  const [firstToken, ...restTokens] = trimmed.split(/\s+/);
  if (firstToken === 'json' || firstToken === 'markdown' || firstToken === 'text') {
    return {
      format: firstToken,
      outputPath: restTokens.join(' ').trim() || undefined,
    };
  }

  return {
    format: 'markdown',
    outputPath: trimmed,
  };
}

function buildDefaultExportName(session: Session, format: ExportFormat): string {
  const extension = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
  const safeSessionName = (session.name || 'conversation')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'conversation';
  return `${safeSessionName}-${session.id.slice(0, 8)}.${extension}`;
}

function splitArgsOnce(rawArgs: string): [string, string] {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return ['', ''];
  }

  const match = trimmed.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) {
    return [trimmed, ''];
  }

  return [match[1], match[2]];
}

function decodeEscapedText(value: string): string {
  return value
    .replace(/\\\\/g, '\u0000')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\u0000/g, '\\');
}

function formatSearchResult(match: Message): string {
  const type = getMessageDisplayType(match) || match.role;
  const toolName = getMessageToolName(match);
  const summary = MessageHistoryManager.getMessageSummary(match);
  const rawText = summary.searchableToolOutput || match.content || '(no content)';
  const snippet = truncate(rawText.replace(/\s+/g, ' ').trim() || '(no content)', 96);
  const meta = toolName ? ` ${toolName}` : '';
  return `  ${new Date(match.timestamp).toLocaleTimeString()}  ${type}${meta}  ${snippet}`;
}

function formatFileEntries(
  entries: FileBrowserController['entries'],
  currentDisplayPath: string,
  rootPath: string,
) {
  if (entries.length === 0) {
    return [
      `Workspace root: ${rootPath}`,
      `Current path: ${currentDisplayPath}`,
      '',
      '  (empty directory)',
    ].join('\n');
  }

  const visibleEntries = entries.slice(0, 16);
  return [
    `Workspace root: ${rootPath}`,
    `Current path: ${currentDisplayPath}`,
    '',
    ...visibleEntries.map((entry) => (
      `  ${entry.kind === 'directory' ? 'dir ' : 'file'}  ${entry.name}${entry.kind === 'directory' ? '/' : ''}${entry.kind === 'file' ? `  ${entry.size}b` : ''}`
    )),
    ...(entries.length > visibleEntries.length ? [`  ... ${entries.length - visibleEntries.length} more item(s)`] : []),
  ].join('\n');
}

function getSessionConfigStatus(session: Session, enabledTools: string[], enabledSkills: string[]) {
  return {
    scope: getSessionConfigScopeLabel(session),
    locked: isSessionConfigLocked(session),
    readOnly: isReadOnlySession(session),
    effectiveTools: getEffectiveSessionTools(session, enabledTools),
    effectiveSkills: getEffectiveSessionSkills(session, enabledSkills),
  };
}

export function useCommandHandler(opts: UseCommandHandlerOptions) {
  const [input, setInput] = useState('');
  const shellSessionIdRef = useRef<string | undefined>(undefined);

  const ensureActiveSession = useCallback((): Session => {
    const existing = opts.isDefaultAgent
      ? useSessionStore.getState().sessions.find((s) => s.id === useSessionStore.getState().currentSessionId)
      : (useAgentStore.getState().agentSessions[opts.currentAgentId] || []).find(
          (s) => s.id === (useAgentStore.getState().agentCurrentSessionId[opts.currentAgentId] ?? null),
        );
    if (existing) return existing;

    const created = opts.isDefaultAgent
      ? useSessionStore.getState().createSession('TUI Chat')
      : useAgentStore.getState().createAgentSession(opts.currentAgentId, 'TUI Chat');
    if (opts.systemPrompt) {
      if (opts.isDefaultAgent) {
        useSessionStore.getState().setSessionSystemPrompt(created.id, opts.systemPrompt);
      } else {
        useAgentStore.getState().setAgentSessionSystemPrompt(opts.currentAgentId, created.id, opts.systemPrompt);
      }
    }
    return created;
  }, [opts.currentAgentId, opts.isDefaultAgent, opts.systemPrompt]);

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

  const canMutateSessionOverrides = useCallback((session: Session) => {
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

  const setScopeMode = useCallback((session: Session, scope: 'global' | 'session') => {
    const currentScope = getSessionConfigScopeLabel(session);
    if (scope === currentScope) {
      opts.addNotice(`Current session already uses ${scope} scope.`, 'info');
      return false;
    }

    if (!canMutateSessionOverrides(session)) {
      return false;
    }

    if (scope === 'session') {
      const { tools, skills } = ensureSessionOverrides(session);
      opts.addNotice([
        `Session scope enabled for ${session.id.slice(0, 8)} (${session.name}).`,
        `Tools snapshot: ${tools.filter((toolId) => toolId !== 'file_manager').length}`,
        `Skills snapshot: ${skills.length}`,
      ].join('\n'), 'success');
      return true;
    }

    setSessionOverrideConfig(session, undefined, undefined);
    opts.addNotice(`Switched ${session.id.slice(0, 8)} (${session.name}) back to global defaults.`, 'success');
    return true;
  }, [canMutateSessionOverrides, ensureSessionOverrides, opts, setSessionOverrideConfig]);

  const updateScopedTool = useCallback((session: Session, toolId: string, nextEnabled: boolean) => {
    if (toolId === 'file_manager') {
      opts.addNotice('file_manager is not available in TUI. Use /shell and the workspace instead.', 'warning');
      return false;
    }

    const scope = getSessionConfigScopeLabel(session);
    if (scope === 'session') {
      if (!canMutateSessionOverrides(session)) {
        return false;
      }

      const { tools, skills } = ensureSessionOverrides(session);
      const isEnabled = tools.includes(toolId);
      if (isEnabled === nextEnabled) {
        return true;
      }

      const nextTools = nextEnabled
        ? [...tools, toolId]
        : tools.filter((id) => id !== toolId);
      setSessionOverrideConfig(session, nextTools, skills);
      return true;
    }

    const isEnabled = opts.enabledTools.includes(toolId);
    if (isEnabled === nextEnabled) {
      return true;
    }

    if (opts.isDefaultAgent) {
      opts.toggleGlobalTool(toolId);
      return true;
    }

    if (!opts.currentAgent) {
      return false;
    }

    const nextTools = nextEnabled
      ? [...opts.enabledTools, toolId]
      : opts.enabledTools.filter((id) => id !== toolId);
    opts.setAgentEnabledTools(opts.currentAgent.id, nextTools);
    return true;
  }, [canMutateSessionOverrides, ensureSessionOverrides, opts, setSessionOverrideConfig]);

  const updateScopedSkill = useCallback((session: Session, skillId: string, nextEnabled: boolean) => {
    const scope = getSessionConfigScopeLabel(session);
    if (scope === 'session') {
      if (!canMutateSessionOverrides(session)) {
        return false;
      }

      const { tools, skills } = ensureSessionOverrides(session);
      const isEnabled = skills.includes(skillId);
      if (isEnabled === nextEnabled) {
        return true;
      }

      const nextSkills = nextEnabled
        ? [...skills, skillId]
        : skills.filter((id) => id !== skillId);
      setSessionOverrideConfig(session, tools, nextSkills);
      return true;
    }

    const isEnabled = opts.enabledSkills.includes(skillId);
    if (isEnabled === nextEnabled) {
      return true;
    }

    if (opts.isDefaultAgent) {
      opts.toggleGlobalSkill(skillId);
      return true;
    }

    if (!opts.currentAgent) {
      return false;
    }

    const nextSkills = nextEnabled
      ? [...opts.enabledSkills, skillId]
      : opts.enabledSkills.filter((id) => id !== skillId);
    opts.setAgentEnabledSkills(opts.currentAgent.id, nextSkills);
    return true;
  }, [canMutateSessionOverrides, ensureSessionOverrides, opts, setSessionOverrideConfig]);

  const syncMCPConnection = useCallback(async (
    connection: { id: string; name: string; url: string; transport: MCPTransportType },
  ) => {
    opts.updateMCPStatus(connection.id, 'connecting');
    opts.setMCPError(connection.id, null);
    opts.setIsLoading(true);
    opts.setActivityLabel('Syncing MCP...');
    try {
      const { descriptors } = await discoverMCPConnection(connection, { proxyUrl: opts.proxyUrl });
      opts.setMCPTools(connection.id, descriptors);
      opts.addNotice([
        `MCP synced: ${connection.name}`,
        `Transport: ${connection.transport}`,
        `Tools: ${descriptors.length > 0 ? descriptors.map((t) => t.name).join(', ') : '(none discovered)'}`,
      ].join('\n'), 'success');
    } catch (mcpError) {
      const message = mcpError instanceof Error ? mcpError.message : String(mcpError);
      opts.updateMCPStatus(connection.id, 'disconnected');
      opts.setMCPError(connection.id, message);
      opts.addNotice(`MCP sync failed for ${connection.name}: ${message}`, 'error');
    } finally {
      opts.setActivityLabel('Thinking...');
      opts.setIsLoading(false);
    }
  }, [opts]);

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const session = ensureActiveSession();
    const command = parseCommand(trimmed);

    if (!command) {
      if (isReadOnlySession(session)) {
        const readOnlyLabel = getSessionTypeLabel(session).toLowerCase();
        opts.addNotice(`Cannot send messages to this ${readOnlyLabel}. Use /stop, /export, /search, or /help instead.`, 'warning');
        return;
      }
      setInput('');
      await opts.sendMessage(trimmed, session, opts.runtimeConfigRef.current);
      return;
    }

    switch (command.command) {
      case 'quit':
      case 'exit':
        await flushAllSessionPersistence();
        opts.exit();
        return;

      case 'new': {
        const next = opts.isDefaultAgent
          ? opts.createSession('TUI Chat')
          : opts.createAgentSession(opts.currentAgentId, 'TUI Chat');
        if (opts.systemPrompt) {
          if (opts.isDefaultAgent) opts.setSessionSystemPrompt(next.id, opts.systemPrompt);
          else opts.setAgentSessionSystemPrompt(opts.currentAgentId, next.id, opts.systemPrompt);
        }
        opts.addNotice(`Created session ${next.id.slice(0, 8)} for ${opts.isDefaultAgent ? 'default agent' : opts.currentAgent?.name || opts.currentAgentId}.`);
        setInput('');
        return;
      }

      case 'clear':
        opts.clearSessionMessages(session.id);
        opts.clearNotices();
        opts.addNotice('Conversation cleared.', 'success');
        setInput('');
        return;

      case 'help': {
        const help = getHelpInfo(opts.runtimeConfigRef.current, {
          workspace: opts.workspace,
          configDir: opts.configDir,
          sessionId: session.id.slice(0, 8),
        });
        const lines = [
          '',
          '  Configuration',
          `    Provider:    ${help.config.provider}`,
          `    Model:       ${help.config.model}`,
          `    Temperature: ${help.config.temperature}`,
          `    Max tokens:  ${help.config.maxTokens}`,
          ...(help.config.workspace ? [`    Workspace:   ${help.config.workspace}`] : []),
          ...(help.config.configDir ? [`    Config dir:  ${help.config.configDir}`] : []),
          ...(help.config.sessionId ? [`    Session:     ${help.config.sessionId}`] : []),
          '',
          '  Commands',
          ...help.commands.map((item) => `    ${item.name.padEnd(16)}${item.description}`),
          '    /new             Create a new session',
          '    /agents          Show available agents',
          '    /agent <id>      Switch current agent',
          '    /agent-new <n>   Create a new agent',
          '    /delete <id>     Permanently delete a session',
          '    /scope [mode]    Show or switch global/session scope',
          '    /tools           Show enabled tools',
          '    /tool on|off     Toggle a tool for TUI',
          '    /skills          Show enabled skills',
          '    /skill on|off    Toggle a skill for TUI',
          '    /mcp             List MCP connections',
          '    /mcp add         Add and sync an MCP server',
          '    /mcp sync        Refresh an MCP server',
          '    /mcp remove      Remove an MCP server',
          '    /search <query>  Search in current session',
          '    /export [fmt]    Export current session',
          '    /files           List workspace files',
          '    /touch <path>    Create an empty file',
          '    /mkdir <path>    Create a directory',
          '    /rename <a> <b> Rename a file or directory',
          '    /rm <path>       Delete a file or directory',
          '    /write <p> <txt> Overwrite a file using escaped text',
          '    /cd <path>       Change file panel directory',
          '    /open <path>     Preview a workspace file',
          '    /stop            Stop the current response',
          '    /shell <cmd>     Run a shell command in the workspace',
          '',
        ];
        opts.addNotice(lines.join('\n'));
        setInput('');
        return;
      }

      case 'config':
        opts.addNotice(formatConfigSummary(opts.runtimeConfigRef.current, {
          workspace: opts.workspace,
          configDir: opts.configDir,
          sessionId: session.id.slice(0, 8),
        }));
        setInput('');
        return;

      case 'model':
        if (!command.args) { opts.addNotice('Usage: /model <model-name>'); setInput(''); return; }
        opts.addNotice(`Model set to ${opts.applyRuntimeConfig({ model: command.args }).model}`);
        setInput('');
        return;

      case 'provider': {
        if (!command.args) { opts.addNotice('Usage: /provider <provider-id>', 'warning'); setInput(''); return; }
        const nextProvider = command.args.trim();
        const providerMeta = getProviderMeta(nextProvider);
        if (!providerMeta) { opts.addNotice(`Unknown provider "${nextProvider}". Use /providers to list supported providers.`, 'warning'); setInput(''); return; }
        const currentConfig = opts.runtimeConfigRef.current;
        const previousProvider = getProviderMeta(currentConfig.provider);
        const shouldResetBaseUrl = !currentConfig.baseUrl || currentConfig.baseUrl === previousProvider?.defaultBaseUrl;
        const nextConfig = opts.applyRuntimeConfig({
          provider: providerMeta.id,
          baseUrl: shouldResetBaseUrl ? providerMeta.defaultBaseUrl : currentConfig.baseUrl,
        });
        const warnings = [];
        if (providerMeta.requiresApiKey && !nextConfig.apiKey) warnings.push('API key still missing; use /api-key <key>.');
        opts.addNotice([
          `Provider set to ${providerMeta.id}`,
          nextConfig.baseUrl ? `Base URL: ${nextConfig.baseUrl}` : 'Base URL: default',
          ...warnings,
        ].join('\n'), warnings.length > 0 ? 'warning' : 'success');
        setInput('');
        return;
      }

      case 'temperature': {
        if (!command.args) { opts.addNotice('Usage: /temperature <number>'); setInput(''); return; }
        const temp = Number(command.args);
        if (!Number.isFinite(temp)) { opts.addNotice(`Invalid temperature "${command.args}".`); setInput(''); return; }
        opts.addNotice(`Temperature set to ${opts.applyRuntimeConfig({ temperature: temp }).temperature}`);
        setInput('');
        return;
      }

      case 'max-tokens': {
        if (!command.args) { opts.addNotice('Usage: /max-tokens <integer>'); setInput(''); return; }
        const maxTokens = Number.parseInt(command.args, 10);
        if (!Number.isFinite(maxTokens) || maxTokens <= 0) { opts.addNotice(`Invalid max tokens "${command.args}".`); setInput(''); return; }
        opts.addNotice(`Max tokens set to ${opts.applyRuntimeConfig({ maxTokens }).maxTokens}`);
        setInput('');
        return;
      }

      case 'base-url':
        if (!command.args) { opts.addNotice('Usage: /base-url <url>'); setInput(''); return; }
        opts.addNotice(`Base URL set to ${opts.applyRuntimeConfig({ baseUrl: command.args.trim() }).baseUrl}`);
        setInput('');
        return;

      case 'api-key':
        if (!command.args) { opts.addNotice('Usage: /api-key <key>'); setInput(''); return; }
        opts.addNotice(`API key updated for ${opts.applyRuntimeConfig({ apiKey: command.args.trim() }).provider}`);
        setInput('');
        return;

      case 'save-config':
        opts.saveRuntimeConfig(opts.runtimeConfigRef.current);
        opts.addNotice('Current runtime config saved.');
        setInput('');
        return;

      case 'history':
        opts.addNotice([
          getHistoryInfo(session.id, session.messages.length),
          `Type: ${getSessionTypeLabel(session)}`,
          `Status: ${getSessionStatusLabel(session)}`,
          `Config scope: ${getSessionConfigScopeLabel(session)}`,
          `Config lock: ${isReadOnlySession(session) ? 'read-only' : isSessionConfigLocked(session) ? 'locked' : 'editable'}`,
          `Effective tools: ${getEffectiveSessionTools(session, opts.enabledTools).filter((id) => id !== 'file_manager').length}`,
          `Effective skills: ${getEffectiveSessionSkills(session, opts.enabledSkills).length}`,
          ...(session.systemPrompt ? ['System prompt: set'] : []),
          ...(getSessionSummary(session) ? [`Summary: ${getSessionSummary(session)}`] : []),
        ].join('\n'));
        setInput('');
        return;

      case 'sessions': {
        const filter = command.args?.trim() as 'all' | 'user' | 'agent' | 'mind' | undefined;
        if (filter && !['all', 'user', 'agent', 'mind'].includes(filter)) {
          opts.addNotice('Usage: /sessions [all|user|agent|mind]', 'warning');
          setInput('');
          return;
        }
        const filteredSessions = opts.sessions.filter((candidate) => (
          !filter || filter === 'all' ? true : (candidate.sessionType || 'user') === filter
        ));
        const list = filteredSessions.map((s) => ({
          shortId: s.id.slice(0, 8), name: s.name,
          messageCount: s.messages.length,
          createdAt: new Date(s.createdAt).toLocaleString(),
          type: getSessionTypeLabel(s),
          status: getSessionStatusLabel(s),
        }));
        if (list.length === 0) { opts.addNotice('No sessions found.'); }
        else {
          const lines = list.map((s) => `  ${s.shortId}  ${s.type}  ${s.status}  ${s.name}  ${s.messageCount} msg(s)  ${s.createdAt}`);
          opts.addNotice(`${list.length} session(s):\n${lines.join('\n')}`);
        }
        setInput('');
        return;
      }

      case 'agents': {
        const lines = opts.agents.map((a) => {
          const prefix = a.id === opts.currentAgentId ? '*' : ' ';
          return `${prefix} ${a.id}  ${a.name}`;
        });
        opts.addNotice(['Agents:', ...lines].join('\n'));
        setInput('');
        return;
      }

      case 'agent': {
        if (!command.args) { opts.addNotice('Usage: /agent <agent-id-or-name>'); setInput(''); return; }
        const query = command.args.trim().toLowerCase();
        const match = opts.agents.find((a) => a.id === query || a.name.toLowerCase() === query || a.id.startsWith(query));
        if (!match) { opts.addNotice(`No agent found matching "${command.args}"`); setInput(''); return; }
        opts.setCurrentAgent(match.id);
        const existing = (opts.agentSessions[match.id] || [])[0];
        if (!match.isDefault && !existing) {
          const s = opts.createAgentSession(match.id, 'TUI Chat');
          if (opts.systemPrompt) opts.setAgentSessionSystemPrompt(match.id, s.id, opts.systemPrompt);
        }
        opts.addNotice(`Switched to agent ${match.name} (${match.id}).`);
        setInput('');
        return;
      }

      case 'agent-new': {
        if (!command.args) { opts.addNotice('Usage: /agent-new <name>'); setInput(''); return; }
        const newAgent = opts.createAgent({ name: command.args.trim(), avatar: '🤖', description: '', systemPrompt: '', color: '#3b82f6' });
        opts.setCurrentAgent(newAgent.id);
        const s = opts.createAgentSession(newAgent.id, 'TUI Chat');
        if (opts.systemPrompt) opts.setAgentSessionSystemPrompt(newAgent.id, s.id, opts.systemPrompt);
        opts.addNotice(`Created agent ${newAgent.name} (${newAgent.id}).`);
        setInput('');
        return;
      }

      case 'resume': {
        if (!command.args) { opts.addNotice('Usage: /resume <session-id-prefix>'); setInput(''); return; }
        const match = opts.sessions.find((s) => s.id.startsWith(command.args));
        if (!match) { opts.addNotice(`No session found matching "${command.args}"`); setInput(''); return; }
        if (opts.isDefaultAgent) {
          await opts.loadSessionMessages(match.id);
          opts.openSession(match.id);
        } else {
          await opts.loadAgentSessionMessages(opts.currentAgentId, match.id);
          opts.setAgentCurrentSession(opts.currentAgentId, match.id);
        }
        opts.addNotice(`Resumed session ${match.id.slice(0, 8)} (${match.name}).`);
        setInput('');
        return;
      }

      case 'save':
        if (opts.isDefaultAgent) await opts.flushMessages(session.id);
        else await opts.flushAgentMessages(opts.currentAgentId, session.id);
        opts.addNotice('Messages flushed to disk.');
        setInput('');
        return;

      case 'delete': {
        if (!command.args) { opts.addNotice('Usage: /delete <session-id-prefix>'); setInput(''); return; }
        const match = opts.sessions.find((s) => s.id.startsWith(command.args));
        if (!match) { opts.addNotice(`No session found matching "${command.args}"`); setInput(''); return; }
        if (opts.isDefaultAgent) opts.permanentlyDeleteSession(match.id);
        else opts.deleteAgentSession(opts.currentAgentId, match.id);
        if (match.id === session.id) {
          const next = opts.isDefaultAgent ? opts.createSession('TUI Chat') : opts.createAgentSession(opts.currentAgentId, 'TUI Chat');
          if (opts.systemPrompt) {
            if (opts.isDefaultAgent) opts.setSessionSystemPrompt(next.id, opts.systemPrompt);
            else opts.setAgentSessionSystemPrompt(opts.currentAgentId, next.id, opts.systemPrompt);
          }
        }
        opts.addNotice(`Deleted session ${match.id.slice(0, 8)} (${match.name}).`);
        setInput('');
        return;
      }

      case 'scope': {
        const requestedScope = command.args.trim();
        const config = getSessionConfigStatus(session, opts.enabledTools, opts.enabledSkills);

        if (!requestedScope) {
          opts.addNotice([
            `Session ${session.id.slice(0, 8)} (${session.name})`,
            `Scope: ${config.scope}`,
            `Status: ${config.readOnly ? 'read-only' : config.locked ? 'locked' : 'editable'}`,
            `Tools: ${config.effectiveTools.filter((id) => id !== 'file_manager').length}${config.effectiveTools.includes('file_manager') ? ' + file_manager (suppressed in TUI)' : ''}`,
            `Skills: ${config.effectiveSkills.length}`,
          ].join('\n'));
          setInput('');
          return;
        }

        if (requestedScope !== 'global' && requestedScope !== 'session') {
          opts.addNotice('Usage: /scope [global|session]', 'warning');
          setInput('');
          return;
        }

        setScopeMode(session, requestedScope);
        setInput('');
        return;
      }

      case 'tools': {
        const config = getSessionConfigStatus(session, opts.enabledTools, opts.enabledSkills);
        const filtered = config.effectiveTools.filter((id) => id !== 'file_manager');
        const lines = [
          `Tools (${config.scope} scope · ${config.readOnly ? 'read-only' : config.locked ? 'locked' : 'editable'}):`,
          ...filtered.map((id) => `  - ${id}`),
        ];
        if (config.effectiveTools.includes('file_manager')) lines.push('', 'Suppressed in TUI: file_manager');
        opts.addNotice(lines.join('\n'));
        setInput('');
        return;
      }

      case 'tool': {
        const [op, toolId] = command.args.split(/\s+/, 2);
        if (!op || !toolId || !['on', 'off'].includes(op)) { opts.addNotice('Usage: /tool on <tool-id> | /tool off <tool-id>', 'warning'); setInput(''); return; }
        const didUpdate = updateScopedTool(session, toolId, op === 'on');
        if (didUpdate) {
          const scope = getSessionConfigScopeLabel(session);
          opts.addNotice(`Tool ${toolId} ${op === 'on' ? 'enabled' : 'disabled'} in ${scope} scope.`, 'success');
        }
        setInput('');
        return;
      }

      case 'skills': {
        const config = getSessionConfigStatus(session, opts.enabledTools, opts.enabledSkills);
        const enabledSet = new Set(config.effectiveSkills);
        const lines = opts.skills.length === 0
          ? ['No skills loaded.']
          : [
              `Skills (${config.scope} scope · ${config.readOnly ? 'read-only' : config.locked ? 'locked' : 'editable'}):`,
              ...opts.skills.map((s) => `  ${enabledSet.has(s.id) ? '[x]' : '[ ]'} ${s.id} — ${s.description}`),
            ];
        opts.addNotice(lines.join('\n'));
        setInput('');
        return;
      }

      case 'skill': {
        const [op, skillId] = command.args.split(/\s+/, 2);
        if (!op || !skillId || !['on', 'off'].includes(op)) { opts.addNotice('Usage: /skill on <skill-id> | /skill off <skill-id>', 'warning'); setInput(''); return; }
        const didUpdate = updateScopedSkill(session, skillId, op === 'on');
        if (didUpdate) {
          const scope = getSessionConfigScopeLabel(session);
          opts.addNotice(`Skill ${skillId} ${op === 'on' ? 'enabled' : 'disabled'} in ${scope} scope.`, 'success');
        }
        setInput('');
        return;
      }

      case 'mcp': {
        if (!command.args) {
          if (opts.mcpConnections.length === 0) opts.addNotice('No MCP connections configured.', 'warning');
          else opts.addNotice([
            'MCP Connections:',
            ...opts.mcpConnections.map((c) => `  ${c.id.slice(0, 8)}  ${c.name}  ${c.status}  ${c.tools.length} tool(s)`),
          ].join('\n'));
          setInput('');
          return;
        }
        const [op, v1, v2, v3] = command.args.split(/\s+/, 4);
        if (op === 'add') {
          const name = v1?.trim(); const url = v2?.trim(); const transport = (v3?.trim() || 'http') as MCPTransportType;
          if (!name || !url || !['http', 'sse'].includes(transport)) { opts.addNotice('Usage: /mcp add <name> <url> [http|sse]', 'warning'); setInput(''); return; }
          const id = opts.addMCPConnection(name, url, transport);
          await syncMCPConnection({ id, name, url, transport });
          setInput('');
          return;
        }
        if (!v1 || !['sync', 'remove'].includes(op)) { opts.addNotice('Usage: /mcp | /mcp add <name> <url> [http|sse] | /mcp sync <id> | /mcp remove <id>', 'warning'); setInput(''); return; }
        const match = opts.mcpConnections.find((c) => c.id.startsWith(v1) || c.name.toLowerCase() === v1.toLowerCase());
        if (!match) { opts.addNotice(`No MCP connection found matching "${v1}".`, 'warning'); setInput(''); return; }
        if (op === 'sync') { await syncMCPConnection(match); setInput(''); return; }
        if (opts.isDefaultAgent) {
          for (const tool of match.tools) { if (opts.enabledTools.includes(tool.id)) opts.toggleGlobalTool(tool.id); }
        } else if (opts.currentAgent) {
          opts.setAgentEnabledTools(opts.currentAgent.id, opts.enabledTools.filter((id) => !match.tools.some((t) => t.id === id)));
        }
        opts.removeMCPConnection(match.id);
        opts.addNotice(`Removed MCP connection ${match.name} (${match.id.slice(0, 8)}).`, 'success');
        setInput('');
        return;
      }

      case 'stop':
        opts.handleStop(session.id);
        setInput('');
        return;

      case 'search': {
        if (!command.args) {
          opts.addNotice('Usage: /search <query>', 'warning');
          setInput('');
          return;
        }
        const matches = MessageHistoryManager.searchMessages(session.messages, command.args);
        if (matches.length === 0) {
          opts.addNotice(`No messages matched "${command.args}".`, 'warning');
          setInput('');
          return;
        }
        const visibleMatches = matches.slice(-8);
        opts.addNotice([
          `Found ${matches.length} match(es) in ${session.id.slice(0, 8)} (${session.name}):`,
          ...visibleMatches.map((match) => formatSearchResult(match)),
          ...(matches.length > visibleMatches.length ? [`  ... ${matches.length - visibleMatches.length} older match(es)`] : []),
        ].join('\n'));
        setInput('');
        return;
      }

      case 'export': {
        const { format, outputPath } = parseExportArgs(command.args);
        try {
          const targetPath = path.resolve(
            opts.workspace || process.cwd(),
            outputPath || buildDefaultExportName(session, format),
          );
          const effectiveToolIds = (session.sessionTools ?? opts.enabledTools).filter((toolId) => toolId !== 'file_manager');
          const exportOptions = {
            systemPrompt: session.systemPrompt,
            sessionId: session.id,
            sessionName: session.name,
            tools: getEnabledTools(effectiveToolIds),
            alternateHistories: getSessionAlternateHistories(session),
          };

          const content = format === 'json'
            ? MessageHistoryManager.exportToJSON(session.messages, exportOptions)
            : format === 'text'
              ? MessageHistoryManager.exportToText(session.messages, exportOptions)
              : MessageHistoryManager.exportToMarkdown(session.messages, exportOptions);

          await mkdir(path.dirname(targetPath), { recursive: true });
          await writeFile(targetPath, content, 'utf8');

          const stats = MessageHistoryManager.getMessageStats(session.messages);
          opts.addNotice([
            `Exported ${session.name} to ${targetPath}`,
            `Format: ${format}`,
            `Messages: ${stats.total}`,
            `Tool calls: ${stats.toolCalls}`,
            `Estimated tokens: ${stats.tokens}`,
            `Turns: ${MessageHistoryManager.getConversationTurns(session.messages).length}`,
          ].join('\n'), 'success');
        } catch (exportError) {
          opts.addNotice(`Export failed: ${exportError instanceof Error ? exportError.message : String(exportError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'files':
        opts.addNotice(formatFileEntries(
          opts.fileBrowser.entries,
          opts.fileBrowser.currentDisplayPath,
          opts.fileBrowser.rootPath,
        ));
        setInput('');
        return;

      case 'touch': {
        if (!command.args) {
          opts.addNotice('Usage: /touch <path>', 'warning');
          setInput('');
          return;
        }
        try {
          const nextPath = await opts.fileBrowser.createFile(command.args);
          opts.addNotice(`Created file ${nextPath}`, 'success');
        } catch (fileError) {
          opts.addNotice(`touch failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'mkdir': {
        if (!command.args) {
          opts.addNotice('Usage: /mkdir <path>', 'warning');
          setInput('');
          return;
        }
        try {
          const nextPath = await opts.fileBrowser.createDirectory(command.args);
          opts.addNotice(`Created directory ${nextPath}`, 'success');
        } catch (fileError) {
          opts.addNotice(`mkdir failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'cd': {
        if (!command.args) {
          opts.addNotice('Usage: /cd <path>', 'warning');
          setInput('');
          return;
        }
        try {
          const nextPath = await opts.fileBrowser.changeDirectory(command.args);
          await opts.fileBrowser.refresh(nextPath);
          opts.addNotice(`Current directory: ${nextPath}`, 'success');
        } catch (fileError) {
          opts.addNotice(`cd failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'rename': {
        const [sourcePath, nextPathOrName] = splitArgsOnce(command.args);
        if (!sourcePath || !nextPathOrName) {
          opts.addNotice('Usage: /rename <path> <new-name-or-path>', 'warning');
          setInput('');
          return;
        }
        try {
          const renamedPath = await opts.fileBrowser.renamePath(sourcePath, nextPathOrName);
          opts.addNotice(`Renamed to ${renamedPath}`, 'success');
        } catch (fileError) {
          opts.addNotice(`rename failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'rm': {
        if (!command.args) {
          opts.addNotice('Usage: /rm <path>', 'warning');
          setInput('');
          return;
        }
        try {
          const deletedPath = await opts.fileBrowser.deletePath(command.args);
          opts.addNotice(`Deleted ${deletedPath}`, 'success');
        } catch (fileError) {
          opts.addNotice(`rm failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'write': {
        const [targetPath, rawContent] = splitArgsOnce(command.args);
        if (!targetPath || !rawContent) {
          opts.addNotice('Usage: /write <path> <text-with-optional-\\n-escapes>', 'warning');
          setInput('');
          return;
        }
        try {
          const content = decodeEscapedText(rawContent);
          const preview = await opts.fileBrowser.writeTextFile(targetPath, content);
          opts.addNotice([
            `Wrote ${preview.displayPath}`,
            `Bytes: ${preview.size}`,
            `Lines: ${preview.lines.length}${preview.truncated ? '+' : ''}`,
          ].join('\n'), 'success');
        } catch (fileError) {
          opts.addNotice(`write failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'open': {
        if (!command.args) {
          opts.addNotice('Usage: /open <path>', 'warning');
          setInput('');
          return;
        }
        try {
          const result = await opts.fileBrowser.openPath(command.args);
          if (result.kind === 'directory') {
            await opts.fileBrowser.refresh(result.path);
            opts.addNotice(`Opened directory ${result.path}`, 'success');
          } else {
            const preview = result.preview;
            opts.addNotice([
              `Preview: ${preview?.displayPath || result.path}`,
              preview?.kind === 'binary' ? 'Type: binary' : 'Type: text',
              '',
              ...(preview?.lines || ['(no preview)']),
              ...(preview?.truncated ? ['...', '(preview truncated)'] : []),
            ].join('\n'), 'info');
          }
        } catch (fileError) {
          opts.addNotice(`open failed: ${fileError instanceof Error ? fileError.message : String(fileError)}`, 'error');
        }
        setInput('');
        return;
      }

      case 'shell': {
        if (!command.args) { opts.addNotice('Usage: /shell <command> | /shell reset'); setInput(''); return; }
        let platformContext;
        try { platformContext = getPlatformContext(); }
        catch { opts.addNotice('Shell execution is not available before platform initialization completes.', 'warning'); setInput(''); return; }
        const capabilities = getPlatformCapabilities(platformContext.info);
        if (!capabilities.supportsExec || !platformContext.api.executeShell) { opts.addNotice('Shell execution is not available on this platform.', 'warning'); setInput(''); return; }
        if (command.args.trim() === 'reset') {
          if (shellSessionIdRef.current && platformContext.api.destroyShellSession) await platformContext.api.destroyShellSession(shellSessionIdRef.current);
          shellSessionIdRef.current = undefined;
          opts.addNotice('Shell session reset.', 'success');
          setInput('');
          return;
        }
        setInput('');
        opts.setIsLoading(true);
        opts.setActivityLabel('Running shell...');
        try {
          const result = await platformContext.api.executeShell(command.args.trim(), {
            sessionId: shellSessionIdRef.current, cwd: opts.workspace,
            loginShell: opts.execLoginShell, timeoutMs: opts.toolExecutionTimeout,
          });
          if (result.sessionId) shellSessionIdRef.current = result.sessionId;
          if (result.error) opts.addNotice(`$ ${command.args.trim()}\nError: ${result.error}`, 'error');
          else opts.addNotice([
            `$ ${command.args.trim()}`, `Session: ${result.sessionId}`, `Exit Code: ${result.exitCode}`, '', result.output || '(no output)',
          ].join('\n'), result.exitCode === 0 ? 'success' : 'warning');
        } catch (shellError) {
          opts.addNotice(`Shell execution failed: ${shellError instanceof Error ? shellError.message : String(shellError)}`, 'error');
        } finally {
          opts.setActivityLabel('Thinking...');
          opts.setIsLoading(false);
        }
        return;
      }

      case 'providers': {
        const groups = getProviderList();
        const lines: string[] = [];
        for (const group of groups) {
          lines.push(group.category);
          for (const provider of group.providers) {
            lines.push(`  ${provider.id}  ${provider.name}  (${provider.requiresApiKey ? 'api key' : 'no api key'})`);
            lines.push(`    ${provider.sampleModels}`);
          }
          lines.push('');
        }
        opts.addNotice(lines.join('\n'));
        setInput('');
        return;
      }

      default:
        opts.addNotice(`Unknown command: /${command.command}. Type /help for available commands.`, 'warning');
        setInput('');
    }
  }, [ensureActiveSession, opts, setScopeMode, syncMCPConnection, updateScopedSkill, updateScopedTool]);

  return { input, setInput, handleSubmit, syncMCPConnection };
}
