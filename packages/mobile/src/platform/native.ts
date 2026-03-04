import { Platform } from 'react-native';
import { setPlatformContext } from '@shared/platform';
import type { IPlatformAPI, IPlatformContext, OSType } from '@shared/platform';
import { setThemeHandler, setLanguageHandler } from '@shared/stores/settings';
import { setFileSystemInstance } from '@shared/services/filesystem';
import { nativeStorage } from './storage';
import { nativeFS } from './filesystem';
import { mobileFileSystem } from './mobileFileSystem';
import i18n from './i18n';

const nativeAPI: IPlatformAPI = {
  fetch: (url: string, options?: RequestInit) => {
    // React Native has fetch built-in
    return fetch(url, options);
  },
};

/**
 * Initialize React Native mobile platform context
 */
export function initMobilePlatform(): void {
  const os: OSType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown';

  const context: IPlatformContext = {
    info: {
      type: 'mobile',
      os,
      isBrowser: false,
      isDesktop: false,
      isMobile: true,
    },
    storage: nativeStorage,
    fs: nativeFS,
    api: nativeAPI,
  };

  setPlatformContext(context);

  // Register mobile filesystem as the IFileSystem implementation
  setFileSystemInstance(mobileFileSystem);

  // Wire up theme handler (handled by App.tsx via Paper theme)
  setThemeHandler(() => {
    // Theme changes are handled by App.tsx re-rendering with new theme
  });

  // Wire up language handler
  setLanguageHandler((lang: string) => {
    i18n.changeLanguage(lang);
  });

  console.log('[Platform] Initialized: mobile (React Native)');
}
