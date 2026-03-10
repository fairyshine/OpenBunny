import { create } from 'zustand';
import { statsStorage } from '../services/storage/statsStorage';
import type { AggregatedStats } from '../services/storage/statsStorage';

interface StatsState {
  stats: AggregatedStats | null;
  isLoading: boolean;
  /** Fetch aggregated stats, optionally filtered by time range. */
  fetchStats: (since?: number, until?: number, sessionIds?: string[]) => Promise<void>;
  /** Re-fetch after recording new stats. */
  invalidate: () => void;
}

export const useStatsStore = create<StatsState>()((set, get) => ({
  stats: null,
  isLoading: false,

  fetchStats: async (since?: number, until?: number, sessionIds?: string[]) => {
    set({ isLoading: true });
    try {
      const stats = await statsStorage.aggregate(since, until, sessionIds);
      set({ stats, isLoading: false });
    } catch {
      set({ stats: null, isLoading: false });
    }
  },

  invalidate: () => {
    get().fetchStats();
  },
}));
