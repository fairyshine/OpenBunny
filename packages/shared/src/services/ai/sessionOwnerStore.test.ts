import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultSessionOwnerStore,
  resetDefaultSessionOwnerStoreForTests,
  setDefaultSessionOwnerStore,
} from './sessionOwnerStore';
import { zustandSessionOwnerStore } from '../../stores/aiRuntimeAdapters';

test('unconfigured session owner store fails fast', () => {
  resetDefaultSessionOwnerStoreForTests();
  assert.throws(
    () => getDefaultSessionOwnerStore().getSession('agent-1', 'session-1'),
    /AI session owner store is not configured/,
  );
});

test('default session owner store can be overridden and reset', () => {
  const customStore = { ...zustandSessionOwnerStore };
  setDefaultSessionOwnerStore(customStore);
  assert.equal(getDefaultSessionOwnerStore(), customStore);

  resetDefaultSessionOwnerStoreForTests();
  assert.throws(
    () => getDefaultSessionOwnerStore().getSession('agent-1', 'session-1'),
    /AI session owner store is not configured/,
  );
});
