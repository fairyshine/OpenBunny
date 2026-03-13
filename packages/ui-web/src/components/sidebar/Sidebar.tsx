import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Activity, TrendingUp, Monitor, ScrollText } from 'lucide-react';
import { fileSystem } from '@openbunny/shared/services/filesystem';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID, getAgentGroupFilesRoot } from '@openbunny/shared/stores/agent';
import { SessionType } from '@openbunny/shared/types';
import type { Project } from '@openbunny/shared/types';
import { FolderOpen } from '../icons';
import { Button } from '../ui/button';
import FileTree from './file-tree';
import { ProjectDialog } from './ProjectDialog';
import { CollapsedSidebar } from './CollapsedSidebar';
import { SidebarHeader } from './SidebarHeader';
import { SessionList } from './SessionList';
import { AgentList } from './AgentList';
import { useResizableSidebar } from './useResizableSidebar';
import type { SessionTypeFilter } from './SessionTypeFilterBar';

type TabType = 'agents' | 'sessions' | 'files' | 'stats';
type FileScope = { type: 'agent' } | { type: 'group'; groupId: string };

const FILES_SIDEBAR_WIDTH = 270;

interface SidebarProps {
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSessionSelect?: () => void;
  onFileBlankClick?: () => void;
  onOpenGraph?: (groupId?: string) => void;
  onTabChange?: (tab: TabType) => void;
  onAgentSelect?: (agentId: string, reselected: boolean) => void;
  onAgentConfig?: (agentId: string) => void;
  onCurrentAgentDeleted?: () => void;
  activeTab?: TabType;
}

