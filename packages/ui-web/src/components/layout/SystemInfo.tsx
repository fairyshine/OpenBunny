import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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

export default function SystemInfo() {
  const { t } = useTranslation();
  const [systemInfo, setSystemInfo] = useState<SystemInfoData | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    const checkPlatform = () => {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        setIsDesktop(true);
        fetchSystemInfo();
        // Update every 3 seconds
        const interval = setInterval(fetchSystemInfo, 3000);
        return () => clearInterval(interval);
      }
    };

    const fetchSystemInfo = async () => {
      try {
        const info = await (window as any).electronAPI.system.getInfo();
        setSystemInfo(info);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      }
    };

    const cleanup = checkPlatform();
    return cleanup;
  }, []);

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

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

  if (!isDesktop || !systemInfo) {
    return null;
  }

  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* CPU Info */}
      <Card className="border-elegant hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            {t('status.system.cpu')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{systemInfo.cpuUsage.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">{t('status.system.usage')}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate" title={systemInfo.cpuModel}>
              {systemInfo.cpus} {t('status.system.cores')}
            </p>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(systemInfo.cpuUsage)} transition-all duration-300`}
                style={{ width: `${Math.min(systemInfo.cpuUsage, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memory Info */}
      <Card className="border-elegant hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-purple-500" />
            {t('status.system.memory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{systemInfo.memUsagePercent.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">{t('status.system.usage')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(systemInfo.usedMemory)} / {formatBytes(systemInfo.totalMemory)}
            </p>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(systemInfo.memUsagePercent)} transition-all duration-300`}
                style={{ width: `${Math.min(systemInfo.memUsagePercent, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Load Average */}
      <Card className="border-elegant hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            {t('status.system.load')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{systemInfo.loadAverage[0].toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">{t('status.system.load1m')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('status.system.load5m')}: {systemInfo.loadAverage[1].toFixed(2)} · {t('status.system.load15m')}: {systemInfo.loadAverage[2].toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-elegant hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Monitor className="w-4 h-4 text-green-500" />
            {t('status.system.info')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{getPlatformName(systemInfo.platform)}</span>
              <span className="text-xs text-muted-foreground">{systemInfo.arch}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('status.system.uptime')}: {formatUptime(systemInfo.uptime)}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={systemInfo.hostname}>
              {systemInfo.hostname}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
