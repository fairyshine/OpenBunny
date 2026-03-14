import test from 'node:test';
import assert from 'node:assert/strict';
import { initNodePlatform } from './node';
import { resetPlatformRuntimeForTests } from './bootstrap';
import { getPlatform } from './detect';
import { getDefaultAIRuntimeDefaultsResolver, resetDefaultAIRuntimeDefaultsResolverForTests } from '../services/ai/runtimeDefaults';
import { getDefaultSessionOwnerStore, resetDefaultSessionOwnerStoreForTests } from '../services/ai/sessionOwnerStore';

const storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

test.afterEach(() => {
  resetPlatformRuntimeForTests();
  resetDefaultAIRuntimeDefaultsResolverForTests();
  resetDefaultSessionOwnerStoreForTests();
});

test('initNodePlatform initializes node platform context without implicitly wiring AI adapters', () => {
  initNodePlatform(
    { type: 'cli', os: 'linux', isBrowser: false, isDesktop: false, isMobile: false, isCLI: true, isTUI: false },
    storage,
  );

  assert.equal(getPlatform().type, 'cli');
  assert.throws(
    () => getDefaultAIRuntimeDefaultsResolver().getDefaults(),
    /AI runtime defaults resolver is not configured/,
  );
  assert.throws(
    () => getDefaultSessionOwnerStore().getSession('agent-1', 'session-1'),
    /AI session owner store is not configured/,
  );
});
