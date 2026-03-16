import test from 'node:test';
import assert from 'node:assert/strict';
import { useSessionStore } from '../stores/session';
import type { Message, Session } from '../types';
import { getHelpInfo, resumeSession } from './commands';

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
    messages: overrides.messages ?? [],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    deletedAt: overrides.deletedAt,
    isStreaming: overrides.isStreaming,
    interruptedAt: overrides.interruptedAt,
    systemPrompt: overrides.systemPrompt,
    sessionType: overrides.sessionType,
    projectId: overrides.projectId,
    sessionTools: overrides.sessionTools,
    sessionSkills: overrides.sessionSkills,
    mindSession: overrides.mindSession,
    chatSession: overrides.chatSession,
  };
}

test('resumeSession falls back to the stored system prompt when no override is provided', async () => {
  const snapshot = useSessionStore.getState();
  const session = createSession({
    id: 'stored-session-1',
    name: 'Stored Session',
    systemPrompt: 'remember this prompt',
    messages: [
      createMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      createMessage({ id: 'assistant-1', role: 'assistant', content: 'hi' }),
    ],
  });

  useSessionStore.setState({
    ...snapshot,
    sessions: [session],
    currentSessionId: null,
    openSessionIds: [],
    sessionStats: { sessionCount: 1, totalMessages: 2, totalTokens: 0 },
  });

  try {
    const result = await resumeSession('stored-session');
    assert.ok(!('error' in result));
    assert.deepEqual(result.history, [
      { role: 'system', content: 'remember this prompt' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
    assert.deepEqual(result.displayMessages, [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
  } finally {
    useSessionStore.setState(snapshot);
  }
});

test('getHelpInfo includes TUI workspace and scope commands', () => {
  const help = getHelpInfo({
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
  });

  const commandNames = help.commands.map((command) => command.name);
  assert.ok(commandNames.includes('/scope [mode]'));
  assert.ok(commandNames.includes('/files'));
  assert.ok(commandNames.includes('/open <path>'));
  assert.ok(commandNames.includes('/write <p> <txt>'));
});
