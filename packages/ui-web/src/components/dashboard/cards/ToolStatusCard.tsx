import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolStore } from '@openbunny/shared/stores/tools';
import { useAgentConfig } from '../../../hooks/useAgentConfig';
import { resolveToolDisplay } from '../../../lib/toolDisplay';
import { Badge } from '../../ui/badge';

export default function ToolStatusCard() {
  const { t } = useTranslation();
  const { enabledTools } = useAgentConfig();
  const mcpConnections = useToolStore((state) => state.mcpConnections);

  const toolBadges = useMemo(() => {
    return enabledTools.map((toolId) => ({
      id: toolId,
      ...resolveToolDisplay(toolId, mcpConnections),
    }));
  }, [enabledTools, mcpConnections]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {toolBadges.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('dashboard.noTools')}</span>
        ) : (
          toolBadges.map((tool) => (
            <Badge
              key={tool.id}
              variant="secondary"
              className={tool.isMCP ? 'text-xs max-w-full' : 'text-xs'}
              title={tool.rawId}
            >
              <span className="truncate">{tool.name}</span>
            </Badge>
          ))
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {t('dashboard.enabledCount', { count: enabledTools.length })}
      </div>
    </div>
  );
}
