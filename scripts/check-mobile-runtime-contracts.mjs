import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();

function readFile(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function readJson(file) {
  return JSON.parse(readFile(file));
}

const failures = [];
const metroConfig = readFile('packages/mobile/metro.config.js');
const babelConfig = readFile('packages/mobile/babel.config.js');
const mobilePackage = readJson('packages/mobile/package.json');
const rootPackage = readJson('package.json');

for (const [file, content] of [
  ['packages/mobile/metro.config.js', metroConfig],
  ['packages/mobile/babel.config.js', babelConfig],
]) {
  if (content.includes('../shared/src') || content.includes('@shared/')) {
    failures.push(`- ${file} should not resolve @openbunny/shared through raw source aliases`);
  }
}

for (const scriptName of ['start', 'android', 'ios', 'web']) {
  const script = mobilePackage.scripts?.[scriptName] ?? '';
  if (!script.includes('build:shared')) {
    failures.push(`- packages/mobile/package.json script "${scriptName}" must prebuild shared artifacts`);
  }
}

if ((mobilePackage.scripts?.['start:runtime'] ?? '') !== 'expo start') {
  failures.push('- packages/mobile/package.json must expose "start:runtime" as the raw Expo entrypoint');
}

if ((rootPackage.scripts?.['dev:mobile'] ?? '') !== 'node scripts/dev-mobile.mjs') {
  failures.push('- package.json must run mobile dev through `node scripts/dev-mobile.mjs`');
}

if (failures.length === 0) {
  const probe = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "await import('@openbunny/shared/platform'); await import('@openbunny/shared/stores/session'); console.log('mobile runtime imports resolved');",
    ],
    {
      cwd: path.join(repoRoot, 'packages/mobile'),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  if (probe.status !== 0) {
    failures.push('- mobile runtime import probe failed to resolve @openbunny/shared package exports');
    if (probe.stderr?.trim()) {
      failures.push(`  ${probe.stderr.trim()}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Mobile runtime contract violations found:\n');
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('Mobile runtime contract passed.');
