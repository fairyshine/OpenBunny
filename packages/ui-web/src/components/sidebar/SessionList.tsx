import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@openbunny/shared/stores/agent';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { isImageAvatar } from '@openbunny/shared/utils/imageUtils';
import { runMindConversation } from '@openbunny/shared/services/ai/mind';
import { deleteChatSessionPair, runChatConversation } from '@openbunny/shared/services/ai/chat';
import { SessionType } from '@openbunny/shared/types';
import type { Project } from '@openbunny/shared/types';
import { ChevronRight, ChevronLeft, Plus, Edit2, Trash, TrashIcon, MessagesSquare, getProjectIcon } from '../icons';
import { Loader2, MessageCircle, Users } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { SessionTypeFilterBar, type SessionTypeFilter } from './SessionTypeFilterBar';
import { SessionItem } from './SessionItem';
import { TrashList } from './TrashList';
import { useWorkspaceSession } from '../../hooks/useWorkspaceSession';
import { useAgentConfig } from '../../hooks/useAgentConfig';

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
  const agents = useAgentStore((s) => s.agents);
  const relationships = useAgentStore((s) => s.relationships);
  const agentSessions = useAgentStore((s) => s.agentSessions);
  const agentProjects = useAgentStore((s) => s.agentProjects);
  const createAgentSession = useAgentStore((s) => s.createAgentSession);
  const renameAgentSession = useAgentStore((s) => s.renameAgentSession);
  const deleteAgentSession = useAgentStore((s) => s.deleteAgentSession);
  const deleteAgentProject = useAgentStore((s) => s.deleteAgentProject);
  const moveAgentSessionToProject = useAgentStore((s) => s.moveAgentSessionToProject);
  const setAgentCurrentSession = useAgentStore((s) => s.setAgentCurrentSession);

  // Fallback to default session store for default agent
  const { deleteSession, createSession, deleteProject, moveSessionToProject, clearTrash, setCurrentSession, openSession } = useSessionStore();
  const globalSessions = useSessionStore(s => s.sessions);
  const globalProjects = useSessionStore(s => s.projects);
  const { currentSession } = useWorkspaceSession();
  const enableSessionTabs = useSettingsStore((s) => s.enableSessionTabs);
  const { llmConfig, enabledTools, enabledSkills } = useAgentConfig();

  // Use agent sessions/projects if not default agent, otherwise use global
  const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;
  const allSessions = isDefaultAgent ? globalSessions : (agentSessions[currentAgentId] || []);
  const projects = isDefaultAgent ? globalProjects : (agentProjects[currentAgentId] || []);

  const [showTrash, setShowTrash] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const [mindInput, setMindInput] = useState('');
  const [isCreatingMindSession, setIsCreatingMindSession] = useState(false);
  const [mindStatus, setMindStatus] = useState<string | null>(null);
  const [isCreatingChatForAgentId, setIsCreatingChatForAgentId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatTargetAgent, setChatTargetAgent] = useState<{ id: string; name: string } | null>(null);
  const [contactsExpanded, setContactsExpanded] = useState(true);

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

  const currentAgent = useMemo(
    () => agents.find((agent) => agent.id === currentAgentId) || null,
    [agents, currentAgentId],
  );

  const contactAgents = useMemo(() => {
    if (!currentAgent) return [];

    const contacts = new Map<string, { agent: typeof agents[number]; reasons: Set<'group' | 'relationship'> }>();

    const addContact = (agent: typeof agents[number], reason: 'group' | 'relationship') => {
      if (agent.id === currentAgent.id) return;

      const existing = contacts.get(agent.id);
      if (existing) {
        existing.reasons.add(reason);
        return;
      }

      contacts.set(agent.id, {
        agent,
        reasons: new Set([reason]),
      });
    };

    if (currentAgent.groupId) {
      for (const agent of agents) {
        if (agent.groupId === currentAgent.groupId) {
          addContact(agent, 'group');
        }
      }
    }

    for (const relationship of relationships) {
      const relatedAgentId = relationship.sourceAgentId === currentAgent.id
        ? relationship.targetAgentId
        : relationship.targetAgentId === currentAgent.id
          ? relationship.sourceAgentId
          : null;

      if (!relatedAgentId) continue;

      const relatedAgent = agents.find((agent) => agent.id === relatedAgentId);
      if (relatedAgent) {
        addContact(relatedAgent, 'relationship');
      }
    }

    return Array.from(contacts.values())
      .map(({ agent, reasons }) => ({
        agent,
        reasons: Array.from(reasons),
        sessionCount: agent.id === DEFAULT_AGENT_ID
          ? globalSessions.filter((session) => !session.deletedAt).length
          : (agentSessions[agent.id]?.filter((session) => !session.deletedAt).length || 0),
      }))
      .sort((left, right) => {
        const leftPriority = left.reasons.includes('group') ? 0 : 1;
        const rightPriority = right.reasons.includes('group') ? 0 : 1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return left.agent.name.localeCompare(right.agent.name, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [agentSessions, agents, currentAgent, globalSessions, relationships]);

  const handleContactClick = (agentId: string) => {
    if (agentId !== currentAgentId) {
      setAgentCurrentSession(currentAgentId, null);
      useAgentStore.getState().setCurrentAgent(agentId);
    }
    onSessionTypeFilterChange('all');
    onSessionSelect?.();
    onItemClick();
  };

  const openChatDialog = (agentId: string, agentName: string) => {
    setChatTargetAgent({ id: agentId, name: agentName });
    setChatDraft('');
    setChatStatus(null);
    setChatDialogOpen(true);
  };

  const handleStartChatWithContact = async () => {
    if (isCreatingChatForAgentId) return;
    if (!chatTargetAgent) return;

    const trimmed = chatDraft.trim();
    if (!trimmed) return;

    setIsCreatingChatForAgentId(chatTargetAgent.id);
    setChatStatus(null);

    try {
      await runChatConversation(chatTargetAgent.name, trimmed, {
        sourceSessionId: currentSession?.id || 'sidebar-chat-trigger',
        llmConfig,
        enabledToolIds: enabledTools,
        sessionSkillIds: enabledSkills,
        currentAgentId,
        onSourceSessionReady: (sourceSessionId) => {
          setAgentCurrentSession(currentAgentId, sourceSessionId);
          onSessionSelect?.();
          onItemClick();
        },
      });
      setChatStatus(t('sidebar.agent.contactChatFinished', { name: chatTargetAgent.name }));
      setChatDialogOpen(false);
      setChatDraft('');
    } catch (error) {
      setChatStatus(t('sidebar.agent.contactChatError', { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setIsCreatingChatForAgentId(null);
    }
  };

  const renderContactSection = () => {
    if (!currentAgent || currentAgentId === DEFAULT_AGENT_ID || sessionTypeFilter !== 'agent' || showTrash) return null;

    return (
      <div className="mx-2 mt-2 rounded-md border border-border bg-muted/30 shrink-0">
        <button
          onClick={() => setContactsExpanded((prev) => !prev)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t('sidebar.agent.contacts')}</div>
            <div className="text-xs text-muted-foreground truncate">{currentAgent.name}</div>
          </div>
          <span className="text-xs text-muted-foreground">{contactAgents.length}</span>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${contactsExpanded ? 'rotate-90' : ''}`} />
        </button>

        {contactsExpanded && (
          <div className="border-t border-border px-2 py-2">
            {contactAgents.length > 0 ? (
              <div className="space-y-1">
                {contactAgents.map(({ agent, reasons, sessionCount }) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/60"
                  >
                    <button
                      onClick={() => handleContactClick(agent.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left"
                      title={t('sidebar.agent.openAgentSessions')}
                    >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-base"
                      style={agent.isDefault ? {
                        backgroundColor: 'hsl(var(--foreground))',
                        color: 'hsl(var(--background))',
                      } : {
                        backgroundColor: `${agent.color}20`,
                        color: agent.color,
                      }}
                    >
                      {isImageAvatar(agent.avatar)
                        ? <img src={agent.avatar} alt="avatar" className="h-full w-full object-cover" draggable={false} />
                        : agent.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{agent.name}</span>
                        {reasons.includes('group') ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            {t('sidebar.agent.contactSameGroup')}
                          </span>
                        ) : reasons.includes('relationship') ? (
                          <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t('sidebar.agent.contactNetworkConnected')}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('sidebar.agent.sessions', { count: sessionCount })}
                      </div>
                    </div>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => openChatDialog(agent.id, agent.name)}
                      title={t('sidebar.agent.contactChat')}
                      disabled={isCreatingChatForAgentId !== null}
                    >
                      {isCreatingChatForAgentId === agent.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                {t('sidebar.agent.noContacts')}
              </div>
            )}
            {chatStatus && (
              <div className="px-2 pt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {chatStatus}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Delete current session via keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) return;
      if (showTrash || editingId) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!currentSession || currentSession.deletedAt) return;

      e.preventDefault();

      const isLinkedAgentSession = currentSession.sessionType === 'agent' && !!currentSession.chatSession?.peerSessionId;
      if (isLinkedAgentSession) {
        deleteChatSessionPair(currentAgentId, currentSession.id);
        return;
      }

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
      createAgentSession(currentAgentId, t('header.newSession'), projectId, type);
    }
    onSessionSelect?.();
    onItemClick();
  };

  const handleRunMind = async () => {
    const text = mindInput.trim();
    if (!text || isCreatingMindSession) return;

    if (!llmConfig.apiKey) {
      setMindStatus(t('chat.configRequired'));
      return;
    }

    let sessionReady = false;
    setIsCreatingMindSession(true);
    setMindInput('');
    setMindStatus(null);

    try {
      await runMindConversation(text, {
        sourceSessionId: currentSession?.id || 'sidebar-mind-trigger',
        llmConfig,
        enabledToolIds: enabledTools,
        sessionSkillIds: enabledSkills,
        currentAgentId,
        onSessionReady: (mindSessionId) => {
          sessionReady = true;
          setIsCreatingMindSession(false);

          if (isDefaultAgent) {
            if (enableSessionTabs) {
              openSession(mindSessionId);
            } else {
              setCurrentSession(mindSessionId);
            }
          } else {
            setAgentCurrentSession(currentAgentId, mindSessionId);
          }

          onSessionSelect?.();
          onItemClick();
        },
      });
    } catch (error) {
      if (!sessionReady) {
        setMindInput(text);
      }
      setMindStatus(t('sidebar.mind.error', { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      if (!sessionReady) {
        setIsCreatingMindSession(false);
      }
    }
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
    <>
      <Dialog open={chatDialogOpen} onOpenChange={(open) => {
        setChatDialogOpen(open);
        if (!open) {
          setChatDraft('');
          setChatTargetAgent(null);
        }
      }}>
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('sidebar.agent.contactChat')}</DialogTitle>
            <DialogDescription>
              {chatTargetAgent ? t('sidebar.agent.contactChatPrompt', { name: chatTargetAgent.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder={chatTargetAgent ? t('sidebar.agent.contactChatPrompt', { name: chatTargetAgent.name }) : ''}
            rows={5}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChatDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleStartChatWithContact()}
              disabled={!chatDraft.trim() || isCreatingChatForAgentId !== null}
            >
              {isCreatingChatForAgentId ? t('sidebar.agent.contactChatRunning') : t('sidebar.agent.contactChat')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-full flex flex-col">
      {/* Session Type Filter */}
      {!showTrash && (
        <SessionTypeFilterBar value={sessionTypeFilter} onChange={onSessionTypeFilterChange} />
      )}

      {renderContactSection()}

      {!showTrash && sessionTypeFilter === 'mind' && (
        <div className="mx-2 mt-2 rounded-md border border-border bg-muted/30 p-2 space-y-2 shrink-0">
          <Input
            value={mindInput}
            onChange={(e) => setMindInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleRunMind();
              }
            }}
            placeholder={t('sidebar.mind.placeholder')}
            disabled={isCreatingMindSession}
          />
          <Button
            onClick={() => void handleRunMind()}
            size="sm"
            className="w-full"
            disabled={isCreatingMindSession || !mindInput.trim()}
          >
            {isCreatingMindSession ? t('sidebar.mind.running') : t('sidebar.mind.run')}
          </Button>
          {mindStatus && (
            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {mindStatus}
            </div>
          )}
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
    </>
  );
}
