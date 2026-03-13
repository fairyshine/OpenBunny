/**
 * expo-sqlite backend for stats persistence (React Native).
 */

import * as SQLite from 'expo-sqlite';
import type { IStatsStorageBackend, StatsRecord } from '@openbunny/shared/services/storage/statsTypes';

const DB_NAME = 'openbunny_stats.db';

export class SQLiteStatsBackend implements IStatsStorageBackend {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async ensureDB(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.db = await SQLite.openDatabaseAsync(DB_NAME);
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS stats (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            project_id TEXT,
            model TEXT NOT NULL,
            provider TEXT NOT NULL,
            input_tokens INTEGER NOT NULL,
            output_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            message_count INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            date TEXT NOT NULL,
            step_count INTEGER,
            tool_calls TEXT,
            tool_call_count INTEGER,
            finish_reason TEXT,
            temperature REAL,
            max_tokens INTEGER,
            user_input_length INTEGER,
            total_chunks INTEGER,
            error TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_stats_session ON stats(session_id);
          CREATE INDEX IF NOT EXISTS idx_stats_date ON stats(date);
          CREATE INDEX IF NOT EXISTS idx_stats_created ON stats(created_at);
        `);
        // Migrate: add new columns if upgrading from v1
        const cols = await this.db.getAllAsync<{ name: string }>(
          `PRAGMA table_info(stats)`
        );
        const colNames = new Set(cols.map((c) => c.name));
        const migrations: [string, string][] = [
          ['step_count', 'INTEGER'],
          ['tool_calls', 'TEXT'],
          ['tool_call_count', 'INTEGER'],
          ['finish_reason', 'TEXT'],
          ['temperature', 'REAL'],
          ['max_tokens', 'INTEGER'],
          ['user_input_length', 'INTEGER'],
          ['total_chunks', 'INTEGER'],
          ['error', 'TEXT'],
        ];
        for (const [col, type] of migrations) {
          if (!colNames.has(col)) {
            await this.db.execAsync(`ALTER TABLE stats ADD COLUMN ${col} ${type}`);
          }
        }
      })();
    }

    await this.initPromise;
    return this.db!;
  }

  async append(record: StatsRecord): Promise<void> {
    const db = await this.ensureDB();
    await db.runAsync(
      `INSERT OR REPLACE INTO stats
        (id, session_id, project_id, model, provider, input_tokens, output_tokens, total_tokens, message_count, duration, created_at, date,
         step_count, tool_calls, tool_call_count, finish_reason, temperature, max_tokens, user_input_length, total_chunks, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.sessionId,
        record.projectId ?? null,
        record.model,
        record.provider,
        record.inputTokens,
        record.outputTokens,
        record.totalTokens,
        record.messageCount,
        record.duration,
        record.createdAt,
        record.date,
        record.stepCount ?? null,
        record.toolCalls ? JSON.stringify(record.toolCalls) : null,
        record.toolCallCount ?? null,
        record.finishReason ?? null,
        record.temperature ?? null,
        record.maxTokens ?? null,
        record.userInputLength ?? null,
        record.totalChunks ?? null,
        record.error ?? null,
      ]
    );
  }

  async loadAll(since?: number, until?: number): Promise<StatsRecord[]> {
    const db = await this.ensureDB();
    let sql = 'SELECT * FROM stats';
    const params: (number | undefined)[] = [];

    if (since != null || until != null) {
      sql += ' WHERE created_at >= ? AND created_at <= ?';
      params.push(since ?? 0, until ?? Date.now());
    }

    const rows = await db.getAllAsync<Record<string, any>>(sql, params as any[]);
    return rows.map(rowToRecord);
  }

  async loadBySession(sessionId: string): Promise<StatsRecord[]> {
    const db = await this.ensureDB();
    const rows = await db.getAllAsync<Record<string, any>>(
      'SELECT * FROM stats WHERE session_id = ?',
      [sessionId]
    );
    return rows.map(rowToRecord);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    await db.runAsync('DELETE FROM stats WHERE session_id = ?', [sessionId]);
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    await db.runAsync('DELETE FROM stats');
  }
}

function rowToRecord(row: Record<string, any>): StatsRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id ?? undefined,
    model: row.model,
    provider: row.provider,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    messageCount: row.message_count,
    duration: row.duration,
    createdAt: row.created_at,
    date: row.date,
    stepCount: row.step_count ?? undefined,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
    toolCallCount: row.tool_call_count ?? undefined,
    finishReason: row.finish_reason ?? undefined,
    temperature: row.temperature ?? undefined,
    maxTokens: row.max_tokens ?? undefined,
    userInputLength: row.user_input_length ?? undefined,
    totalChunks: row.total_chunks ?? undefined,
    error: row.error ?? undefined,
  };
}
