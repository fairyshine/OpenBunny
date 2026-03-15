/// <reference types="node" />
/**
 * Zustand StateStorage adapter backed by the local filesystem.
 * Used by CLI / TUI so that Zustand persist works without localStorage.
 *
 * Zustand's persist middleware calls getItem/setItem/removeItem.
 * We use synchronous fs for getItem (Zustand expects sync or Promise — sync is simpler).
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export interface NodeZustandStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

export function createNodeZustandStorage(dir: string): NodeZustandStorage {
  mkdirSync(dir, { recursive: true });

  return {
    getItem(name: string): string | null {
      try {
        return readFileSync(join(dir, `${name}.json`), 'utf-8');
      } catch {
        return null;
      }
    },
    setItem(name: string, value: string): void {
      try {
        writeFileSync(join(dir, `${name}.json`), value, 'utf-8');
      } catch {
        // best-effort
      }
    },
    removeItem(name: string): void {
      try {
        unlinkSync(join(dir, `${name}.json`));
      } catch {
        // ignore
      }
    },
  };
}
