import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@shared/stores/agent';
import { Button } from '../ui/button';
import { MoreHorizontal, Edit2, Trash2 } from '../icons';
import { useState } from 'react';
import type { Agent } from '@shared/types';

interface AgentListProps {
  onItemClick?: () => void;
  onEditAgent?: (agent: Agent) => void;
}

export function AgentList({ onItemClick, onEditAgent }: AgentListProps) {
  const { t } = useTranslation();
  const agents = useAgentStore((s) => s.agents);
  const currentAgentId = useAgentStore((s) => s.currentAgentId);
  const setCurrentAgent = useAgentStore((s) => s.setCurrentAgent);
  const deleteAgent = useAgentStore((s) => s.deleteAgent);
  const agentSessions = useAgentStore((s) => s.agentSessions);

  const [contextMenuAgentId, setContextMenuAgentId] = useState<string | null>(null);

  const handleAgentClick = (agentId: string) => {
    setCurrentAgent(agentId);
    onItemClick?.();
  };

  const handleDeleteAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    if (agent.isDefault) {
      alert(t('sidebar.agent.cannotDeleteDefault'));
      return;
    }

    if (confirm(t('sidebar.agent.deleteConfirm', { name: agent.name }))) {
      deleteAgent(agentId);
    }
    setContextMenuAgentId(null);
  };

  const handleEditAgent = (agent: Agent) => {
    setContextMenuAgentId(null);
    onEditAgent?.(agent);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {agents.map((agent) => {
          const sessionCount = agentSessions[agent.id]?.length || 0;
          const isActive = currentAgentId === agent.id;
          const showContextMenu = contextMenuAgentId === agent.id;

          return (
            <div key={agent.id} className="relative mb-1">
              <button
                onClick={() => handleAgentClick(agent.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left
                  ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'}
                `}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: agent.color + '20', color: agent.color }}
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
                {!agent.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuAgentId(showContextMenu ? null : agent.id);
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                )}
              </button>

              {showContextMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setContextMenuAgentId(null)}
                  />
                  <div className="absolute right-2 top-full mt-1 w-40 bg-popover border border-border rounded-md shadow-md z-50 py-1">
                    <button
                      onClick={() => handleEditAgent(agent)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t('sidebar.agent.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('sidebar.agent.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {agents.filter((a) => !a.isDefault).length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t('sidebar.agent.noAgents')}
          </div>
        )}
      </div>
    </div>
  );
}
