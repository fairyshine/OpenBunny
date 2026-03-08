import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@shared/stores/agent';
import { Button } from '../ui/button';
import { MoreHorizontal, Edit2, Trash2, Network } from '../icons';
import { useState } from 'react';
import type { Agent } from '@shared/types';
import { ChevronRight, Pencil, ArrowRightLeft } from 'lucide-react';

interface AgentListProps {
  onItemClick?: () => void;
  onEditAgent?: (agent: Agent) => void;
  onOpenGraph?: (groupId?: string) => void;
}

export function AgentList({ onItemClick, onEditAgent, onOpenGraph }: AgentListProps) {
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

  const [contextMenuAgentId, setContextMenuAgentId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [contextMenuGroupId, setContextMenuGroupId] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleAgentClick = (agentId: string) => {
    setCurrentAgent(agentId);
    onItemClick?.();
  };

  const handleDeleteAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    if (agent.isDefault) { alert(t('sidebar.agent.cannotDeleteDefault')); return; }
    if (confirm(t('sidebar.agent.deleteConfirm', { name: agent.name }))) deleteAgent(agentId);
    setContextMenuAgentId(null);
  };

  const handleEditAgent = (agent: Agent) => {
    setContextMenuAgentId(null);
    onEditAgent?.(agent);
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
    updateAgent(agentId, { groupId });
    setContextMenuAgentId(null);
  };

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

    return (
      <div key={agent.id} className="relative">
        <button
          onClick={() => handleAgentClick(agent.id)}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
            ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'}
          `}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
            style={agent.isDefault ? {
              backgroundColor: 'hsl(var(--foreground))',
              color: 'hsl(var(--background))'
            } : {
              backgroundColor: agent.color + '20',
              color: agent.color
            }}
          >
            {agent.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{agent.name}</span>
              {agent.isDefault && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {t('sidebar.agent.default')}
                </span>
              )}
            </div>
            {sessionCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('sidebar.agent.sessions', { count: sessionCount })}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover/agent:opacity-100"
            onClick={(e) => { e.stopPropagation(); setContextMenuAgentId(showCtx ? null : agent.id); }}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </button>

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
              {/* Move to group submenu */}
              {agentGroups.length > 0 && (
                <div className="border-t border-border my-1" />
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
      <div key={groupId} className="mb-1">
        {/* Group header */}
        <div className="flex items-center gap-1 px-2 py-1 group/grp">
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
          <div className="flex items-center gap-0.5 opacity-0 group-hover/grp:opacity-100 transition-opacity">
            <Button
              variant="ghost" size="icon" className="h-5 w-5"
              onClick={(e) => { e.stopPropagation(); onOpenGraph?.(groupId); }}
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
              <div key={agent.id} className="group/agent">
                {renderAgentItem(agent)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {/* Groups */}
        {agentGroups.map((group) => {
          const groupAgents = groupedMap.get(group.id) || [];
          return renderGroupSection(group.id, group.name, groupAgents, group.color);
        })}

        {/* Ungrouped agents */}
        {ungroupedAgents.length > 0 && (
          <>
            {agentGroups.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>{t('sidebar.agent.ungrouped')}</span>
                <span className="text-muted-foreground/60 ml-auto">{ungroupedAgents.length}</span>
              </div>
            )}
            {ungroupedAgents.map((agent) => (
              <div key={agent.id} className="group/agent">
                {renderAgentItem(agent)}
              </div>
            ))}
          </>
        )}

        {agents.filter((a) => !a.isDefault).length === 0 && agentGroups.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t('sidebar.agent.noAgents')}
          </div>
        )}
      </div>
    </div>
  );
}
