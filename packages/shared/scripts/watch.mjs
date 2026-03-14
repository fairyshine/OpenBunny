import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { distDir, packageDir, resetDistDir, rewriteFile, walkDistFiles } from './build-helpers.mjs';

resetDistDir();

const seen = new Map();

function recordFile(file) {
  const stats = statSync(file);
  seen.set(file, `${stats.mtimeMs}:${stats.size}`);
}

function sweepDist() {
  const active = new Set();

  for (const file of walkDistFiles(distDir)) {
    active.add(file);
    const stats = statSync(file);
    const currentStamp = `${stats.mtimeMs}:${stats.size}`;

    if (seen.get(file) === currentStamp) {
      continue;
    }

    rewriteFile(file);
    recordFile(file);
  }

  for (const file of seen.keys()) {
    if (!active.has(file)) {
      seen.delete(file);
    }
  }
}

const tsc = spawn('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
  cwd: packageDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const interval = setInterval(sweepDist, 250);
interval.unref();

const cleanup = (code = 0) => {
  clearInterval(interval);
  if (!tsc.killed) {
    tsc.kill('SIGINT');
  }
  process.exit(code);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

tsc.on('exit', (code) => {
  clearInterval(interval);
  process.exit(code ?? 0);
});
