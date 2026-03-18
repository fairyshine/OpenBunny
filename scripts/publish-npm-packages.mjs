import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const publishOrder = [
  '@openbunny/shared',
  '@openbunny/ui-web',
  '@openbunny/cli',
  '@openbunny/tui',
];

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const packDestinationDir = fileURLToPath(new URL('../.tmp-openbunny-config/pnpm-packed', import.meta.url));

const passthroughArgs = args.filter((arg) => arg !== '--dry-run');

mkdirSync(packDestinationDir, { recursive: true });

for (const pkg of publishOrder) {
  const commandArgs = isDryRun
    ? ['--filter', pkg, 'pack', '--pack-destination', packDestinationDir]
    : ['--filter', pkg, 'publish', ...passthroughArgs];

  console.log(`\n> pnpm ${commandArgs.join(' ')}`);

  const result = spawnSync('pnpm', commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
