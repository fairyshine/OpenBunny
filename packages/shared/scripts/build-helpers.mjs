import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const packageDir = path.resolve(__dirname, '..');
export const distDir = path.join(packageDir, 'dist');

const importPattern = /(from\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/g;
const exportPattern = /(export\s+\*\s+from\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/g;
const dynamicImportPattern = /(import\(\s*['"])(\.{1,2}\/[^'"\n]+)(['"]\s*\))/g;
const bareImportPattern = /(import\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/g;

function statSyncSafe(targetPath) {
  try {
    return statSync(targetPath);
  } catch {
    return null;
  }
}

function resolveRelativeSpecifier(specifier, filePath) {
  const ext = path.extname(specifier);
  if (ext) return specifier;

  const resolvedBase = path.resolve(path.dirname(filePath), specifier);
  if (statSyncSafe(resolvedBase)?.isDirectory()) {
    return `${specifier}/index.js`;
  }

  return `${specifier}.js`;
}

export function resetDistDir() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
}

export function rewriteRelativeImports(content, filePath) {
  const rewrite = (_, prefix, specifier, suffix) => `${prefix}${resolveRelativeSpecifier(specifier, filePath)}${suffix}`;

  return content
    .replace(importPattern, rewrite)
    .replace(exportPattern, rewrite)
    .replace(dynamicImportPattern, rewrite)
    .replace(bareImportPattern, rewrite);
}

export function rewriteFile(fullPath) {
  if (!fullPath.endsWith('.js') && !fullPath.endsWith('.d.ts')) return false;
  if (!existsSync(fullPath)) return false;

  const original = readFileSync(fullPath, 'utf8');
  const rewritten = rewriteRelativeImports(original, fullPath);
  if (rewritten === original) return false;

  writeFileSync(fullPath, rewritten);
  return true;
}

export function walkDistFiles(dir = distDir) {
  if (!existsSync(dir)) return [];

  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walkDistFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.js') || fullPath.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

export function rewriteDistFiles() {
  for (const file of walkDistFiles()) {
    rewriteFile(file);
  }
}
