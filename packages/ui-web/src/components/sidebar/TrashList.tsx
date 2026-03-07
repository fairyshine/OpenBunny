import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { Button } from '../ui/button';
import { Undo2, TrashIcon } from '../icons';
import { formatDate } from './utils';
import type { Session } from '@shared/types';

interface TrashListProps {
  deletedSessions: Session[];
  onItemClick: () => void;
}

export function TrashList({ deletedSessions, onItemClick }: TrashListProps) {
  const { t } = useTranslation();
  const { setCurrentSession, restoreSession, permanentlyDeleteSession } = useSessionStore();

  if (deletedSessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-xs">
        {t('sidebar.emptyTrash')}
      </div>
    );
  }

  return (
    <>
      {deletedSessions.map((session) => (
        <div
          key={session.id}
          onClick={() => {
            setCurrentSession(session.id);
            onItemClick();
          }}
          className="group flex items-center justify-between p-3 rounded-md cursor-pointer transition-all border border-transparent hover:bg-muted/50"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm text-muted-foreground">{session.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(session.deletedAt || session.updatedAt)}
            </p>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                restoreSession(session.id);
              }}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title={t('sidebar.restore')}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                permanentlyDeleteSession(session.id);
              }}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title={t('sidebar.permanentlyDelete')}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}
