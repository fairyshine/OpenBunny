import { spawn, type ChildProcess } from 'node:child_process';
import type { ShellExecOptions, ShellExecResult } from './types';

interface ShellSession {
  process: ChildProcess;
  shell: string;
  cwd: string;
}

const shellSessions = new Map<string, ShellSession>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'cmd.exe';
  }

  return process.env.SHELL || '/bin/zsh';
}

function getShellArgs(loginShell: boolean): string[] {
  if (process.platform === 'win32') {
    return ['/Q', '/K'];
  }

  // Keep the shell session persistent via stdin without enabling interactive mode.
  // Interactive shells emit prompts, OSC title updates, and other control sequences
  // that can corrupt TUI rendering and delay simple commands like `pwd`.
  return loginShell ? ['-l'] : [];
}

function getOrCreateSession(sessionId: string, options: Required<Pick<ShellExecOptions, 'cwd' | 'loginShell'>>): ShellSession {
  const existing = shellSessions.get(sessionId);
  if (existing && !existing.process.killed) {
    return existing;
  }

  const shell = getDefaultShell();
  const child = spawn(shell, getShellArgs(options.loginShell), {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, TERM: 'dumb', PS1: '' },
    cwd: options.cwd,
  });

  child.on('exit', () => {
    shellSessions.delete(sessionId);
  });

  const session: ShellSession = {
    process: child,
    shell,
    cwd: options.cwd,
  };

  shellSessions.set(sessionId, session);
  return session;
}

export async function executeNodeShell(command: string, options: ShellExecOptions = {}): Promise<ShellExecResult> {
  if (process.platform === 'win32') {
    return {
      sessionId: options.sessionId || '',
      exitCode: -1,
      output: '',
      error: 'exec tool is only supported on macOS and Linux',
    };
  }

  const sessionId = options.sessionId || `session_${Date.now()}`;
  const cwd = options.cwd || process.cwd();
  const loginShell = options.loginShell ?? false;
  const timeoutMs = options.timeoutMs ?? 300000;
  const session = getOrCreateSession(sessionId, { cwd, loginShell });
  const { process: child } = session;

  return new Promise<ShellExecResult>((resolve) => {
    let output = '';
    let errorOutput = '';
    let settled = false;

    const endMarker = `__OPENBUNNY_EXEC_END_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    const exitMarker = `__OPENBUNNY_EXEC_EXIT_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

    const timeout = timeoutMs === -1
      ? null
      : setTimeout(() => {
          settle({
            sessionId,
            exitCode: -1,
            output: sanitizeShellOutput(output || errorOutput),
            error: `Command timed out after ${timeoutMs}ms`,
          });
        }, timeoutMs);

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      child.stdout?.off('data', onStdout);
      child.stderr?.off('data', onStderr);
      child.off('exit', onExit);
      child.off('error', onError);
    };

    const settle = (result: ShellExecResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onStdout = (data: Buffer) => {
      output += data.toString();

      if (!output.includes(endMarker)) {
        return;
      }

      const exitMatch = output.match(new RegExp(`${escapeRegExp(exitMarker)}(\\d+)`));
      const exitCode = exitMatch ? Number.parseInt(exitMatch[1], 10) : 0;
      const cleanOutput = output
        .replace(new RegExp(`echo ${escapeRegExp(exitMarker)}\\$\\?\\r?\\n?`, 'g'), '')
        .replace(new RegExp(`${escapeRegExp(exitMarker)}\\d+`, 'g'), '')
        .replace(new RegExp(`echo ${escapeRegExp(endMarker)}\\r?\\n?`, 'g'), '')
        .replace(new RegExp(escapeRegExp(endMarker), 'g'), '')
        .trim();

      settle({
        sessionId,
        exitCode,
        output: sanitizeShellOutput(cleanOutput),
      });
    };

    const onStderr = (data: Buffer) => {
      errorOutput += data.toString();
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      settle({
        sessionId,
        exitCode: code ?? -1,
        output: sanitizeShellOutput(output || errorOutput),
        error: `Shell session exited unexpectedly${signal ? ` (${signal})` : ''}`,
      });
    };

    const onError = (error: Error) => {
      settle({
        sessionId,
        exitCode: -1,
        output: sanitizeShellOutput(output || errorOutput),
        error: error.message,
      });
    };

    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);
    child.once('exit', onExit);
    child.once('error', onError);
    child.stdin?.write(`${command}\necho ${exitMarker}$?\necho ${endMarker}\n`);
  });
}

export function sanitizeShellOutput(output: string): string {
  return output
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/[\x00-\x08\x0B-\x1A\x1C-\x1F\x7F]/g, '')
    .trim();
}

export async function destroyNodeShellSession(sessionId: string): Promise<void> {
  const session = shellSessions.get(sessionId);
  if (!session) {
    return;
  }

  session.process.kill();
  shellSessions.delete(sessionId);
}

export async function listNodeShellSessions(): Promise<string[]> {
  return Array.from(shellSessions.keys());
}

export function destroyAllNodeShellSessions(): void {
  for (const session of shellSessions.values()) {
    session.process.kill();
  }
  shellSessions.clear();
}
