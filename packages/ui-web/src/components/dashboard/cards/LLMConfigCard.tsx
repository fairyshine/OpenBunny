import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@cyberbunny/shared';
import { Brain } from 'lucide-react';
import { Badge } from '../../ui/badge';

export default function LLMConfigCard() {
  const { t } = useTranslation();
  const llmConfig = useSessionStore((s) => s.llmConfig);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('dashboard.llmConfig')}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('settings.provider')}</span>
          <Badge variant="outline" className="text-xs font-mono">
            {llmConfig.provider || '-'}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('settings.model')}</span>
          <Badge variant="outline" className="text-xs font-mono max-w-[140px] truncate">
            {llmConfig.model || '-'}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">API Key</span>
          <Badge variant={llmConfig.apiKey ? 'default' : 'destructive'} className="text-xs">
            {llmConfig.apiKey ? '✓' : '✗'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
