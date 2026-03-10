// Agent Knowledge Graph — embedded in main content area
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useNodes,
  useStore,
  NodeTypes,
  EdgeTypes,
  EdgeProps,
  Connection,
  ConnectionMode,
  ConnectionLineType,
  ConnectionLineComponentProps,
  ReactFlowProvider,
  useReactFlow,
  getStraightPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { useAgentStore, DEFAULT_AGENT_ID } from '@shared/stores/agent';
import { useSessionStore } from '@shared/stores/session';
import type { Agent, AgentGroup } from '@shared/types';
import { Button } from '../ui/button';
import { AgentNode, AGENT_AVATAR_CENTER_X, AGENT_AVATAR_CENTER_Y, type AgentNodeData } from './AgentNode';
import { AgentGroupNode } from './AgentGroupNode';
import { Maximize2, Trash2, X, Link2 } from 'lucide-react';

const elk = new ELK();

const NODE_WIDTH = 86;
const NODE_HEIGHT = 78;

const GROUP_LABEL_OFFSET_Y = 18;
const GROUP_LABEL_HEIGHT = 34;
const GROUP_PADDING_X = 28;
const GROUP_PADDING_TOP = 34;
const GROUP_PADDING_BOTTOM = 28;
const GROUP_AGENT_GAP_X = 116;
const GROUP_AGENT_GAP_Y = 108;
const GROUP_LAYOUT_GAP_X = 72;
const GROUP_LAYOUT_GAP_Y = 72;

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
  groupNode: AgentGroupNode,
};

function CenterEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, label, labelStyle }: EdgeProps) {
  const nodes = useNodes();
  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);

  const sourceCenterX = (sourceNode?.positionAbsolute?.x ?? sourceNode?.position.x ?? sourceX) + AGENT_AVATAR_CENTER_X;
  const sourceCenterY = (sourceNode?.positionAbsolute?.y ?? sourceNode?.position.y ?? sourceY) + AGENT_AVATAR_CENTER_Y;
  const targetCenterX = (targetNode?.positionAbsolute?.x ?? targetNode?.position.x ?? targetX) + AGENT_AVATAR_CENTER_X;
  const targetCenterY = (targetNode?.positionAbsolute?.y ?? targetNode?.position.y ?? targetY) + AGENT_AVATAR_CENTER_Y;

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX: sourceCenterX,
    sourceY: sourceCenterY,
    targetX: targetCenterX,
    targetY: targetCenterY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              fontSize: 10,
              color: 'hsl(var(--muted-foreground))',
              fontWeight: 500,
              background: 'hsl(var(--card) / 0.9)',
              backdropFilter: 'blur(4px)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid hsl(var(--border) / 0.5)',
              ...(labelStyle as React.CSSProperties),
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = {
  centerEdge: CenterEdge,
};

function CenterConnectionLine({ fromNode, toX, toY }: ConnectionLineComponentProps) {
  if (!fromNode) return null;

  const sourceX = (fromNode.positionAbsolute?.x ?? fromNode.position.x) + AGENT_AVATAR_CENTER_X;
  const sourceY = (fromNode.positionAbsolute?.y ?? fromNode.position.y) + AGENT_AVATAR_CENTER_Y;

  // Snap to target node's avatar center if hovering over one
  const nodeLookup = useStore((s) => s.nodeInternals);
  let finalX = toX;
  let finalY = toY;

  nodeLookup.forEach((node) => {
    if (node.type !== 'agentNode' || node.id === fromNode.id) return;
    const nx = node.positionAbsolute?.x ?? node.position.x;
    const ny = node.positionAbsolute?.y ?? node.position.y;
    const cx = nx + AGENT_AVATAR_CENTER_X;
    const cy = ny + AGENT_AVATAR_CENTER_Y;
    const dist = Math.hypot(toX - cx, toY - cy);
    if (dist < 40) {
      finalX = cx;
      finalY = cy;
    }
  });

  const [path] = getStraightPath({ sourceX, sourceY, targetX: finalX, targetY: finalY });

  return (
    <g>
      <path d={path} fill="none" stroke="hsl(var(--primary) / 0.65)" strokeWidth={2} strokeDasharray="6 4" />
    </g>
  );
}

