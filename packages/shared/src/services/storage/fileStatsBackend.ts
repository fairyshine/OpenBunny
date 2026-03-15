/// <reference types="node" />
/**
 * File-based stats storage backend for Node.js (CLI / TUI).
 * Each session's stats are stored as: {dir}/{sessionId}.json
 */

import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { StatsRecord, IStatsStorageBackend } from './statsTypes';

export class FileStatsBackend implements IStatsStorageBackend {
  constructor(private readonly dir: string) {}

  async append(record: StatsRecord): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const existing = await this.loadBySession(record.sessionId);
    existing.push(record);
    await writeFile(this.filePath(record.sessionId), JSON.stringify(existing), 'utf-8');
  }

  async loadAll(since?: number, until?: number): Promise<StatsRecord[]> {
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }

    const results: StatsRecord[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = await readFile(join(this.dir, file), 'utf-8');
        const records = JSON.parse(data) as StatsRecord[];
        for (const r of records) {
          if (since !== undefined && r.createdAt < since) continue;
          if (until !== undefined && r.createdAt > until) continue;
          results.push(r);
        }
      } catch {
        // skip corrupt files
      }
    }
    return results;
  }

  async loadBySession(sessionId: string): Promise<StatsRecord[]> {
    try {
      const data = await readFile(this.filePath(sessionId), 'utf-8');
      return JSON.parse(data) as StatsRecord[];
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  async deleteBySession(sessionId: string): Promise<void> {
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
