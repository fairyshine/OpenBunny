import type { CodeThemePreset } from '@openbunny/shared/stores/settings';
import { bundledLanguages, createHighlighter } from 'shiki';

const FALLBACK_LANGUAGE = 'plaintext';

const CODE_THEME_MAP: Record<CodeThemePreset, { light: string; dark: string }> = {
  github: { light: 'github-light-default', dark: 'github-dark-default' },
  vscode: { light: 'light-plus', dark: 'dark-plus' },
  one: { light: 'one-light', dark: 'one-dark-pro' },
  'rose-pine': { light: 'rose-pine-dawn', dark: 'rose-pine-moon' },
  kanagawa: { light: 'kanagawa-lotus', dark: 'kanagawa-wave' },
  aurora: { light: 'aurora-x', dark: 'synthwave-84' },
};

const PRELOADED_LANGUAGES = [
  'plaintext',
  'text',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'bash',
  'json',
  'python',
  'html',
  'css',
  'yaml',
  'markdown',
  'sql',
] as const;

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: Array.from(new Set(Object.values(CODE_THEME_MAP).flatMap((theme) => [theme.light, theme.dark]))),
      langs: PRELOADED_LANGUAGES.filter((language) => language in bundledLanguages),
    });
  }

  return highlighterPromise;
}

export function normalizeCodeLanguage(language?: string): string {
  if (!language) return FALLBACK_LANGUAGE;

  const normalized = language.trim().toLowerCase();
  if (['js', 'mjs', 'cjs', 'javascript'].includes(normalized)) return 'javascript';
  if (['jsx'].includes(normalized)) return 'jsx';
  if (['ts', 'mts', 'cts', 'typescript'].includes(normalized)) return 'typescript';
  if (['tsx'].includes(normalized)) return 'tsx';
  if (['sh', 'shell', 'zsh', 'bash', 'shellscript'].includes(normalized)) return 'bash';
  if (['py', 'python'].includes(normalized)) return 'python';
  if (['yml', 'yaml'].includes(normalized)) return 'yaml';
  if (normalized === 'md') return 'markdown';
  if (normalized in bundledLanguages) return normalized;

  return FALLBACK_LANGUAGE;
}

export function resolveCodeTheme(preset: CodeThemePreset, isDark: boolean): string {
  const themeSet = CODE_THEME_MAP[preset] ?? CODE_THEME_MAP.github;
  return isDark ? themeSet.dark : themeSet.light;
}

export async function highlightCodeBlock(
  code: string,
  language: string | undefined,
  isDark: boolean,
  preset: CodeThemePreset,
): Promise<string> {
  const highlighter = await getHighlighter();
  const normalizedLanguage = normalizeCodeLanguage(language);

  return highlighter.codeToHtml(code, {
    lang: normalizedLanguage,
    theme: resolveCodeTheme(preset, isDark),
  });
}
