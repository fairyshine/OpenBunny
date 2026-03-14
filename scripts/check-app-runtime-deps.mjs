import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
}

const appContracts = [
  {
    name: '@openbunny/web',
    file: 'packages/web/package.json',
    allowedDependencies: {
      '@openbunny/shared': 'workspace:*',
      '@openbunny/ui-web': 'workspace:*',
      react: 'catalog:',
      'react-dom': 'catalog:',
    },
  },
  {
    name: '@openbunny/desktop',
    file: 'packages/desktop/package.json',
    allowedDependencies: {
      '@openbunny/shared': 'workspace:*',
      '@openbunny/ui-web': 'workspace:*',
      react: 'catalog:',
      'react-dom': 'catalog:',
    },
  },
];

const failures = [];
for (const contract of appContracts) {
  const manifest = readJson(contract.file);
  const deps = manifest.dependencies ?? {};

  for (const [name, version] of Object.entries(contract.allowedDependencies)) {
    if (!(name in deps)) {
      failures.push(`- ${contract.name} is missing dependency ${name}@${version}`);
      continue;
    }

    if (deps[name] !== version) {
      failures.push(`- ${contract.name} has ${name}@${deps[name]} but expected ${version}`);
    }
  }

  for (const name of Object.keys(deps)) {
    if (!(name in contract.allowedDependencies)) {
      failures.push(`- ${contract.name} should not declare transitive runtime dependency ${name}`);
    }
  }
}

if (failures.length > 0) {
  console.error('App runtime dependency contract violations found:\n');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('App runtime dependency contract passed for web and desktop.');
