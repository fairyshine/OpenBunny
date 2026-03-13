import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import zhCN from '@openbunny/shared/i18n/locales/zh-CN';
import enUS from '@openbunny/shared/i18n/locales/en-US';

/**
 * Get persisted language from Zustand store (via localStorage shim)
 */
function getPersistedLanguage(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('webagent-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        const lang = parsed?.state?.language;
        if (lang && lang !== 'system') return lang;
      }
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
  const languageCode = locale?.languageCode || 'en';
  return languageCode.startsWith('zh') ? 'zh-CN' : 'en-US';
}

/**
 * Initialize i18n for React Native
 */
export async function initMobileI18n(): Promise<void> {
  const persistedLang = getPersistedLanguage();
  const initialLang = persistedLang || resolveSystemLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        'zh-CN': { translation: zhCN },
        'en-US': { translation: enUS },
      },
      lng: initialLang,
      fallbackLng: 'zh-CN',
      supportedLngs: ['zh-CN', 'en-US'],
      interpolation: {
        escapeValue: false,
      },
    });

  console.log('[i18n] Initialized with language:', initialLang);
}

export default i18n;
