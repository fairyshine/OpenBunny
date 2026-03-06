import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, HardDrive, Activity, Monitor } from 'lucide-react';

interface SystemInfoData {
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
}

const formatBytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getPlatformName = (platform: string) => {
  switch (platform) {
    case 'darwin': return 'macOS';
    case 'win32': return 'Windows';
    case 'linux': return 'Linux';
    default: return platform;
  }
};

const getProgressColor = (percent: number) => {
  if (percent < 50) return 'bg-green-500';
  if (percent < 80) return 'bg-yellow-500';
  return 'bg-red-500';
};

export default function SystemInfoCard() {
  const { t } = useTranslation();
  const [systemInfo, setSystemInfo] = useState<SystemInfoData | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return;

    const fetchSystemInfo = async () => {
      try {
        const info = await (window as any).electronAPI.system.getInfo();
        setSystemInfo(info);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      }
    };

    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!systemInfo) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* CPU */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Cpu className="w-3.5 h-3.5 text-blue-500" />
          {t('status.system.cpu')}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold">{systemInfo.cpuUsage.toFixed(1)}%</span>
          <span className="text-xs text-muted-foreground">{systemInfo.cpus} {t('status.system.cores')}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor(systemInfo.cpuUsage)} transition-all duration-300`}
            style={{ width: `${Math.min(systemInfo.cpuUsage, 100)}%` }}
          />
        </div>
      </div>

      {/* Memory */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <HardDrive className="w-3.5 h-3.5 text-purple-500" />
          {t('status.system.memory')}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold">{systemInfo.memUsagePercent.toFixed(1)}%</span>
          <span className="text-xs text-muted-foreground">{formatBytes(systemInfo.usedMemory)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressColor(systemInfo.memUsagePercent)} transition-all duration-300`}
            style={{ width: `${Math.min(systemInfo.memUsagePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Load */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Activity className="w-3.5 h-3.5 text-orange-500" />
          {t('status.system.load')}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold">{systemInfo.loadAverage[0].toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">{t('status.system.load1m')}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('status.system.load5m')}: {systemInfo.loadAverage[1].toFixed(2)} · {t('status.system.load15m')}: {systemInfo.loadAverage[2].toFixed(2)}
        </p>
      </div>

      {/* System */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Monitor className="w-3.5 h-3.5 text-green-500" />
          {t('status.system.info')}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold">{getPlatformName(systemInfo.platform)}</span>
          <span className="text-xs text-muted-foreground">{systemInfo.arch}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('status.system.uptime')}: {formatUptime(systemInfo.uptime)}
        </p>
      </div>
    </div>
  );
}
