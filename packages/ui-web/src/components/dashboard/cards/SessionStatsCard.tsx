import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@cyberbunny/shared';

export default function SessionStatsCard() {
  const { t } = useTranslation();
  const { sessionCount, totalMessages, totalTokens } = useSessionStore((s) => s.sessionStats);

  return (
    <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-2xl font-bold">{sessionCount}</div>
          <div className="text-xs text-muted-foreground">{t('dashboard.sessions')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{totalMessages}</div>
          <div className="text-xs text-muted-foreground">{t('dashboard.messages')}</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}</div>
          <div className="text-xs text-muted-foreground">Tokens</div>
        </div>
      </div>
  );
}
