import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  consoleLogger,
  DEFAULT_AGENT_ID,
  statsStorage,
  useAgentStore,
  useSessionStore,
  useSkillStore,
  useToolStore,
} from '@openbunny/shared';
import type { AggregatedStats, LogCategory, LogEntry, LogLevel } from '@openbunny/shared';
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  Clock3,
  Cpu,
  FolderKanban,
  Gauge,
  HardDrive,
  Layers3,
  Network,
  RefreshCw,
  TerminalSquare,
  Wrench,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type SystemInfoData = {
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  cpuModel: string;
  cpuUsage: number;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memUsagePercent: number;
  loadAverage: number[];
  uptime: number;
  nodeVersion: string;
  electronVersion: string;
};

type MonitorMode = 'desktop' | 'browser';

type MonitorSample = {
  timestamp: number;
  cpu: number;
  memory: number;
  load: number;
  heapPercent: number;
  heapUsedMB: number;
  eventLoopLag: number;
  domNodes: number;
};

type OverviewStat = {
  id: string;
  label: string;
  value: string;
  hint: string;
  icon: typeof Bot;
};

type BreakdownEntry = {
  label: string;
  value: number;
  hint?: string;
};

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

const MAX_MONITOR_SAMPLES = 30;
const STATS_REFRESH_MS = 10_000;
const MONITOR_REFRESH_MS = 2_000;

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatPlatform(platform?: string): string {
  switch (platform) {
    case 'darwin': return 'macOS';
    case 'win32': return 'Windows';
    case 'linux': return 'Linux';
    default: return platform || 'Web';
  }
}

function createRecentDateKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    keys.push(date.toLocaleDateString('sv-SE'));
  }
  return keys;
}

function toBreakdownEntries(
  entries: [string, { count: number; totalTokens: number }][],
  valueKey: 'count' | 'totalTokens',
  limit = 6,
): BreakdownEntry[] {
  return entries
    .sort((a, b) => b[1][valueKey] - a[1][valueKey])
    .slice(0, limit)
    .map(([label, data]) => ({
      label,
      value: data[valueKey],
      hint: valueKey === 'count' ? `${formatCompact(data.totalTokens)} tokens` : `${data.count} hits`,
    }));
}

