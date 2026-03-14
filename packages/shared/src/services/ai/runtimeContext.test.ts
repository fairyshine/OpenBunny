import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENT_ID } from '../../stores/agent';
import { type MCPConnection } from '../../stores/tools';
import {
  resetDefaultAIRuntimeDefaultsResolverForTests,
  setDefaultAIRuntimeDefaultsResolver,
  type AIRuntimeDefaultsResolver,
} from './runtimeDefaults';
import {
  findRuntimeAgent,
  resolveAgentRuntimeContext,
  resolveMCPRuntimeContext,
  resolveRuntimeAgents,
  resolveSessionRuntimeContext,
  resolveSkillRuntimeContext,
} from './runtimeContext';
import { resetDefaultSessionOwnerStoreForTests, setDefaultSessionOwnerStore } from './sessionOwnerStore';
import { zustandSessionOwnerStore } from '../../stores/aiRuntimeAdapters';

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

function createRuntimeDefaultsResolver(): AIRuntimeDefaultsResolver {
  const statusCalls: Array<[string, string, string | null | undefined]> = [];
  const skillCalls: string[] = [];
  const connection = createConnection({ id: 'conn-store', status: 'connected' });
  const resolver: AIRuntimeDefaultsResolver = {
    getDefaults: () => ({
      currentAgentId: 'agent-2',
      agents: [{
        id: DEFAULT_AGENT_ID,
        name: 'Default Agent',
        avatar: '🐰',
        systemPrompt: '',
        description: 'default',
        color: '#ffffff',
        llmConfig: undefined,
        enabledTools: [],
        enabledSkills: [],
        createdAt: new Date(0).toISOString(),
        isDefault: true,
      }, {
        id: 'agent-2',
        name: 'Agent 2',
        avatar: '🤖',
        systemPrompt: 'system',
        description: 'agent 2',
        color: '#000000',
        llmConfig: undefined,
        enabledTools: ['python'],
        enabledSkills: ['skill-from-store'],
        createdAt: new Date(1).toISOString(),
        isDefault: false,
      }],
      defaultLLMConfig: {
        provider: 'anthropic',
        apiKey: 'store-key',
        model: 'claude-3-5-sonnet',
        temperature: 0.3,
        maxTokens: 2048,
      },
      defaultEnabledToolIds: ['memory', 'chat'],
      proxyUrl: 'https://proxy.example.com',
      toolExecutionTimeout: 123456,
      execLoginShell: false,
      searchProvider: 'brave',
      exaApiKey: 'store-exa-key',
      braveApiKey: 'store-brave-key',
      skills: [{ name: 'skill-from-store', description: 'store', source: 'builtin', body: 'body' }],
      enabledSkillIds: ['skill-from-store'],
      markSkillActivated: (skillName: string) => { skillCalls.push(skillName); },
      mcpConnections: [connection],
      onConnectionStatusChange: (id, status, error) => { statusCalls.push([id, status, error]); },
    }),
  };
  return Object.assign(resolver, { statusCalls, skillCalls, connection });
}

test.afterEach(() => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
  resetDefaultSessionOwnerStoreForTests();
});

test('resolveSkillRuntimeContext prefers overrides and falls back to injected defaults resolver', () => {
  const resolver = createRuntimeDefaultsResolver();
  setDefaultAIRuntimeDefaultsResolver(resolver);

  const fromDefaults = resolveSkillRuntimeContext();
  assert.equal(fromDefaults.skills[0].name, 'skill-from-store');
  assert.deepEqual(fromDefaults.enabledSkillIds, ['skill-from-store']);
  fromDefaults.markSkillActivated?.('store-hit');
  assert.deepEqual((resolver as typeof resolver & { skillCalls: string[] }).skillCalls, ['store-hit']);

  const overridden = resolveSkillRuntimeContext({
    skills: [{ name: 'override-skill', description: 'override', source: 'builtin', body: 'body' }],
    enabledSkillIds: ['override-skill'],
    markSkillActivated: (skillName) => {
      (resolver as typeof resolver & { skillCalls: string[] }).skillCalls.push(`override:${skillName}`);
    },
  });
  assert.equal(overridden.skills[0].name, 'override-skill');
  assert.deepEqual(overridden.enabledSkillIds, ['override-skill']);
  overridden.markSkillActivated?.('hit');
  assert.deepEqual((resolver as typeof resolver & { skillCalls: string[] }).skillCalls, ['store-hit', 'override:hit']);
});

test('resolveMCPRuntimeContext exposes injected defaults and status callback', () => {
  const resolver = createRuntimeDefaultsResolver();
  setDefaultAIRuntimeDefaultsResolver(resolver);

  const context = resolveMCPRuntimeContext();
  assert.deepEqual(context.mcpConnections, [(resolver as typeof resolver & { connection: MCPConnection }).connection]);
  context.onConnectionStatusChange?.('conn-store', 'connected', 'boom');
  assert.deepEqual((resolver as typeof resolver & { statusCalls: Array<[string, string, string | null | undefined]> }).statusCalls, [['conn-store', 'connected', 'boom']]);

  const overrideCalls: Array<[string, string, string | null | undefined]> = [];
  const overridden = resolveMCPRuntimeContext({
    mcpConnections: [createConnection({ id: 'conn-override' })],
    onConnectionStatusChange: (id, status, error) => { overrideCalls.push([id, status, error]); },
  });
  overridden.onConnectionStatusChange?.('conn-override', 'connecting', null);
  assert.deepEqual(overrideCalls, [['conn-override', 'connecting', null]]);
});

