import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENT_ID } from '../../stores/agent';
import {
  resetDefaultAIRuntimeDefaultsResolverForTests,
  setDefaultAIRuntimeDefaultsResolver,
  type AIRuntimeDefaultsResolver,
} from './runtimeDefaults';
import { buildAgentAssistantSystemPrompt } from './prompts';

const runtimeDefaultsResolver: AIRuntimeDefaultsResolver = {
  getDefaults: () => ({
    currentAgentId: DEFAULT_AGENT_ID,
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
      name: 'Architect',
      avatar: '🧱',
      systemPrompt: 'Keep the package boundaries strict.',
      description: 'architecture',
      color: '#000000',
      llmConfig: undefined,
      enabledTools: [],
      enabledSkills: [],
      createdAt: new Date(1).toISOString(),
      isDefault: false,
    }],
    defaultLLMConfig: {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 512,
    },
    defaultEnabledToolIds: [],
    skills: [],
    enabledSkillIds: [],
    mcpConnections: [],
  }),
};

test.afterEach(() => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
});

test('buildAgentAssistantSystemPrompt resolves agent persona from injected runtime defaults', () => {
  setDefaultAIRuntimeDefaultsResolver(runtimeDefaultsResolver);

  const prompt = buildAgentAssistantSystemPrompt('agent-2');
  assert.match(prompt, /## Agent Persona/);
  assert.match(prompt, /Keep the package boundaries strict\./);
});

test('buildAgentAssistantSystemPrompt respects explicit runtime agent overrides', () => {
  setDefaultAIRuntimeDefaultsResolver({
    getDefaults: () => ({
      currentAgentId: DEFAULT_AGENT_ID,
      agents: [],
      defaultLLMConfig: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 512,
      },
      defaultEnabledToolIds: [],
      skills: [],
      enabledSkillIds: [],
      mcpConnections: [],
    }),
  });

  const prompt = buildAgentAssistantSystemPrompt('agent-override', undefined, {
    agents: [{
      id: 'agent-override',
      name: 'Override Agent',
      avatar: '🛠',
      systemPrompt: 'Use the override runtime context.',
      description: 'override',
      color: '#333333',
      llmConfig: undefined,
      enabledTools: [],
      enabledSkills: [],
      createdAt: new Date(2).toISOString(),
      isDefault: false,
    }],
  });

  assert.match(prompt, /Use the override runtime context\./);
});
