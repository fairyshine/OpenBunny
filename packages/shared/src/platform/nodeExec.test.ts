import test from 'node:test';
import assert from 'node:assert/strict';
import { executeNodeShell, destroyAllNodeShellSessions, sanitizeShellOutput } from './nodeExec';

test.afterEach(() => {
  destroyAllNodeShellSessions();
});

test('sanitizeShellOutput strips OSC and ANSI control sequences', () => {
  const noisy = '\u001b]2;title\u0007\u001b[32mhello\u001b[0m\nworld';
  assert.equal(sanitizeShellOutput(noisy), 'hello\nworld');
});

test('executeNodeShell returns clean output for simple commands', async () => {
  if (process.platform === 'win32') {
    return;
  }

  const result = await executeNodeShell('pwd', {
    loginShell: true,
    timeoutMs: 2000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /^\//);
  assert.doesNotMatch(result.output, /\u001b\]/);
  assert.doesNotMatch(result.output, /\u001b\[/);
});
