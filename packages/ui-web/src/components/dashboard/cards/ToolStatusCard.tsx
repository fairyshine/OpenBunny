import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@cyberbunny/shared';
import { Wrench } from 'lucide-react';
import { Badge } from '../../ui/badge';

export default function ToolStatusCard() {
  const { t } = useTranslation();
  const enabledTools = useSettingsStore((s) => s.enabledTools);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('dashboard.toolStatus')}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {enabledTools.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('dashboard.noTools')}</span>
        ) : (
          enabledTools.map((tool) => (
            <Badge key={tool} variant="secondary" className="text-xs font-mono">
              {tool}
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
