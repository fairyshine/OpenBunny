import type { MCPConnection } from '../../stores/tools';
import type { Agent, LLMConfig } from '../../types';
import { getDefaultAIRuntimeDefaultsResolver } from './runtimeDefaults';
import { getDefaultSessionOwnerStore, type SessionOwnerStore } from './sessionOwnerStore';
import type { LoadedSkill } from '../skills';

export interface SkillRuntimeContext {
  skills: LoadedSkill[];
  enabledSkillIds: string[];
  markSkillActivated?: (skillName: string) => void;
}

export interface MCPRuntimeContext {
  mcpConnections: MCPConnection[];
  onConnectionStatusChange?: (
    connectionId: string,
    status: MCPConnection['status'],
    error?: string | null,
  ) => void;
}

export interface SessionRuntimeContext {
  sessionOwnerStore: SessionOwnerStore;
}

export interface AgentRuntimeContext extends SkillRuntimeContext, MCPRuntimeContext, SessionRuntimeContext {
  currentAgentId: string;
  agents: Agent[];
  defaultLLMConfig: LLMConfig;
  defaultEnabledToolIds: string[];
  defaultSkillIds: string[];
  proxyUrl?: string;
  toolExecutionTimeout?: number;
  execLoginShell?: boolean;
  searchProvider?: 'exa_free' | 'exa' | 'brave';
  exaApiKey?: string;
  braveApiKey?: string;
}

export function resolveRuntimeAgents(runtimeContext: Pick<Partial<AgentRuntimeContext>, 'agents'> = {}): Agent[] {
  return runtimeContext.agents ?? getDefaultAIRuntimeDefaultsResolver().getDefaults().agents;
}

export function findRuntimeAgent(
  agentId: string,
  runtimeContext: Pick<Partial<AgentRuntimeContext>, 'agents'> = {},
): Agent | null {
  return resolveRuntimeAgents(runtimeContext).find((agent) => agent.id === agentId) || null;
}

export function resolveSkillRuntimeContext(overrides: Partial<SkillRuntimeContext> = {}): SkillRuntimeContext {
  const defaults = getDefaultAIRuntimeDefaultsResolver().getDefaults();

  return {
    skills: overrides.skills ?? defaults.skills,
    enabledSkillIds: overrides.enabledSkillIds ?? defaults.enabledSkillIds,
    markSkillActivated: overrides.markSkillActivated ?? defaults.markSkillActivated,
  };
}

export function resolveSessionRuntimeContext(overrides: Partial<SessionRuntimeContext> = {}): SessionRuntimeContext {
  return {
    sessionOwnerStore: overrides.sessionOwnerStore ?? getDefaultSessionOwnerStore(),
  };
}

export function resolveMCPRuntimeContext(overrides: Partial<MCPRuntimeContext> = {}): MCPRuntimeContext {
  const defaults = getDefaultAIRuntimeDefaultsResolver().getDefaults();

  return {
    mcpConnections: overrides.mcpConnections ?? defaults.mcpConnections,
    onConnectionStatusChange: overrides.onConnectionStatusChange ?? defaults.onConnectionStatusChange,
  };
}

export function resolveAgentRuntimeContext(overrides: Partial<AgentRuntimeContext> = {}): AgentRuntimeContext {
  const defaults = getDefaultAIRuntimeDefaultsResolver().getDefaults();
  const sessionContext = resolveSessionRuntimeContext(overrides);
  const enabledSkillIds = overrides.enabledSkillIds ?? defaults.enabledSkillIds;

  return {
    currentAgentId: overrides.currentAgentId ?? defaults.currentAgentId,
    agents: overrides.agents ?? defaults.agents,
    defaultLLMConfig: overrides.defaultLLMConfig ?? defaults.defaultLLMConfig,
    defaultEnabledToolIds: overrides.defaultEnabledToolIds ?? defaults.defaultEnabledToolIds,
    defaultSkillIds: overrides.defaultSkillIds ?? enabledSkillIds,
    proxyUrl: overrides.proxyUrl ?? defaults.proxyUrl,
    toolExecutionTimeout: overrides.toolExecutionTimeout ?? defaults.toolExecutionTimeout,
    execLoginShell: overrides.execLoginShell ?? defaults.execLoginShell,
    searchProvider: overrides.searchProvider ?? defaults.searchProvider,
    exaApiKey: overrides.exaApiKey ?? defaults.exaApiKey,
    braveApiKey: overrides.braveApiKey ?? defaults.braveApiKey,
    skills: overrides.skills ?? defaults.skills,
    enabledSkillIds,
    markSkillActivated: overrides.markSkillActivated ?? defaults.markSkillActivated,
    mcpConnections: overrides.mcpConnections ?? defaults.mcpConnections,
    onConnectionStatusChange: overrides.onConnectionStatusChange ?? defaults.onConnectionStatusChange,
    ...sessionContext,
  };
}
