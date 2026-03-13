import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENT_ID, useAgentStore } from '../../stores/agent';
import { useSessionStore } from '../../stores/session';
import { useSettingsStore } from '../../stores/settings';
import { useSkillStore } from '../../stores/skills';
import { useToolStore, type MCPConnection } from '../../stores/tools';
import {
  resolveAgentRuntimeContext,
  resolveMCPRuntimeContext,
  resolveSessionRuntimeContext,
  resolveSkillRuntimeContext,
} from './runtimeContext';
import { zustandSessionOwnerStore } from './sessionOwnerStore';

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

test('resolveSkillRuntimeContext prefers overrides and falls back to skill store', () => {
  const snapshot = useSkillStore.getState();
  const markCalls: string[] = [];

  useSkillStore.setState({
    skills: [{ name: 'store-skill', description: 'from store', source: 'builtin', body: 'body' }],
    enabledSkillIds: ['store-skill'],
    markActivated: (skillName: string) => { markCalls.push(skillName); },
  });

  try {
    const fromStore = resolveSkillRuntimeContext();
    assert.equal(fromStore.skills[0].name, 'store-skill');
    assert.deepEqual(fromStore.enabledSkillIds, ['store-skill']);
    fromStore.markSkillActivated?.('store-hit');
    assert.deepEqual(markCalls, ['store-hit']);

    const overridden = resolveSkillRuntimeContext({
      skills: [{ name: 'override-skill', description: 'override', source: 'builtin', body: 'body' }],
      enabledSkillIds: ['override-skill'],
      markSkillActivated: (skillName) => { markCalls.push(`override:${skillName}`); },
    });
    assert.equal(overridden.skills[0].name, 'override-skill');
    assert.deepEqual(overridden.enabledSkillIds, ['override-skill']);
    overridden.markSkillActivated?.('hit');
    assert.deepEqual(markCalls, ['store-hit', 'override:hit']);
  } finally {
    useSkillStore.setState(snapshot);
  }
});

test('resolveMCPRuntimeContext exposes store connections and default status callback', () => {
  const snapshot = useToolStore.getState();
  const statusCalls: Array<[string, string]> = [];
  const errorCalls: Array<[string, string | null]> = [];
  const connection = createConnection({ id: 'conn-store' });

  useToolStore.setState({
    mcpConnections: [connection],
    updateMCPStatus: ((id, status) => { statusCalls.push([id, status]); }) as typeof snapshot.updateMCPStatus,
    setMCPError: ((id, error) => { errorCalls.push([id, error]); }) as typeof snapshot.setMCPError,
  });

  try {
    const context = resolveMCPRuntimeContext();
    assert.deepEqual(context.mcpConnections, [connection]);
    context.onConnectionStatusChange?.('conn-store', 'connected', 'boom');
    assert.deepEqual(statusCalls, [['conn-store', 'connected']]);
    assert.deepEqual(errorCalls, [['conn-store', 'boom']]);

    const overrideCalls: Array<[string, string, string | null | undefined]> = [];
    const overridden = resolveMCPRuntimeContext({
      mcpConnections: [createConnection({ id: 'conn-override' })],
      onConnectionStatusChange: (id, status, error) => { overrideCalls.push([id, status, error]); },
    });
    overridden.onConnectionStatusChange?.('conn-override', 'connecting', null);
    assert.deepEqual(overrideCalls, [['conn-override', 'connecting', null]]);
  } finally {
    useToolStore.setState(snapshot);
  }
});

test('resolveSessionRuntimeContext uses injected store or zustand default', () => {
  const context = resolveSessionRuntimeContext();
  assert.equal(context.sessionOwnerStore, zustandSessionOwnerStore);

  const customStore = { ...zustandSessionOwnerStore };
  assert.equal(resolveSessionRuntimeContext({ sessionOwnerStore: customStore }).sessionOwnerStore, customStore);
});