function toCountEntries(entries: Record<string, number>, limit = 6): BreakdownEntry[] {
  return Object.entries(entries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function Sparkline({ values, strokeClass }: { values: number[]; strokeClass: string }) {
  const safeValues = values.length > 1 ? values : [0, ...(values.length === 1 ? values : [0])];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const points = safeValues.map((value, index) => {
    const x = (index / (safeValues.length - 1 || 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full overflow-visible">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={strokeClass}
      />
    </svg>
  );
}

function OverviewCard({ icon: Icon, label, value, hint }: OverviewStat) {
  return (
    <Card className="border-elegant">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold leading-none">{value}</div>
            <div className="text-xs text-muted-foreground">{hint}</div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonitorCard({
  title,
  value,
  hint,
  values,
  strokeClass,
}: {
  title: string;
  value: string;
  hint: string;
  values: number[];
  strokeClass: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold leading-none mt-1">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      </div>
      <Sparkline values={values} strokeClass={strokeClass} />
    </div>
  );
}

function BreakdownList({ entries, formatValue = formatCompact }: { entries: BreakdownEntry[]; formatValue?: (value: number) => string }) {
  const max = Math.max(...entries.map((entry) => entry.value), 1);

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground">-</div>
      ) : entries.map((entry) => (
        <div key={entry.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{entry.label}</span>
            <span className="font-medium tabular-nums shrink-0">{formatValue(entry.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(entry.value / max) * 100}%` }} />
          </div>
          {entry.hint && <div className="text-[11px] text-muted-foreground">{entry.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function DailyBars({
  items,
  tokenFormatter,
}: {
  items: Array<{ key: string; tokens: number; interactions: number }>;
  tokenFormatter: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.tokens), 1);

  return (
    <div className="space-y-3">
      <div className="h-48 flex items-end gap-2">
        {items.map((item) => {
          const height = Math.max((item.tokens / max) * 100, item.tokens > 0 ? 5 : 0);
          return (
            <div key={item.key} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end h-40">
                <div
                  className="w-full rounded-t-md bg-primary shadow-sm transition-all hover:bg-primary/80"
                  style={{ height: `${height}%` }}
                  title={`${item.key}: ${tokenFormatter(item.tokens)} · ${item.interactions} interactions`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{item.key.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div>{items[0]?.key}</div>
        <div className="text-center">{items[Math.floor(items.length / 2)]?.key}</div>
        <div className="text-right">{items[items.length - 1]?.key}</div>
      </div>
    </div>
  );
}

const SECTION_IDS = {
  overview: 'global-stats-overview',
  monitor: 'global-stats-monitor',
  runtime: 'global-stats-runtime',
  trend: 'global-stats-trend',
  usage: 'global-stats-usage',
  logs: 'global-stats-logs',
} as const;

export default function GlobalStatsPage() {
  const { t, i18n } = useTranslation();
  const globalSessions = useSessionStore((state) => state.sessions);
  const globalProjects = useSessionStore((state) => state.projects);
  const openSessionIds = useSessionStore((state) => state.openSessionIds);
  const agents = useAgentStore((state) => state.agents);
  const agentGroups = useAgentStore((state) => state.agentGroups);
  const agentSessions = useAgentStore((state) => state.agentSessions);
  const agentProjects = useAgentStore((state) => state.agentProjects);
  const skills = useSkillStore((state) => state.skills);
  const mcpConnections = useToolStore((state) => state.mcpConnections);
  const [stats, setStats] = useState<AggregatedStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(() => consoleLogger.getLogs());
  const [systemInfo, setSystemInfo] = useState<SystemInfoData | null>(null);
  const [monitorMode, setMonitorMode] = useState<MonitorMode>('browser');
  const [monitorSamples, setMonitorSamples] = useState<MonitorSample[]>([]);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const aggregated = await statsStorage.aggregate();
      setStats(aggregated);
      setLastUpdatedAt(Date.now());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = window.setInterval(loadStats, STATS_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadStats]);

  useEffect(() => {
    setLogs(consoleLogger.getLogs());
    return consoleLogger.subscribe((nextLogs) => setLogs(nextLogs));
  }, []);

  useEffect(() => {
    let isMounted = true;
    let expected = performance.now() + MONITOR_REFRESH_MS;

    const sample = async () => {
      const now = performance.now();
      const lag = Math.max(0, now - expected);
      expected = now + MONITOR_REFRESH_MS;

      const perfWithMemory = performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      };
      const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      const heapUsedBytes = perfWithMemory.memory?.usedJSHeapSize ?? 0;
      const heapLimitBytes = perfWithMemory.memory?.jsHeapSizeLimit ?? 0;
      const domNodes = typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0;

      let nextSystemInfo: SystemInfoData | null = null;
      let nextMode: MonitorMode = 'browser';
      if (electronAPI?.system?.getInfo) {
        try {
          nextSystemInfo = await electronAPI.system.getInfo();
          nextMode = 'desktop';
        } catch {
          nextSystemInfo = null;
        }
      }

      if (!isMounted) return;

      setMonitorMode(nextMode);
      setSystemInfo(nextSystemInfo);
      setMonitorSamples((current) => {
        const samplePoint: MonitorSample = {
          timestamp: Date.now(),
          cpu: nextSystemInfo?.cpuUsage ?? 0,
          memory: nextSystemInfo?.memUsagePercent ?? 0,
          load: nextSystemInfo ? Math.min((nextSystemInfo.loadAverage[0] / Math.max(nextSystemInfo.cpus, 1)) * 100, 100) : 0,
          heapPercent: heapLimitBytes > 0 ? Math.min((heapUsedBytes / heapLimitBytes) * 100, 100) : 0,
          heapUsedMB: heapUsedBytes / (1024 ** 2),
          eventLoopLag: lag,
          domNodes,
        };
        return [...current.slice(-(MAX_MONITOR_SAMPLES - 1)), samplePoint];
      });
    };

    sample();
    const interval = window.setInterval(sample, MONITOR_REFRESH_MS);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const activeGlobalSessions = useMemo(
    () => globalSessions.filter((session) => !session.deletedAt),
    [globalSessions],
  );

  const agentSessionTotal = useMemo(
    () => Object.entries(agentSessions)
      .filter(([agentId]) => agentId !== DEFAULT_AGENT_ID)
      .reduce((sum, [, sessions]) => sum + sessions.length, 0),
    [agentSessions],
  );

  const totalProjects = useMemo(
    () => globalProjects.length + Object.values(agentProjects).reduce((sum, projects) => sum + projects.length, 0),
    [agentProjects, globalProjects.length],
  );

  const uniqueEnabledTools = useMemo(
    () => new Set(agents.flatMap((agent) => agent.enabledTools)).size,
    [agents],
  );

  const overviewStats = useMemo<OverviewStat[]>(() => {
    const customAgentCount = agents.filter((agent) => !agent.isDefault).length;
    const totalSessionCount = activeGlobalSessions.length + agentSessionTotal;
    const trashCount = globalSessions.length - activeGlobalSessions.length;

    return [
      {
        id: 'agents',
        label: t('stats.totalAgents'),
        value: formatCompact(agents.length),
        hint: t('stats.customAgentsHint', { count: customAgentCount }),
        icon: Bot,
      },
      {
        id: 'groups',
        label: t('stats.agentGroups'),
        value: formatCompact(agentGroups.length),
        hint: t('stats.mcpHint', { count: mcpConnections.length }),
        icon: Layers3,
      },
      {
        id: 'sessions',
        label: t('stats.totalSessions'),
        value: formatCompact(totalSessionCount),
        hint: t('stats.openTabsHint', { count: openSessionIds.length, trash: trashCount }),
        icon: Boxes,
      },
      {
        id: 'projects',
        label: t('stats.projects'),
        value: formatCompact(totalProjects),
        hint: t('stats.skillsHint', { count: skills.length }),
        icon: FolderKanban,
      },
      {
        id: 'interactions',
        label: t('stats.totalInteractions'),
        value: formatCompact(stats.totalInteractions),
        hint: t('stats.avgDurationHint', { value: formatDuration(stats.avgDuration) }),
        icon: Activity,
      },
      {
        id: 'tokens',
        label: t('stats.totalTokens'),
        value: formatCompact(stats.totalTokens),
        hint: t('stats.avgTokensHint', { value: formatCompact(stats.avgTokensPerInteraction) }),
        icon: Gauge,
      },
      {
        id: 'tools',
        label: t('stats.enabledTools'),
        value: formatCompact(uniqueEnabledTools),
        hint: t('stats.toolCallsHint', { count: stats.totalToolCalls }),
        icon: Wrench,
      },
      {
        id: 'logs',
        label: t('stats.logEntries'),
        value: formatCompact(logs.length),
        hint: t('stats.errorHint', { count: stats.errorCount }),
        icon: TerminalSquare,
      },
    ];
  }, [activeGlobalSessions.length, agentGroups.length, agentSessionTotal, agents, globalSessions.length, logs.length, mcpConnections.length, openSessionIds.length, skills.length, stats, t, totalProjects, uniqueEnabledTools]);

  const recentDays = useMemo(() => {
    const keys = createRecentDateKeys(14);
    return keys.map((key) => ({
      key,
      tokens: stats.byDate[key]?.totalTokens ?? 0,
      interactions: stats.byDate[key]?.count ?? 0,
    }));
  }, [stats.byDate]);

  const topAgents = useMemo<BreakdownEntry[]>(() => {
    return agents
      .map((agent) => {
        const sessionCount = agent.id === DEFAULT_AGENT_ID
          ? activeGlobalSessions.length
          : (agentSessions[agent.id]?.length ?? 0);
        return {
          label: agent.name,
          value: sessionCount,
          hint: agent.isDefault ? t('sidebar.agent.default') : agent.description || undefined,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [activeGlobalSessions.length, agentSessions, agents, t]);

  const modelEntries = useMemo(
    () => toBreakdownEntries(Object.entries(stats.byModel), 'totalTokens', 8),
    [stats.byModel],
  );

  const providerEntries = useMemo(
    () => toBreakdownEntries(Object.entries(stats.byProvider), 'totalTokens', 8),
    [stats.byProvider],
  );

  const toolEntries = useMemo(
    () => Object.entries(stats.byTool)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([label, data]) => ({ label, value: data.count, hint: `${data.interactions} interactions` })),
    [stats.byTool],
  );

  const finishReasonEntries = useMemo(
    () => toCountEntries(stats.byFinishReason, 8),
    [stats.byFinishReason],
  );

  const logLevelEntries = useMemo<BreakdownEntry[]>(() => {
    const counts = logs.reduce<Record<LogLevel, number>>((acc, log) => {
      acc[log.level] = (acc[log.level] ?? 0) + 1;
      return acc;
    }, { info: 0, success: 0, warning: 0, error: 0, debug: 0 });

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }));
  }, [logs]);

  const logCategoryEntries = useMemo<BreakdownEntry[]>(() => {
    const counts = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.category] = (acc[log.category] ?? 0) + 1;
      return acc;
    }, {} as Record<LogCategory, number>);

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }, [logs]);

  const latestSample = monitorSamples[monitorSamples.length - 1];
  const metricCards = useMemo(() => {
    if (monitorMode === 'desktop') {
      return [
        {
          title: t('status.system.cpu'),
          value: latestSample ? formatPercent(latestSample.cpu) : '--',
          hint: systemInfo ? `${systemInfo.cpus} ${t('status.system.cores')}` : t('common.loading'),
          values: monitorSamples.map((sample) => sample.cpu),
          strokeClass: 'text-sky-500',
        },
        {
          title: t('status.system.memory'),
          value: latestSample ? formatPercent(latestSample.memory) : '--',
          hint: systemInfo ? `${formatBytes(systemInfo.usedMemory)} / ${formatBytes(systemInfo.totalMemory)}` : t('common.loading'),
          values: monitorSamples.map((sample) => sample.memory),
          strokeClass: 'text-violet-500',
        },
        {
          title: t('status.system.load'),
          value: systemInfo ? systemInfo.loadAverage[0].toFixed(2) : '--',
          hint: systemInfo ? `${t('status.system.load5m')}: ${systemInfo.loadAverage[1].toFixed(2)} · ${t('status.system.load15m')}: ${systemInfo.loadAverage[2].toFixed(2)}` : t('common.loading'),
          values: monitorSamples.map((sample) => sample.load),
          strokeClass: 'text-amber-500',
        },
      ];
    }

    return [
      {
        title: t('stats.heapUsage'),
        value: latestSample ? `${latestSample.heapUsedMB.toFixed(0)} MB` : '--',
        hint: latestSample ? formatPercent(latestSample.heapPercent) : t('stats.browserMetricsHint'),
        values: monitorSamples.map((sample) => sample.heapPercent),
        strokeClass: 'text-sky-500',
      },
      {
        title: t('stats.eventLoopLag'),
        value: latestSample ? `${latestSample.eventLoopLag.toFixed(1)} ms` : '--',
        hint: t('stats.monitorWindowHint', { count: MAX_MONITOR_SAMPLES }),
        values: monitorSamples.map((sample) => Math.min(sample.eventLoopLag, 120)),
        strokeClass: 'text-rose-500',
      },
      {
        title: t('stats.domNodes'),
        value: latestSample ? formatCompact(latestSample.domNodes) : '--',
        hint: t('stats.browserRuntime'),
        values: monitorSamples.map((sample) => Math.min(sample.domNodes, 5000)),
        strokeClass: 'text-emerald-500',
      },
    ];
  }, [latestSample, monitorMode, monitorSamples, systemInfo, t]);

  const runtimeItems = useMemo(() => {
    const browserNav = navigator as Navigator & { deviceMemory?: number };
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const items = [
      { label: t('stats.runtimeMode'), value: monitorMode === 'desktop' ? t('stats.desktopRuntime') : t('stats.browserRuntime') },
      { label: t('stats.locale'), value: i18n.language },
      { label: t('stats.timezone'), value: timezone },
      { label: t('stats.onlineStatus'), value: online ? t('stats.online') : t('stats.offline') },
      { label: t('stats.cores'), value: `${navigator.hardwareConcurrency || 0}` },
      { label: t('stats.deviceMemory'), value: browserNav.deviceMemory ? `${browserNav.deviceMemory} GB` : '-' },
    ];

    if (systemInfo) {
      items.unshift(
        { label: t('stats.platform'), value: `${formatPlatform(systemInfo.platform)} · ${systemInfo.arch}` },
        { label: t('stats.hostname'), value: systemInfo.hostname },
      );
      items.push(
        { label: t('stats.nodeVersion'), value: systemInfo.nodeVersion },
        { label: t('stats.electronVersion'), value: systemInfo.electronVersion },
        { label: t('status.system.uptime'), value: formatUptime(systemInfo.uptime) },
      );
    }

    return items;
  }, [i18n.language, monitorMode, systemInfo, t]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="min-h-full p-4 sm:p-6 gradient-bg">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          <Card id={SECTION_IDS.overview} className="border-elegant bg-card/90 backdrop-blur-sm scroll-mt-4">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      {t('stats.title')}
                    </CardTitle>
                    <Badge variant="secondary">{monitorMode === 'desktop' ? t('stats.desktopRuntime') : t('stats.browserRuntime')}</Badge>
                    <Badge variant={stats.errorCount > 0 ? 'destructive' : 'outline'}>
                      {t('stats.errorHint', { count: stats.errorCount })}
                    </Badge>
                  </div>
                  <CardDescription>{t('stats.subtitle')}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {t('stats.refreshedAt', { time: lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '--:--:--' })}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadStats()}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('stats.refresh')}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {overviewStats.map((item) => <OverviewCard key={item.id} {...item} />)}
          </div>

          <div id={SECTION_IDS.monitor} className="grid grid-cols-1 xl:grid-cols-3 gap-4 scroll-mt-4">
            <Card className="xl:col-span-2 border-elegant">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  {t('stats.liveMonitor')}
                </CardTitle>
                <CardDescription>{t('stats.liveMonitorDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metricCards.map((metric) => <MonitorCard key={metric.title} {...metric} />)}
              </CardContent>
            </Card>

            <Card id={SECTION_IDS.runtime} className="border-elegant scroll-mt-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  {t('stats.runtime')}
                </CardTitle>
                <CardDescription>{t('stats.runtimeDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runtimeItems.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-right font-medium break-all">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div id={SECTION_IDS.trend} className="grid grid-cols-1 xl:grid-cols-3 gap-4 scroll-mt-4">
            <Card className="xl:col-span-2 border-elegant">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  {t('stats.usageTrend')}
                </CardTitle>
                <CardDescription>{t('stats.usageTrendDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyBars items={recentDays} tokenFormatter={formatCompact} />
              </CardContent>
            </Card>

            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" />
                  {t('stats.topAgents')}
                </CardTitle>
                <CardDescription>{t('stats.topAgentsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={topAgents} />
              </CardContent>
            </Card>
          </div>

          <div id={SECTION_IDS.usage} className="grid grid-cols-1 xl:grid-cols-3 gap-4 scroll-mt-4">
            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base">{t('stats.models')}</CardTitle>
                <CardDescription>{t('stats.modelsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={modelEntries} />
              </CardContent>
            </Card>
            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base">{t('stats.providers')}</CardTitle>
                <CardDescription>{t('stats.providersDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={providerEntries} />
              </CardContent>
            </Card>
            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base">{t('stats.tools')}</CardTitle>
                <CardDescription>{t('stats.toolsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={toolEntries} />
              </CardContent>
            </Card>
          </div>

          <div id={SECTION_IDS.logs} className="grid grid-cols-1 xl:grid-cols-3 gap-4 scroll-mt-4">
            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-primary" />
                  {t('stats.finishReasons')}
                </CardTitle>
                <CardDescription>{t('stats.finishReasonsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={finishReasonEntries} />
              </CardContent>
            </Card>
            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-primary" />
                  {t('stats.logLevels')}
                </CardTitle>
                <CardDescription>{t('stats.logLevelsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={logLevelEntries} />
              </CardContent>
            </Card>
            <Card className="border-elegant">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" />
                  {t('stats.logCategories')}
                </CardTitle>
                <CardDescription>{t('stats.logCategoriesDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList entries={logCategoryEntries} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
