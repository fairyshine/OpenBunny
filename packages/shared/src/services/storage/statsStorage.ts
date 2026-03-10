/**
 * Stats Storage — service layer for recording and querying usage statistics.
 *
 * Backend selection mirrors MessageStorage:
 * - Browser / Electron: IndexedDB (auto-detected)
 * - React Native: injected via setBackend()
 */

import type { StatsRecord, IStatsStorageBackend, AggregatedStats } from './statsTypes';
import { IndexedDBStatsBackend } from './statsIndexeddb';

export type { IStatsStorageBackend, StatsRecord, AggregatedStats } from './statsTypes';

class StatsStorage {
  private backend: IStatsStorageBackend;

  constructor() {
    if (typeof indexedDB !== 'undefined') {
      this.backend = new IndexedDBStatsBackend();
    } else {
      this.backend = {
        append: async () => {},
        loadAll: async () => [],
        loadBySession: async () => [],
        deleteBySession: async () => {},
        clear: async () => {},
      };
    }
  }

  setBackend(backend: IStatsStorageBackend): void {
    this.backend = backend;
  }

  /** Record a single interaction's stats (fire-and-forget). */
  async record(record: StatsRecord): Promise<void> {
    try {
      await this.backend.append(record);
    } catch (err) {
      console.error('[StatsStorage] record failed:', err);
    }
  }

  /** Aggregate all stats, optionally filtered by time range and session ids. */
  async aggregate(since?: number, until?: number, sessionIds?: string[]): Promise<AggregatedStats> {
    try {
      const records = await this.backend.loadAll(since, until);
      const filteredRecords = filterRecordsBySession(records, sessionIds);
      return computeAggregation(filteredRecords);
    } catch (err) {
      console.error('[StatsStorage] aggregate failed:', err);
      return EMPTY_STATS;
    }
  }

  /** Get raw records for a specific session. */
  async getSessionStats(sessionId: string): Promise<StatsRecord[]> {
    return this.backend.loadBySession(sessionId);
  }

  /** Delete stats when a session is permanently deleted. */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.backend.deleteBySession(sessionId);
    } catch (err) {
      console.error('[StatsStorage] deleteSession failed:', err);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.backend.clear();
    } catch (err) {
      console.error('[StatsStorage] clear failed:', err);
    }
  }
}

function filterRecordsBySession(records: StatsRecord[], sessionIds?: string[]): StatsRecord[] {
  if (sessionIds === undefined) return records;
  if (sessionIds.length === 0) return [];

  const sessionIdSet = new Set(sessionIds);
  return records.filter((record) => sessionIdSet.has(record.sessionId));
}

const EMPTY_STATS: AggregatedStats = {
  totalSessions: 0,
  totalInteractions: 0,
  totalMessages: 0,
  totalTokens: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalDuration: 0,
  totalToolCalls: 0,
  totalSteps: 0,
  avgDuration: 0,
  avgTokensPerInteraction: 0,
  errorCount: 0,
  byModel: {},
  byProvider: {},
  byDate: {},
  byProject: {},
  byTool: {},
  byFinishReason: {},
};

function addToBucket(
  map: Record<string, { count: number; totalTokens: number; inputTokens: number; outputTokens: number; totalDuration: number }>,
  key: string,
  r: StatsRecord,
) {
  if (!map[key]) map[key] = { count: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, totalDuration: 0 };
  map[key].count++;
  map[key].totalTokens += r.totalTokens;
  map[key].inputTokens += r.inputTokens;
  map[key].outputTokens += r.outputTokens;
  map[key].totalDuration += r.duration;
}

function computeAggregation(records: StatsRecord[]): AggregatedStats {
  if (records.length === 0) return EMPTY_STATS;

  const sessionIds = new Set<string>();
  const byModel: AggregatedStats['byModel'] = {};
  const byProvider: AggregatedStats['byProvider'] = {};
  const byDate: AggregatedStats['byDate'] = {};
  const byProject: AggregatedStats['byProject'] = {};
  const byTool: AggregatedStats['byTool'] = {};
  const byFinishReason: AggregatedStats['byFinishReason'] = {};
  let totalMessages = 0, totalTokens = 0, totalInputTokens = 0, totalOutputTokens = 0;
  let totalDuration = 0, totalToolCalls = 0, totalSteps = 0, errorCount = 0;

  for (const r of records) {
    sessionIds.add(r.sessionId);
    totalMessages += r.messageCount;
    totalTokens += r.totalTokens;
    totalInputTokens += r.inputTokens;
    totalOutputTokens += r.outputTokens;
    totalDuration += r.duration;
    totalToolCalls += r.toolCallCount ?? 0;
    totalSteps += r.stepCount ?? 0;
    if (r.error) errorCount++;

    addToBucket(byModel, r.model, r);
    addToBucket(byProvider, r.provider, r);
    addToBucket(byDate, r.date, r);
    if (r.projectId) addToBucket(byProject, r.projectId, r);

    // by tool
    if (r.toolCalls) {
      const seen = new Set<string>();
      for (const name of r.toolCalls) {
        if (!byTool[name]) byTool[name] = { count: 0, interactions: 0 };
        byTool[name].count++;
        if (!seen.has(name)) {
          byTool[name].interactions++;
          seen.add(name);
        }
      }
    }

    // by finish reason
    if (r.finishReason) {
      byFinishReason[r.finishReason] = (byFinishReason[r.finishReason] ?? 0) + 1;
    }
  }

  const n = records.length;
  return {
    totalSessions: sessionIds.size,
    totalInteractions: n,
    totalMessages,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalDuration,
    totalToolCalls,
    totalSteps,
    avgDuration: Math.round(totalDuration / n),
    avgTokensPerInteraction: Math.round(totalTokens / n),
    errorCount,
    byModel,
    byProvider,
    byDate,
    byProject,
    byTool,
    byFinishReason,
  };
}

export const statsStorage = new StatsStorage();