interface AgentLike { id: string }
interface RelLike { id: string; sourceAgentId: string; targetAgentId: string }

async function runElkLayout(
  agents: AgentLike[],
  relationships: RelLike[],
): Promise<Map<string, { x: number; y: number }>> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'stress',
      'elk.stress.desiredEdgeLength': '180',
      'elk.spacing.nodeNode': '60',
      'elk.padding': '[top=40,left=40,bottom=40,right=40]',
    },
    children: agents.map((agent) => ({ id: agent.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: relationships.map((relationship) => ({
      id: relationship.id,
      sources: [relationship.sourceAgentId],
      targets: [relationship.targetAgentId],
    })),
  };

  const result = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();

  for (const node of result.children ?? []) {
    if (node.x != null && node.y != null) {
      positions.set(node.id, { x: node.x, y: node.y });
    }
  }

  return positions;
}

function circleLayout(agents: AgentLike[]): Map<string, { x: number; y: number }> {
  const cx = 400;
  const cy = 300;
  const radius = Math.max(120, agents.length * 40);
  const positions = new Map<string, { x: number; y: number }>();

  agents.forEach((agent, index) => {
    positions.set(agent.id, {
      x: cx + Math.cos((index / agents.length) * 2 * Math.PI - Math.PI / 2) * radius,
      y: cy + Math.sin((index / agents.length) * 2 * Math.PI - Math.PI / 2) * radius,
    });
  });

  return positions;
}

function getGroupDimensions(agentCount: number) {
  const columns = agentCount <= 1 ? 1 : agentCount <= 4 ? 2 : agentCount <= 9 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(Math.max(agentCount, 1) / columns));
  const width = Math.max(260, GROUP_PADDING_X * 2 + NODE_WIDTH + (columns - 1) * GROUP_AGENT_GAP_X);
  const height = Math.max(
    150,
    GROUP_LABEL_OFFSET_Y + GROUP_LABEL_HEIGHT + GROUP_PADDING_TOP + NODE_HEIGHT + (rows - 1) * GROUP_AGENT_GAP_Y + GROUP_PADDING_BOTTOM,
  );

  return { columns, rows, width, height };
}

function buildOverviewNodes(agents: Agent[], agentGroups: AgentGroup[], streamingAgentIds?: Set<string>): Node[] {
  const nodes: Node[] = [];
  const groupedEntries = agentGroups.map((group) => ({
    group,
    agents: agents.filter((agent) => agent.groupId === group.id),
  }));
  const columnsPerRow = groupedEntries.length <= 1 ? 1 : groupedEntries.length <= 4 ? 2 : 3;
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;
  let columnIndex = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const entry of groupedEntries) {
    const { width, height, columns } = getGroupDimensions(entry.agents.length);

    if (columnIndex >= columnsPerRow) {
      currentX = 0;
      currentY += rowHeight + GROUP_LAYOUT_GAP_Y;
      rowHeight = 0;
      columnIndex = 0;
    }

    const groupNodeId = `group:${entry.group.id}`;

    nodes.push({
      id: groupNodeId,
      type: 'groupNode',
      position: { x: currentX, y: currentY },
      data: {
        label: entry.group.name,
        color: entry.group.color,
        agentCount: entry.agents.length,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      style: { width, height, zIndex: 0 },
    });

    const gridWidth = NODE_WIDTH + (columns - 1) * GROUP_AGENT_GAP_X;
    const offsetX = Math.max(GROUP_PADDING_X, (width - gridWidth) / 2);

    entry.agents.forEach((agent, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;

      nodes.push({
        id: agent.id,
        type: 'agentNode',
        position: {
          x: offsetX + column * GROUP_AGENT_GAP_X,
          y: GROUP_LABEL_OFFSET_Y + GROUP_LABEL_HEIGHT + GROUP_PADDING_TOP + row * GROUP_AGENT_GAP_Y,
        },
        parentNode: groupNodeId,
        extent: 'parent',
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        data: {
          agent,
          isStatic: true,
          isStreaming: streamingAgentIds?.has(agent.id),
          isCore: entry.group.coreAgentId === agent.id,
        } satisfies AgentNodeData,
        className: 'bg-transparent border-0 shadow-none',
        style: { zIndex: 1, background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 },
      });
    });

    minX = Math.min(minX, currentX);
    minY = Math.min(minY, currentY);
    maxX = Math.max(maxX, currentX + width);
    maxY = Math.max(maxY, currentY + height);

    currentX += width + GROUP_LAYOUT_GAP_X;
    rowHeight = Math.max(rowHeight, height);
    columnIndex += 1;
  }

  if (!groupedEntries.length) {
    minX = -180;
    minY = -120;
    maxX = 180;
    maxY = 120;
  }

  return nodes;
}

