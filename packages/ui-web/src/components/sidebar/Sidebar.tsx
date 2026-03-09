import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@shared/stores/session';
import { useAgentStore, DEFAULT_AGENT_ID } from '@shared/stores/agent';
import { SessionType } from '@shared/types';
import type { Project } from '@shared/types';
import FileTree from './file-tree';
import { ProjectDialog } from './ProjectDialog';
import { CollapsedSidebar } from './CollapsedSidebar';
import { SidebarHeader } from './SidebarHeader';
import { SessionList } from './SessionList';
import { AgentList } from './AgentList';
import { useResizableSidebar } from './useResizableSidebar';
import type { SessionTypeFilter } from './SessionTypeFilterBar';

type TabType = 'agents' | 'sessions' | 'files';

interface SidebarProps {
  selectedFilePath?: string;
  onSelectFile?: (path: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onSessionSelect?: () => void;
  onFileBlankClick?: () => void;
  onOpenGraph?: (groupId?: string) => void;
  onTabChange?: (tab: 'agents' | 'sessions' | 'files') => void;
  onAgentSelect?: (agentId: string, reselected: boolean) => void;
  onCurrentAgentDeleted?: () => void;
}

export default function Sidebar({ selectedFilePath, onSelectFile, isOpen, onClose, onSessionSelect, onFileBlankClick, onOpenGraph, onTabChange, onAgentSelect, onCurrentAgentDeleted }: SidebarProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('agents');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionTypeFilter>('all');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { sidebarWidth, sidebarRef, handleResizeStart } = useResizableSidebar();
  const { createSession } = useSessionStore();
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const createAgentSession = useAgentStore((s) => s.createAgentSession);
  const createAgent = useAgentStore((s) => s.createAgent);
  const setCurrentAgent = useAgentStore((s) => s.setCurrentAgent);

  const createAgentGroup = useAgentStore((s) => s.createAgentGroup);
  const agentGroups = useAgentStore((s) => s.agentGroups);

  const getDefaultGroupName = () => {
    const existingNames = new Set(agentGroups.map((group) => group.name.trim()));

    for (let index = 1; ; index += 1) {
      const candidate = t('sidebar.agent.defaultGroupName', { index }).trim();
      if (!existingNames.has(candidate)) return candidate;
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
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
      createAgentSession(currentAgentId, t('header.newSession'));
    }
    onSessionSelect?.();
    handleItemClick();
  };

  const handleCollapse = () => {
    setIsCollapsed(true);
    onClose?.();
  };

  if (isCollapsed) {
    return (
      <CollapsedSidebar
        activeTab={activeTab}
        onExpand={(tab) => { setActiveTab(tab); setIsCollapsed(false); }}
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
        {/* Resize Handle */}
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
            onAgentSelect?.(agent.id, false);
          }}
          onCreateGroup={() => { const name = prompt(t('sidebar.agent.groupName'), getDefaultGroupName()); if (name?.trim()) createAgentGroup(name.trim()); }}
          onOpenGraph={() => onOpenGraph?.()}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'agents' ? (
            <AgentList
              onItemClick={handleItemClick}
              onOpenGraph={onOpenGraph}
              onAgentSelect={onAgentSelect}
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
          ) : (
            <div className="h-full">
              <FileTree
                selectedPath={selectedFilePath}
                onSelectFile={onSelectFile}
                onItemClick={handleItemClick}
                onBlankClick={onFileBlankClick}
              />
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
