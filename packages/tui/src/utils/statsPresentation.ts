import type { AggregatedStats } from '@openbunny/shared';

export type StatsBreakdownKind = 'providers' | 'models' | 'tools' | 'dates' | 'projects' | 'finishReasons';

export const EMPTY_AGGREGATED_STATS: AggregatedStats = {
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

export function formatCompactStat(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

export function formatStatsDuration(value: number): string {
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function summarizeCountBuckets(
  entries: Array<[string, { count: number; totalTokens?: number; interactions?: number }]>,
  formatExtra?: (entry: { count: number; totalTokens?: number; interactions?: number }) => string,
) {
  if (entries.length === 0) {
    return '(none)';
  }

  const [label, data] = entries[0];
  const suffix = formatExtra ? formatExtra(data) : `${data.count} hits`;
  return `${label} · ${suffix}`;
}

export function summarizeStatsBreakdown(stats: AggregatedStats, kind: StatsBreakdownKind): string {
  switch (kind) {
    case 'providers':
      return summarizeCountBuckets(
        Object.entries(stats.byProvider).sort((left, right) => right[1].count - left[1].count),
        (entry) => `${entry.count} req · ${formatCompactStat(entry.totalTokens ?? 0)} tok`,
      );
    case 'models':
      return summarizeCountBuckets(
        Object.entries(stats.byModel).sort((left, right) => right[1].count - left[1].count),
        (entry) => `${entry.count} req · ${formatCompactStat(entry.totalTokens ?? 0)} tok`,
      );
    case 'tools':
      return summarizeCountBuckets(
        Object.entries(stats.byTool).sort((left, right) => right[1].count - left[1].count),
        (entry) => `${entry.count} call · ${entry.interactions ?? 0} turn`,
      );
    case 'dates':
      return summarizeCountBuckets(
        Object.entries(stats.byDate).sort((left, right) => right[0].localeCompare(left[0])),
        (entry) => `${entry.count} req · ${formatCompactStat(entry.totalTokens ?? 0)} tok`,
      );
    case 'projects':
      return summarizeCountBuckets(
        Object.entries(stats.byProject).sort((left, right) => right[1].count - left[1].count),
        (entry) => `${entry.count} req · ${formatCompactStat(entry.totalTokens ?? 0)} tok`,
      );
    case 'finishReasons': {
      const entries = Object.entries(stats.byFinishReason).sort((left, right) => right[1] - left[1]);
      if (entries.length === 0) return '(none)';
      const [label, count] = entries[0];
      return `${label} · ${count} hit${count === 1 ? '' : 's'}`;
    }
    default:
      return '(none)';
  }
}

export function getStatsBreakdownLines(
  stats: AggregatedStats,
  kind: StatsBreakdownKind,
  limit = 6,
): string[] {
  switch (kind) {
    case 'providers':
      return Object.entries(stats.byProvider)
        .sort((left, right) => right[1].count - left[1].count)
        .slice(0, limit)
        .map(([label, entry]) => `${label} · ${entry.count} req · ${formatCompactStat(entry.totalTokens)} tok`);
    case 'models':
      return Object.entries(stats.byModel)
        .sort((left, right) => right[1].count - left[1].count)
        .slice(0, limit)
        .map(([label, entry]) => `${label} · ${entry.count} req · ${formatCompactStat(entry.totalTokens)} tok`);
    case 'tools':
      return Object.entries(stats.byTool)
        .sort((left, right) => right[1].count - left[1].count)
        .slice(0, limit)
        .map(([label, entry]) => `${label} · ${entry.count} call${entry.count === 1 ? '' : 's'} · ${entry.interactions} interaction${entry.interactions === 1 ? '' : 's'}`);
    case 'dates':
      return Object.entries(stats.byDate)
        .sort((left, right) => right[0].localeCompare(left[0]))
        .slice(0, limit)
        .map(([label, entry]) => `${label} · ${entry.count} req · ${formatCompactStat(entry.totalTokens)} tok`);
    case 'projects':
      return Object.entries(stats.byProject)
        .sort((left, right) => right[1].count - left[1].count)
        .slice(0, limit)
        .map(([label, entry]) => `${label} · ${entry.count} req · ${formatCompactStat(entry.totalTokens)} tok`);
    case 'finishReasons':
      return Object.entries(stats.byFinishReason)
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([label, count]) => `${label} · ${count} hit${count === 1 ? '' : 's'}`);
    default:
      return [];
  }
}

export function buildStatsOverviewLines(stats: AggregatedStats): string[] {
  return [
    `Sessions: ${formatCompactStat(stats.totalSessions)}`,
    `Interactions: ${formatCompactStat(stats.totalInteractions)}`,
    `Messages: ${formatCompactStat(stats.totalMessages)}`,
    `Tokens: ${formatCompactStat(stats.totalTokens)} (${formatCompactStat(stats.totalInputTokens)} in / ${formatCompactStat(stats.totalOutputTokens)} out)`,
    `Tool calls: ${formatCompactStat(stats.totalToolCalls)} · Steps: ${formatCompactStat(stats.totalSteps)}`,
    `Avg duration: ${formatStatsDuration(stats.avgDuration)} · Avg tokens: ${formatCompactStat(stats.avgTokensPerInteraction)}`,
    `Errors: ${formatCompactStat(stats.errorCount)}`,
  ];
}

export function buildStatsCommandLines(stats: AggregatedStats): string[] {
  return [
    'Global stats:',
    ...buildStatsOverviewLines(stats),
    '',
    'Top providers:',
    ...(getStatsBreakdownLines(stats, 'providers', 4).length > 0 ? getStatsBreakdownLines(stats, 'providers', 4) : ['(none)']),
    '',
    'Top models:',
    ...(getStatsBreakdownLines(stats, 'models', 4).length > 0 ? getStatsBreakdownLines(stats, 'models', 4) : ['(none)']),
    '',
    'Top tools:',
    ...(getStatsBreakdownLines(stats, 'tools', 4).length > 0 ? getStatsBreakdownLines(stats, 'tools', 4) : ['(none)']),
  ];
}
