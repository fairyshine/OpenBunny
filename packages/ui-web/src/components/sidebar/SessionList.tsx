import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@shared/stores/agent';
import { SessionType } from '@shared/types';
import type { Project } from '@shared/types';
import { ChevronRight, ChevronLeft, Plus, Edit2, Trash, TrashIcon, MessagesSquare, getProjectIcon } from '../icons';
import { Button } from '../ui/button';
import { SessionTypeFilterBar, type SessionTypeFilter } from './SessionTypeFilterBar';
import { SessionItem } from './SessionItem';
import { TrashList } from './TrashList';
import { useWorkspaceSession } from '../../hooks/useWorkspaceSession';

interface SessionListProps {
  onItemClick: () => void;
  onSessionSelect?: () => void;
  onEditProject: (project: Project) => void;
  sessionTypeFilter: SessionTypeFilter;
  onSessionTypeFilterChange: (filter: SessionTypeFilter) => void;
}

export function SessionList({ onItemClick, onSessionSelect, onEditProject, sessionTypeFilter, onSessionTypeFilterChange }: SessionListProps) {
  const { t } = useTranslation();
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const agentSessions = useAgentStore((s) => s.agentSessions);
  const agentProjects = useAgentStore((s) => s.agentProjects);
  const createAgentSession = useAgentStore((s) => s.createAgentSession);
  const renameAgentSession = useAgentStore((s) => s.renameAgentSession);
  const deleteAgentSession = useAgentStore((s) => s.deleteAgentSession);
  const deleteAgentProject = useAgentStore((s) => s.deleteAgentProject);
  const moveAgentSessionToProject = useAgentStore((s) => s.moveAgentSessionToProject);

  // Fallback to default session store for default agent
  const { deleteSession, createSession, deleteProject, moveSessionToProject, clearTrash } = useSessionStore();
  const globalSessions = useSessionStore(s => s.sessions);
  const globalProjects = useSessionStore(s => s.projects);
  const { currentSession } = useWorkspaceSession();

  // Use agent sessions/projects if not default agent, otherwise use global
  const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;
  const allSessions = isDefaultAgent ? globalSessions : (agentSessions[currentAgentId] || []);
  const projects = isDefaultAgent ? globalProjects : (agentProjects[currentAgentId] || []);

  const [showTrash, setShowTrash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
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

  const [projectsListVisible, setProjectsListVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('projects-list-visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const deletedSessions = useMemo(
    () => allSessions.filter(s => s.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)),
    [allSessions],
  );

  // Delete current session via keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showTrash || editingId) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!currentSession || currentSession.deletedAt) return;
      if (currentSession.sessionType === 'agent') return;
      e.preventDefault();
      if (isDefaultAgent) {
        deleteSession(currentSession.id);
      } else {
        deleteAgentSession(currentAgentId, currentSession.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTrash, editingId, currentSession, currentAgentId, deleteAgentSession, deleteSession, isDefaultAgent]);

  const toggleProjectsListVisible = () => {
    const next = !projectsListVisible;
    setProjectsListVisible(next);
    try { localStorage.setItem('projects-list-visible', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toggleProjectCollapse = (projectId: string) => {
    const newCollapsed = new Set(collapsedProjects);
    if (newCollapsed.has(projectId)) newCollapsed.delete(projectId);
    else newCollapsed.add(projectId);
    setCollapsedProjects(newCollapsed);
    try { localStorage.setItem('collapsed-projects', JSON.stringify([...newCollapsed])); } catch { /* ignore */ }
  };

  const startRename = (sessionId: string, currentName: string) => {
    setEditingId(sessionId);
    setEditingName(currentName);
  };

  const commitRename = () => {
    if (editingId && editingName.trim()) {
      if (isDefaultAgent) {
        useSessionStore.getState().renameSession(editingId, editingName);
      } else {
        renameAgentSession(currentAgentId, editingId, editingName);
      }
    }
    setEditingId(null);
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    if (confirm(t('sidebar.confirmDeleteProject', { name: projectName }))) {
      if (isDefaultAgent) {
        deleteProject(projectId);
      } else {
        deleteAgentProject(currentAgentId, projectId);
      }
    }
  };

  const handleDragStart = (sessionId: string) => setDraggedSessionId(sessionId);
  const handleDragEnd = () => { setDraggedSessionId(null); setDropTargetProjectId(null); };

  const handleCreateSessionInProject = (projectId: string) => {
    const type: SessionType = sessionTypeFilter === 'agent' ? 'user' : (sessionTypeFilter === 'all' ? 'user' : sessionTypeFilter);
    if (isDefaultAgent) {
      createSession(t('header.newSession'), type, projectId);
    } else {
      createAgentSession(currentAgentId, t('header.newSession'), projectId);
    }
    onSessionSelect?.();
    onItemClick();
  };

  const sessionItemProps = {
    editingId,
    editingName,
    draggedSessionId,
    onEditingNameChange: setEditingName,
    onStartRename: startRename,
    onCommitRename: commitRename,
    onCancelRename: () => setEditingId(null),
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onItemClick,
    onSessionSelect,
  };

  const filterSessions = (sessions: typeof allSessions) =>
    sessionTypeFilter === 'all'
      ? sessions
      : sessions.filter(s => (s.sessionType || 'user') === sessionTypeFilter);

  return (
    <div className="h-full flex flex-col">
      {/* Session Type Filter */}
      {!showTrash && (
        <SessionTypeFilterBar value={sessionTypeFilter} onChange={onSessionTypeFilterChange} />
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
                const filtered = filterSessions(projectSessions);
                const isCollapsed = collapsedProjects.has(project.id);

                return (
                  <div key={project.id} className="space-y-1">
                    {/* Project Header */}
                    <div
                      className={`flex items-center justify-between px-2 py-1 group rounded-md transition-colors cursor-pointer ${
                        dropTargetProjectId === project.id ? 'bg-primary/10 ring-2 ring-primary/40' : 'hover:bg-muted/30'
                      }`}
                      onClick={() => toggleProjectCollapse(project.id)}
                      onDragOver={(e) => { e.preventDefault(); if (draggedSessionId) setDropTargetProjectId(project.id); }}
                      onDragLeave={() => setDropTargetProjectId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedSessionId) {
                          if (isDefaultAgent) {
                            moveSessionToProject(draggedSessionId, project.id);
                          } else {
                            moveAgentSessionToProject(currentAgentId, draggedSessionId, project.id);
                          }
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
                          ({filtered.length})
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleCreateSessionInProject(project.id); }}
                          variant="ghost" size="icon" className="h-5 w-5"
                          title={t('sidebar.newSessionInProject')}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                          variant="ghost" size="icon" className="h-5 w-5"
                          title={t('sidebar.editProject')}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id, project.name); }}
                          variant="ghost" size="icon" className="h-5 w-5 text-destructive"
                          title={t('sidebar.deleteProject')}
                        >
                          <Trash className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Sessions in this project */}
                    {!isCollapsed && filtered.map((session) => (
                      <SessionItem key={session.id} session={session} {...sessionItemProps} />
                    ))}
                  </div>
                );
              })}

              {/* No Project Section */}
              {(() => {
                const noProjectSessions = allSessions.filter(s => !s.deletedAt && !s.projectId);
                const filtered = filterSessions(noProjectSessions);

                if (filtered.length === 0 && projects.length > 0) return null;

                return (
                  <div className="space-y-1">
                    {filtered.length > 0 && (
                      <div
                        className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
                          dropTargetProjectId === 'none' ? 'bg-primary/10 ring-2 ring-primary/40' : ''
                        }`}
                        onDragOver={(e) => { e.preventDefault(); if (draggedSessionId) setDropTargetProjectId('none'); }}
                        onDragLeave={() => setDropTargetProjectId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedSessionId) {
                            if (isDefaultAgent) {
                              moveSessionToProject(draggedSessionId, null);
                            } else {
                              moveAgentSessionToProject(currentAgentId, draggedSessionId, null);
                            }
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

                    {filtered.map((session) => (
                      <SessionItem key={session.id} session={session} {...sessionItemProps} />
                    ))}

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
            <TrashList deletedSessions={deletedSessions} onItemClick={onItemClick} />
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
            variant="ghost" size="sm"
            className="w-full justify-start text-xs text-destructive hover:text-destructive mb-1"
          >
            <TrashIcon className="w-3.5 h-3.5 mr-2" />
            {t('sidebar.clearTrash')}
          </Button>
        )}
        <Button
          onClick={() => setShowTrash(!showTrash)}
          variant="ghost" size="sm"
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
  );
}
