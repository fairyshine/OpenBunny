import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENT_ID } from '../../stores/agent';
import {
  getDefaultAIRuntimeDefaultsResolver,
  resetDefaultAIRuntimeDefaultsResolverForTests,
  setDefaultAIRuntimeDefaultsResolver,
  type AIRuntimeDefaultsResolver,
} from './runtimeDefaults';

test('unconfigured AI runtime defaults resolver fails fast', () => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
  assert.throws(
    () => getDefaultAIRuntimeDefaultsResolver().getDefaults(),
    /AI runtime defaults resolver is not configured/,
  );
});

test('default AI runtime defaults resolver is configurable and resettable', () => {
  resetDefaultAIRuntimeDefaultsResolverForTests();
  assert.throws(
    () => getDefaultAIRuntimeDefaultsResolver().getDefaults(),
    /AI runtime defaults resolver is not configured/,
  );

  const customResolver: AIRuntimeDefaultsResolver = {
    getDefaults: () => ({
      currentAgentId: DEFAULT_AGENT_ID,
      agents: [],
      defaultLLMConfig: {
        provider: 'openai',
        apiKey: 'custom-key',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 1024,
      },
      defaultEnabledToolIds: ['memory'],
      proxyUrl: 'https://custom-runtime.example.com',
      toolExecutionTimeout: 999,
      execLoginShell: true,
      searchProvider: 'exa',
      exaApiKey: 'custom-exa-key',
      braveApiKey: 'custom-brave-key',
      skills: [],
      enabledSkillIds: [],
      markSkillActivated: undefined,
      mcpConnections: [],
      onConnectionStatusChange: undefined,
    }),
  };

  setDefaultAIRuntimeDefaultsResolver(customResolver);
  assert.equal(getDefaultAIRuntimeDefaultsResolver(), customResolver);

  resetDefaultAIRuntimeDefaultsResolverForTests();
  assert.throws(
    () => getDefaultAIRuntimeDefaultsResolver().getDefaults(),
    /AI runtime defaults resolver is not configured/,
  );
});
