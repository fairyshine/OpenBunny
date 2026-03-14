import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENT_ID } from '../../stores/agent';
import {
  resetDefaultAIRuntimeDefaultsResolverForTests,
  setDefaultAIRuntimeDefaultsResolver,
  type AIRuntimeDefaultsResolver,
} from './runtimeDefaults';
import { runChatConversation } from './chat';

test.afterEach(() => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
});

test('runChatConversation resolves source and target agents from runtime context before validation', async () => {
  const runtimeDefaultsResolver: AIRuntimeDefaultsResolver = {
    getDefaults: () => ({
      currentAgentId: DEFAULT_AGENT_ID,
      agents: [{
        id: DEFAULT_AGENT_ID,
        name: 'Operator',
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
        id: 'agent-specialist',
        name: 'Specialist',
        avatar: '🧠',
        systemPrompt: '',
        description: 'specialist',
        color: '#111111',
        llmConfig: {
          provider: 'openai',
          apiKey: 'target-key',
          model: 'gpt-4o-mini',
        },
        enabledTools: [],
        enabledSkills: [],
        createdAt: new Date(1).toISOString(),
        isDefault: false,
      }],
      defaultLLMConfig: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      defaultEnabledToolIds: [],
      skills: [],
      enabledSkillIds: [],
      mcpConnections: [],
    }),
  };
  setDefaultAIRuntimeDefaultsResolver(runtimeDefaultsResolver);

  await assert.rejects(
    runChatConversation('Specialist', 'Review the roadmap', {
      sourceSessionId: 'source-session',
      llmConfig: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
      enabledToolIds: [],
      currentAgentId: DEFAULT_AGENT_ID,
      runtimeContext: {
        currentAgentId: DEFAULT_AGENT_ID,
        agents: runtimeDefaultsResolver.getDefaults().agents,
      },
    }),
    /Agent "Operator" is missing an API key\./,
  );
});
