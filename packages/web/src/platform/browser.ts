import { setPlatformContext, detectPlatform } from '@shared/platform';
import type { IPlatformStorage, IPlatformAPI } from '@shared/platform';
import { setThemeHandler, setLanguageHandler } from '@shared/stores/settings';
import { soundManager } from '@shared/services/sound';
import { applyTheme, type Theme } from '@openbunny/ui-web';
import { WebSoundBackend } from '@openbunny/ui-web/platform/sound';
import i18n from '@shared/i18n';

// Browser storage implementation (localStorage)
const browserStorage: IPlatformStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

// Browser API implementation
const browserAPI: IPlatformAPI = {
  fetch: (url: string, options?: RequestInit) => fetch(url, options),
};

/**
 * Initialize browser platform context
 */
export function initBrowserPlatform(): void {
  const info = detectPlatform();

  setPlatformContext({
    info,
    storage: browserStorage,
    api: browserAPI,
  });

  // Wire up theme handler
  setThemeHandler((theme: Theme) => {
    applyTheme(theme);
  });

  // Wire up language handler
  setLanguageHandler((lang: string) => {
    i18n.changeLanguage(lang);
  });

  // Wire up sound backend
  soundManager.setBackend(new WebSoundBackend());

  console.log(`[Platform] Initialized: ${info.type}`);
}
