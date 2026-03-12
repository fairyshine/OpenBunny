import { Appearance } from 'react-native';
import type { Theme } from '@shared/stores/settings';
import { resolveThemePreference, type ResolvedTheme } from '@shared/utils/theme';

export function getSystemTheme(): ResolvedTheme {
  const colorScheme = Appearance.getColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
}

/**
 * Get the effective theme (resolve 'system' to 'light' or 'dark')
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  return resolveThemePreference(theme, getSystemTheme());
}

/**
 * Listen to system theme changes
 */
export function setupSystemThemeListener(
  callback: (theme: ResolvedTheme) => void
): () => void {
  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    callback(colorScheme === 'dark' ? 'dark' : 'light');
  });

  return () => subscription.remove();
}
