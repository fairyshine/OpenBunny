import type { MCPConnection } from '../../stores/tools';
import type { Agent, LLMConfig } from '../../types';
import type { LoadedSkill } from '../skills';

export interface AIRuntimeDefaults {
  currentAgentId: string;
  agents: Agent[];
  defaultLLMConfig: LLMConfig;
  defaultEnabledToolIds: string[];
  proxyUrl?: string;
  toolExecutionTimeout?: number;
  execLoginShell?: boolean;
  searchProvider?: 'exa_free' | 'exa' | 'brave';
  exaApiKey?: string;
  braveApiKey?: string;
  skills: LoadedSkill[];
  enabledSkillIds: string[];
  markSkillActivated?: (skillName: string) => void;
  mcpConnections: MCPConnection[];
  onConnectionStatusChange?: (
    connectionId: string,
    status: MCPConnection['status'],
    error?: string | null,
  ) => void;
}

export interface AIRuntimeDefaultsResolver {
  getDefaults(): AIRuntimeDefaults;
}

const UNCONFIGURED_RUNTIME_DEFAULTS_MESSAGE =
  'AI runtime defaults resolver is not configured. Initialize platform runtime or call setDefaultAIRuntimeDefaultsResolver().';

const unconfiguredAIRuntimeDefaultsResolver: AIRuntimeDefaultsResolver = {
  getDefaults() {
    throw new Error(UNCONFIGURED_RUNTIME_DEFAULTS_MESSAGE);
  },
};

let defaultAIRuntimeDefaultsResolver: AIRuntimeDefaultsResolver = unconfiguredAIRuntimeDefaultsResolver;

export function setDefaultAIRuntimeDefaultsResolver(runtimeDefaultsResolver: AIRuntimeDefaultsResolver): void {
  defaultAIRuntimeDefaultsResolver = runtimeDefaultsResolver;
}

export function getDefaultAIRuntimeDefaultsResolver(): AIRuntimeDefaultsResolver {
  return defaultAIRuntimeDefaultsResolver;
}

export function resetDefaultAIRuntimeDefaultsResolverForTests(): void {
  defaultAIRuntimeDefaultsResolver = unconfiguredAIRuntimeDefaultsResolver;
}
