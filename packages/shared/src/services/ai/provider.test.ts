import test from 'node:test';
import assert from 'node:assert/strict';
import type { IPlatformContext } from '../../platform';
import type { LLMConfig } from '../../types';
import { createModel, createProvider, testConnection, type ProviderDependencies } from './provider';
import { getProviderMeta } from './providers';

function createConfig(overrides: Partial<LLMConfig> = {}): LLMConfig {
  return {
    provider: overrides.provider ?? 'openai',
    apiKey: overrides.apiKey ?? 'test-key',
    model: overrides.model ?? 'test-model',
    baseUrl: overrides.baseUrl,
    temperature: overrides.temperature ?? 0.7,
    maxTokens: overrides.maxTokens ?? 1024,
  };
}

function createDependencies(overrides: Partial<ProviderDependencies> = {}): ProviderDependencies {
  return {
    createOpenAI: overrides.createOpenAI ?? (((options: Record<string, unknown>) => {
      const provider = ((model: string) => ({ sdk: 'openai', model, options })) as ((model: string) => unknown) & { chat?: (model: string) => unknown };
      provider.chat = (model: string) => ({ sdk: 'openai-compatible', model, options });
      return provider as ReturnType<ProviderDependencies['createOpenAI']>;
    }) as ProviderDependencies['createOpenAI']),
    createAnthropic: overrides.createAnthropic ?? (((options: Record<string, unknown>) => {
      return ((model: string) => ({ sdk: 'anthropic', model, options })) as ReturnType<ProviderDependencies['createAnthropic']>;
    }) as ProviderDependencies['createAnthropic']),
    createGoogleGenerativeAI: overrides.createGoogleGenerativeAI ?? (((options: Record<string, unknown>) => {
      return ((model: string) => ({ sdk: 'google', model, options })) as ReturnType<ProviderDependencies['createGoogleGenerativeAI']>;
    }) as ProviderDependencies['createGoogleGenerativeAI']),
    generateText: overrides.generateText ?? (async () => ({ text: 'ok' }) as Awaited<ReturnType<ProviderDependencies['generateText']>>),
    getPlatformContext: overrides.getPlatformContext ?? (() => {
      throw new Error('Platform context not initialized');
    }),
    getProviderMeta: overrides.getProviderMeta ?? getProviderMeta,
  };
}

function createPlatformContext(createExternalFetch?: IPlatformContext['api']['createExternalFetch']): IPlatformContext {
  return {
    info: { type: 'browser', os: 'macos', isBrowser: true, isDesktop: false, isMobile: false },
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    api: {
      fetch: globalThis.fetch,
      createExternalFetch,
    },
  };
}

test('createProvider passes platform external fetch and base URL to OpenAI provider', () => {
  const fetchCalls: unknown[] = [];
  let receivedOptions: Record<string, unknown> | undefined;
  const customFetch = async () => new Response(null, { status: 204 });

  const deps = createDependencies({
    getPlatformContext: () => createPlatformContext((options) => {
      fetchCalls.push(options);
      return customFetch;
    }),
    createOpenAI: ((options: Record<string, unknown>) => {
      receivedOptions = options;
      return ((model: string) => ({ sdk: 'openai', model, options })) as ReturnType<ProviderDependencies['createOpenAI']>;
    }) as ProviderDependencies['createOpenAI'],
  });

  const provider = createProvider(createConfig({
    provider: 'openai',
    model: 'gpt-5-mini',
    baseUrl: 'https://api.example.com/v1',
  }), 'https://proxy.example.com', deps);

  assert.equal(typeof provider, 'function');
  assert.deepEqual(fetchCalls, [{ service: 'llm-provider', proxyUrl: 'https://proxy.example.com' }]);
  assert.equal(receivedOptions?.apiKey, 'test-key');
  assert.equal(receivedOptions?.baseURL, 'https://api.example.com/v1');
  assert.equal(receivedOptions?.fetch, customFetch);
});

test('createProvider ignores platform fetch failures and selects anthropic/google branches', () => {
  const seen: Array<{ sdk: string; options: Record<string, unknown> }> = [];
  const deps = createDependencies({
    getPlatformContext: () => {
      throw new Error('not initialized');
    },
    createAnthropic: ((options: Record<string, unknown>) => {
      seen.push({ sdk: 'anthropic', options });
      return ((model: string) => ({ sdk: 'anthropic', model, options })) as ReturnType<ProviderDependencies['createAnthropic']>;
    }) as ProviderDependencies['createAnthropic'],
    createGoogleGenerativeAI: ((options: Record<string, unknown>) => {
      seen.push({ sdk: 'google', options });
      return ((model: string) => ({ sdk: 'google', model, options })) as ReturnType<ProviderDependencies['createGoogleGenerativeAI']>;
    }) as ProviderDependencies['createGoogleGenerativeAI'],
  });

  createProvider(createConfig({ provider: 'anthropic', baseUrl: 'https://anthropic.example.com' }), undefined, deps);
  createProvider(createConfig({ provider: 'google', baseUrl: 'https://google.example.com' }), undefined, deps);

  assert.deepEqual(seen, [
    {
      sdk: 'anthropic',
      options: { apiKey: 'test-key', baseURL: 'https://anthropic.example.com' },
    },
    {
      sdk: 'google',
      options: { apiKey: 'test-key', baseURL: 'https://google.example.com' },
    },
  ]);
});

test('createModel uses chat() for openai-compatible providers and direct invoke for native providers', () => {
  const deps = createDependencies({
    getPlatformContext: () => createPlatformContext(),
  });

  assert.deepEqual(createModel(createConfig({ provider: 'lmstudio', model: 'local-model' }), undefined, deps), {
    sdk: 'openai-compatible',
    model: 'local-model',
    options: { apiKey: 'test-key', baseURL: 'http://127.0.0.1:1234/v1' },
  });
  assert.deepEqual(createModel(createConfig({ provider: 'openai', model: 'gpt-5' }), undefined, deps), {
    sdk: 'openai',
    model: 'gpt-5',
    options: { apiKey: 'test-key', baseURL: undefined },
  });
  assert.throws(() => createModel(createConfig({ model: '   ' }), undefined, deps), /Model name is required/);
});

test('testConnection calls generateText with the created model and fixed probe prompt', async () => {
  const generateCalls: Array<Record<string, unknown>> = [];
  const deps = createDependencies({
    getPlatformContext: () => createPlatformContext(),
    generateText: (async (options: Record<string, unknown>) => {
      generateCalls.push(options);
      return { text: 'ok' } as Awaited<ReturnType<ProviderDependencies['generateText']>>;
    }) as ProviderDependencies['generateText'],
  });

  const result = await testConnection(createConfig({ provider: 'openai', model: 'gpt-5-nano' }), undefined, deps);

  assert.equal(result, 'ok');
  assert.equal(generateCalls.length, 1);
  assert.deepEqual(generateCalls[0], {
    model: {
      sdk: 'openai',
      model: 'gpt-5-nano',
      options: { apiKey: 'test-key', baseURL: undefined },
    },
    messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
    maxOutputTokens: 10,
  });
});
