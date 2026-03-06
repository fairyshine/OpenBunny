import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, selectCurrentSession } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { SessionType } from '@shared/types';
import { Trash, ChevronLeft, ChevronRight, MessageSquare, Folder, Edit2, Plus, Undo2, TrashIcon, Globe, Lightbulb, HardDrive } from '../icons';
import FileTree from './FileTree';
import { ProjectDialog } from './ProjectDialog';
import { SessionContextMenu } from './SessionContextMenu';
import { Button } from '../ui/button';

type TabType = 'sessions' | 'files';
type SessionTypeFilter = 'all' | SessionType;

interface SidebarProps {
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSessionSelect?: () => void;
}

const SESSION_TYPE_ICONS: Record<SessionTypeFilter, React.FC<{ className?: string }>> = {
  all: HardDrive,
  user: MessageSquare,
  agent: Globe,
  mind: Lightbulb,
};

export default function Sidebar({ selectedFilePath, onSelectFile, isOpen, onClose, onSessionSelect }: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionTypeFilter>('all');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const { setCurrentSession, deleteSession, renameSession, createSession, restoreSession, permanentlyDeleteSession, clearTrash, deleteProject } = useSessionStore();
  const currentSession = useSessionStore(selectCurrentSession);
  const allSessions = useSessionStore(s => s.sessions);
  const projects = useSessionStore(s => s.projects);
  const enableSessionTabs = useSettingsStore(s => s.enableSessionTabs);

  const deletedSessions = useMemo(() => allSessions.filter(s => s.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)), [allSessions]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showTrash, setShowTrash] = useState(false);
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

    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const sameYear = date.getFullYear() === now.getFullYear();

    const dateStr = date.toLocaleDateString(undefined, {
      year: sameYear ? undefined : 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return `${dateStr} ${time}`;
  };

  const handleItemClick = () => {
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };

  const isReadOnly = (session: { sessionType?: SessionType }) => session.sessionType === 'agent';

  const handleCreateSession = () => {
    // Agent sessions are created externally, not by user
    const type: SessionType = sessionTypeFilter === 'agent' ? 'user' : (sessionTypeFilter === 'all' ? 'user' : sessionTypeFilter);
    createSession(t('header.newSession'), type);
    handleItemClick();
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (confirm(t('sidebar.confirmDeleteProject', { name: projectName }))) {
      deleteProject(projectId);
    }
  };

  const sessionTypeFilters: SessionTypeFilter[] = ['all', 'user', 'agent', 'mind'];

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

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        w-72 bg-background border-r border-border shadow-elegant
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        hidden md:flex
        ${isOpen ? '!flex' : ''}
        flex-col
      `}>
        {/* Header - Fixed */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <span className="text-sm font-semibold tracking-tight">
            {activeTab === 'sessions' ? t('sidebar.sessions') : t('sidebar.files')}
          </span>
          <div className="flex items-center gap-1">
            {activeTab === 'sessions' && (
              <Button
                onClick={handleCreateSession}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('header.newSession')}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
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
        </div>

        {/* Tabs - Fixed */}
        <div className="grid grid-cols-2 mx-2 my-2 bg-muted/50 rounded-md p-1 shrink-0">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-sm transition-colors ${
              activeTab === 'sessions'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t('sidebar.sessions')}
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-sm transition-colors ${
              activeTab === 'files'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            {t('sidebar.files')}
          </button>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'sessions' ? (
            <div className="h-full flex flex-col">
              {/* Session Type Filter */}
              {!showTrash && (
                <div className="flex items-center gap-1 mx-2 mb-1 shrink-0">
                  {sessionTypeFilters.map((filter) => {
                    const Icon = SESSION_TYPE_ICONS[filter];
                    return (
                      <button
                        key={filter}
                        onClick={() => setSessionTypeFilter(filter)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-sm transition-colors ${
                          sessionTypeFilter === filter
                            ? 'bg-foreground/10 text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {t(`sidebar.sessionType.${filter}`)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Session List - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-2 space-y-2">
                  {!showTrash ? (
                    <>
                      {/* Project Sections */}
                      {projects.map((project) => {
                        const projectSessions = allSessions.filter(s => !s.deletedAt && s.projectId === project.id);
                        if (sessionTypeFilter !== 'all') {
                          const filtered = projectSessions.filter(s => (s.sessionType || 'user') === sessionTypeFilter);
                          if (filtered.length === 0) return null;
                        }

                        return (
                          <div key={project.id} className="space-y-1">
                            {/* Project Header */}
                            <div className="flex items-center justify-between px-2 py-1 group">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-base">{project.icon}</span>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                                  {project.name}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({projectSessions.filter(s => sessionTypeFilter === 'all' || (s.sessionType || 'user') === sessionTypeFilter).length})
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const type: SessionType = sessionTypeFilter === 'agent' ? 'user' : (sessionTypeFilter === 'all' ? 'user' : sessionTypeFilter);
                                    createSession(t('header.newSession'), type, project.id);
                                    handleItemClick();
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  title={t('sidebar.newSessionInProject')}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProject(project);
                                    setProjectDialogOpen(true);
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  title={t('sidebar.editProject')}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProject(project.id, project.name);
                                  }}
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-destructive"
                                  title={t('sidebar.deleteProject')}
                                >
                                  <Trash className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Sessions in this project */}
                            {projectSessions
                              .filter(s => sessionTypeFilter === 'all' || (s.sessionType || 'user') === sessionTypeFilter)
                              .map((session) => {
                                const readOnly = isReadOnly(session);
                                return (
                                  <div
                                    key={session.id}
                                    onClick={() => {
                                      if (editingId !== session.id) {
                                        if (enableSessionTabs) {
                                          if (currentSession?.id === session.id) {
                                            useSessionStore.getState().closeSession(session.id);
                                          } else {
                                            useSessionStore.getState().openSession(session.id);
                                            onSessionSelect?.();
                                          }
                                        } else {
                                          if (currentSession?.id === session.id) {
                                            useSessionStore.setState({ currentSessionId: null });
                                          } else {
                                            setCurrentSession(session.id);
                                            onSessionSelect?.();
                                          }
                                        }
                                        handleItemClick();
                                      }
                                    }}
                                    onDoubleClick={() => {
                                      if (!readOnly) startRename(session.id, session.name);
                                    }}
                                    className={`group relative flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all ${
                                      currentSession?.id === session.id
                                        ? 'bg-foreground/5 border border-foreground/10'
                                        : 'hover:bg-muted/50 border border-transparent'
                                    } ${session.isStreaming ? 'streaming-border' : ''}`}
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
                                        <div className="flex items-center gap-1.5">
                                          {session.sessionType && session.sessionType !== 'user' && (
                                            (() => {
                                              const TypeIcon = SESSION_TYPE_ICONS[session.sessionType];
                                              return <TypeIcon className="w-3 h-3 shrink-0 text-muted-foreground" />;
                                            })()
                                          )}
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

                                    {!readOnly && editingId !== session.id && (
                                      <div className="flex items-center gap-0.5">
                                        <SessionContextMenu
                                          session={session}
                                          onRename={() => startRename(session.id, session.name)}
                                          onDelete={() => deleteSession(session.id)}
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
                              })}
                          </div>
                        );
                      })}

                      {/* No Project Section */}
                      {(() => {
                        const noProjectSessions = allSessions.filter(s => !s.deletedAt && !s.projectId);
                        const filtered = sessionTypeFilter === 'all'
                          ? noProjectSessions
                          : noProjectSessions.filter(s => (s.sessionType || 'user') === sessionTypeFilter);

                        if (filtered.length === 0 && projects.length > 0) return null;

                        return (
                          <div className="space-y-1">
                            {/* No Project Header (only show if there are sessions) */}
                            {filtered.length > 0 && (
                              <div className="flex items-center gap-2 px-2 py-1">
                                <span className="text-base">📋</span>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {t('sidebar.noProject')}
                                </span>
                                <span className="text-xs text-muted-foreground">({filtered.length})</span>
                              </div>
                            )}

                            {/* Sessions without project */}
                            {filtered.map((session) => {
                              const readOnly = isReadOnly(session);
                              return (
                                <div
                                  key={session.id}
                                  onClick={() => {
                                    if (editingId !== session.id) {
                                      if (enableSessionTabs) {
                                        if (currentSession?.id === session.id) {
                                          useSessionStore.getState().closeSession(session.id);
                                        } else {
                                          useSessionStore.getState().openSession(session.id);
                                          onSessionSelect?.();
                                        }
                                      } else {
                                        if (currentSession?.id === session.id) {
                                          useSessionStore.setState({ currentSessionId: null });
                                        } else {
                                          setCurrentSession(session.id);
                                          onSessionSelect?.();
                                        }
                                      }
                                      handleItemClick();
                                    }
                                  }}
                                  onDoubleClick={() => {
                                    if (!readOnly) startRename(session.id, session.name);
                                  }}
                                  className={`group relative flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all ${
                                    currentSession?.id === session.id
                                      ? 'bg-foreground/5 border border-foreground/10'
                                      : 'hover:bg-muted/50 border border-transparent'
                                  } ${session.isStreaming ? 'streaming-border' : ''}`}
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
                                      <div className="flex items-center gap-1.5">
                                        {session.sessionType && session.sessionType !== 'user' && (
                                          (() => {
                                            const TypeIcon = SESSION_TYPE_ICONS[session.sessionType];
                                            return <TypeIcon className="w-3 h-3 shrink-0 text-muted-foreground" />;
                                          })()
                                        )}
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

                                  {!readOnly && editingId !== session.id && (
                                    <div className="flex items-center gap-0.5">
                                      <SessionContextMenu
                                        session={session}
                                        onRename={() => startRename(session.id, session.name)}
                                        onDelete={() => deleteSession(session.id)}
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
                            })}

                            {/* Empty state */}
                            {filtered.length === 0 && projects.length === 0 && (
                              <div className="text-center py-12 text-muted-foreground text-xs">
                                {t('sidebar.noSessions')}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Add Project Button */}
                      <Button
                        onClick={() => {
                          setEditingProject(null);
                          setProjectDialogOpen(true);
                        }}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs mt-2"
                      >
                        <Plus className="w-3 h-3 mr-2" />
                        {t('sidebar.createProject')}
                      </Button>
                    </>
                  ) : (
                    <>
                      {deletedSessions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-xs">
                          {t('sidebar.emptyTrash')}
                        </div>
                      ) : (
                        deletedSessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={() => {
                              setCurrentSession(session.id);
                              handleItemClick();
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
                        ))
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Trash Button - Fixed at bottom */}
              <div className="border-t border-border p-2 shrink-0">
                {showTrash && deletedSessions.length > 0 && (
                  <Button
                    onClick={() => {
                      if (confirm(t('sidebar.confirmClearTrash'))) {
                        clearTrash();
                        setShowTrash(false);
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs text-destructive hover:text-destructive mb-1"
                  >
                    <TrashIcon className="w-3.5 h-3.5 mr-2" />
                    {t('sidebar.clearTrash')}
                  </Button>
                )}
                <Button
                  onClick={() => setShowTrash(!showTrash)}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                >
                  {showTrash ? (
                    <>
                      <ChevronLeft className="w-3.5 h-3.5 mr-2" />
                      {t('sidebar.backToSessions')}
                    </>
                  ) : (
                    <>
                      <TrashIcon className="w-3.5 h-3.5 mr-2" />
                      {deletedSessions.length > 0 ? t('sidebar.trashCount', { count: deletedSessions.length }) : t('sidebar.trash')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full">
              <FileTree
                selectedPath={selectedFilePath}
                onSelectFile={onSelectFile}
                onItemClick={handleItemClick}
              />
            </div>
          )}
        </div>

        {/* Project Dialog */}
        <ProjectDialog
          isOpen={projectDialogOpen}
          onClose={() => {
            setProjectDialogOpen(false);
            setEditingProject(null);
          }}
          project={editingProject}
        />
      </aside>
    </>
  );
}
