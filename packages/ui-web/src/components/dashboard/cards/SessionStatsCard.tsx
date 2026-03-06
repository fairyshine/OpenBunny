import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@cyberbunny/shared';
import { MessageSquare } from '../../icons';

export default function SessionStatsCard() {
  const { t } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);

  const { count, totalMessages, totalTokens } = useMemo(() => {
    const active = sessions.filter((s) => !s.deletedAt);
    return {
      count: active.length,
      totalMessages: active.reduce((sum, s) => sum + s.messages.length, 0),
      totalTokens: active.reduce(
        (sum, s) => sum + s.messages.reduce((mSum, m) => mSum + (m.metadata?.tokens ?? 0), 0),
        0,
      ),
    };
  }, [sessions]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('dashboard.sessionStats')}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-2xl font-bold">{count}</div>
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
    </div>
  );
}
