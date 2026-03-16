/**
 * One-call platform initialization for Node.js terminals (CLI & TUI).
 * Replaces the duplicated init sequences in cli/src/index.ts and tui/src/index.tsx.
 */

import path from 'node:path';
import { initNodePlatform } from '../platform/node';
import { detectNodeOS } from '../platform/detect';
import { resolveNodeConfigDir } from '../platform/nodeConfig';
import { registerZustandAIRuntimeAdapters } from '../stores/aiRuntimeAdapters';
import { createConfigStorage } from './nodeConfigSingleton';
import type { IPlatformStorage } from '../platform';

export interface InitTerminalOptions {
  type: 'cli' | 'tui';
}

export interface TerminalContext {
  configDir: string;
}

export function initTerminal(options: InitTerminalOptions): TerminalContext {
  const storage: IPlatformStorage = createConfigStorage();
  const configDir = resolveNodeConfigDir();

  const isCLI = options.type === 'cli';

  initNodePlatform(
    {
      type: options.type,
      os: detectNodeOS(),
      isBrowser: false,
      isDesktop: false,
      isMobile: false,
      isCLI,
      isTUI: !isCLI,
    },
    storage,
    {
      sessionsDir: path.join(configDir, 'sessions'),
      statsDir: path.join(configDir, 'stats'),
      storeDir: path.join(configDir, 'store'),
      filesDir: path.join(configDir, 'files'),
    },
  );

  registerZustandAIRuntimeAdapters();

  return { configDir };
}
