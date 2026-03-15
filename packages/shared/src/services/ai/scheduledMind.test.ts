import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDefaultAIRuntimeDefaultsResolverForTests, setDefaultAIRuntimeDefaultsResolver } from './runtimeDefaults';
import {
  buildCronMindInput,
  buildHeartbeatMindInput,
  resolveScheduledMindExecutionContext,
  resetScheduledMindBridgeForTests,
} from './scheduledMind';

const defaultLLMConfig = {
  provider: 'openai',
  apiKey: 'default-key',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 1024,
};

const agentLLMConfig = {
  provider: 'openai',
  apiKey: 'agent-key',
  model: 'gpt-4.1',
  temperature: 0.4,
  maxTokens: 2048,
};

const defaultAgent = {
  id: 'default',
  name: 'OpenBunny',
  avatar: 'B',
  description: '',
  systemPrompt: '',
  color: '#000000',
  isDefault: true,
  llmConfig: defaultLLMConfig,
  enabledTools: ['python', 'mind'],
  enabledSkills: ['default-agent-skill'],
  filesRoot: '/root',
  createdAt: 1,
  updatedAt: 1,
};

const workerAgent = {
  ...defaultAgent,
  id: 'agent-1',
  name: 'Worker',
  isDefault: false,
  llmConfig: agentLLMConfig,
  enabledTools: ['web_search', 'cron', 'heartbeat', 'mind', 'memory'],
  enabledSkills: ['agent-skill'],
};

test.afterEach(() => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
  resetScheduledMindBridgeForTests();
});

test('resolveScheduledMindExecutionContext uses default runtime defaults when no task snapshot exists', () => {
  setDefaultAIRuntimeDefaultsResolver({
    getDefaults() {
      return {
        currentAgentId: 'default',
        agents: [defaultAgent, workerAgent],
        defaultLLMConfig,
        defaultEnabledToolIds: ['python', 'mind', 'cron', 'heartbeat'],
        proxyUrl: 'https://proxy.example.com',
        toolExecutionTimeout: 1234,
        execLoginShell: false,
        searchProvider: 'exa',
        exaApiKey: 'exa-key',
        braveApiKey: '',
        skills: [],
        enabledSkillIds: ['default-runtime-skill'],
        markSkillActivated: undefined,
        mcpConnections: [],
        onConnectionStatusChange: undefined,
      };
    },
  });

  const context = resolveScheduledMindExecutionContext({
    sourceSessionId: 'session-1',
    projectId: 'project-1',
  });

  assert.ok(context);
  assert.equal(context.currentAgentId, 'default');
  assert.equal(context.llmConfig.model, 'gpt-4o-mini');
  assert.deepEqual(context.enabledToolIds, ['python', 'mind']);
  assert.deepEqual(context.sessionSkillIds, ['default-runtime-skill']);
  assert.equal(context.sourceSessionId, 'session-1');
  assert.equal(context.projectId, 'project-1');
  assert.equal(context.runtimeContext.currentAgentId, 'default');
});

test('resolveScheduledMindExecutionContext prefers the scheduled agent snapshot and filters recursive tools', () => {
  setDefaultAIRuntimeDefaultsResolver({
    getDefaults() {
      return {
        currentAgentId: 'default',
        agents: [defaultAgent, workerAgent],
        defaultLLMConfig,
        defaultEnabledToolIds: ['python', 'mind'],
        proxyUrl: '',
        toolExecutionTimeout: 300000,
        execLoginShell: true,
        searchProvider: 'exa_free',
        exaApiKey: '',
        braveApiKey: '',
        skills: [],
        enabledSkillIds: ['default-runtime-skill'],
        markSkillActivated: undefined,
        mcpConnections: [],
        onConnectionStatusChange: undefined,
      };
    },
  });

  const context = resolveScheduledMindExecutionContext({
    sourceSessionId: 'session-2',
    currentAgentId: 'agent-1',
    enabledToolIds: ['memory', 'heartbeat', 'cron', 'mind', 'web_search'],
    sessionSkillIds: ['scheduled-skill'],
  });

  assert.ok(context);
  assert.equal(context.currentAgentId, 'agent-1');
  assert.equal(context.llmConfig.model, 'gpt-4.1');
  assert.deepEqual(context.enabledToolIds, ['memory', 'mind', 'web_search']);
  assert.deepEqual(context.sessionSkillIds, ['scheduled-skill']);
  assert.equal(context.runtimeContext.currentAgentId, 'agent-1');
});

test('resolveScheduledMindExecutionContext returns null when no runnable llm config exists', () => {
  setDefaultAIRuntimeDefaultsResolver({
    getDefaults() {
      return {
        currentAgentId: 'default',
        agents: [{ ...defaultAgent, llmConfig: { ...defaultLLMConfig, apiKey: '' } }],
        defaultLLMConfig: { ...defaultLLMConfig, apiKey: '' },
        defaultEnabledToolIds: ['python'],
        proxyUrl: '',
        toolExecutionTimeout: 300000,
        execLoginShell: true,
        searchProvider: 'exa_free',
        exaApiKey: '',
        braveApiKey: '',
        skills: [],
        enabledSkillIds: [],
        markSkillActivated: undefined,
        mcpConnections: [],
        onConnectionStatusChange: undefined,
      };
    },
  });

  assert.equal(resolveScheduledMindExecutionContext(), null);
});

test('buildCronMindInput returns only the job description', () => {
  const cronPrompt = buildCronMindInput({
    id: 'cron-1',
    expression: '*/5 * * * *',
    description: 'Check deployment status',
    createdAt: 1,
    nextRun: 2,
    lastRun: 3,
    runCount: 4,
  });

  assert.equal(cronPrompt, 'Check deployment status');
});

test('buildHeartbeatMindInput returns the single item text', () => {
  const heartbeatPrompt = buildHeartbeatMindInput({
    id: 'heartbeat-1',
    text: 'Review error budget',
    createdAt: Date.UTC(2026, 0, 1, 8, 0, 0),
  });

  assert.equal(heartbeatPrompt, 'Review error budget');
});
