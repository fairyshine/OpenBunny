import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, selectCurrentSession } from '../../stores/session';
import { Trash, ChevronLeft, ChevronRight, MessageSquare, Folder, Edit2 } from '../icons';
import FileTree from './FileTree';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';

type TabType = 'sessions' | 'files';

interface SidebarProps {
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ selectedFilePath, onSelectFile, isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const { sessions, setCurrentSession, deleteSession, renameSession } = useSessionStore();
  const currentSession = useSessionStore(selectCurrentSession);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = (sessionId: string, currentName: string) => {
    setEditingId(sessionId);
    setEditingName(currentName);
  };

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      renameSession(editingId, editingName);
    }
    setEditingId(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-background border-r border-border flex-col items-center hidden md:flex shadow-elegant">
        <div className="h-14 flex items-center justify-center border-b border-border w-full">
          <Button
            onClick={() => setIsCollapsed(false)}
            variant="ghost"
            size="icon"
            title={t('sidebar.expand')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center py-3 gap-2">
          <Button
            onClick={() => {
              setActiveTab('sessions');
              setIsCollapsed(false);
            }}
            variant={activeTab === 'sessions' ? 'default' : 'ghost'}
            size="icon"
            title={t('sidebar.sessions')}
            className="h-9 w-9"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {
              setActiveTab('files');
              setIsCollapsed(false);
            }}
            variant={activeTab === 'files' ? 'default' : 'ghost'}
            size="icon"
            title={t('sidebar.files')}
            className="h-9 w-9"
          >
            <Folder className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  const handleItemClick = () => {
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        w-72 bg-background border-r border-border flex flex-col shadow-elegant
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        hidden md:flex
        ${isOpen ? '!flex' : ''}
      `}>
        <div className="h-14 border-b border-border flex items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            {activeTab === 'sessions' ? t('sidebar.sessions') : t('sidebar.files')}
          </span>
          <Button
            onClick={() => {
              setIsCollapsed(true);
              if (onClose) onClose();
            }}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('sidebar.collapse')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 m-2 bg-muted/50">
            <TabsTrigger value="sessions" className="flex items-center gap-2 text-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              {t('sidebar.sessions')}
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2 text-xs">
              <Folder className="w-3.5 h-3.5" />
              {t('sidebar.files')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="flex-1 mt-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {sessions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs">
                    {t('sidebar.noSessions')}
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        if (editingId !== session.id) {
                          setCurrentSession(session.id);
                          handleItemClick();
                        }
                      }}
                      onDoubleClick={() => startRename(session.id, session.name)}
                      className={`group flex items-center justify-between p-3 rounded-md cursor-pointer transition-all ${
                        currentSession?.id === session.id
                          ? 'bg-foreground/5 border border-foreground/10'
                          : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        {editingId === session.id ? (
                          <input
                            ref={editInputRef}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm font-medium bg-transparent border-b border-primary outline-none py-0"
                          />
                        ) : (
                          <p className="font-medium truncate text-sm">{session.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(session.updatedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(session.id, session.name);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={t('common.rename')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title={t('common.delete')}
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="files" className="flex-1 mt-0">
            <FileTree
              selectedPath={selectedFilePath}
              onSelectFile={onSelectFile}
              onItemClick={handleItemClick}
            />
          </TabsContent>
        </Tabs>
      </aside>
    </>
  );
}
