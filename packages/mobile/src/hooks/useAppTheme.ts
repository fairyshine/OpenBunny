import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { resolveTheme } from '../platform/theme';

export function useAppTheme() {
  const { theme: themePreference } = useSettingsStore();
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    const effectiveTheme = resolveTheme(themePreference);
    return effectiveTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  }, [themePreference, systemColorScheme]);

  return theme;
}
