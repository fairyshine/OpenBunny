import { Platform } from 'react-native';
import { initializePlatformRuntime } from '@openbunny/shared/platform';
import type { IPlatformAPI, IPlatformContext, OSType } from '@openbunny/shared/platform';
import { setThemeHandler, setLanguageHandler } from '@openbunny/shared/stores/settings';
import { setFileSystemInstance } from '@openbunny/shared/services/filesystem';
import { initializePlatformStorage } from '@openbunny/shared/services/storage/bootstrap';
import { soundManager } from '@openbunny/shared/services/sound';
import { nativeStorage } from './storage';
import { nativeFS } from './filesystem';
import { mobileFileSystem } from './mobileFileSystem';
import { SQLiteMessageBackend } from './messageBackend';
import { SQLiteStatsBackend } from './statsBackend';
import { MobileSoundBackend } from './sound';
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
export function initMobilePlatform(): IPlatformContext {
  return initializePlatformRuntime({
    key: 'mobile',
    createContext: () => {
      const os: OSType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown';
      return {
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
    },
    initialize: () => {
      setFileSystemInstance(mobileFileSystem);
      initializePlatformStorage({
        messageBackend: new SQLiteMessageBackend(),
        statsBackend: new SQLiteStatsBackend(),
      });
      setThemeHandler(() => {
        // Theme changes are handled by App.tsx re-rendering with new theme
      });
      setLanguageHandler((lang: string) => {
        i18n.changeLanguage(lang);
      });
      soundManager.setBackend(new MobileSoundBackend());
      console.log('[Platform] Initialized: mobile (React Native)');
    },
  });
}
