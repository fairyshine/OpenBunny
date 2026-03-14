import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const packageRules = [
  {
    name: '@openbunny/shared',
    dir: 'packages/shared/src',
    forbidden: [
      { pattern: /from ['"]react-i18next['"]/g, message: 'keep React-specific i18n bindings out of shared; register them from platform/UI bootstrap code' },
      { pattern: /from ['"]i18next-browser-languagedetector['"]/g, message: 'keep browser-only language detection out of shared; resolve initial language from platform bootstrap code' },
    ],
  },
  {
    name: '@openbunny/shared ai services',
    dir: 'packages/shared/src/services/ai',
    exclude: [/\.test\.ts$/],
    forbidden: [
      {
        pattern: /use(?:Agent|Session|Settings|Skill|Tool)Store[\s\S]*from ['"]\.\.\/\.\.\/stores\/(?:agent|session|settings|skills|tools)['"]/g,
        message: 'resolve shared AI runtime data through runtime context or platform-registered adapters; keep direct Zustand hook imports out of shared AI service files',
      },
    ],
  },
  {
    name: '@openbunny/ui-web',
    dir: 'packages/ui-web/src',
    forbidden: [
      { pattern: /@shared\//g, message: 'use `@openbunny/shared/*` package imports instead of `@shared/*` aliases' },
      { pattern: /\.\.\/shared\/src\//g, message: 'do not import shared raw source paths directly' },
    ],
  },
  {
    name: '@openbunny/web',
    dir: 'packages/web/src',
    forbidden: [
      { pattern: /@shared\//g, message: 'use package imports or build aliases, not `@shared/*` source aliases' },
      { pattern: /\.\.\/shared\/src\//g, message: 'do not import shared raw source paths directly' },
      { pattern: /\.\.\/ui-web\/src\//g, message: 'do not import ui-web raw source paths directly' },
    ],
  },
  {
    name: '@openbunny/desktop',
    dir: 'packages/desktop/src',
    forbidden: [
      { pattern: /@shared\//g, message: 'use package imports or build aliases, not `@shared/*` source aliases' },
      { pattern: /\.\.\/shared\/src\//g, message: 'do not import shared raw source paths directly' },
      { pattern: /\.\.\/ui-web\/src\//g, message: 'do not import ui-web raw source paths directly' },
    ],
  },
  {
    name: '@openbunny/cli',
    dir: 'packages/cli/src',
    forbidden: [
      { pattern: /@shared\//g, message: 'use `@openbunny/shared/*` public subpaths instead of `@shared/*` aliases' },
      { pattern: /\.\.\/shared\/src\//g, message: 'do not import shared raw source paths directly' },
    ],
  },
  {
    name: '@openbunny/tui',
    dir: 'packages/tui/src',
    forbidden: [
      { pattern: /@shared\//g, message: 'use `@openbunny/shared/*` public subpaths instead of `@shared/*` aliases' },
      { pattern: /\.\.\/shared\/src\//g, message: 'do not import shared raw source paths directly' },
    ],
  },
  {
    name: '@openbunny/mobile',
    dir: 'packages/mobile/src',
    forbidden: [
      { pattern: /@shared\//g, message: 'use `@openbunny/shared/*` public subpaths instead of `@shared/*` aliases' },
      { pattern: /\.\.\/shared\/src\//g, message: 'do not import shared raw source paths directly' },
    ],
  },
];

const sourceFilePattern = /\.(ts|tsx|js|jsx|mts|cts)$/;
const violations = [];

function walk(dir) {
  const fullDir = path.join(repoRoot, dir);
  if (!fs.existsSync(fullDir)) return [];

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'dist' || entry.name === 'node_modules') continue;
    const relPath = path.join(dir, entry.name);
    const fullPath = path.join(repoRoot, relPath);
    if (entry.isDirectory()) {
      files.push(...walk(relPath));
      continue;
    }
    if (entry.isFile() && sourceFilePattern.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const rule of packageRules) {
  for (const file of walk(rule.dir)) {
    const relativeFile = path.relative(repoRoot, file);
    if (rule.exclude?.some((pattern) => pattern.test(relativeFile))) {
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    for (const forbidden of rule.forbidden) {
      const match = content.match(forbidden.pattern);
      if (!match) continue;
      violations.push({
        packageName: rule.name,
        file: relativeFile,
        message: forbidden.message,
      });
    }
  }
}

if (violations.length > 0) {
  console.error('Package boundary violations found:\n');
  for (const violation of violations) {
    console.error(`- [${violation.packageName}] ${violation.file}: ${violation.message}`);
  }
  process.exit(1);
}

console.log('Package boundary check passed for shared, web, desktop, ui-web, cli, tui, and mobile.');
console.log('Note: mobile app code now imports `@openbunny/shared/*` package subpaths and runtime resolution is guarded separately by `scripts/check-mobile-runtime-contracts.mjs`.');
