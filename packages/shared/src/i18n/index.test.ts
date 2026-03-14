import test from 'node:test';
import assert from 'node:assert/strict';
import i18n, { initializeSharedI18n, readPersistedLanguage, resolveSupportedLanguage } from './index';

test('readPersistedLanguage returns explicit saved language and ignores system/default cases', () => {
  assert.equal(readPersistedLanguage(null), null);
  assert.equal(readPersistedLanguage(''), null);
  assert.equal(readPersistedLanguage(JSON.stringify({ state: { language: 'system' } })), null);
  assert.equal(readPersistedLanguage(JSON.stringify({ state: { language: 'zh-CN' } })), 'zh-CN');
  assert.equal(readPersistedLanguage(JSON.stringify({ state: { language: 'en-US' } })), 'en-US');
  assert.equal(readPersistedLanguage('{invalid-json'), null);
});

test('resolveSupportedLanguage normalizes locale variants onto supported languages', () => {
  assert.equal(resolveSupportedLanguage('zh'), 'zh-CN');
  assert.equal(resolveSupportedLanguage('zh-Hans-CN'), 'zh-CN');
  assert.equal(resolveSupportedLanguage('en'), 'en-US');
  assert.equal(resolveSupportedLanguage('en-GB'), 'en-US');
  assert.equal(resolveSupportedLanguage(undefined), 'en-US');
});

test('initializeSharedI18n is idempotent and keeps the first resolved language', async () => {
  const first = initializeSharedI18n({ initialLanguage: 'en-GB' });
  const second = initializeSharedI18n({ initialLanguage: 'zh-CN' });

  assert.equal(first, second);
  await first;
  assert.equal(i18n.language, 'en-US');
});
