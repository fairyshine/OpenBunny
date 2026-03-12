import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createToolCallMessage,
  createToolResultMessage,
  normalizeToolResultOutput,
  tagMessageSpeaker,
} from './messageFactory';

test('createToolCallMessage builds normalized tool call presentation', () => {
  const message = createToolCallMessage('Calling tool: python', {
    id: 'tool-call-1',
    toolName: 'python',
    toolInput: '{"code":"print(1)"}',
    toolCallId: 'call-1',
    toolDescription: 'Run Python code',
    streaming: true,
  });

  assert.equal(message.type, 'tool_call');
  assert.equal(message.toolName, 'python');
  assert.equal(message.metadata?.toolDescription, 'Run Python code');
  assert.equal(message.presentation?.kind, 'process');
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'process' }>)?.stage, 'tool_call');
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'process' }>)?.toolInput, '{"code":"print(1)"}');
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'process' }>)?.isStreaming, true);
});

test('createToolResultMessage builds normalized tool result presentation with files', () => {
  const message = createToolResultMessage('Output:\n```\n42\n```', {
    id: 'tool-result-1',
    toolName: 'python',
    toolCallId: 'call-1',
    files: [{ data: 'abc123', mediaType: 'image/png', filename: 'plot.png' }],
  });

  assert.equal(message.type, 'tool_result');
  assert.equal(message.toolOutput, 'Output:\n```\n42\n```');
  assert.equal(message.presentation?.kind, 'tool_result');
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'tool_result' }>)?.content, '42');
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'tool_result' }>)?.previewText, '42');
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'tool_result' }>)?.files.length, 1);
  assert.equal((message.presentation as Extract<typeof message.presentation, { kind: 'tool_result' }>)?.files[0]?.filename, 'plot.png');
});

test('normalizeToolResultOutput extracts text and file-data parts', () => {
  const result = normalizeToolResultOutput({
    type: 'content',
    value: [
      { type: 'text', text: 'line 1' },
      { type: 'file-data', data: 'img-data', mediaType: 'image/png', filename: 'chart.png' },
      { type: 'text', text: 'line 2' },
    ],
  });

  assert.equal(result.content, 'line 1\nline 2');
  assert.deepEqual(result.files, [
    { data: 'img-data', mediaType: 'image/png', filename: 'chart.png' },
  ]);
});

test('tagMessageSpeaker preserves presentation and tags metadata', () => {
  const original = createToolResultMessage('done', {
    toolName: 'exec',
  });
  const tagged = tagMessageSpeaker(original, 'agent-1', 'Rabbit');

  assert.equal(tagged.metadata?.speakerAgentId, 'agent-1');
  assert.equal(tagged.metadata?.speakerAgentName, 'Rabbit');
  assert.equal(tagged.presentation?.kind, 'tool_result');
});