test('resolveAgentRuntimeContext assembles values from stores and respects overrides', () => {
  const agentSnapshot = useAgentStore.getState();
  const sessionSnapshot = useSessionStore.getState();
  const settingsSnapshot = useSettingsStore.getState();
  const skillSnapshot = useSkillStore.getState();
  const toolSnapshot = useToolStore.getState();

  const baseAgent = agentSnapshot.agents.find((agent) => agent.id === DEFAULT_AGENT_ID) ?? agentSnapshot.agents[0];
  const extraAgent = {
    ...baseAgent,
    id: 'agent-2',
    name: 'Agent 2',
    enabledSkills: ['agent-skill'],
    enabledTools: ['python'],
  };
  const customSessionOwnerStore = { ...zustandSessionOwnerStore };
  const customConnection = createConnection({ id: 'conn-agent', status: 'connected' });
  const skillCalls: string[] = [];

  useAgentStore.setState({
    agents: [baseAgent, extraAgent],
    currentAgentId: 'agent-2',
  });
  useSessionStore.setState({
    llmConfig: {
      provider: 'anthropic',
      apiKey: 'store-key',
      model: 'claude-3-5-sonnet',
      temperature: 0.3,
      maxTokens: 2048,
    },
  });
  useSettingsStore.setState({
    enabledTools: ['memory', 'chat'],
    proxyUrl: 'https://proxy.example.com',
    toolExecutionTimeout: 123456,
  });
  useSkillStore.setState({
    skills: [{ name: 'skill-from-store', description: 'store', source: 'builtin', body: 'body' }],
    enabledSkillIds: ['skill-from-store'],
    markActivated: (skillName: string) => { skillCalls.push(skillName); },
  });
  useToolStore.setState({
    mcpConnections: [customConnection],
  });

  try {
    const context = resolveAgentRuntimeContext({ sessionOwnerStore: customSessionOwnerStore });
    assert.equal(context.currentAgentId, 'agent-2');
    assert.deepEqual(context.agents.map((agent) => agent.id), [DEFAULT_AGENT_ID, 'agent-2']);
    assert.equal(context.defaultLLMConfig.model, 'claude-3-5-sonnet');
    assert.deepEqual(context.defaultEnabledToolIds, ['memory', 'chat']);
    assert.deepEqual(context.defaultSkillIds, ['skill-from-store']);
    assert.equal(context.proxyUrl, 'https://proxy.example.com');
    assert.equal(context.toolExecutionTimeout, 123456);
    assert.deepEqual(context.mcpConnections, [customConnection]);
    assert.equal(context.sessionOwnerStore, customSessionOwnerStore);
    context.markSkillActivated?.('store-hit');
    assert.deepEqual(skillCalls, ['store-hit']);

    const override = resolveAgentRuntimeContext({
      currentAgentId: DEFAULT_AGENT_ID,
      agents: [baseAgent],
      defaultLLMConfig: {
        provider: 'openai',
        apiKey: 'override-key',
        model: 'gpt-4o-mini',
        temperature: 0.9,
        maxTokens: 512,
      },
      defaultEnabledToolIds: ['python'],
      defaultSkillIds: ['override-skill'],
      skills: [{ name: 'override-skill', description: 'override', source: 'builtin', body: 'body' }],
      enabledSkillIds: ['override-skill'],
      mcpConnections: [],
      proxyUrl: 'https://override.example.com',
      toolExecutionTimeout: 999,
      sessionOwnerStore: customSessionOwnerStore,
    });
    assert.equal(override.currentAgentId, DEFAULT_AGENT_ID);
    assert.deepEqual(override.agents.map((agent) => agent.id), [DEFAULT_AGENT_ID]);
    assert.equal(override.defaultLLMConfig.model, 'gpt-4o-mini');
    assert.deepEqual(override.defaultEnabledToolIds, ['python']);
    assert.deepEqual(override.defaultSkillIds, ['override-skill']);
    assert.equal(override.proxyUrl, 'https://override.example.com');
    assert.equal(override.toolExecutionTimeout, 999);
    assert.deepEqual(override.enabledSkillIds, ['override-skill']);
    assert.deepEqual(override.mcpConnections, []);
  } finally {
    useAgentStore.setState(agentSnapshot);
    useSessionStore.setState(sessionSnapshot);
    useSettingsStore.setState(settingsSnapshot);
    useSkillStore.setState(skillSnapshot);
    useToolStore.setState(toolSnapshot);
  }
});
