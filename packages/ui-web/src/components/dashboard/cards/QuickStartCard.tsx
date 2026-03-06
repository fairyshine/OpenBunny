import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/badge';
import { Lightbulb } from 'lucide-react';

export default function QuickStartCard() {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('status.quickStart')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="font-mono text-xs border-elegant">
          {t('status.badge.python')}
        </Badge>
        <Badge variant="outline" className="font-mono text-xs border-elegant">
          {t('status.badge.search')}
        </Badge>
        <Badge variant="outline" className="font-mono text-xs border-elegant">
          {t('status.badge.file')}
        </Badge>
      </div>
    </div>
  );
}
