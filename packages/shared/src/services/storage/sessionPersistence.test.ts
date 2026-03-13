import test from 'node:test';
import assert from 'node:assert/strict';
import type { Message, Session } from '../../types';
import {
  clearStreamingMessageFlags,
  markStreamingSessionsInterruptedState,
  mergePersistedSessionMessages,
} from '../../stores/sessionStateHelpers';
import {
  clearAllSessionPersistence,
  deleteSessionPersistence,
  deleteSessionPersistenceBatch,
  flushAllSessionPersistence,
  flushSessionPersistence,
  persistSessionMessages,
} from './sessionPersistence';
import { messageStorage } from './messageStorage';
import { statsStorage } from './statsStorage';

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? 'msg-1',
    role: overrides.role ?? 'assistant',
    content: overrides.content ?? 'hello',
    timestamp: overrides.timestamp ?? 1,
    metadata: overrides.metadata,
    type: overrides.type,
    toolName: overrides.toolName,
    toolInput: overrides.toolInput,
    toolOutput: overrides.toolOutput,
    toolCallId: overrides.toolCallId,
    groupId: overrides.groupId,
    parentId: overrides.parentId,
    presentation: overrides.presentation,
  };
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? 'session-1',
    name: overrides.name ?? 'Session 1',
    type: overrides.type ?? 'chat',
    projectId: overrides.projectId,
    agentId: overrides.agentId,
    messages: overrides.messages ?? [],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    deletedAt: overrides.deletedAt,
    isStreaming: overrides.isStreaming,
    systemPrompt: overrides.systemPrompt,
    mindSession: overrides.mindSession,
    chatSession: overrides.chatSession,
    interruptedAt: overrides.interruptedAt,
  };
}

test('sessionPersistence forwards message and stats operations correctly', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const originalMessage = {
    save: messageStorage.save.bind(messageStorage),
    flush: messageStorage.flush.bind(messageStorage),
    flushAll: messageStorage.flushAll.bind(messageStorage),
    delete: messageStorage.delete.bind(messageStorage),
    clear: messageStorage.clear.bind(messageStorage),
  };
  const originalStats = {
    deleteSession: statsStorage.deleteSession.bind(statsStorage),
    clear: statsStorage.clear.bind(statsStorage),
  };

  messageStorage.save = ((...args: unknown[]) => {
    calls.push({ method: 'save', args });
  }) as typeof messageStorage.save;
  messageStorage.flush = (async (...args: unknown[]) => {
    calls.push({ method: 'flush', args });
  }) as typeof messageStorage.flush;
  messageStorage.flushAll = (async (...args: unknown[]) => {
    calls.push({ method: 'flushAll', args });
  }) as typeof messageStorage.flushAll;
  messageStorage.delete = (async (...args: unknown[]) => {
    calls.push({ method: 'delete', args });
  }) as typeof messageStorage.delete;
  messageStorage.clear = (async (...args: unknown[]) => {
    calls.push({ method: 'clear', args });
  }) as typeof messageStorage.clear;
  statsStorage.deleteSession = (async (...args: unknown[]) => {
    calls.push({ method: 'deleteStats', args });
  }) as typeof statsStorage.deleteSession;
  statsStorage.clear = (async (...args: unknown[]) => {
    calls.push({ method: 'clearStats', args });
  }) as typeof statsStorage.clear;

  try {
    const messages = [createMessage({ id: 'm-1' })];
    persistSessionMessages('session-1', messages);
    await flushSessionPersistence('session-1');
    await flushAllSessionPersistence();
    await deleteSessionPersistence('session-1', { includeStats: true });
    await deleteSessionPersistenceBatch(['session-2', 'session-3'], { includeStats: true });
    await clearAllSessionPersistence({ includeStats: true });
  } finally {
    messageStorage.save = originalMessage.save;
    messageStorage.flush = originalMessage.flush;
    messageStorage.flushAll = originalMessage.flushAll;
    messageStorage.delete = originalMessage.delete;
    messageStorage.clear = originalMessage.clear;
    statsStorage.deleteSession = originalStats.deleteSession;
    statsStorage.clear = originalStats.clear;
  }

  assert.deepEqual(calls, [
    { method: 'save', args: ['session-1', [createMessage({ id: 'm-1' })]] },
    { method: 'flush', args: ['session-1'] },
    { method: 'flushAll', args: [] },
    { method: 'delete', args: ['session-1'] },
    { method: 'deleteStats', args: ['session-1'] },
    { method: 'delete', args: ['session-2'] },
    { method: 'delete', args: ['session-3'] },
    { method: 'deleteStats', args: ['session-2'] },
    { method: 'deleteStats', args: ['session-3'] },
    { method: 'clear', args: [] },
    { method: 'clearStats', args: [] },
  ]);
});

test('mergePersistedSessionMessages only fills empty in-memory sessions', () => {
  const persistedMessages = [createMessage({ id: 'persisted' })];
  const sessions = [
    createSession({ id: 'empty', messages: [] }),
    createSession({ id: 'already-loaded', messages: [createMessage({ id: 'local' })] }),
  ];

  const merged = mergePersistedSessionMessages(sessions, [
    { id: 'empty', messages: persistedMessages },
    { id: 'already-loaded', messages: [createMessage({ id: 'ignored' })] },
  ]);

  assert.deepEqual(merged[0].messages, persistedMessages);
  assert.deepEqual(merged[1].messages, [createMessage({ id: 'local' })]);
});

test('markStreamingSessionsInterruptedState clears streaming flags and persists only changed sessions', () => {
  const persisted: Array<{ sessionId: string; messages: Message[] }> = [];
  const sessions = [
    createSession({
      id: 'streaming',
      isStreaming: true,
      messages: [createMessage({ id: 'streaming-msg', metadata: { streaming: true, tokens: 5 } })],
    }),
    createSession({
      id: 'idle',
      isStreaming: false,
      messages: [createMessage({ id: 'idle-msg' })],
    }),
  ];

  const result = markStreamingSessionsInterruptedState(
    sessions,
    (sessionId, messages) => persisted.push({ sessionId, messages }),
    12345,
  );

  assert.equal(result.changed, true);
  assert.equal(result.sessions[0].isStreaming, false);
  assert.equal(result.sessions[0].interruptedAt, 12345);
  assert.equal(result.sessions[0].updatedAt, 12345);
  assert.equal(result.sessions[0].messages[0].metadata?.streaming, false);
  assert.deepEqual(persisted, [{ sessionId: 'streaming', messages: result.sessions[0].messages }]);
  assert.equal(result.sessions[1], sessions[1]);
});

test('clearStreamingMessageFlags normalizes non-streaming messages while preserving content', () => {
  const messages = [
    createMessage({ id: 'streaming', metadata: { streaming: true } }),
    createMessage({ id: 'plain', metadata: { tokens: 3 } }),
  ];

  const cleared = clearStreamingMessageFlags(messages);
  assert.equal(cleared[0].metadata?.streaming, false);
  assert.equal(cleared[1].content, 'hello');
  assert.equal(cleared[1].metadata?.tokens, 3);
});
