import { spawnSync } from 'node:child_process';
import { packageDir, resetDistDir, rewriteDistFiles } from './build-helpers.mjs';

resetDistDir();

const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], {
  cwd: packageDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

rewriteDistFiles();
