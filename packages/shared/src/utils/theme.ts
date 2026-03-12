import type { Theme } from '../stores/settings';

export type ResolvedTheme = 'light' | 'dark';

export function resolveThemePreference(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === 'system' ? systemTheme : theme;
}
