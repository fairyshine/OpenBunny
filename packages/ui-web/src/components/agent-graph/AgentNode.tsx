// Knowledge Graph style Agent Node
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { Agent } from '@shared/types';

export interface AgentNodeData {
  agent: Agent;
}

export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const { agent } = data;
  const isDefault = agent.isDefault;

  const color = isDefault ? 'hsl(var(--primary))' : agent.color;
  const glowColor = isDefault ? 'hsl(var(--primary) / 0.4)' : `${agent.color}66`;

  return (
    <div className="flex flex-col items-center gap-1.5 group">
      {/* Handles — invisible, full circle coverage */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-full !h-full !rounded-full !border-none !bg-transparent !top-0 !left-0 !transform-none !min-w-0 !min-h-0"
        style={{ width: 56, height: 56 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-full !h-full !rounded-full !border-none !bg-transparent !top-0 !left-0 !transform-none !min-w-0 !min-h-0"
        style={{ width: 56, height: 56 }}
      />

      {/* Avatar circle */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-300 cursor-grab active:cursor-grabbing"
        style={{
          background: isDefault
            ? 'hsl(var(--foreground))'
            : `linear-gradient(135deg, ${agent.color}30, ${agent.color}60)`,
          color: isDefault ? 'hsl(var(--background))' : agent.color,
          boxShadow: selected
            ? `0 0 0 3px ${color}, 0 0 20px ${glowColor}`
            : `0 0 12px ${glowColor}`,
          border: `2px solid ${selected ? color : 'transparent'}`,
        }}
      >
        {agent.avatar}
      </div>

      {/* Name label */}
      <div
        className="text-xs font-medium text-center max-w-[80px] leading-tight select-none"
        style={{ color: selected ? color : 'hsl(var(--foreground))' }}
      >
        {agent.name}
      </div>
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
