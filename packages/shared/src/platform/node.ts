import { initializePlatformRuntime } from '../platform';
import type { IPlatformStorage, IPlatformAPI, IPlatformContext, PlatformInfo } from '../platform';
import { initializePlatformStorage } from '../services/storage/bootstrap';

/**
 * Initialize a Node.js-based platform (CLI or TUI).
 * Storage is injected to avoid shared depending on `conf`.
 */
export function initNodePlatform(info: PlatformInfo, storage: IPlatformStorage): IPlatformContext {
  const nodeAPI: IPlatformAPI = {
    fetch: (url: string, options?: RequestInit) => fetch(url, options),
  };

  return initializePlatformRuntime({
    key: info.type,
    createContext: () => ({
      info,
      storage,
      api: nodeAPI,
    }),
    initialize: () => {
      initializePlatformStorage();
    },
  });
}
