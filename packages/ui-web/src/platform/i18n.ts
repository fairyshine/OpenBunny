import { initReactI18next } from 'react-i18next';
import { initializeSharedI18n, readPersistedLanguage, resolveSupportedLanguage } from '@openbunny/shared/i18n';

function getPersistedLanguage(): string | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return readPersistedLanguage(localStorage.getItem('webagent-settings'));
  } catch {
    return null;
  }
}

function resolveBrowserLanguage(): string {
  if (typeof navigator === 'undefined') {
    return 'en-US';
  }
  return resolveSupportedLanguage(navigator.language);
}

export function initializeDOMI18n() {
  const initialLanguage = getPersistedLanguage() ?? resolveBrowserLanguage();
  return initializeSharedI18n({
    plugins: [initReactI18next],
    initialLanguage,
  });
}
