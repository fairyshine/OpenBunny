import { detectPlatform, initializePlatformRuntime } from '@openbunny/shared/platform';
import type { IPlatformStorage, IPlatformAPI, IPlatformContext } from '@openbunny/shared/platform';
import { setThemeHandler, setLanguageHandler } from '@openbunny/shared/stores/settings';
import { soundManager } from '@openbunny/shared/services/sound';
import { initializePlatformStorage } from '@openbunny/shared/services/storage/bootstrap';
import { applyTheme, type Theme } from '@openbunny/ui-web';
import { WebSoundBackend } from '@openbunny/ui-web/platform/sound';
import i18n from '@openbunny/shared/i18n';

// Browser storage implementation (localStorage)
const browserStorage: IPlatformStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

function createBrowserExternalFetch(proxyUrl?: string): typeof globalThis.fetch | undefined {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const originalUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      const encodedTarget = encodeURIComponent(originalUrl);
      return globalThis.fetch(`/api/proxy?target=${encodedTarget}`, init);
    };
  }

  if (proxyUrl) {
    const workerBase = proxyUrl.replace(/\/+$/, '');
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const originalUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      return globalThis.fetch(`${workerBase}/proxy`, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          'X-Target-URL': originalUrl,
        },
      });
    };
  }

  return undefined;
}

// Browser API implementation
const browserAPI: IPlatformAPI = {
  fetch: (url: string, options?: RequestInit) => fetch(url, options),
  createExternalFetch: ({ service, proxyUrl }) => {
    if (service !== 'llm-provider') return undefined;
    return createBrowserExternalFetch(proxyUrl);
  },
};

/**
 * Initialize browser platform context
 */
export function initBrowserPlatform(): IPlatformContext {
  return initializePlatformRuntime({
    key: 'browser',
    createContext: () => ({
      info: detectPlatform(),
      storage: browserStorage,
      api: browserAPI,
    }),
    initialize: (context) => {
      initializePlatformStorage();
      setThemeHandler((theme: Theme) => {
        applyTheme(theme);
      });
      setLanguageHandler((lang: string) => {
        i18n.changeLanguage(lang);
      });
      soundManager.setBackend(new WebSoundBackend());
      console.log(`[Platform] Initialized: ${context.info.type}`);
    },
  });
}
