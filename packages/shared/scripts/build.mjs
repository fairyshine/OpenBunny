import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const distDir = path.join(packageDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const tsc = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], {
  cwd: packageDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

const importPattern = /(from\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/g;
const exportPattern = /(export\s+\*\s+from\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/g;
const dynamicImportPattern = /(import\(\s*['"])(\.{1,2}\/[^'"\n]+)(['"]\s*\))/g;
const bareImportPattern = /(import\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/g;

function resolveRelativeSpecifier(specifier, filePath) {
  const ext = path.extname(specifier);
  if (ext) return specifier;

  const resolvedBase = path.resolve(path.dirname(filePath), specifier);
  if (statSyncSafe(resolvedBase)?.isDirectory()) {
    return `${specifier}/index.js`;
  }

  return `${specifier}.js`;
}

function statSyncSafe(targetPath) {
  try {
    return statSync(targetPath);
  } catch {
    return null;
  }
}

function rewriteRelativeImports(content, filePath) {
  const rewrite = (_, prefix, specifier, suffix) => `${prefix}${resolveRelativeSpecifier(specifier, filePath)}${suffix}`;

  return content
    .replace(importPattern, rewrite)
    .replace(exportPattern, rewrite)
    .replace(dynamicImportPattern, rewrite)
    .replace(bareImportPattern, rewrite);
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!fullPath.endsWith('.js') && !fullPath.endsWith('.d.ts')) continue;

    const original = readFileSync(fullPath, 'utf8');
    const rewritten = rewriteRelativeImports(original, fullPath);
    if (rewritten !== original) {
      writeFileSync(fullPath, rewritten);
    }
  }
}

walk(distDir);
