import { useTranslation } from 'react-i18next';
import { useAgentStore, DEFAULT_AGENT_ID } from '@openbunny/shared/stores/agent';
import { useSessionStore } from '@openbunny/shared/stores/session';
import { isImageAvatar } from '@openbunny/shared/utils/imageUtils';
import { Button } from '../ui/button';
import { MoreHorizontal, Edit2, Trash2, Network, FolderOpen } from '../icons';
import { useCallback, useMemo, useState } from 'react';
import type { Agent } from '@openbunny/shared/types';
import { ChevronRight, Pencil, ArrowRightLeft, Star, Settings } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

const UNGROUPED_DROP_ID = '__ungrouped__';

interface AgentListProps {
  onItemClick?: () => void;
  onOpenGraph?: (groupId?: string) => void;
  onOpenGroupFiles?: (groupId: string) => void;
  onAgentSelect?: (agentId: string, reselected: boolean) => void;
  onAgentConfig?: (agentId: string) => void;
  onCurrentAgentDeleted?: () => void;
}

// --- Draggable wrapper for a single agent item ---
function DraggableAgentItem({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: agent.id,
    disabled: !!agent.isDefault,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group/agent ${isDragging ? 'opacity-30' : ''}`}
    >
      {children}
    </div>
  );
}

// --- Droppable wrapper for an entire group section ---
function DroppableGroupZone({ groupId, children }: { groupId: string; children: (isOver: boolean) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId });
  return <div ref={setNodeRef}>{children(isOver)}</div>;
}

// --- Droppable wrapper for the ungrouped zone ---
function DroppableUngroupedZone({ children }: { children: (isOver: boolean) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNGROUPED_DROP_ID });
  return <div ref={setNodeRef}>{children(isOver)}</div>;
}

export function AgentList({ onItemClick, onOpenGraph, onOpenGroupFiles, onAgentSelect, onAgentConfig, onCurrentAgentDeleted }: AgentListProps) {
  const { t } = useTranslation();
  const agents = useAgentStore((s) => s.agents);
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const setCurrentAgent = useAgentStore((s) => s.setCurrentAgent);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const agentSessions = useAgentStore((s) => s.agentSessions);
  const agentGroups = useAgentStore((s) => s.agentGroups);
  const deleteAgentGroup = useAgentStore((s) => s.deleteAgentGroup);
  const updateAgentGroup = useAgentStore((s) => s.updateAgentGroup);

  // Track which agents have streaming sessions
  const defaultAgentSessions = useSessionStore((s) => s.sessions);
  const streamingAgentIds = useMemo(() => {
    const ids = new Set<string>();
    if (defaultAgentSessions.some((s) => s.isStreaming)) {
      ids.add(DEFAULT_AGENT_ID);
    }
    for (const [agentId, sessions] of Object.entries(agentSessions)) {
      if (sessions.some((s) => s.isStreaming)) {
        ids.add(agentId);
      }
    }
    return ids;
  }, [defaultAgentSessions, agentSessions]);

  const [contextMenuAgentId, setContextMenuAgentId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [contextMenuGroupId, setContextMenuGroupId] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeDragAgent, setActiveDragAgent] = useState<Agent | null>(null);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleAgentClick = (agentId: string) => {
    const reselected = currentAgentId === agentId;
    setCurrentAgent(agentId);
    onAgentSelect?.(agentId, reselected);
    onItemClick?.();
  };

  const handleAgentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, agentId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleAgentClick(agentId);
  };

  const handleDeleteAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    if (agent.isDefault) { alert(t('sidebar.agent.cannotDeleteDefault')); return; }

    const isCurrentAgent = currentAgentId === agentId;
    if (confirm(t('sidebar.agent.deleteConfirm', { name: agent.name }))) {
      deleteAgent(agentId);
      if (isCurrentAgent) {
        onCurrentAgentDeleted?.();
      }
    }

    setContextMenuAgentId(null);
  };

  const handleEditAgent = (agent: Agent) => {
    setContextMenuAgentId(null);
    onAgentConfig?.(agent.id);
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = agentGroups.find((g) => g.id === groupId);
    if (!group) return;
    if (confirm(t('sidebar.agent.deleteGroupConfirm', { name: group.name }))) deleteAgentGroup(groupId);
    setContextMenuGroupId(null);
  };

  const handleStartRename = (groupId: string) => {
    const group = agentGroups.find((g) => g.id === groupId);
    if (!group) return;
    setRenamingGroupId(groupId);
    setRenameValue(group.name);
    setContextMenuGroupId(null);
  };

  const handleFinishRename = () => {
    if (renamingGroupId && renameValue.trim()) {
      updateAgentGroup(renamingGroupId, { name: renameValue.trim() });
    }
    setRenamingGroupId(null);
  };

  const handleMoveToGroup = (agentId: string, groupId: string | undefined) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent?.groupId) {
      const oldGroup = agentGroups.find((g) => g.id === agent.groupId);
      if (oldGroup?.coreAgentId === agentId) {
        const nextCore = agents.find((a) => a.groupId === oldGroup.id && a.id !== agentId);
        updateAgentGroup(oldGroup.id, { coreAgentId: nextCore?.id });
      }
    }
    updateAgent(agentId, { groupId });
    setContextMenuAgentId(null);
  };

  const switchToGroupCore = (groupId: string) => {
    const currentAgent = agents.find((a) => a.id === currentAgentId);
    if (currentAgent?.groupId === groupId) return;
    const group = agentGroups.find((g) => g.id === groupId);
    if (group?.coreAgentId) {
      setCurrentAgent(group.coreAgentId);
      onAgentSelect?.(group.coreAgentId, false);
    } else {
      setCurrentAgent(DEFAULT_AGENT_ID);
      onAgentSelect?.(DEFAULT_AGENT_ID, currentAgentId === DEFAULT_AGENT_ID);
    }
  };

  // --- Drag handlers ---
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const agent = agents.find((a) => a.id === event.active.id);
    if (agent) setActiveDragAgent(agent);
  }, [agents]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragAgent(null);
    const { active, over } = event;
    if (!over) return;

    const agentId = active.id as string;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    const targetId = over.id as string;

    if (targetId === UNGROUPED_DROP_ID) {
      // Drop to ungrouped — skip if already ungrouped
      if (!agent.groupId) return;
      handleMoveToGroup(agentId, undefined);
    } else {
      // Drop to a group — skip if same group
      if (agent.groupId === targetId) return;
      handleMoveToGroup(agentId, targetId);
    }
  }, [agents, handleMoveToGroup]);

  const handleDragCancel = useCallback(() => {
    setActiveDragAgent(null);
  }, []);

  // Partition agents by group
  const ungroupedAgents = agents.filter((a) => !a.groupId);
  const groupedMap = new Map<string, Agent[]>();
  for (const group of agentGroups) groupedMap.set(group.id, []);
  for (const agent of agents) {
    if (agent.groupId && groupedMap.has(agent.groupId)) {
      groupedMap.get(agent.groupId)!.push(agent);
    }
  }

  const renderAgentItem = (agent: Agent) => {
    const sessionCount = agentSessions[agent.id]?.length || 0;
    const isActive = currentAgentId === agent.id;
    const showCtx = contextMenuAgentId === agent.id;
    const isStreaming = streamingAgentIds.has(agent.id);
    const agentGroup = agent.groupId ? agentGroups.find((g) => g.id === agent.groupId) : undefined;
    const isCore = agentGroup?.coreAgentId === agent.id;

    return (
      <div key={agent.id} className="relative">
        <div
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
            ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'}
            ${isStreaming ? 'streaming-border' : ''}
          `}
        >
          <div
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => handleAgentClick(agent.id)}
            onKeyDown={(event) => handleAgentKeyDown(event, agent.id)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-base shrink-0 overflow-hidden"
              style={agent.isDefault ? {
                backgroundColor: 'hsl(var(--foreground))',
                color: 'hsl(var(--background))'
              } : {
                backgroundColor: agent.color + '20',
                color: agent.color
              }}
            >
              {isImageAvatar(agent.avatar)
                ? <img src={agent.avatar} alt="avatar" className="w-full h-full object-cover" draggable={false} />
                : agent.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{agent.name}</span>
                {agent.isDefault && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {t('sidebar.agent.default')}
                  </span>
                )}
                {isCore && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">
                    {t('sidebar.agent.core')}
                  </span>
                )}
              </div>
              {sessionCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('sidebar.agent.sessions', { count: sessionCount })}
                </span>
              )}
            </div>
          </div>
          {!agent.isDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 group-hover/agent:opacity-100"
              onClick={(e) => { e.stopPropagation(); onAgentConfig?.(agent.id); }}
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover/agent:opacity-100"
            onClick={(e) => { e.stopPropagation(); setContextMenuAgentId(showCtx ? null : agent.id); }}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </div>

        {showCtx && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenuAgentId(null)} />
            <div className="absolute right-2 top-full mt-1 w-44 bg-popover border border-border rounded-md shadow-md z-50 py-1">
              <button
                onClick={() => handleEditAgent(agent)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {t('sidebar.agent.edit')}
              </button>
              {agent.groupId && (
                <>
                  <div className="border-t border-border my-1" />
                  {isCore ? (
                    agents.filter((a) => a.groupId === agent.groupId && a.id !== agent.id).length > 0 && (
                      <button
                        onClick={() => {
                          const nextCore = agents.find((a) => a.groupId === agent.groupId && a.id !== agent.id);
                          updateAgentGroup(agent.groupId!, { coreAgentId: nextCore?.id });
                          setContextMenuAgentId(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5 fill-foreground text-foreground" />
                        {t('sidebar.agent.unsetCore')}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        updateAgentGroup(agent.groupId!, { coreAgentId: agent.id });
                        setContextMenuAgentId(null);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                      {t('sidebar.agent.setAsCore')}
                    </button>
                  )}
                </>
              )}
              {agent.groupId && (
                <button
                  onClick={() => handleMoveToGroup(agent.id, undefined)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {t('sidebar.agent.ungrouped')}
                </button>
              )}
              {agentGroups.filter((g) => g.id !== agent.groupId).map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleMoveToGroup(agent.id, g.id)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {g.name}
                </button>
              ))}
              {!agent.isDefault && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('sidebar.agent.delete')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderGroupSection = (groupId: string, groupName: string, groupAgents: Agent[], color?: string) => {
    const isCollapsed = collapsedGroups.has(groupId);
    const showGroupCtx = contextMenuGroupId === groupId;
    const isRenaming = renamingGroupId === groupId;

    return (
      <DroppableGroupZone key={groupId} groupId={groupId}>
        {(isOver) => (
          <div className={`mb-1 rounded-md transition-colors ${isOver ? 'bg-primary/10' : ''}`}>
            {/* Group header */}
            <div className="relative flex items-center gap-1 px-2 py-1 group/grp">
              <button
                onClick={() => toggleGroupCollapse(groupId)}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                {color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setRenamingGroupId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-b border-primary text-xs font-medium outline-none w-full"
                  />
                ) : (
                  <span className="truncate uppercase tracking-wider">{groupName}</span>
                )}
                <span className="text-muted-foreground/60 ml-auto shrink-0">{groupAgents.length}</span>
              </button>
              <div className={`flex items-center gap-0.5 transition-opacity ${showGroupCtx ? 'opacity-100' : 'opacity-0 group-hover/grp:opacity-100'}`}>
                <Button
                  variant="ghost" size="icon" className="h-5 w-5"
                  onClick={(e) => { e.stopPropagation(); switchToGroupCore(groupId); onOpenGroupFiles?.(groupId); }}
                  title={t('sidebar.agent.openSharedFiles')}
                >
                  <FolderOpen className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-5 w-5"
                  onClick={(e) => { e.stopPropagation(); switchToGroupCore(groupId); onOpenGraph?.(groupId); }}
                  title={t('sidebar.agent.relationshipGraph')}
                >
                  <Network className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-5 w-5"
                  onClick={(e) => { e.stopPropagation(); setContextMenuGroupId(showGroupCtx ? null : groupId); }}
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </div>

              {showGroupCtx && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setContextMenuGroupId(null)} />
                  <div className="absolute right-2 top-full mt-1 w-36 bg-popover border border-border rounded-md shadow-md z-50 py-1">
                    <button
                      onClick={() => handleStartRename(groupId)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('sidebar.agent.renameGroup')}
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(groupId)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('sidebar.agent.deleteGroup')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Group agents */}
            {!isCollapsed && (
              <div className="pl-2">
                {groupAgents.map((agent) => (
                  <DraggableAgentItem key={agent.id} agent={agent}>
                    {renderAgentItem(agent)}
                  </DraggableAgentItem>
                ))}
              </div>
            )}
          </div>
        )}
      </DroppableGroupZone>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {/* Groups */}
          {agentGroups.map((group) => {
            const groupAgents = groupedMap.get(group.id) || [];
            return renderGroupSection(group.id, group.name, groupAgents, group.color);
          })}

          {/* Ungrouped agents */}
          {agentGroups.length > 0 ? (
            <DroppableUngroupedZone>
              {(isOver) => (
                <div className={`rounded-md transition-colors ${isOver ? 'bg-primary/10' : ''}`}>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <span>{t('sidebar.agent.ungrouped')}</span>
                    <span className="text-muted-foreground/60 ml-auto">{ungroupedAgents.length}</span>
                  </div>
                  {ungroupedAgents.map((agent) => (
                    <DraggableAgentItem key={agent.id} agent={agent}>
                      {renderAgentItem(agent)}
                    </DraggableAgentItem>
                  ))}
                </div>
              )}
            </DroppableUngroupedZone>
          ) : (
            ungroupedAgents.map((agent) => (
              <DraggableAgentItem key={agent.id} agent={agent}>
                {renderAgentItem(agent)}
              </DraggableAgentItem>
            ))
          )}

          {agents.filter((a) => !a.isDefault).length === 0 && agentGroups.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('sidebar.agent.noAgents')}
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay — floating card following cursor */}
      <DragOverlay dropAnimation={null}>
        {activeDragAgent && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg opacity-80 w-48">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0 overflow-hidden"
              style={{ backgroundColor: activeDragAgent.color + '20', color: activeDragAgent.color }}
            >
              {isImageAvatar(activeDragAgent.avatar)
                ? <img src={activeDragAgent.avatar} alt="" className="w-full h-full object-cover" draggable={false} />
                : activeDragAgent.avatar}
            </div>
            <span className="text-sm font-medium truncate">{activeDragAgent.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
