import { memo } from 'react';
import { NodeProps } from 'reactflow';

export interface AgentGroupNodeData {
  label: string;
  color?: string;
  agentCount: number;
}

export const AgentGroupNode = memo(({ data }: NodeProps<AgentGroupNodeData>) => {
  const color = data.color || 'hsl(var(--primary))';

  return (
    <div
      className="relative w-full h-full rounded-2xl pointer-events-none overflow-visible"
      style={{
        background: 'hsl(var(--card) / 0.35)',
        border: '1px solid hsl(var(--border) / 0.5)',
        boxShadow: '0 1px 4px hsl(var(--foreground) / 0.02), inset 0 1px 0 hsl(var(--card) / 0.5)',
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-25"
        style={{ background: color }}
      />

      {/* Label badge */}
      <div
        className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 shadow-sm"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border) / 0.7)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-semibold text-foreground truncate max-w-[180px]">
          {data.label}
        </span>
        <span
          className="text-[10px] font-medium ml-0.5"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          {data.agentCount}
        </span>
      </div>
    </div>
  );
});

AgentGroupNode.displayName = 'AgentGroupNode';
