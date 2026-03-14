import i18n from 'i18next';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import './types';
import type { Module, Newable, NewableModule } from 'i18next';

type I18nPlugin = Module | NewableModule<Module> | Newable<Module>;
type SharedLanguage = 'zh-CN' | 'en-US';

const DEFAULT_LANGUAGE: SharedLanguage = 'en-US';
const FALLBACK_LANGUAGE: SharedLanguage = 'zh-CN';
const SUPPORTED_LANGUAGES: SharedLanguage[] = ['zh-CN', 'en-US'];

const registeredPlugins = new Set<I18nPlugin>();
let initPromise: Promise<typeof i18n> | null = null;

export interface SharedI18nInitOptions {
  plugins?: I18nPlugin[];
  initialLanguage?: string | null;
}

export function resolveSupportedLanguage(language: string | null | undefined): SharedLanguage {
  return language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function readPersistedLanguage(settingsSnapshot: string | null | undefined): SharedLanguage | null {
  if (!settingsSnapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(settingsSnapshot);
    const language = parsed?.state?.language;
    if (typeof language !== 'string' || language === 'system') {
      return null;
    }
    return resolveSupportedLanguage(language);
  } catch {
    return null;
  }
}

function registerPlugin(plugin: I18nPlugin): void {
  if (registeredPlugins.has(plugin)) {
    return;
  }

  i18n.use(plugin);
  registeredPlugins.add(plugin);
}

export function initializeSharedI18n(options: SharedI18nInitOptions = {}): Promise<typeof i18n> {
  const { plugins = [], initialLanguage } = options;

  if (initPromise) {
    const hasLatePlugins = plugins.some((plugin) => !registeredPlugins.has(plugin));
    if (hasLatePlugins) {
      throw new Error('Shared i18n was already initialized before registering all plugins.');
    }
    return initPromise;
  }

  plugins.forEach(registerPlugin);

  initPromise = i18n.init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: initialLanguage ? resolveSupportedLanguage(initialLanguage) : DEFAULT_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: {
      escapeValue: false,
    },
  }).then(() => i18n);

  return initPromise;
}

export default i18n;
