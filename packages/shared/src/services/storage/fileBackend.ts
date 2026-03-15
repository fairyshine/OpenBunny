/// <reference types="node" />
/**
 * File-based message storage backend for Node.js (CLI / TUI).
 * Each session is stored as a single JSON file: {dir}/{sessionId}.json
 */

import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Message } from '../../types';
import type { IMessageStorageBackend } from './types';

export class FileMessageBackend implements IMessageStorageBackend {
  constructor(private readonly dir: string) {}

  async load(sessionId: string): Promise<Message[]> {
    try {
      const data = await readFile(this.filePath(sessionId), 'utf-8');
      return JSON.parse(data) as Message[];
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  async save(sessionId: string, messages: Message[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.filePath(sessionId), JSON.stringify(messages), 'utf-8');
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await unlink(this.filePath(sessionId));
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await readdir(this.dir);
      await Promise.all(
        files
          .filter((f: string) => f.endsWith('.json'))
          .map((f: string) => unlink(join(this.dir, f))),
      );
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }

  private filePath(sessionId: string): string {
    return join(this.dir, `${sessionId}.json`);
  }
}