export default function Sidebar({ selectedFilePath, onSelectFile, isOpen, onClose, onSessionSelect, onFileBlankClick, onOpenGraph, onTabChange, onAgentSelect, onAgentConfig, onCurrentAgentDeleted, activeTab: controlledActiveTab }: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('agents');
  const [fileScope, setFileScope] = useState<FileScope>({ type: 'agent' });
  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionTypeFilter>('all');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { sidebarWidth, sidebarRef, handleResizeStart, ensureSidebarWidth, resetSidebarWidth } = useResizableSidebar();
  const { createSession } = useSessionStore();
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const createAgentSession = useAgentStore((s) => s.createAgentSession);
  const createAgent = useAgentStore((s) => s.createAgent);
  const setCurrentAgent = useAgentStore((s) => s.setCurrentAgent);
  const createAgentGroup = useAgentStore((s) => s.createAgentGroup);
  const agentGroups = useAgentStore((s) => s.agentGroups);
  const agents = useAgentStore((s) => s.agents);

  const currentAgent = agents.find((agent) => agent.id === currentAgentId) || null;
  const currentAgentGroup = currentAgent?.groupId
    ? agentGroups.find((group) => group.id === currentAgent.groupId) || null
    : null;
  const currentGroup = fileScope.type === 'group'
    ? agentGroups.find((group) => group.id === fileScope.groupId) || null
    : null;
  const groupRootPath = currentGroup ? getAgentGroupFilesRoot(currentGroup.id) : undefined;
  const displayGroup = currentAgentGroup || currentGroup;

  const statsSections = [
    { id: 'global-stats-overview', label: t('stats.nav.overview'), hint: t('stats.totalAgents'), icon: Eye },
    { id: 'global-stats-monitor', label: t('stats.nav.monitor'), hint: t('stats.liveMonitor'), icon: Activity },
    { id: 'global-stats-trend', label: t('stats.nav.trend'), hint: t('stats.usageTrend'), icon: TrendingUp },
    { id: 'global-stats-runtime', label: t('stats.nav.runtime'), hint: t('stats.runtime'), icon: Monitor },
    { id: 'global-stats-logs', label: t('stats.nav.logs'), hint: t('stats.logCategories'), icon: ScrollText },
  ];

  useEffect(() => {
    if (fileScope.type === 'group' && !currentGroup) {
      setFileScope({ type: 'agent' });
    }
  }, [currentGroup, fileScope]);

  useEffect(() => {
    setFileScope({ type: 'agent' });
  }, [currentAgentId]);

  useEffect(() => {
    if (controlledActiveTab) {
      setActiveTab(controlledActiveTab);
    }
  }, [controlledActiveTab]);

  const getDefaultGroupName = () => {
    const existingNames = new Set(agentGroups.map((group) => group.name.trim()));

    for (let index = 1; ; index += 1) {
      const candidate = t('sidebar.agent.defaultGroupName', { index }).trim();
      if (!existingNames.has(candidate)) return candidate;
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'files') {
      setFileScope({ type: 'agent' });
      ensureSidebarWidth(FILES_SIDEBAR_WIDTH);
    } else {
      resetSidebarWidth();
    }
    onTabChange?.(tab);
  };

  const handleItemClick = () => {
    if (onClose && window.innerWidth < 768) {
      onClose();
    }
  };



  const handleCreateSession = () => {
    const type: SessionType = sessionTypeFilter === 'agent' ? 'user' : (sessionTypeFilter === 'all' ? 'user' : sessionTypeFilter);
    const isDefaultAgent = currentAgentId === DEFAULT_AGENT_ID;

    if (isDefaultAgent) {
      createSession(t('header.newSession'), type);
    } else {
      createAgentSession(currentAgentId, t('header.newSession'), undefined, type);
    }
    onSessionSelect?.();
    handleItemClick();
  };

  const handleCreateGroup = async () => {
    const name = prompt(t('sidebar.agent.groupName'), getDefaultGroupName());
    if (!name?.trim()) return;

    const group = createAgentGroup(name.trim());
    await fileSystem.mkdir(getAgentGroupFilesRoot(group.id));
  };

  const handleOpenGroupFiles = async (groupId: string) => {
    const rootPath = getAgentGroupFilesRoot(groupId);
    await fileSystem.mkdir(rootPath);
    setActiveTab('files');
    setFileScope({ type: 'group', groupId });
    ensureSidebarWidth(FILES_SIDEBAR_WIDTH);
    onTabChange?.('files');
  };

  const handleOpenAgentFiles = async () => {
    setActiveTab('files');
    setFileScope({ type: 'agent' });
    ensureSidebarWidth(FILES_SIDEBAR_WIDTH);
    onTabChange?.('files');
  };

  const handleCollapse = () => {
    setIsCollapsed(true);
    onClose?.();
  };

  const handleScrollToStatsSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    handleItemClick();
  };

  if (isCollapsed) {
    return (
      <CollapsedSidebar
        activeTab={activeTab}
        onExpand={(tab) => {
          setActiveTab(tab);
          if (tab === 'files') {
            setFileScope({ type: 'agent' });
            ensureSidebarWidth(FILES_SIDEBAR_WIDTH);
          }
          setIsCollapsed(false);
          onTabChange?.(tab);
        }}
      />
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
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 hover:bg-primary/30 active:bg-primary/50 transition-colors"
          onMouseDown={handleResizeStart}
        />

        <SidebarHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCollapse={handleCollapse}
          onCreateProject={() => { setEditingProject(null); setProjectDialogOpen(true); }}
          onCreateSession={handleCreateSession}
          onCreateAgent={() => {
            const agent = createAgent({ name: t('sidebar.agent.defaultName'), avatar: '🤖', description: '', systemPrompt: '', color: '#3b82f6' });
            setCurrentAgent(agent.id);
            onAgentConfig?.(agent.id);
          }}
          onCreateGroup={handleCreateGroup}
          onOpenGraph={() => onOpenGraph?.()}
        />

        <div className="flex-1 overflow-hidden">
          {activeTab === 'agents' ? (
            <AgentList
              onItemClick={handleItemClick}
              onOpenGraph={onOpenGraph}
              onOpenGroupFiles={handleOpenGroupFiles}
              onAgentSelect={onAgentSelect}
              onAgentConfig={onAgentConfig}
              onCurrentAgentDeleted={onCurrentAgentDeleted}
            />
          ) : activeTab === 'sessions' ? (
            <SessionList
              onItemClick={handleItemClick}
              onSessionSelect={onSessionSelect}
              onEditProject={(project) => { setEditingProject(project); setProjectDialogOpen(true); }}
              sessionTypeFilter={sessionTypeFilter}
              onSessionTypeFilterChange={setSessionTypeFilter}
            />
          ) : activeTab === 'files' ? (
            <div className="h-full flex flex-col">
              {displayGroup && (
                <div className="px-3 py-2 border-b border-border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {fileScope.type === 'group' ? t('sidebar.agent.sharedFiles') : t('sidebar.agent.viewAgentFiles')}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {fileScope.type === 'group' ? displayGroup.name : currentAgent?.name}
                      </div>
                    </div>
                    <FolderOpen className="w-4 h-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={handleOpenAgentFiles}
                      variant={fileScope.type === 'agent' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="flex-1 min-w-0"
                      title={t('sidebar.agent.viewAgentFiles')}
                    >
                      <span className="truncate">{t('sidebar.agent.viewAgentFiles')}</span>
                    </Button>
                    <Button
                      onClick={() => handleOpenGroupFiles(displayGroup.id)}
                      variant={fileScope.type === 'group' && fileScope.groupId === displayGroup.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="flex-1 min-w-0"
                      title={t('sidebar.agent.sharedFiles')}
                    >
                      <span className="truncate">{t('sidebar.agent.sharedFiles')}</span>
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <FileTree
                  rootPath={groupRootPath}
                  selectedPath={selectedFilePath}
                  onSelectFile={onSelectFile}
                  onItemClick={handleItemClick}
                  onBlankClick={onFileBlankClick}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-2 py-1">
                {statsSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleScrollToStatsSection(section.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{section.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{section.hint}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <ProjectDialog
          isOpen={projectDialogOpen}
          onClose={() => { setProjectDialogOpen(false); setEditingProject(null); }}
          project={editingProject ?? undefined}
        />
      </aside>
    </>
  );
}
