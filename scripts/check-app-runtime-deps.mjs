import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
}

const shared = readJson('packages/shared/package.json');
const uiWeb = readJson('packages/ui-web/package.json');
const appPackages = [
  ['@openbunny/web', 'packages/web/package.json'],
  ['@openbunny/desktop', 'packages/desktop/package.json'],
];

const requiredDependencies = {
  '@openbunny/shared': 'workspace:*',
  '@openbunny/ui-web': 'workspace:*',
  ...shared.dependencies,
  ...uiWeb.dependencies,
};

for (const source of [shared.peerDependencies ?? {}, uiWeb.peerDependencies ?? {}]) {
  for (const [name, version] of Object.entries(source)) {
    if (name.startsWith('@openbunny/')) continue;
    requiredDependencies[name] ??= version;
  }
}

const failures = [];
for (const [pkgName, file] of appPackages) {
  const manifest = readJson(file);
  const deps = manifest.dependencies ?? {};

  for (const [name, version] of Object.entries(requiredDependencies)) {
    if (!(name in deps)) {
      failures.push(`- ${pkgName} is missing dependency ${name}@${version}`);
      continue;
    }
    if (deps[name] !== version) {
      failures.push(`- ${pkgName} has ${name}@${deps[name]} but expected ${version}`);
    }
  }
}

if (failures.length > 0) {
  console.error('App runtime dependency contract violations found:\n');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('App runtime dependency contract passed for web and desktop.');
