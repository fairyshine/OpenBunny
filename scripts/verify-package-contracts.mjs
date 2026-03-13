import { spawnSync } from 'node:child_process';

const steps = [
  ['pnpm', ['--filter', '@openbunny/shared', 'build']],
  ['pnpm', ['--filter', '@openbunny/ui-web', 'build']],
  ['pnpm', ['--filter', '@openbunny/web', 'build']],
  ['pnpm', ['--filter', '@openbunny/desktop', 'typecheck']],
  ['pnpm', ['--filter', '@openbunny/mobile', 'typecheck']],
  ['pnpm', ['--filter', '@openbunny/mobile', 'typecheck:contracts']],
  ['pnpm', ['--filter', '@openbunny/cli', 'build']],
  ['pnpm', ['--filter', '@openbunny/tui', 'build']],
  ['node', ['scripts/check-package-boundaries.mjs']],
  ['node', ['scripts/check-package-exports.mjs']],
  ['node', ['scripts/check-app-runtime-deps.mjs']],
];

for (const [command, args] of steps) {
  const label = [command, ...args].join(' ');
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      HOME: process.env.HOME || '/tmp/openbunny-home',
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || '/tmp/openbunny-config',
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nPackage contract verification passed.');
