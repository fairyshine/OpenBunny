import test from 'node:test';
import assert from 'node:assert/strict';
import { initializePlatformRuntime, resetPlatformRuntimeForTests } from './bootstrap';
import { getPlatformContext } from './detect';
import type { IPlatformContext } from './types';

function createContext(id: string, type: IPlatformContext['info']['type'] = 'browser'): IPlatformContext {
  return {
    info: {
      type,
      os: 'macos',
      isBrowser: type === 'browser',
      isDesktop: type === 'desktop',
      isMobile: type === 'mobile',
      isCLI: type === 'cli',
      isTUI: type === 'tui',
    },
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    api: {
      fetch: globalThis.fetch,
      createExternalFetch: () => undefined,
    },
    fs: undefined,
    __id: id,
  } as IPlatformContext & { __id: string };
}

test('initializePlatformRuntime is idempotent per key and initializes only once', () => {
  resetPlatformRuntimeForTests();
  let createCalls = 0;
  let initializeCalls = 0;

  const first = initializePlatformRuntime({
    key: 'browser-app',
    createContext: () => {
      createCalls += 1;
      return createContext('first');
    },
    initialize: () => {
      initializeCalls += 1;
    },
  });

  const second = initializePlatformRuntime({
    key: 'browser-app',
    createContext: () => {
      createCalls += 1;
      return createContext('second');
    },
    initialize: () => {
      initializeCalls += 1;
    },
  });

  assert.equal(first, second);
  assert.equal(createCalls, 1);
  assert.equal(initializeCalls, 1);
  assert.equal(getPlatformContext(), first);
});

test('initializePlatformRuntime switches active context across keys and can restore cached keys', () => {
  resetPlatformRuntimeForTests();
  const browser = initializePlatformRuntime({
    key: 'browser-app',
    createContext: () => createContext('browser', 'browser'),
  }) as IPlatformContext & { __id: string };
  const desktop = initializePlatformRuntime({
    key: 'desktop-app',
    createContext: () => createContext('desktop', 'desktop'),
  }) as IPlatformContext & { __id: string };

  assert.equal(getPlatformContext(), desktop);
  assert.equal(browser.__id, 'browser');
  assert.equal(desktop.__id, 'desktop');

  const restoredBrowser = initializePlatformRuntime({
    key: 'browser-app',
    createContext: () => createContext('browser-new', 'browser'),
  }) as IPlatformContext & { __id: string };

  assert.equal(restoredBrowser, browser);
  assert.equal(getPlatformContext(), browser);
});

test('resetPlatformRuntimeForTests clears cached contexts and active platform context', () => {
  resetPlatformRuntimeForTests();
  const first = initializePlatformRuntime({
    key: 'cli-app',
    createContext: () => createContext('cli', 'cli'),
  });

  assert.equal(getPlatformContext(), first);
  resetPlatformRuntimeForTests();
  assert.throws(() => getPlatformContext(), /Platform context not initialized/);

  const second = initializePlatformRuntime({
    key: 'cli-app',
    createContext: () => createContext('cli-new', 'cli'),
  }) as IPlatformContext & { __id: string };

  assert.notEqual(second, first);
  assert.equal(second.__id, 'cli-new');
});
