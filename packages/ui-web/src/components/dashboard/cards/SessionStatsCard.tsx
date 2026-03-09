import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, useStatsStore } from '@openbunny/shared';
import type { AggregatedStats } from '@openbunny/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../ui/dialog';

type TimeRange = '7d' | '30d' | 'all';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('sv-SE'));
  }
  return days;
}

function DailyChart({ byDate, days }: { byDate: AggregatedStats['byDate']; days: string[] }) {
  const values = days.map((d) => byDate[d]?.totalTokens ?? 0);
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-px h-16">
      {values.map((v, i) => {
        const pct = Math.max((v / max) * 100, v > 0 ? 4 : 0);
        return (
          <div key={days[i]} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end" style={{ height: '48px' }}>
              <div
                className="w-full bg-primary/60 rounded-t-sm transition-all hover:bg-primary"
                style={{ height: `${pct}%` }}
                title={`${days[i]}: ${formatTokens(v)} tokens`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="truncate flex-1 font-mono text-foreground/80">{label}</span>
      <span className="text-muted-foreground whitespace-nowrap tabular-nums">{formatTokens(value)}{suffix}</span>
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const today = () => new Date().toLocaleDateString('sv-SE');

export default function SessionStatsCard() {
  const { t } = useTranslation();
  const { sessionCount, totalMessages, totalTokens } = useSessionStore((s) => s.sessionStats);
  const { stats, fetchStats } = useStatsStore();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<TimeRange>('7d');
  const [hovered, setHovered] = useState(false);

  // Always fetch all-time stats for the card (today data comes from byDate)
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const todayKey = useMemo(today, []);
  const todayData = stats?.byDate[todayKey];
  const todayTokens = todayData?.totalTokens ?? 0;
  const todayCount = todayData?.count ?? 0;

  // Re-fetch with range filter when dialog is open or range changes
  useEffect(() => {
    if (!open) return;
    const since = range === 'all' ? undefined
      : range === '30d' ? Date.now() - 30 * 86400_000
      : Date.now() - 7 * 86400_000;
    fetchStats(since);
  }, [open, range, fetchStats]);

  const days = useMemo(() => lastNDays(range === '30d' ? 30 : 7), [range]);

  const modelEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byModel).sort((a, b) => b[1].totalTokens - a[1].totalTokens);
  }, [stats]);

  const providerEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byProvider).sort((a, b) => b[1].totalTokens - a[1].totalTokens);
  }, [stats]);

  const toolEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byTool).sort((a, b) => b[1].count - a[1].count);
  }, [stats]);

  return (
    <>
      {/* 1x1 Card content */}
      <div
        className="h-full flex flex-col justify-center cursor-pointer select-none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setOpen(true)}
      >
        {hovered ? (
          /* Hover: all-time summary */
          <div className="grid grid-cols-3 gap-1 text-center animate-fade-in">
            <div>
              <div className="text-lg font-bold">{sessionCount}</div>
              <div className="text-[10px] text-muted-foreground">{t('dashboard.sessions')}</div>
            </div>
            <div>
              <div className="text-lg font-bold">{totalMessages}</div>
              <div className="text-[10px] text-muted-foreground">{t('dashboard.messages')}</div>
            </div>
            <div>
              <div className="text-lg font-bold">{formatTokens(totalTokens)}</div>
              <div className="text-[10px] text-muted-foreground">Tokens</div>
            </div>
          </div>
        ) : (
          /* Default: today stats */
          <div className="text-center space-y-1">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t('dashboard.today')}</div>
            <div className="text-3xl font-bold leading-none">{todayCount}</div>
            <div className="text-xs text-muted-foreground">{t('dashboard.todayInteractions')}</div>
            <div className="text-sm font-semibold text-muted-foreground">{formatTokens(todayTokens)} <span className="font-normal text-xs">{t('dashboard.todayTokens')}</span></div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('dashboard.usageStats')}</DialogTitle>
            <DialogDescription>{t('dashboard.sessionStats')}</DialogDescription>
          </DialogHeader>

          {/* Time range selector — fixed */}
          <div className="flex gap-1 shrink-0">
            {(['7d', '30d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  range === r
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {r === '7d' ? t('dashboard.last7days') : r === '30d' ? t('dashboard.last30days') : t('dashboard.allTime')}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">

          {/* Summary numbers — row 1: core */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{stats?.totalSessions ?? 0}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.sessions')}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{stats?.totalInteractions ?? 0}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.interactions')}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{formatTokens(stats?.totalInputTokens ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.inputTokens')}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{formatTokens(stats?.totalOutputTokens ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.outputTokens')}</div>
            </div>
          </div>

          {/* Summary numbers — row 2: extended */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{formatDuration(stats?.avgDuration ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.avgDuration')}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{formatTokens(stats?.avgTokensPerInteraction ?? 0)}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.avgTokens')}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{stats?.totalToolCalls ?? 0}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.toolCalls')}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xl font-bold">{stats?.totalSteps ?? 0}</div>
              <div className="text-xs text-muted-foreground">{t('dashboard.steps')}</div>
            </div>
          </div>

          {/* Daily trend chart */}
          {stats && range !== 'all' && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">{t('dashboard.byDate')}</div>
              <DailyChart byDate={stats.byDate} days={days} />
              <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                <span>{days[0]?.slice(5)}</span>
                <span>{days[Math.floor(days.length / 2)]?.slice(5)}</span>
                <span>{days[days.length - 1]?.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Per-model breakdown */}
          {modelEntries.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">{t('dashboard.byModel')}</div>
              <div className="space-y-2">
                {modelEntries.slice(0, 8).map(([model, data]) => (
                  <BarRow key={model} label={model} value={data.totalTokens} max={stats?.totalTokens ?? 1} />
                ))}
              </div>
            </div>
          )}

          {/* Per-provider breakdown */}
          {providerEntries.length > 1 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">{t('dashboard.byProvider')}</div>
              <div className="space-y-2">
                {providerEntries.map(([provider, data]) => (
                  <BarRow key={provider} label={provider} value={data.totalTokens} max={stats?.totalTokens ?? 1} />
                ))}
              </div>
            </div>
          )}

          {/* Per-tool breakdown */}
          {toolEntries.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-medium">{t('dashboard.byTool')}</div>
              <div className="space-y-2">
                {toolEntries.slice(0, 10).map(([tool, data]) => {
                  const maxCount = toolEntries[0]?.[1]?.count ?? 1;
                  return (
                    <div key={tool} className="flex items-center gap-2 text-xs">
                      <span className="truncate flex-1 font-mono text-foreground/80">{tool}</span>
                      <span className="text-muted-foreground whitespace-nowrap tabular-nums">{data.count}x</span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(data.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats?.totalInteractions === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">{t('dashboard.noStats')}</div>
          )}

          </div>{/* end scrollable content */}
        </DialogContent>
      </Dialog>
    </>
  );
}
