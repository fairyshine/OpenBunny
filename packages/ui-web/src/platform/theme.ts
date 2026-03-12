/**
 * Theme utility functions
 */

import type { Theme } from '@shared/stores/settings';
export type { Theme } from '@shared/stores/settings';
import { resolveThemePreference, type ResolvedTheme } from '@shared/utils/theme';

/**
 * Apply theme to document
 */
export function applyTheme(theme: Theme): void {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolveThemePreference(theme, getSystemTheme()));
}

/**
 * Get current system theme
 */
export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Setup system theme change listener
 */
export function setupSystemThemeListener(callback: (theme: ResolvedTheme) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (event: MediaQueryListEvent) => {
    callback(event.matches ? 'dark' : 'light');
  };
  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}
