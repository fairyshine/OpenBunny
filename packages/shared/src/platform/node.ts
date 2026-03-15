import { initializePlatformRuntime } from '../platform';
import type { IPlatformStorage, IPlatformAPI, IPlatformContext, PlatformInfo } from '../platform';
import { initializePlatformStorage } from '../services/storage/bootstrap';
import { FileMessageBackend } from '../services/storage/fileBackend';
import { FileStatsBackend } from '../services/storage/fileStatsBackend';
import { createNodeZustandStorage } from '../services/storage/nodeZustandStorage';
import { useSessionStore } from '../stores/session';

export interface NodePlatformOptions {
  /** Directory for session message JSON files */
  sessionsDir?: string;
  /** Directory for stats JSON files */
  statsDir?: string;
  /** Directory for Zustand persist JSON files */
  storeDir?: string;
}

/**
 * Initialize a Node.js-based platform (CLI or TUI).
 * Storage is injected to avoid shared depending on `conf`.
 */
export function initNodePlatform(
  info: PlatformInfo,
  storage: IPlatformStorage,
  options?: NodePlatformOptions,
): IPlatformContext {
  const nodeAPI: IPlatformAPI = {
    fetch: (url: string, opts?: RequestInit) => fetch(url, opts),
  };

  return initializePlatformRuntime({
    key: info.type,
    createContext: () => ({
      info,
      storage,
      api: nodeAPI,
    }),
    initialize: () => {
      const messageBackend = options?.sessionsDir
        ? new FileMessageBackend(options.sessionsDir)
        : undefined;
      const statsBackend = options?.statsDir
        ? new FileStatsBackend(options.statsDir)
        : undefined;

      initializePlatformStorage({ messageBackend, statsBackend });

      if (options?.storeDir) {
        const zustandStorage = createNodeZustandStorage(options.storeDir);
        useSessionStore.persist.setOptions({ storage: zustandStorage as any });
        // Trigger rehydration so persisted sessions are loaded from disk
        void useSessionStore.persist.rehydrate();
      }
    },
  });
}
