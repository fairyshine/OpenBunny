import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const packageRoot = process.cwd();
const srcRoot = path.join(packageRoot, 'src');
const tempRoot = await mkdtemp(path.join(tmpdir(), 'openbunny-shared-tests-'));
const outRoot = path.join(tempRoot, 'src');
const nodeModulesLink = path.join(tempRoot, 'node_modules');
const workspaceNodeModules = path.join(packageRoot, 'node_modules');
await symlink(workspaceNodeModules, nodeModulesLink, 'dir');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = await walk(srcRoot);
const testOutputs = [];

for (const sourceFile of sourceFiles) {
  const relativePath = path.relative(srcRoot, sourceFile);
  const outputPath = path.join(outRoot, relativePath.replace(/\.ts$/, '.js'));
  const outputDir = path.dirname(outputPath);
  await mkdir(outputDir, { recursive: true });

  const sourceText = await readFile(sourceFile, 'utf8');
  const transpiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: sourceFile,
  });

  await writeFile(outputPath, transpiled.outputText, 'utf8');
  if (sourceFile.endsWith('.test.ts')) {
    testOutputs.push(outputPath);
  }
}

const result = spawnSync(process.execPath, ['--test', ...testOutputs], {
  cwd: tempRoot,
  stdio: 'inherit',
});

await rm(tempRoot, { recursive: true, force: true });
process.exit(result.status ?? 1);
