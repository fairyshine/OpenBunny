import { DEFAULT_AGENT_ID, useAgentStore } from '../../stores/agent';
import { useSettingsStore } from '../../stores/settings';
import { useSkillStore } from '../../stores/skills';
import { useToolStore, type MCPConnection } from '../../stores/tools';
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

export interface AgentRuntimeContext extends SkillRuntimeContext, MCPRuntimeContext {
  currentAgentId: string;
  proxyUrl?: string;
  toolExecutionTimeout?: number;
}

export function resolveSkillRuntimeContext(overrides: Partial<SkillRuntimeContext> = {}): SkillRuntimeContext {
  const skillStore = useSkillStore.getState();

  return {
    skills: overrides.skills ?? skillStore.skills,
    enabledSkillIds: overrides.enabledSkillIds ?? skillStore.enabledSkillIds,
    markSkillActivated: overrides.markSkillActivated ?? skillStore.markActivated,
  };
}

export function resolveMCPRuntimeContext(overrides: Partial<MCPRuntimeContext> = {}): MCPRuntimeContext {
  const toolStore = useToolStore.getState();

  return {
    mcpConnections: overrides.mcpConnections ?? toolStore.mcpConnections,
    onConnectionStatusChange: overrides.onConnectionStatusChange ?? ((connectionId, status, error) => {
      toolStore.updateMCPStatus(connectionId, status);
      toolStore.setMCPError(connectionId, error || null);
    }),
  };
}

export function resolveAgentRuntimeContext(overrides: Partial<AgentRuntimeContext> = {}): AgentRuntimeContext {
  const settingsStore = useSettingsStore.getState();
  const skillContext = resolveSkillRuntimeContext(overrides);
  const mcpContext = resolveMCPRuntimeContext(overrides);

  return {
    currentAgentId: overrides.currentAgentId ?? useAgentStore.getState().currentAgentId ?? DEFAULT_AGENT_ID,
    proxyUrl: overrides.proxyUrl ?? settingsStore.proxyUrl,
    toolExecutionTimeout: overrides.toolExecutionTimeout ?? settingsStore.toolExecutionTimeout,
    ...skillContext,
    ...mcpContext,
  };
}
