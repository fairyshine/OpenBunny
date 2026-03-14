import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const contracts = [
  {
    name: '@openbunny/web',
    assetsDir: 'packages/web/dist/assets',
    entryPrefix: 'index-',
    maxEntrySizeBytes: 550 * 1024,
    requiredAsyncChunkPrefixes: ['vendor-shiki-core-', 'vendor-shiki-lang-', 'vendor-shiki-theme-'],
  },
  {
    name: '@openbunny/desktop',
    assetsDir: 'packages/desktop/dist/assets',
    entryPrefix: 'index-',
    maxEntrySizeBytes: 550 * 1024,
    requiredAsyncChunkPrefixes: ['vendor-shiki-core-', 'vendor-shiki-lang-', 'vendor-shiki-theme-'],
  },
];

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const failures = [];
for (const contract of contracts) {
  const assetsDir = path.join(repoRoot, contract.assetsDir);
  if (!fs.existsSync(assetsDir)) {
    failures.push(`- ${contract.name} is missing build assets at ${contract.assetsDir}`);
    continue;
  }

  const assetFiles = fs.readdirSync(assetsDir);
  const entryFiles = assetFiles.filter((file) => file.startsWith(contract.entryPrefix) && file.endsWith('.js'));

  if (entryFiles.length !== 1) {
    failures.push(`- ${contract.name} expected exactly one ${contract.entryPrefix}*.js entry chunk but found ${entryFiles.length}`);
    continue;
  }

  const entryFile = entryFiles[0];
  const entrySize = fs.statSync(path.join(assetsDir, entryFile)).size;
  if (entrySize > contract.maxEntrySizeBytes) {
    failures.push(
      `- ${contract.name} entry chunk ${entryFile} is ${formatKiB(entrySize)} (limit ${formatKiB(contract.maxEntrySizeBytes)})`,
    );
  }

  for (const chunkPrefix of contract.requiredAsyncChunkPrefixes) {
    const matchingChunks = assetFiles.filter((file) => file.startsWith(chunkPrefix) && file.endsWith('.js'));
    if (matchingChunks.length === 0) {
      failures.push(`- ${contract.name} is missing async chunk ${chunkPrefix}*.js in ${contract.assetsDir}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Bundle budget contract violations found:\n');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

for (const contract of contracts) {
  const assetsDir = path.join(repoRoot, contract.assetsDir);
  const assetFiles = fs.readdirSync(assetsDir);
  const entryFile = assetFiles.find((file) => file.startsWith(contract.entryPrefix) && file.endsWith('.js'));
  const entrySize = fs.statSync(path.join(assetsDir, entryFile)).size;
  console.log(`${contract.name} bundle budget passed: ${entryFile} = ${formatKiB(entrySize)}`);
}