interface GraphContentProps {
  onClose: () => void;
  groupId?: string;
}

function GraphContent({ onClose, groupId }: GraphContentProps) {
  const { t } = useTranslation();
  const {
    agents: allAgents,
    relationships: allRelationships,
    agentGroups,
    createRelationship,
    deleteRelationship,
    updateAgent,
  } = useAgentStore();
  const { fitView } = useReactFlow();

  // Track which agents have streaming sessions
  const agentSessions = useAgentStore((s) => s.agentSessions);
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

  const isOverviewMode = groupId === undefined;

  const agents = useMemo(() => {
    if (isOverviewMode) return allAgents;
    return allAgents.filter((agent) => agent.groupId === groupId);
  }, [allAgents, groupId, isOverviewMode]);

  const agentIds = useMemo(() => new Set(agents.map((agent) => agent.id)), [agents]);
  const agentMap = useMemo(() => new Map(allAgents.map((agent) => [agent.id, agent])), [allAgents]);
  const validGroupIds = useMemo(() => new Set(agentGroups.map((group) => group.id)), [agentGroups]);

  const relationships = useMemo(() => {
    if (isOverviewMode) {
      return allRelationships.filter((relationship) => {
        const sourceAgent = agentMap.get(relationship.sourceAgentId);
        const targetAgent = agentMap.get(relationship.targetAgentId);
        if (!sourceAgent?.groupId || !targetAgent?.groupId) return false;
        if (!validGroupIds.has(sourceAgent.groupId) || !validGroupIds.has(targetAgent.groupId)) return false;
        return sourceAgent.groupId === targetAgent.groupId;
      });
    }

    return allRelationships.filter(
      (relationship) => agentIds.has(relationship.sourceAgentId) && agentIds.has(relationship.targetAgentId),
    );
  }, [agentIds, agentMap, allRelationships, isOverviewMode, validGroupIds]);

  const graphTitle = useMemo(() => {
    if (isOverviewMode) return t('sidebar.agent.allGraph');
    const group = agentGroups.find((item) => item.id === groupId);
    return group?.name;
  }, [agentGroups, groupId, isOverviewMode, t]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const initializedRef = useRef(false);

  const agentIdKey = useMemo(() => agents.map((agent) => agent.id).sort().join(','), [agents]);
  const relIdKey = useMemo(() => relationships.map((relationship) => relationship.id).sort().join(','), [relationships]);
  const overviewKey = useMemo(
    () => [
      allAgents.map((agent) => `${agent.id}:${agent.groupId ?? 'ungrouped'}`).sort().join(','),
      agentGroups.map((group) => `${group.id}:${group.name}`).sort().join(','),
    ].join('|'),
    [allAgents, agentGroups],
  );

  const buildEdges = useCallback((): Edge[] => {
    return relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.sourceAgentId,
      target: relationship.targetAgentId,
      label: relationship.label || '',
      type: 'centerEdge',
      markerStart: undefined,
      markerEnd: undefined,
      style: {
        strokeWidth: selectedEdge === relationship.id ? 2.5 : 1.5,
        stroke: selectedEdge === relationship.id
          ? 'hsl(var(--primary))'
          : 'hsl(var(--muted-foreground) / 0.35)',
        strokeDasharray: selectedEdge === relationship.id ? undefined : '6 4',
      },
    }));
  }, [relationships, selectedEdge]);

  useEffect(() => {
    setEdges(buildEdges());
  }, [buildEdges, setEdges]);

  const applyPositions = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      positions.forEach((position, id) => nodePositionsRef.current.set(id, position));
      setNodes(
        agents.map((agent) => {
          const group = agent.groupId ? agentGroups.find((g) => g.id === agent.groupId) : undefined;
          return {
            id: agent.id,
            type: 'agentNode',
            position: positions.get(agent.id) ?? nodePositionsRef.current.get(agent.id) ?? { x: 0, y: 0 },
            data: { agent, isStreaming: streamingAgentIds.has(agent.id), isCore: group?.coreAgentId === agent.id } satisfies AgentNodeData,
            className: 'bg-transparent border-0 shadow-none',
            style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 },
          };
        }),
      );
    },
    [agents, agentGroups, setNodes, streamingAgentIds],
  );

  useEffect(() => {
    if (!isOverviewMode) return;

    setIsEditMode(false);
    setPendingSourceId(null);
    setSelectedEdge(null);
    setNodes(buildOverviewNodes(allAgents, agentGroups, streamingAgentIds));
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 80);
  }, [agentGroups, allAgents, fitView, isOverviewMode, overviewKey, setEdges, setNodes]);

  // Lightweight streaming state sync for overview nodes (no fitView / reset)
  useEffect(() => {
    if (!isOverviewMode) return;

    setNodes((existingNodes) =>
      existingNodes.map((node) => {
        if (node.type !== 'agentNode') return node;
        const newIsStreaming = streamingAgentIds.has(node.id);
        if (node.data?.isStreaming !== newIsStreaming) {
          return { ...node, data: { ...node.data, isStreaming: newIsStreaming } };
        }
        return node;
      }),
    );
  }, [isOverviewMode, streamingAgentIds, setNodes]);

  useEffect(() => {
    if (isOverviewMode || agents.length === 0) return;

    const allSaved = agents.every((agent) => nodePositionsRef.current.has(agent.id) || agent.graphPosition != null);

    if (allSaved) {
      const positions = new Map<string, { x: number; y: number }>();
      agents.forEach((agent) => {
        positions.set(agent.id, nodePositionsRef.current.get(agent.id) ?? agent.graphPosition!);
      });
      applyPositions(positions);

      if (!initializedRef.current) {
        initializedRef.current = true;
        setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 200);
      }
      return;
    }

    runElkLayout(agents, relationships)
      .then((positions) => {
        applyPositions(positions);
        if (!initializedRef.current) {
          initializedRef.current = true;
          setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 200);
        }
      })
      .catch(() => {
        applyPositions(circleLayout(agents));
        if (!initializedRef.current) {
          initializedRef.current = true;
          setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 200);
        }
      });
  }, [agentIdKey, relIdKey, agents, applyPositions, fitView, isOverviewMode, relationships]);

  useEffect(() => {
    if (isOverviewMode) return;

    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
    setNodes((existingNodes) =>
      existingNodes.map((node) => {
        const agent = agentMap.get(node.id);
        if (!agent) return node;
        const newIsStreaming = streamingAgentIds.has(agent.id);
        const group = agent.groupId ? agentGroups.find((g) => g.id === agent.groupId) : undefined;
        const newIsCore = group?.coreAgentId === agent.id;
        if (agent !== node.data?.agent || newIsStreaming !== node.data?.isStreaming || newIsCore !== node.data?.isCore) {
          return { ...node, data: { ...node.data, agent, isStreaming: newIsStreaming, isCore: newIsCore } };
        }
        return node;
      }),
    );
  }, [agents, agentGroups, isOverviewMode, setNodes, streamingAgentIds]);

  const hasRelationship = useCallback(
    (sourceAgentId: string, targetAgentId: string) => {
      return relationships.some(
        (relationship) =>
          (relationship.sourceAgentId === sourceAgentId && relationship.targetAgentId === targetAgentId)
          || (relationship.sourceAgentId === targetAgentId && relationship.targetAgentId === sourceAgentId),
      );
    },
    [relationships],
  );

  useEffect(() => {
    if (isOverviewMode) return;

    const connectedToPending = new Set(
      pendingSourceId
        ? relationships
            .filter(
              (relationship) => relationship.sourceAgentId === pendingSourceId || relationship.targetAgentId === pendingSourceId,
            )
            .map((relationship) => (
              relationship.sourceAgentId === pendingSourceId ? relationship.targetAgentId : relationship.sourceAgentId
            ))
        : [],
    );

    setNodes((existingNodes) =>
      existingNodes.map((node) => {
        const isPendingSource = node.id === pendingSourceId;
        const willDisconnect = !isPendingSource && pendingSourceId != null && connectedToPending.has(node.id);
        const willConnect = !isPendingSource && pendingSourceId != null && !connectedToPending.has(node.id);

        return {
          ...node,
          data: {
            ...node.data,
            isEditMode,
            isPendingSource,
            willConnect: isEditMode ? willConnect : false,
            willDisconnect: isEditMode ? willDisconnect : false,
          },
        };
      }),
    );
  }, [isEditMode, isOverviewMode, pendingSourceId, relationships, setNodes]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isOverviewMode || !isEditMode) return;

      if (!pendingSourceId) {
        setPendingSourceId(node.id);
        return;
      }

      if (pendingSourceId === node.id) {
        setPendingSourceId(null);
        return;
      }

      const existing = relationships.find(
        (relationship) =>
          (relationship.sourceAgentId === pendingSourceId && relationship.targetAgentId === node.id)
          || (relationship.sourceAgentId === node.id && relationship.targetAgentId === pendingSourceId),
      );

      if (existing) {
        deleteRelationship(existing.id);
      } else {
        createRelationship(pendingSourceId, node.id);
      }

      setPendingSourceId(null);
    },
    [createRelationship, deleteRelationship, isEditMode, isOverviewMode, pendingSourceId, relationships],
  );

  const toggleEditMode = useCallback(() => {
    if (isOverviewMode) return;

    setIsEditMode((previous) => {
      if (previous) setPendingSourceId(null);
      return !previous;
    });
    setSelectedEdge(null);
  }, [isOverviewMode]);

  const handleNodeDrag = useCallback((_: unknown, node: Node) => {
    nodePositionsRef.current.set(node.id, node.position);
  }, []);

  const handleNodeDragStop = useCallback((_: unknown, node: Node) => {
    nodePositionsRef.current.set(node.id, node.position);
    updateAgent(node.id, { graphPosition: node.position });
  }, [updateAgent]);

  const handleConnectStart = useCallback((_: unknown, params: { nodeId?: string | null }) => {
    setSelectedEdge(null);
    setPendingSourceId(params.nodeId ?? null);
  }, []);

  const handleConnectEnd = useCallback(() => {
    setPendingSourceId(null);
  }, []);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (isOverviewMode || !isEditMode || !connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      return !hasRelationship(connection.source, connection.target);
    },
    [hasRelationship, isEditMode, isOverviewMode],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isOverviewMode || !isEditMode || !connection.source || !connection.target) return;
      if (!isValidConnection(connection)) return;
      createRelationship(connection.source, connection.target);
      setPendingSourceId(null);
    },
    [createRelationship, isEditMode, isOverviewMode, isValidConnection],
  );

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (isOverviewMode) return;
    setSelectedEdge((previous) => (previous === edge.id ? null : edge.id));
  }, [isOverviewMode]);

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null);
    setPendingSourceId(null);
  }, []);

  const handleDeleteEdge = useCallback(() => {
    if (selectedEdge) {
      deleteRelationship(selectedEdge);
      setSelectedEdge(null);
    }
  }, [deleteRelationship, selectedEdge]);

  const handleRelayout = useCallback(() => {
    if (isOverviewMode) {
      setNodes(buildOverviewNodes(allAgents, agentGroups, streamingAgentIds));
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 80);
      return;
    }

    nodePositionsRef.current.clear();
    runElkLayout(agents, relationships)
      .then((positions) => {
        applyPositions(positions);
        setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
      })
      .catch(() => {
        applyPositions(circleLayout(agents));
        setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
      });
  }, [agentGroups, agents, allAgents, applyPositions, fitView, isOverviewMode, relationships, setNodes]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border rounded-lg px-2 py-1.5 shadow-sm">
        {graphTitle && (
          <>
            <span className="text-xs font-medium px-1">{graphTitle}</span>
            <div className="w-px h-4 bg-border" />
          </>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fitView({ padding: isOverviewMode ? 0.2 : 0.3, duration: 300 })}>
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        {!isOverviewMode && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Auto layout" onClick={handleRelayout}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${isEditMode ? 'text-primary bg-primary/10' : ''}`}
              title={isEditMode ? 'Exit edit mode' : 'Edit connections'}
              onClick={toggleEditMode}
            >
              <Link2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
        {!isOverviewMode && isEditMode && (
          <span className="text-xs text-muted-foreground px-1 select-none">
            {pendingSourceId ? t('agentGraph.editSelectTarget') : t('agentGraph.editSelectSource')}
          </span>
        )}
        {!isOverviewMode && !isEditMode && selectedEdge && (
          <>
            <div className="w-px h-4 bg-border" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleDeleteEdge}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm border shadow-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-xs text-muted-foreground/60 select-none">
        {isOverviewMode ? t('agentGraph.overviewInstructions') : t('agentGraph.instructions')}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={isOverviewMode ? undefined : handleNodeClick}
        onNodeDrag={isOverviewMode || isEditMode ? undefined : handleNodeDrag}
        onNodeDragStop={isOverviewMode || isEditMode ? undefined : handleNodeDragStop}
        onConnectStart={!isOverviewMode && isEditMode ? handleConnectStart : undefined}
        onConnectEnd={!isOverviewMode && isEditMode ? handleConnectEnd : undefined}
        onConnect={!isOverviewMode ? handleConnect : undefined}
        isValidConnection={isValidConnection}
        onEdgeClick={!isOverviewMode ? handleEdgeClick : undefined}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!isOverviewMode && !isEditMode}
        nodesConnectable={!isOverviewMode && isEditMode}
        elementsSelectable={!isOverviewMode}
        panOnDrag={isOverviewMode ? true : !isEditMode}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Straight}
        connectionLineComponent={CenterConnectionLine}
        defaultEdgeOptions={{ type: 'centerEdge', markerStart: undefined, markerEnd: undefined }}
        fitView
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
      </ReactFlow>
    </div>
  );
}

export function AgentGraph({ onClose, groupId }: { onClose: () => void; groupId?: string }) {
  return (
    <div className="relative h-full w-full bg-background">
      <ReactFlowProvider>
        <GraphContent onClose={onClose} groupId={groupId} />
      </ReactFlowProvider>
    </div>
  );
}
