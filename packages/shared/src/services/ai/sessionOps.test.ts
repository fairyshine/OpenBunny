import test from 'node:test';
import assert from 'node:assert/strict';
import type { Message, Session } from '../../types';
import { createSessionOps } from './sessionOps';
import type { SessionOwnerStore } from './sessionOwnerStore';

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? 'msg-1',
    role: overrides.role ?? 'user',
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

test('createSessionOps delegates all session owner operations', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const detachedSession = createSession({ id: 'detached' });
  const ownedSession = createSession({ id: 'owned' });

  const store: SessionOwnerStore = {
    async createDetachedSession(...args) {
      calls.push({ method: 'createDetachedSession', args });
      return detachedSession;
    },
    appendMessage(...args) {
      calls.push({ method: 'appendMessage', args });
    },
    updateMessage(...args) {
      calls.push({ method: 'updateMessage', args });
    },
    setStreaming(...args) {
      calls.push({ method: 'setStreaming', args });
    },
    setPrompt(...args) {
      calls.push({ method: 'setPrompt', args });
    },
    setMindMeta(...args) {
      calls.push({ method: 'setMindMeta', args });
    },
    setChatMeta(...args) {
      calls.push({ method: 'setChatMeta', args });
    },
    async flush(...args) {
      calls.push({ method: 'flush', args });
    },
    getSession(...args) {
      calls.push({ method: 'getSession', args });
      return ownedSession;
    },
    deleteSession(...args) {
      calls.push({ method: 'deleteSession', args });
    },
  };

  const ops = createSessionOps(store);
  const message = createMessage({ id: 'm-1' });
  const mindMeta: Session['mindSession'] = { sessionId: 'mind-1', groupId: 'group-1' };
  const chatMeta: Session['chatSession'] = { sessionId: 'chat-1', groupId: 'group-2' };

  assert.equal(await ops.createDetachedSession('agent-1', 'Detached', 'chat', 'project-1'), detachedSession);
  ops.appendSessionMessage('agent-1', 'session-1', message);
  ops.updateSessionMessage('agent-1', 'session-1', 'm-1', { content: 'updated' });
  ops.setSessionStreaming('agent-1', 'session-1', true);
  ops.setSessionPrompt('agent-1', 'session-1', 'system prompt');
  ops.setSessionMindMeta('agent-1', 'session-1', mindMeta);
  ops.setSessionChatMeta('agent-1', 'session-1', chatMeta);
  await ops.flushSession('agent-1', 'session-1');
  assert.equal(ops.getSessionByOwner('agent-1', 'session-1'), ownedSession);
  ops.deleteSessionByOwner('agent-1', 'session-1');

  assert.deepEqual(calls, [
    { method: 'createDetachedSession', args: ['agent-1', 'Detached', 'chat', 'project-1'] },
    { method: 'appendMessage', args: ['agent-1', 'session-1', message] },
    { method: 'updateMessage', args: ['agent-1', 'session-1', 'm-1', { content: 'updated' }] },
    { method: 'setStreaming', args: ['agent-1', 'session-1', true] },
    { method: 'setPrompt', args: ['agent-1', 'session-1', 'system prompt'] },
    { method: 'setMindMeta', args: ['agent-1', 'session-1', mindMeta] },
    { method: 'setChatMeta', args: ['agent-1', 'session-1', chatMeta] },
    { method: 'flush', args: ['agent-1', 'session-1'] },
    { method: 'getSession', args: ['agent-1', 'session-1'] },
    { method: 'deleteSession', args: ['agent-1', 'session-1'] },
  ]);
});
