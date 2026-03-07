import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore, selectCurrentSession } from '@shared/stores/session';
import { useSettingsStore } from '@shared/stores/settings';
import { SessionType } from '@shared/types';
import { Trash, ChevronLeft, ChevronRight, MessageSquare, Edit2, Plus, Undo2, TrashIcon, Globe, Lightbulb, HardDrive, getProjectIcon, MessagesSquare, FolderOpen, FolderTree } from '../icons';
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

  // Resizable sidebar width
  const MIN_WIDTH = 270;
  const MAX_WIDTH = 480;
  const DEFAULT_WIDTH = 288; // w-72
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar-width');
      return saved ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved))) : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const widthRef = useRef(sidebarWidth);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      widthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('sidebar-width', String(widthRef.current));
      } catch { /* ignore */ }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('collapsed-projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const { moveSessionToProject } = useSessionStore();
  const [projectsListVisible, setProjectsListVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('projects-list-visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleProjectsListVisible = () => {
    const next = !projectsListVisible;
    setProjectsListVisible(next);
    try {
      localStorage.setItem('projects-list-visible', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleProjectCollapse = (projectId: string) => {
    const newCollapsed = new Set(collapsedProjects);
    if (newCollapsed.has(projectId)) {
      newCollapsed.delete(projectId);
    } else {
      newCollapsed.add(projectId);
    }
    setCollapsedProjects(newCollapsed);
    try {
      localStorage.setItem('collapsed-projects', JSON.stringify([...newCollapsed]));
    } catch {
      // ignore
    }
  };

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

  // Delete current session via keyboard Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (activeTab !== 'sessions' || showTrash || editingId) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!currentSession || currentSession.deletedAt) return;
      if (isReadOnly(currentSession)) return;
      e.preventDefault();
      deleteSession(currentSession.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showTrash, editingId, currentSession, deleteSession]);

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
            <FolderTree className="w-4 h-4" />
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

      <aside
        ref={sidebarRef}
        style={{ width: sidebarWidth }}
        className={`
        bg-background border-r border-border shadow-elegant relative
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        hidden md:flex
        ${isOpen ? '!flex' : ''}
        flex-col
      `}>
        {/* Resize Handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 hover:bg-primary/30 active:bg-primary/50 transition-colors"
          onMouseDown={handleResizeStart}
        />
        {/* Header - Fixed */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <span className="text-sm font-semibold tracking-tight">
            {activeTab === 'sessions' ? t('sidebar.sessions') : t('sidebar.files')}
          </span>
          <div className="flex items-center gap-1">
            {activeTab === 'sessions' && (
              <>
                <Button
                  onClick={() => {
                    setEditingProject(null);
                    setProjectDialogOpen(true);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={t('sidebar.createProject')}
                >
                  <FolderOpen className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleCreateSession}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={t('header.newSession')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </>
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
            <FolderTree className="w-3.5 h-3.5" />
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
                      {/* Projects Section Header */}
                      {projects.length > 0 && (
                        <div
                          className="flex items-center gap-2 px-2 py-1 cursor-pointer rounded-md hover:bg-muted/30 transition-colors"
                          onClick={toggleProjectsListVisible}
                        >
                          <span className={`transition-transform ${projectsListVisible ? 'rotate-90' : ''}`}>
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t('sidebar.projects')}
                          </span>
                          <span className="text-xs text-muted-foreground">({projects.length})</span>
                        </div>
                      )}

                      {/* Project Sections */}
                      {projectsListVisible && projects.map((project) => {
                        const projectSessions = allSessions.filter(s => !s.deletedAt && s.projectId === project.id);
                        const filteredSessions = sessionTypeFilter === 'all'
                          ? projectSessions
                          : projectSessions.filter(s => (s.sessionType || 'user') === sessionTypeFilter);

                        const isCollapsed = collapsedProjects.has(project.id);

                        return (
                          <div key={project.id} className="space-y-1">
                            {/* Project Header */}
                            <div
                              className={`flex items-center justify-between px-2 py-1 group rounded-md transition-colors cursor-pointer ${
                                dropTargetProjectId === project.id ? 'bg-primary/10 ring-2 ring-primary/40' : 'hover:bg-muted/30'
                              }`}
                              onClick={() => toggleProjectCollapse(project.id)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (draggedSessionId) {
                                  setDropTargetProjectId(project.id);
                                }
                              }}
                              onDragLeave={() => setDropTargetProjectId(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedSessionId) {
                                  moveSessionToProject(draggedSessionId, project.id);
                                  setDraggedSessionId(null);
                                  setDropTargetProjectId(null);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                </span>
                                {(() => {
                                  const ProjectIcon = getProjectIcon(project.icon || '');
                                  return <ProjectIcon className="w-4 h-4" style={project.color ? { color: project.color } : undefined} />;
                                })()}
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                                  {project.name}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({filteredSessions.length})
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            {!isCollapsed && filteredSessions
                              .map((session) => {
                                const readOnly = isReadOnly(session);
                                return (
                                  <div
                                    key={session.id}
                                    draggable={!readOnly && editingId !== session.id}
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = 'move';
                                      setDraggedSessionId(session.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedSessionId(null);
                                      setDropTargetProjectId(null);
                                    }}
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
                                    } ${session.isStreaming ? 'streaming-border' : ''} ${
                                      draggedSessionId === session.id ? 'opacity-50' : ''
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
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                              <div
                                className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
                                  dropTargetProjectId === 'none' ? 'bg-primary/10 ring-2 ring-primary/40' : ''
                                }`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggedSessionId) {
                                    setDropTargetProjectId('none');
                                  }
                                }}
                                onDragLeave={() => setDropTargetProjectId(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedSessionId) {
                                    moveSessionToProject(draggedSessionId, null);
                                    setDraggedSessionId(null);
                                    setDropTargetProjectId(null);
                                  }
                                }}
                              >
                                <MessagesSquare className="w-4 h-4 text-muted-foreground" />
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
                                  draggable={!readOnly && editingId !== session.id}
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedSessionId(session.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedSessionId(null);
                                    setDropTargetProjectId(null);
                                  }}
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
                                  } ${session.isStreaming ? 'streaming-border' : ''} ${
                                    draggedSessionId === session.id ? 'opacity-50' : ''
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
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
