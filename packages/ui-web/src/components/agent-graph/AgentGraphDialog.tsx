// Agent Knowledge Graph — embedded in main content area
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { useAgentStore } from '@shared/stores/agent';
import { Button } from '../ui/button';
import { AgentNode, AgentNodeData } from './AgentNode';
import { Maximize2, Play, Pause, Trash2, X } from 'lucide-react';

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
};

interface SimNode extends SimulationNodeDatum {
  id: string;
}

interface GraphContentProps {
  onClose: () => void;
  groupId?: string; // undefined = all agents
}

function GraphContent({ onClose, groupId }: GraphContentProps) {
  const { t } = useTranslation();
  const { agents: allAgents, relationships: allRelationships, agentGroups, createRelationship, deleteRelationship, updateAgent } = useAgentStore();
  const { fitView } = useReactFlow();

  // Filter agents and relationships by group
  const agents = useMemo(() => {
    if (groupId === undefined) return allAgents;
    return allAgents.filter((a) => a.groupId === groupId);
  }, [allAgents, groupId]);

  const agentIds = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);

  const relationships = useMemo(() => {
    return allRelationships.filter(
      (r) => agentIds.has(r.sourceAgentId) && agentIds.has(r.targetAgentId)
    );
  }, [allRelationships, agentIds]);

  // Title for the graph
  const graphTitle = useMemo(() => {
    if (groupId === undefined) return undefined;
    const group = agentGroups.find((g) => g.id === groupId);
    return group?.name;
  }, [groupId, agentGroups]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSimulating, setIsSimulating] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);

  // Build nodes from agents
  const buildNodes = useCallback((): Node<AgentNodeData>[] => {
    const cx = 400;
    const cy = 300;
    const radius = Math.max(120, agents.length * 40);
    return agents.map((agent, i) => {
      const pos = agent.graphPosition || {
        x: cx + Math.cos((i / agents.length) * 2 * Math.PI - Math.PI / 2) * radius,
        y: cy + Math.sin((i / agents.length) * 2 * Math.PI - Math.PI / 2) * radius,
      };
      return {
        id: agent.id,
        type: 'agentNode',
        position: pos,
        data: { agent },
      };
    });
  }, [agents]);

  // Build edges from relationships
  const buildEdges = useCallback((): Edge[] => {
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.sourceAgentId,
      target: rel.targetAgentId,
      label: rel.label || '',
      type: 'straight',
      style: {
        strokeWidth: selectedEdge === rel.id ? 2.5 : 1.5,
        stroke: selectedEdge === rel.id
          ? 'hsl(var(--primary))'
          : 'hsl(var(--muted-foreground) / 0.35)',
        strokeDasharray: selectedEdge === rel.id ? undefined : '6 4',
      },
      labelStyle: {
        fontSize: 10,
        fill: 'hsl(var(--muted-foreground))',
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: 'hsl(var(--background))',
        fillOpacity: 0.8,
      },
      labelBgPadding: [4, 2] as [number, number],
    }));
  }, [relationships, selectedEdge]);

  // Sync store -> React Flow
  useEffect(() => {
    setNodes(buildNodes());
    setEdges(buildEdges());
  }, [agents, relationships, selectedEdge, buildNodes, buildEdges, setNodes, setEdges]);

  // D3 Force simulation
  useEffect(() => {
    if (!isSimulating || agents.length === 0) return;

    const simNodes: SimNode[] = agents.map((a, i) => {
      const pos = a.graphPosition || {
        x: 400 + Math.cos((i / agents.length) * 2 * Math.PI) * 200,
        y: 300 + Math.sin((i / agents.length) * 2 * Math.PI) * 200,
      };
      return { id: a.id, x: pos.x, y: pos.y };
    });

    const simLinks: SimulationLinkDatum<SimNode>[] = relationships.map((r) => ({
      source: r.sourceAgentId,
      target: r.targetAgentId,
    }));

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
          .id((d) => d.id)
          .distance(180)
          .strength(0.4)
      )
      .force('charge', forceManyBody().strength(-600))
      .force('center', forceCenter(400, 300))
      .force('collide', forceCollide(60))
      .alphaDecay(0.015)
      .velocityDecay(0.3)
      .on('tick', () => {
        setNodes((nds) =>
          nds.map((node) => {
            const sn = simNodes.find((n) => n.id === node.id);
            if (sn && sn.x != null && sn.y != null) {
              return { ...node, position: { x: sn.x, y: sn.y } };
            }
            return node;
          })
        );
      });

    simulationRef.current = sim;
    return () => { sim.stop(); };
  }, [isSimulating, agents.length, relationships.length, agents, relationships, setNodes]);

  const handleNodeDragStop = useCallback(
    (_: any, node: Node) => {
      updateAgent(node.id, { graphPosition: node.position });
      if (simulationRef.current && isSimulating) {
        simulationRef.current.alpha(0.1).restart();
      }
    },
    [updateAgent, isSimulating]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      const exists = allRelationships.some(
        (r) =>
          (r.sourceAgentId === conn.source && r.targetAgentId === conn.target) ||
          (r.sourceAgentId === conn.target && r.targetAgentId === conn.source)
      );
      if (!exists) createRelationship(conn.source, conn.target);
    },
    [allRelationships, createRelationship]
  );

  const handleEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge((prev) => (prev === edge.id ? null : edge.id));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null);
  }, []);

  const handleDeleteEdge = useCallback(() => {
    if (selectedEdge) {
      deleteRelationship(selectedEdge);
      setSelectedEdge(null);
    }
  }, [selectedEdge, deleteRelationship]);

  const toggleSimulation = useCallback(() => {
    if (isSimulating) {
      simulationRef.current?.stop();
    }
    setIsSimulating((p) => !p);
  }, [isSimulating]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Floating toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border rounded-lg px-2 py-1.5 shadow-sm">
        {graphTitle && (
          <>
            <span className="text-xs font-medium px-1">{graphTitle}</span>
            <div className="w-px h-4 bg-border" />
          </>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fitView({ padding: 0.3, duration: 300 })}>
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${isSimulating ? 'text-primary' : ''}`}
          onClick={toggleSimulation}
        >
          {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>
        {selectedEdge && (
          <>
            <div className="w-px h-4 bg-border" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleDeleteEdge}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Close button */}
      <div className="absolute top-3 right-3 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm border shadow-sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-xs text-muted-foreground/60 select-none">
        {t('agentGraph.instructions')}
      </div>

      {/* Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'straight' }}
        connectionLineStyle={{ stroke: 'hsl(var(--primary) / 0.5)', strokeWidth: 1.5, strokeDasharray: '6 4' }}
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
