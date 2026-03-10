import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@shared/stores/agent';
import { useSettingsStore } from '@shared/stores/settings';
import type { Session } from '@shared/types';
import { Button } from '../ui/button';
import { SessionContextMenu } from './SessionContextMenu';
import { SESSION_TYPE_ICONS } from './SessionTypeFilterBar';
import { formatDate } from './utils';
import { useWorkspaceSession } from '../../hooks/useWorkspaceSession';

interface SessionItemProps {
  session: Session;
  editingId: string | null;
  editingName: string;
  draggedSessionId: string | null;
  onEditingNameChange: (name: string) => void;
  onStartRename: (sessionId: string, currentName: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDragStart: (sessionId: string) => void;
  onDragEnd: () => void;
  onItemClick: () => void;
  onSessionSelect?: () => void;
}

export function SessionItem({
  session,
  editingId,
  editingName,
  draggedSessionId,
  onEditingNameChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDragStart,
  onDragEnd,
  onItemClick,
  onSessionSelect,
}: SessionItemProps) {
  const { t } = useTranslation();
  const { setCurrentSession, deleteSession } = useSessionStore();
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const setAgentCurrentSession = useAgentStore((s) => s.setAgentCurrentSession);
  const deleteAgentSession = useAgentStore((s) => s.deleteAgentSession);
  const { currentSession } = useWorkspaceSession();
  const enableSessionTabs = useSettingsStore(s => s.enableSessionTabs);
  const editInputRef = useRef<HTMLInputElement>(null);
  const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;

  const isEditing = editingId === session.id;
  const readOnly = session.sessionType === 'agent';

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (isEditing) return;
    if (enableSessionTabs) {
      if (currentSession?.id === session.id) {
        if (isDefaultAgent) {
          useSessionStore.getState().closeSession(session.id);
        } else {
          setAgentCurrentSession(currentAgentId, null);
        }
      } else {
        if (isDefaultAgent) {
          useSessionStore.getState().openSession(session.id);
        } else {
          setAgentCurrentSession(currentAgentId, session.id);
        }
        onSessionSelect?.();
      }
    } else {
      if (currentSession?.id === session.id) {
        if (isDefaultAgent) {
          useSessionStore.setState({ currentSessionId: null });
        } else {
          setAgentCurrentSession(currentAgentId, null);
        }
      } else {
        if (isDefaultAgent) {
          setCurrentSession(session.id);
        } else {
          setAgentCurrentSession(currentAgentId, session.id);
        }
        onSessionSelect?.();
      }
    }
    onItemClick();
  };

  return (
    <div
      draggable={!readOnly && !isEditing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(session.id);
      }}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      onDoubleClick={() => {
        if (!readOnly) onStartRename(session.id, session.name);
      }}
      className={`group relative flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all ${
        currentSession?.id === session.id
          ? 'bg-foreground/5 border border-foreground/10'
          : 'hover:bg-muted/50 border border-transparent'
      } ${session.isStreaming ? 'streaming-border' : ''} ${
        draggedSessionId === session.id ? 'opacity-50' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm font-medium bg-transparent border-b border-primary outline-none py-0"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            {session.sessionType && session.sessionType !== 'user' && (() => {
              const TypeIcon = SESSION_TYPE_ICONS[session.sessionType];
              return <TypeIcon className="w-3 h-3 shrink-0 text-muted-foreground" />;
            })()}
            <p className="font-medium truncate text-sm">{session.name}</p>
            {readOnly && (
              <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground leading-none">
                {t('sidebar.readOnly')}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(session.updatedAt)}
        </p>
      </div>

      {!readOnly && !isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <SessionContextMenu
            session={session}
            onRename={() => onStartRename(session.id, session.name)}
            onDelete={() => {
              if (isDefaultAgent) {
                deleteSession(session.id);
              } else {
                deleteAgentSession(currentAgentId, session.id);
              }
            }}
          >
            <Button
              onClick={(e) => e.stopPropagation()}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title={t('common.more')}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </Button>
          </SessionContextMenu>
        </div>
      )}
    </div>
  );
}
