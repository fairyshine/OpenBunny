#!/usr/bin/env node
/**
 * Sync version from root package.json to all workspace packages and version.ts
 *
 * Usage:
 *   node scripts/sync-version.mjs          # sync current version
 *   node scripts/sync-version.mjs 0.2.0    # set new version and sync
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const root = new URL('..', import.meta.url).pathname;
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// If a new version is passed as argument, update root first
const newVersion = process.argv[2];
if (newVersion) {
  rootPkg.version = newVersion;
  writeFileSync(join(root, 'package.json'), JSON.stringify(rootPkg, null, 2) + '\n');
  console.log(`Root → ${newVersion}`);
}

const version = rootPkg.version;

// Find all workspace package.json files
const output = execSync('pnpm -r exec -- node -e "console.log(process.cwd())"', { cwd: root, encoding: 'utf8' });
const dirs = output.trim().split('\n').filter(Boolean);

for (const dir of dirs) {
  const pkgPath = join(dir, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.version !== version) {
      pkg.version = version;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`${pkg.name} → ${version}`);
    }
  } catch {}
}

// Sync version.ts
const versionTsPath = join(root, 'packages/shared/src/version.ts');
writeFileSync(versionTsPath, `export const APP_VERSION = '${version}';\n`);
console.log(`version.ts → ${version}`);

console.log(`\nAll synced to ${version}`);
