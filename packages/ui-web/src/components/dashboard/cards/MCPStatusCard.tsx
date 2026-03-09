import { useTranslation } from 'react-i18next';
import { useToolStore } from '@openbunny/shared';

export default function MCPStatusCard() {
  const { t } = useTranslation();
  const mcpConnections = useToolStore((s) => s.mcpConnections);

  const statusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  return (
    <div className="space-y-3">
      {mcpConnections.length === 0 ? (
        <span className="text-xs text-muted-foreground">{t('dashboard.noMcp')}</span>
      ) : (
        <div className="space-y-2">
          {mcpConnections.map((conn) => (
            <div key={conn.id} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${statusColor(conn.status)}`} />
              <span className="text-xs font-mono truncate">{conn.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{conn.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
