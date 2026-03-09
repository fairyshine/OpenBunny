/**
 * expo-sqlite backend for message persistence (React Native).
 */

import * as SQLite from 'expo-sqlite';
import type { IMessageStorageBackend } from '@shared/services/storage/types';
import type { Message } from '@shared/types';

const DB_NAME = 'openbunny_messages.db';

export class SQLiteMessageBackend implements IMessageStorageBackend {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async ensureDB(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.db = await SQLite.openDatabaseAsync(DB_NAME);
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS messages (
            session_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
      })();
    }

    await this.initPromise;
    return this.db!;
  }

  async load(sessionId: string): Promise<Message[]> {
    const db = await this.ensureDB();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM messages WHERE session_id = ?',
      [sessionId]
    );
    if (!row) return [];
    try {
      return JSON.parse(row.data) as Message[];
    } catch {
      return [];
    }
  }

  async save(sessionId: string, messages: Message[]): Promise<void> {
    const db = await this.ensureDB();
    await db.runAsync(
      'INSERT OR REPLACE INTO messages (session_id, data, updated_at) VALUES (?, ?, ?)',
      [sessionId, JSON.stringify(messages), Date.now()]
    );
  }

  async delete(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    await db.runAsync('DELETE FROM messages WHERE session_id = ?', [sessionId]);
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    await db.runAsync('DELETE FROM messages');
  }
}
