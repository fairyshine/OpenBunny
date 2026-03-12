import test from 'node:test';
import assert from 'node:assert/strict';
import type { Message } from '../types';
import {
  deriveMessagePresentation,
  getMessageDisplayType,
  getMessageSearchTexts,
  getMessageToolName,
  mergeMessageWithPresentation,
} from './messagePresentation';
import { MessageHistoryManager } from './messageHistory';

function createRawMessage(message: Partial<Message> & Pick<Message, 'role' | 'content'>): Message {
  return {
    id: message.id || 'msg-1',
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || 1,
    type: message.type,
    toolName: message.toolName,
    toolInput: message.toolInput,
    toolOutput: message.toolOutput,
    toolCallId: message.toolCallId,
    groupId: message.groupId,
    parentId: message.parentId,
    metadata: message.metadata,
    presentation: message.presentation,
  };
}

test('deriveMessagePresentation parses activate_skill tool calls', () => {
  const message = createRawMessage({
    role: 'assistant',
    content: 'Calling tool: activate_skill',
    type: 'tool_call',
    toolName: 'activate_skill',
    toolInput: JSON.stringify({ name: 'slides', resource_path: 'templates/intro.md' }),
    metadata: { streaming: true, skillDescription: 'Build slides' },
  });

  const presentation = deriveMessagePresentation(message);
  assert.equal(presentation.kind, 'skill_activation');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation' }>).skillName, 'slides');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation' }>).resourcePath, 'templates/intro.md');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation' }>).skillDescription, 'Build slides');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation' }>).isStreaming, true);
});

test('deriveMessagePresentation parses activate_skill resource results', () => {
  const message = createRawMessage({
    role: 'tool',
    content: '<skill_resource name="slides" path="templates/intro.md">\n# Intro\n</skill_resource>',
    type: 'tool_result',
    toolName: 'activate_skill',
  });

  const presentation = deriveMessagePresentation(message);
  assert.equal(presentation.kind, 'skill_resource_result');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_resource_result' }>).skillName, 'slides');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_resource_result' }>).resourcePath, 'templates/intro.md');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_resource_result' }>).resourceFormat, 'markdown');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_resource_result' }>).fileContent.trim(), '# Intro');
});

test('deriveMessagePresentation parses activation results with resources', () => {
  const message = createRawMessage({
    role: 'tool',
    content: '<skill_content name="slides">\n# Slides Skill\n<skill_resources>\n<directory path="templates" />\n<file path="templates/intro.md" size="128" />\n</skill_resources>\n</skill_content>',
    type: 'tool_result',
    toolName: 'activate_skill',
  });

  const presentation = deriveMessagePresentation(message);
  assert.equal(presentation.kind, 'skill_activation_result');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation_result' }>).skillName, 'slides');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation_result' }>).resources.length, 2);
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation_result' }>).resources[0]?.type, 'directory');
  assert.equal((presentation as Extract<typeof presentation, { kind: 'skill_activation_result' }>).resources[1]?.size, 128);
});

test('mergeMessageWithPresentation recomputes tool result presentation after streaming update', () => {
  const base = createRawMessage({
    role: 'tool',
    content: 'partial',
    type: 'tool_result',
    toolName: 'python',
    metadata: { streaming: true },
  });

  const merged = mergeMessageWithPresentation(base, {
    content: 'Output:\n```\nfinal\n```',
    metadata: { streaming: false },
  });

  assert.equal(merged.metadata?.streaming, false);
  assert.equal(merged.presentation?.kind, 'tool_result');
  assert.equal((merged.presentation as Extract<typeof merged.presentation, { kind: 'tool_result' }>).content, 'final');
  assert.equal((merged.presentation as Extract<typeof merged.presentation, { kind: 'tool_result' }>).isStreaming, false);
});

test('search helpers and history search use presentation-aware content', () => {
  const skillResourceMessage = mergeMessageWithPresentation(
    createRawMessage({
      id: 'search-1',
      role: 'tool',
      content: '<skill_resource name="slides" path="templates/intro.md">\n# Hidden Deck\n</skill_resource>',
      type: 'tool_result',
      toolName: 'activate_skill',
    }),
    {},
  );

  assert.equal(getMessageDisplayType(skillResourceMessage), 'tool_result');
  assert.equal(getMessageToolName(skillResourceMessage), 'activate_skill');
  assert.ok(getMessageSearchTexts(skillResourceMessage).some((text) => text.includes('Hidden Deck')));

  const results = MessageHistoryManager.searchMessages([skillResourceMessage], 'Hidden Deck');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, 'search-1');
});
