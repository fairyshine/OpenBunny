import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import './types';

// Read persisted language from Zustand store in localStorage
function getPersistedLanguage(): string | null {
  try {
    const raw = localStorage.getItem('webagent-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const lang = parsed?.state?.language;
      if (lang && lang !== 'system') return lang;
    }
  } catch {
    // ignore
  }
  return null;
}

// Resolve system language to supported locale
function resolveSystemLanguage(): string {
  const nav = navigator.language || '';
  return nav.startsWith('zh') ? 'zh-CN' : 'en-US';
}

const persistedLang = getPersistedLanguage();
const initialLang = persistedLang || resolveSystemLanguage();

i18n
  .use(LanguageDetector)
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
    detection: {
      order: [], // We handle detection ourselves above
    },
  });

export default i18n;
