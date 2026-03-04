import { setPlatformContext } from '@shared/platform';
import type { IPlatformStorage, IPlatformFS, IPlatformAPI, OSType } from '@shared/platform';
import { setThemeHandler, setLanguageHandler } from '@shared/stores/settings';
import { applyTheme } from '@cyberbunny/ui-web';
import i18n from '@shared/i18n';

// Type for the electronAPI exposed via preload
declare global {
  interface Window {
    electronAPI: {
      platform: string;
      os: string;
      fs: {
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<void>;
        readdir: (path: string) => Promise<string[]>;
        mkdir: (path: string) => Promise<void>;
        rm: (path: string) => Promise<void>;
        rename: (oldPath: string, newPath: string) => Promise<void>;
      };
      storage: {
        getItem: (key: string) => Promise<string | null>;
        setItem: (key: string, value: string) => Promise<void>;
        removeItem: (key: string) => Promise<void>;
      };
    };
  }
}

// Electron storage implementation (via IPC)
const electronStorage: IPlatformStorage = {
  getItem: (key: string) => window.electronAPI.storage.getItem(key),
  setItem: (key: string, value: string) => window.electronAPI.storage.setItem(key, value),
  removeItem: (key: string) => window.electronAPI.storage.removeItem(key),
};

// Electron file system implementation (via IPC)
const electronFS: IPlatformFS = {
  readFile: (path: string) => window.electronAPI.fs.readFile(path),
  writeFile: (path: string, content: string) => window.electronAPI.fs.writeFile(path, content),
  readdir: (path: string) => window.electronAPI.fs.readdir(path),
  mkdir: (path: string) => window.electronAPI.fs.mkdir(path),
  rm: (path: string) => window.electronAPI.fs.rm(path),
  rename: (oldPath: string, newPath: string) => window.electronAPI.fs.rename(oldPath, newPath),
};

// Electron API implementation
const electronAPI: IPlatformAPI = {
  fetch: (url: string, options?: RequestInit) => fetch(url, options),
};

/**
 * Initialize Electron desktop platform context
 */
export function initDesktopPlatform(): void {
  const os = (window.electronAPI.os || 'unknown') as OSType;

  setPlatformContext({
    info: {
      type: 'desktop',
      os,
      isBrowser: false,
      isDesktop: true,
      isMobile: false,
    },
    storage: electronStorage,
    fs: electronFS,
    api: electronAPI,
  });

  setThemeHandler(applyTheme);
  setLanguageHandler((lang: string) => {
    i18n.changeLanguage(lang);
  });

  console.log(`[Platform] Initialized: desktop (Electron) on ${os}`);
}
