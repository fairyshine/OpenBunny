import { useState, useCallback, useRef } from 'react';
import type { LLMConfig, Session } from '@openbunny/shared/types';
import { discoverMCPConnection } from '@openbunny/shared';
import { getProviderMeta } from '@openbunny/shared/services/ai';
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
import { formatConfigSummary } from '../utils/formatting.js';
import type { NoticeTone } from '../types.js';

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
  setAgentSessionSystemPrompt: (agentId: string, sessionId: string, prompt: string) => void;
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
  // agent loop
  handleStop: (sessionId: string | null) => void;
  sendMessage: (trimmed: string, session: Session, config: LLMConfig) => Promise<void>;
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
          '    /tools           Show enabled tools',
          '    /tool on|off     Toggle a tool for TUI',
          '    /skills          Show enabled skills',
          '    /skill on|off    Toggle a skill for TUI',
          '    /mcp             List MCP connections',
          '    /mcp add         Add and sync an MCP server',
          '    /mcp sync        Refresh an MCP server',
          '    /mcp remove      Remove an MCP server',
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
        opts.addNotice(getHistoryInfo(session.id, session.messages.length));
        setInput('');
        return;

      case 'sessions': {
        const list = opts.sessions.map((s) => ({
          shortId: s.id.slice(0, 8), name: s.name,
          messageCount: s.messages.length, createdAt: new Date(s.createdAt).toLocaleString(),
        }));
        if (list.length === 0) { opts.addNotice('No sessions found.'); }
        else {
          const lines = list.map((s) => `  ${s.shortId}  ${s.name}  ${s.messageCount} msg(s)  ${s.createdAt}`);
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

      case 'tools': {
        const filtered = opts.enabledTools.filter((id) => id !== 'file_manager');
        const lines = ['Enabled tools:', ...filtered.map((id) => `  - ${id}`)];
        if (opts.enabledTools.includes('file_manager')) lines.push('', 'Suppressed in TUI: file_manager');
        opts.addNotice(lines.join('\n'));
        setInput('');
        return;
      }

      case 'tool': {
        const [op, toolId] = command.args.split(/\s+/, 2);
        if (!op || !toolId || !['on', 'off'].includes(op)) { opts.addNotice('Usage: /tool on <tool-id> | /tool off <tool-id>', 'warning'); setInput(''); return; }
        if (toolId === 'file_manager') { opts.addNotice('file_manager is not available in TUI. Use /shell and the workspace instead.', 'warning'); setInput(''); return; }
        const isEnabled = opts.enabledTools.includes(toolId);
        if ((op === 'on' && !isEnabled) || (op === 'off' && isEnabled)) {
          if (opts.isDefaultAgent) opts.toggleGlobalTool(toolId);
          else if (opts.currentAgent) {
            const next = op === 'on' ? [...opts.enabledTools, toolId] : opts.enabledTools.filter((id) => id !== toolId);
            opts.setAgentEnabledTools(opts.currentAgent.id, next);
          }
        }
        opts.addNotice(`Tool ${toolId} ${op === 'on' ? 'enabled' : 'disabled'}.`, 'success');
        setInput('');
        return;
      }

      case 'skills': {
        const enabledSet = new Set(opts.enabledSkills);
        const lines = opts.skills.length === 0
          ? ['No skills loaded.']
          : opts.skills.map((s) => `  ${enabledSet.has(s.id) ? '[x]' : '[ ]'} ${s.id} — ${s.description}`);
        opts.addNotice(['Skills:', ...lines].join('\n'));
        setInput('');
        return;
      }

      case 'skill': {
        const [op, skillId] = command.args.split(/\s+/, 2);
        if (!op || !skillId || !['on', 'off'].includes(op)) { opts.addNotice('Usage: /skill on <skill-id> | /skill off <skill-id>', 'warning'); setInput(''); return; }
        const isEnabled = opts.enabledSkills.includes(skillId);
        if ((op === 'on' && !isEnabled) || (op === 'off' && isEnabled)) {
          if (opts.isDefaultAgent) opts.toggleGlobalSkill(skillId);
          else if (opts.currentAgent) {
            const next = op === 'on' ? [...opts.enabledSkills, skillId] : opts.enabledSkills.filter((id) => id !== skillId);
            opts.setAgentEnabledSkills(opts.currentAgent.id, next);
          }
        }
        opts.addNotice(`Skill ${skillId} ${op === 'on' ? 'enabled' : 'disabled'}.`, 'success');
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
  }, [ensureActiveSession, opts, syncMCPConnection]);

  return { input, setInput, handleSubmit, syncMCPConnection };
}
