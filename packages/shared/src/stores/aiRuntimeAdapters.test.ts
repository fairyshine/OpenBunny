import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENT_ID, useAgentStore } from './agent';
import { useSessionStore } from './session';
import { useSettingsStore } from './settings';
import { useSkillStore } from './skills';
import { useToolStore, type MCPConnection } from './tools';
import { resetDefaultAIRuntimeDefaultsResolverForTests, getDefaultAIRuntimeDefaultsResolver } from '../services/ai/runtimeDefaults';
import { getDefaultSessionOwnerStore, resetDefaultSessionOwnerStoreForTests } from '../services/ai/sessionOwnerStore';
import { resetScheduledMindBridgeForTests } from '../services/ai/scheduledMind';
import { registerZustandAIRuntimeAdapters, zustandAIRuntimeDefaultsResolver, zustandSessionOwnerStore } from './aiRuntimeAdapters';

function createConnection(overrides: Partial<MCPConnection> = {}): MCPConnection {
  return {
    id: overrides.id ?? 'conn-1',
    name: overrides.name ?? 'Connection 1',
    url: overrides.url ?? 'http://localhost:3000',
    transport: overrides.transport ?? 'http',
    status: overrides.status ?? 'disconnected',
    lastError: overrides.lastError ?? null,
    tools: overrides.tools ?? [],
  };
}

test.afterEach(() => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
  resetDefaultSessionOwnerStoreForTests();
  resetScheduledMindBridgeForTests();
});

test('zustandAIRuntimeDefaultsResolver reads current store-backed defaults', () => {
  const agentSnapshot = useAgentStore.getState();
  const sessionSnapshot = useSessionStore.getState();
  const settingsSnapshot = useSettingsStore.getState();
  const skillSnapshot = useSkillStore.getState();
  const toolSnapshot = useToolStore.getState();

  const baseAgent = agentSnapshot.agents.find((agent) => agent.id === DEFAULT_AGENT_ID) ?? agentSnapshot.agents[0];
  const extraAgent = {
    ...baseAgent,
    id: 'agent-runtime-defaults',
    name: 'Agent Runtime Defaults',
  };
  const connection = createConnection({ id: 'runtime-defaults-conn', status: 'connected' });
  const skillCalls: string[] = [];
  const statusCalls: Array<[string, string]> = [];
  const errorCalls: Array<[string, string | null]> = [];

  useAgentStore.setState({
    agents: [baseAgent, extraAgent],
    currentAgentId: 'agent-runtime-defaults',
  });
  useSessionStore.setState({
    llmConfig: {
      provider: 'anthropic',
      apiKey: 'runtime-defaults-key',
      model: 'claude-3-5-sonnet',
      temperature: 0.4,
      maxTokens: 4096,
    },
  });
  useSettingsStore.setState({
    enabledTools: ['memory', 'python'],
    proxyUrl: 'https://runtime-defaults.example.com',
    toolExecutionTimeout: 321,
    execLoginShell: false,
    searchProvider: 'brave',
    exaApiKey: 'exa-runtime-defaults-key',
    braveApiKey: 'brave-runtime-defaults-key',
  });
  useSkillStore.setState({
    skills: [{ name: 'runtime-default-skill', description: 'store', source: 'builtin', body: 'body' }],
    enabledSkillIds: ['runtime-default-skill'],
    markActivated: (skillName: string) => { skillCalls.push(skillName); },
  });
  useToolStore.setState({
    mcpConnections: [connection],
    updateMCPStatus: ((id, status) => { statusCalls.push([id, status]); }) as typeof toolSnapshot.updateMCPStatus,
    setMCPError: ((id, error) => { errorCalls.push([id, error]); }) as typeof toolSnapshot.setMCPError,
  });

  try {
    const defaults = zustandAIRuntimeDefaultsResolver.getDefaults();
    assert.equal(defaults.currentAgentId, 'agent-runtime-defaults');
    assert.deepEqual(defaults.agents.map((agent) => agent.id), [DEFAULT_AGENT_ID, 'agent-runtime-defaults']);
    assert.equal(defaults.defaultLLMConfig.model, 'claude-3-5-sonnet');
    assert.deepEqual(defaults.defaultEnabledToolIds, ['memory', 'python']);
    assert.equal(defaults.proxyUrl, 'https://runtime-defaults.example.com');
    assert.equal(defaults.toolExecutionTimeout, 321);
    assert.equal(defaults.execLoginShell, false);
    assert.equal(defaults.searchProvider, 'brave');
    assert.equal(defaults.exaApiKey, 'exa-runtime-defaults-key');
    assert.equal(defaults.braveApiKey, 'brave-runtime-defaults-key');
    assert.deepEqual(defaults.enabledSkillIds, ['runtime-default-skill']);
    defaults.markSkillActivated?.('runtime-default-hit');
    assert.deepEqual(skillCalls, ['runtime-default-hit']);
    assert.deepEqual(defaults.mcpConnections, [connection]);
    defaults.onConnectionStatusChange?.('runtime-defaults-conn', 'connected', 'boom');
    assert.deepEqual(statusCalls, [['runtime-defaults-conn', 'connected']]);
    assert.deepEqual(errorCalls, [['runtime-defaults-conn', 'boom']]);
  } finally {
    useAgentStore.setState(agentSnapshot);
    useSessionStore.setState(sessionSnapshot);
    useSettingsStore.setState(settingsSnapshot);
    useSkillStore.setState(skillSnapshot);
    useToolStore.setState(toolSnapshot);
  }
});

test('zustandSessionOwnerStore reads existing default-agent sessions from stores', () => {
  const sessionSnapshot = useSessionStore.getState();
  const session = sessionSnapshot.createSession('Adapter Session', 'agent');

  try {
    assert.equal(zustandSessionOwnerStore.getSession(DEFAULT_AGENT_ID, session.id)?.id, session.id);
  } finally {
    useSessionStore.setState(sessionSnapshot);
  }
});

test('registerZustandAIRuntimeAdapters installs the shared zustand-backed defaults', () => {
  registerZustandAIRuntimeAdapters();

  assert.equal(getDefaultAIRuntimeDefaultsResolver(), zustandAIRuntimeDefaultsResolver);
  assert.equal(getDefaultSessionOwnerStore(), zustandSessionOwnerStore);
});
