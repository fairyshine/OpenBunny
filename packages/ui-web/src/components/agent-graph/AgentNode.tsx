import { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { Agent } from '@shared/types';
import { isImageAvatar } from '@shared/utils/imageUtils';

export const AGENT_NODE_WIDTH = 80;
export const AGENT_NODE_HEIGHT = 90;
export const AGENT_AVATAR_CENTER_X = 40;
export const AGENT_AVATAR_CENTER_Y = 32;

export interface AgentNodeData {
  agent: Agent;
  isEditMode?: boolean;
  isPendingSource?: boolean;
  willConnect?: boolean;
  willDisconnect?: boolean;
  isStatic?: boolean;
  isStreaming?: boolean;
  isCore?: boolean;
}

export const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const { agent, isEditMode, isPendingSource, willConnect, willDisconnect, isStatic, isStreaming, isCore } = data;
  const isDefault = agent.isDefault;

  const accentColor = isDefault ? 'hsl(var(--primary))' : agent.color;

  let borderColor = 'hsl(var(--border))';
  let ringStyle = 'none';
  let avatarBorder = 'transparent';
  let labelColor = 'hsl(var(--muted-foreground))';
  let cardShadow = '0 1px 3px hsl(var(--foreground) / 0.04), 0 4px 12px hsl(var(--foreground) / 0.03)';

  if (isPendingSource) {
    borderColor = 'hsl(var(--primary))';
    ringStyle = '0 0 0 2px hsl(var(--primary) / 0.2)';
    avatarBorder = 'hsl(var(--primary))';
    labelColor = 'hsl(var(--primary))';
    cardShadow = '0 2px 8px hsl(var(--primary) / 0.15), 0 8px 24px hsl(var(--primary) / 0.1)';
  } else if (willDisconnect) {
    borderColor = 'hsl(var(--destructive))';
    ringStyle = '0 0 0 2px hsl(var(--destructive) / 0.15)';
    avatarBorder = 'hsl(var(--destructive))';
    labelColor = 'hsl(var(--destructive))';
    cardShadow = '0 2px 8px hsl(var(--destructive) / 0.12)';
  } else if (willConnect) {
    borderColor = 'hsl(142 76% 36%)';
    ringStyle = '0 0 0 2px hsl(142 76% 36% / 0.15)';
    avatarBorder = 'hsl(142 76% 36%)';
    labelColor = 'hsl(142 76% 36%)';
    cardShadow = '0 2px 8px hsl(142 76% 36% / 0.12)';
  } else if (selected) {
    borderColor = accentColor;
    ringStyle = isDefault ? '0 0 0 2px hsl(var(--primary) / 0.15)' : `0 0 0 2px ${agent.color}22`;
    avatarBorder = accentColor;
    labelColor = accentColor;
    cardShadow = '0 2px 8px hsl(var(--foreground) / 0.08), 0 8px 20px hsl(var(--foreground) / 0.06)';
  } else if (isEditMode) {
    borderColor = 'hsl(var(--primary) / 0.25)';
  }

  const cursor = isEditMode ? 'cursor-crosshair' : isStatic ? 'cursor-default' : 'cursor-grab active:cursor-grabbing';

  const interactiveHandleClassName = '!absolute !rounded-full !border-0 !bg-transparent !opacity-0 !pointer-events-auto';
  const hiddenHandleClassName = '!w-px !h-px !opacity-0 !border-0 !bg-transparent !pointer-events-none';

  const centerHandleStyle = isEditMode
    ? {
        top: AGENT_AVATAR_CENTER_Y,
        left: AGENT_AVATAR_CENTER_X,
        right: 'auto',
        bottom: 'auto',
        width: 28,
        height: 28,
        transform: 'translate(-50%, -50%)',
        zIndex: 3,
      }
    : undefined;

  return (
    <div className={`relative flex flex-col items-center ${cursor}`} style={{ width: AGENT_NODE_WIDTH, height: AGENT_NODE_HEIGHT }}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={Boolean(isEditMode)}
        className={isEditMode ? interactiveHandleClassName : hiddenHandleClassName}
        style={centerHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={Boolean(isEditMode)}
        className={isEditMode ? interactiveHandleClassName : hiddenHandleClassName}
        style={centerHandleStyle}
      />

      <div
        className={`relative flex flex-col items-center gap-2 px-3 pt-3 pb-3.5 rounded-xl transition-all duration-200 ${isPendingSource ? 'animate-pulse' : ''} ${isStreaming ? 'streaming-border' : ''}`}
        style={{
          background: 'hsl(var(--card))',
          border: `1px solid ${borderColor}`,
          boxShadow: `${cardShadow}${ringStyle !== 'none' ? `, ${ringStyle}` : ''}`,
          width: AGENT_NODE_WIDTH,
          minHeight: AGENT_NODE_HEIGHT,
        }}
      >
        {isEditMode && !isPendingSource && !willConnect && !willDisconnect && !selected && (
          <div className="absolute inset-[-3px] rounded-[14px] border border-dashed border-primary/30 pointer-events-none" />
        )}

        <div
          className="absolute top-0 left-3 right-3 h-[2px] rounded-b-full opacity-60"
          style={{ background: accentColor }}
        />

        <div className="relative">
          <div
            className="relative inline-flex items-center justify-center w-10 h-10 shrink-0 overflow-hidden rounded-full text-xl leading-none transition-colors duration-200"
            style={{
              background: isDefault
                ? 'hsl(var(--muted))'
                : `linear-gradient(135deg, ${agent.color}18, ${agent.color}0A)`,
              border: `1.5px solid ${avatarBorder === 'transparent' ? 'hsl(var(--border) / 0.6)' : avatarBorder}`,
            }}
          >
            {isImageAvatar(agent.avatar)
              ? <img src={agent.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" draggable={false} />
              : <span className="select-none leading-none">{agent.avatar}</span>}
          </div>
          {isCore && (
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: 'hsl(var(--card))', border: '1.5px solid hsl(var(--border))' }}
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="hsl(var(--foreground))" stroke="hsl(var(--foreground))" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          )}
        </div>

        <div
          className="text-[11px] font-medium text-center leading-tight select-none max-w-[72px] truncate"
          style={{ color: labelColor }}
          title={agent.name}
        >
          {agent.name}
        </div>
      </div>
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
