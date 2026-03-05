import { useSessionStore } from '@shared/stores/session';
import { X } from '../icons';
import { Button } from '../ui/button';

export default function SessionTabs() {
  const { sessions, openSessionIds, currentSessionId, setCurrentSession, closeSession } = useSessionStore();

  const openSessions = sessions.filter(s => openSessionIds.includes(s.id) && !s.deletedAt);

  if (openSessions.length === 0) return null;

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center overflow-x-auto scrollbar-thin">
        {openSessions.map((session) => (
          <div
            key={session.id}
            className={`group relative flex items-center gap-2 px-4 py-2 border-r border-border cursor-pointer transition-colors min-w-[120px] max-w-[200px] ${
              currentSessionId === session.id
                ? 'bg-foreground/5 border-b-2 border-b-primary'
                : 'hover:bg-muted/50'
            } ${session.isStreaming ? 'streaming-tab' : ''}`}
            onClick={() => setCurrentSession(session.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.name}</p>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id);
              }}
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
