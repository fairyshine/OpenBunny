import { initializePlatformRuntime } from '../platform';
import type { IPlatformStorage, IPlatformAPI, IPlatformContext, PlatformInfo } from '../platform';
import { setFileSystemInstance } from '../services/filesystem';
import { NodeFileSystem } from '../services/filesystem/nodeFileSystem';
import { initializePlatformStorage } from '../services/storage/bootstrap';
import { FileMessageBackend } from '../services/storage/fileBackend';
import { FileStatsBackend } from '../services/storage/fileStatsBackend';
import { createNodeZustandStorage } from '../services/storage/nodeZustandStorage';
import { useAgentStore } from '../stores/agent';
import { useSessionStore } from '../stores/session';
import { useSettingsStore } from '../stores/settings';
import { useSkillStore } from '../stores/skills';
import { useToolStore } from '../stores/tools';
import { createJSONStorage } from 'zustand/middleware';
import {
  destroyAllNodeShellSessions,
  destroyNodeShellSession,
  executeNodeShell,
  listNodeShellSessions,
} from './nodeExec';

export interface NodePlatformOptions {
  /** Directory for session message JSON files */
  sessionsDir?: string;
  /** Directory for stats JSON files */
  statsDir?: string;
  /** Directory for Zustand persist JSON files */
  storeDir?: string;
  /** Directory for the virtual /root filesystem used by skills and tools */
  filesDir?: string;
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
    executeShell: (command, execOptions) => executeNodeShell(command, execOptions),
    destroyShellSession: (sessionId) => destroyNodeShellSession(sessionId),
    listShellSessions: () => listNodeShellSessions(),
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

      if (options?.filesDir) {
        setFileSystemInstance(new NodeFileSystem(options.filesDir));
      }

      initializePlatformStorage({ messageBackend, statsBackend });

      if (options?.storeDir) {
        const zustandStorage = createNodeZustandStorage(options.storeDir);
        const storage = createJSONStorage(() => zustandStorage as any);
        const persistStores = [
          useSessionStore,
          useSettingsStore,
          useAgentStore,
          useToolStore,
          useSkillStore,
        ];

        for (const store of persistStores) {
          store.persist.setOptions({ storage });
          void store.persist.rehydrate();
        }
      }
    },
  });
}

process.once('exit', () => {
  destroyAllNodeShellSessions();
});
