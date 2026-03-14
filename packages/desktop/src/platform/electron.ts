import { initializePlatformRuntime } from '@openbunny/shared/platform';
import type { IPlatformStorage, IPlatformFS, IPlatformAPI, IPlatformContext, OSType } from '@openbunny/shared/platform';
import { initializeBrowserLikePlatformServices } from '@openbunny/ui-web/platform/runtime';

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
      system: {
        getInfo: () => Promise<{
          platform: string;
          arch: string;
          hostname: string;
          cpus: number;
          cpuModel: string;
          cpuUsage: number;
          totalMemory: number;
          freeMemory: number;
          usedMemory: number;
          memUsagePercent: number;
          loadAverage: number[];
          uptime: number;
          nodeVersion: string;
          electronVersion: string;
        }>;
      };
    };
  }
}

// Electron storage implementation - use native localStorage (Chromium built-in)
// No need for IPC storage since Electron has localStorage
const electronStorage: IPlatformStorage = {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
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
export function initDesktopPlatform(): IPlatformContext {
  return initializePlatformRuntime({
    key: 'desktop',
    createContext: () => {
      const os = (window.electronAPI.os || 'unknown') as OSType;
      return {
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
      };
    },
    initialize: (context) => {
      initializeBrowserLikePlatformServices();
      console.log(`[Platform] Initialized: desktop (Electron) on ${context.info.os}`);
    },
  });
}
