import { useMemo } from 'react';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { DEFAULT_AGENT_ID, useAgentStore } from '@openbunny/shared/stores/agent';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useSkillStore } from '@openbunny/shared/stores/skills';
import { getBuiltinToolIds, useToolStore } from '@openbunny/shared/stores/tools';
import { getPlatformCapabilities, getPlatformContext } from '@openbunny/shared/platform';

export function useAppState() {
  /* ── Session store ─────────────────────────────────── */
  const globalSessions = useSessionStore((s) => s.sessions);
  const globalCurrentSessionId = useSessionStore((s) => s.currentSessionId);
  const globalLLMConfig = useSessionStore((s) => s.llmConfig);
  const createSession = useSessionStore((s) => s.createSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateMessage = useSessionStore((s) => s.updateMessage);
  const clearSessionMessages = useSessionStore((s) => s.clearSessionMessages);
  const setGlobalLLMConfig = useSessionStore((s) => s.setLLMConfig);
  const setSessionStreaming = useSessionStore((s) => s.setSessionStreaming);
  const setSessionSystemPrompt = useSessionStore((s) => s.setSessionSystemPrompt);
  const openSession = useSessionStore((s) => s.openSession);
  const loadSessionMessages = useSessionStore((s) => s.loadSessionMessages);
  const flushMessages = useSessionStore((s) => s.flushMessages);
  const permanentlyDeleteSession = useSessionStore((s) => s.permanentlyDeleteSession);

  /* ── Agent store ───────────────────────────────────── */
  const agents = useAgentStore((s) => s.agents);
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const setCurrentAgent = useAgentStore((s) => s.setCurrentAgent);
  const createAgent = useAgentStore((s) => s.createAgent);
  const agentSessions = useAgentStore((s) => s.agentSessions);
  const agentCurrentSessionId = useAgentStore((s) => s.agentCurrentSessionId);
  const createAgentSession = useAgentStore((s) => s.createAgentSession);
  const renameAgentSession = useAgentStore((s) => s.renameAgentSession);
  const deleteAgentSession = useAgentStore((s) => s.deleteAgentSession);
  const addAgentMessage = useAgentStore((s) => s.addAgentMessage);
  const updateAgentMessage = useAgentStore((s) => s.updateAgentMessage);
  const setAgentSessionStreaming = useAgentStore((s) => s.setAgentSessionStreaming);
  const setAgentSessionSystemPrompt = useAgentStore((s) => s.setAgentSessionSystemPrompt);
  const loadAgentSessionMessages = useAgentStore((s) => s.loadAgentSessionMessages);
  const flushAgentMessages = useAgentStore((s) => s.flushAgentMessages);
  const setAgentCurrentSession = useAgentStore((s) => s.setAgentCurrentSession);
  const setAgentLLMConfig = useAgentStore((s) => s.setAgentLLMConfig);
  const setAgentEnabledTools = useAgentStore((s) => s.setAgentEnabledTools);
  const setAgentEnabledSkills = useAgentStore((s) => s.setAgentEnabledSkills);

  /* ── Settings store ────────────────────────────────── */
  const globalEnabledTools = useSettingsStore((s) => s.enabledTools);
  const toggleGlobalTool = useSettingsStore((s) => s.toggleTool);
  const proxyUrl = useSettingsStore((s) => s.proxyUrl);
  const execLoginShell = useSettingsStore((s) => s.execLoginShell);
  const toolExecutionTimeout = useSettingsStore((s) => s.toolExecutionTimeout);
  const setExecLoginShell = useSettingsStore((s) => s.setExecLoginShell);
  const setToolExecutionTimeout = useSettingsStore((s) => s.setToolExecutionTimeout);
  const searchProvider = useSettingsStore((s) => s.searchProvider);
  const setSearchProvider = useSettingsStore((s) => s.setSearchProvider);

  /* ── Skill store ───────────────────────────────────── */
  const skills = useSkillStore((s) => s.skills);
  const globalEnabledSkills = useSkillStore((s) => s.enabledSkillIds);
  const toggleGlobalSkill = useSkillStore((s) => s.toggleSkill);
  const loadSkills = useSkillStore((s) => s.loadSkills);

  /* ── Tool store (MCP) ──────────────────────────────── */
  const mcpConnections = useToolStore((s) => s.mcpConnections);
  const addMCPConnection = useToolStore((s) => s.addMCPConnection);
  const removeMCPConnection = useToolStore((s) => s.removeMCPConnection);
  const updateMCPStatus = useToolStore((s) => s.updateMCPStatus);
  const setMCPTools = useToolStore((s) => s.setMCPTools);
  const setMCPError = useToolStore((s) => s.setMCPError);

  /* ── Derived state ─────────────────────────────────── */
  const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;

  const currentAgent = useMemo(
    () => agents.find((a) => a.id === currentAgentId) || null,
    [agents, currentAgentId],
  );

  const sessions = useMemo(
    () => isDefaultAgent
      ? globalSessions.filter((s) => !s.deletedAt)
      : (agentSessions[currentAgentId] || []),
    [agentSessions, currentAgentId, globalSessions, isDefaultAgent],
  );

  const currentSessionId = isDefaultAgent
    ? globalCurrentSessionId
    : (agentCurrentSessionId[currentAgentId] ?? null);

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) || null,
    [currentSessionId, sessions],
  );

  const enabledTools = isDefaultAgent ? globalEnabledTools : (currentAgent?.enabledTools || []);
  const enabledSkills = isDefaultAgent ? globalEnabledSkills : (currentAgent?.enabledSkills || []);

  const builtinToolIds = useMemo(
    () => getBuiltinToolIds().filter((id) => id !== 'file_manager'),
    [],
  );

  const capabilities = useMemo(() => {
    try {
      return getPlatformCapabilities(getPlatformContext().info);
    } catch {
      return { supportsExec: false, supportsVirtualFileSystem: false, supportsExternalEditor: false };
    }
  }, []);

  const connectedMcpCount = mcpConnections.filter((c) => c.status === 'connected').length;

  return {
    // session store
    globalSessions, globalCurrentSessionId, globalLLMConfig,
    createSession, renameSession, addMessage, updateMessage,
    clearSessionMessages, setGlobalLLMConfig, setSessionStreaming,
    setSessionSystemPrompt, openSession, loadSessionMessages,
    flushMessages, permanentlyDeleteSession,
    // agent store
    agents, currentAgentId, setCurrentAgent, createAgent,
    agentSessions, agentCurrentSessionId,
    createAgentSession, renameAgentSession, deleteAgentSession,
    addAgentMessage, updateAgentMessage,
    setAgentSessionStreaming, setAgentSessionSystemPrompt,
    loadAgentSessionMessages, flushAgentMessages,
    setAgentCurrentSession, setAgentLLMConfig,
    setAgentEnabledTools, setAgentEnabledSkills,
    // settings store
    globalEnabledTools, toggleGlobalTool, proxyUrl,
    execLoginShell, toolExecutionTimeout,
    setExecLoginShell, setToolExecutionTimeout,
    searchProvider, setSearchProvider,
    // skill store
    skills, globalEnabledSkills, toggleGlobalSkill, loadSkills,
    // tool store (MCP)
    mcpConnections, addMCPConnection, removeMCPConnection,
    updateMCPStatus, setMCPTools, setMCPError,
    // derived
    isDefaultAgent, currentAgent, sessions, currentSessionId,
    currentSession, enabledTools, enabledSkills,
    builtinToolIds, capabilities, connectedMcpCount,
  };
}
