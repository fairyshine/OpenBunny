import { spawn } from 'node:child_process';

const isDryRun = process.argv.includes('--dry-run');
const processes = [];

const commands = [
  ['pnpm', ['--filter', '@openbunny/shared', 'watch']],
  ['pnpm', ['--filter', '@openbunny/mobile', 'start:runtime']],
];

if (isDryRun) {
  for (const [command, args] of commands) {
    console.log([command, ...args].join(' '));
  }
  process.exit(0);
}

function shutdown(code = 0) {
  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
  process.exit(code);
}

for (const [command, args] of commands) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown(code);
      return;
    }

    if (processes.every((proc) => proc.exitCode !== null)) {
      process.exit(0);
    }
  });

  processes.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
