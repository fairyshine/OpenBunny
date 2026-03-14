import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import i18n, {
  initializeSharedI18n,
  readPersistedLanguage,
  resolveSupportedLanguage,
} from '@openbunny/shared/i18n';

/**
 * Get persisted language from Zustand store (via localStorage shim)
 */
function getPersistedLanguage(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return readPersistedLanguage(localStorage.getItem('webagent-settings'));
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Resolve system language to supported locale
 */
function resolveSystemLanguage(): string {
  const locale = Localization.getLocales()[0];
  return resolveSupportedLanguage(locale?.languageTag || locale?.languageCode || 'en-US');
}

/**
 * Initialize i18n for React Native
 */
export async function initMobileI18n(): Promise<void> {
  const persistedLang = getPersistedLanguage();
  const initialLang = persistedLang || resolveSystemLanguage();

  await initializeSharedI18n({
    plugins: [initReactI18next],
    initialLanguage: initialLang,
  });

  console.log('[i18n] Initialized with language:', initialLang);
}

export default i18n;
