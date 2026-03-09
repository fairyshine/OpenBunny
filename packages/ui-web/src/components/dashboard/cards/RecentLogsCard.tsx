import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { consoleLogger } from '@openbunny/shared';
import type { LogEntry } from '@openbunny/shared';
import { Badge } from '../../ui/badge';

export default function RecentLogsCard() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    setLogs(consoleLogger.getLogs().slice(-5));
    const unsub = consoleLogger.subscribe((allLogs) => {
      setLogs(allLogs.slice(-5));
    });
    return unsub;
  }, []);

  const allLogs = consoleLogger.getLogs();
  const errorCount = allLogs.filter((l) => l.level === 'error').length;
  const warnCount = allLogs.filter((l) => l.level === 'warning').length;

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'success': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 ml-auto">
        {errorCount > 0 && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0">
            {errorCount} errors
          </Badge>
        )}
        {warnCount > 0 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 text-yellow-600">
            {warnCount} warnings
          </Badge>
        )}
      </div>
      {logs.length === 0 ? (
        <span className="text-xs text-muted-foreground">{t('console.noLogs')}</span>
      ) : (
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-1.5 text-xs">
              <span className={`shrink-0 ${levelColor(log.level)}`}>●</span>
              <span className="text-muted-foreground shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="truncate">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