test('resolveSessionRuntimeContext uses injected store or registered default', () => {
  const customStore = { ...zustandSessionOwnerStore };
  assert.equal(resolveSessionRuntimeContext({ sessionOwnerStore: customStore }).sessionOwnerStore, customStore);
});

test('resolveSessionRuntimeContext returns the registered default session owner store', () => {
  const customStore = { ...zustandSessionOwnerStore };
  setDefaultSessionOwnerStore(customStore);
  assert.equal(resolveSessionRuntimeContext().sessionOwnerStore, customStore);
});

test('resolveRuntimeAgents and findRuntimeAgent prefer overrides and fall back to injected defaults', () => {
  const resolver = createRuntimeDefaultsResolver();
  setDefaultAIRuntimeDefaultsResolver(resolver);

  const defaultAgents = resolveRuntimeAgents();
  assert.deepEqual(defaultAgents.map((agent) => agent.id), [DEFAULT_AGENT_ID, 'agent-2']);
  assert.equal(findRuntimeAgent('agent-2')?.name, 'Agent 2');
  assert.equal(findRuntimeAgent('missing'), null);

  const overrideAgents = [{
    id: 'agent-override',
    name: 'Override',
    avatar: '🛠',
    systemPrompt: '',
    description: 'override',
    color: '#123456',
    llmConfig: undefined,
    enabledTools: [],
    enabledSkills: [],
    createdAt: new Date(2).toISOString(),
    isDefault: false,
  }];
  assert.deepEqual(resolveRuntimeAgents({ agents: overrideAgents }), overrideAgents);
  assert.equal(findRuntimeAgent('agent-override', { agents: overrideAgents })?.name, 'Override');
});

test('resolveAgentRuntimeContext assembles values from injected defaults and respects overrides', () => {
  const resolver = createRuntimeDefaultsResolver();
  setDefaultAIRuntimeDefaultsResolver(resolver);
  const customSessionOwnerStore = { ...zustandSessionOwnerStore };

  const context = resolveAgentRuntimeContext({ sessionOwnerStore: customSessionOwnerStore });
  assert.equal(context.currentAgentId, 'agent-2');
  assert.deepEqual(context.agents.map((agent) => agent.id), [DEFAULT_AGENT_ID, 'agent-2']);
  assert.equal(context.defaultLLMConfig.model, 'claude-3-5-sonnet');
  assert.deepEqual(context.defaultEnabledToolIds, ['memory', 'chat']);
  assert.deepEqual(context.defaultSkillIds, ['skill-from-store']);
  assert.equal(context.proxyUrl, 'https://proxy.example.com');
  assert.equal(context.toolExecutionTimeout, 123456);
  assert.equal(context.execLoginShell, false);
  assert.equal(context.searchProvider, 'brave');
  assert.equal(context.exaApiKey, 'store-exa-key');
  assert.equal(context.braveApiKey, 'store-brave-key');
  assert.deepEqual(context.mcpConnections, [(resolver as typeof resolver & { connection: MCPConnection }).connection]);
  assert.equal(context.sessionOwnerStore, customSessionOwnerStore);
  context.markSkillActivated?.('store-hit');
  assert.deepEqual((resolver as typeof resolver & { skillCalls: string[] }).skillCalls, ['store-hit']);

  const override = resolveAgentRuntimeContext({
    currentAgentId: DEFAULT_AGENT_ID,
    agents: [context.agents[0]],
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
    execLoginShell: true,
    searchProvider: 'exa',
    exaApiKey: 'override-exa-key',
    braveApiKey: 'override-brave-key',
    sessionOwnerStore: customSessionOwnerStore,
  });
  assert.equal(override.currentAgentId, DEFAULT_AGENT_ID);
  assert.deepEqual(override.agents.map((agent) => agent.id), [DEFAULT_AGENT_ID]);
  assert.equal(override.defaultLLMConfig.model, 'gpt-4o-mini');
  assert.deepEqual(override.defaultEnabledToolIds, ['python']);
  assert.deepEqual(override.defaultSkillIds, ['override-skill']);
  assert.equal(override.proxyUrl, 'https://override.example.com');
  assert.equal(override.toolExecutionTimeout, 999);
  assert.equal(override.execLoginShell, true);
  assert.equal(override.searchProvider, 'exa');
  assert.equal(override.exaApiKey, 'override-exa-key');
  assert.equal(override.braveApiKey, 'override-brave-key');
  assert.deepEqual(override.enabledSkillIds, ['override-skill']);
  assert.deepEqual(override.mcpConnections, []);
});
