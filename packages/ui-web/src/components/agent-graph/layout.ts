interface AgentLike {
  id: string;
}

interface RelLike {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
}

interface Point {
  x: number;
  y: number;
}

const DEFAULT_WIDTH = 860;
const DEFAULT_HEIGHT = 640;
const DEFAULT_MARGIN = 80;
const ITERATIONS = 220;
const REPULSION_STRENGTH = 26000;
const SPRING_STRENGTH = 0.015;
const SPRING_LENGTH = 190;
const CENTERING_STRENGTH = 0.018;
const MAX_STEP = 24;
const COLLISION_PADDING = 34;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashGraph(agents: AgentLike[], relationships: RelLike[]): number {
  const source = [
    ...agents.map((agent) => agent.id).sort(),
    ...relationships.map((relationship) => relationship.id).sort(),
  ].join('|');

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildAdjacency(agents: AgentLike[], relationships: RelLike[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const agent of agents) {
    adjacency.set(agent.id, new Set());
  }

  for (const relationship of relationships) {
    adjacency.get(relationship.sourceAgentId)?.add(relationship.targetAgentId);
    adjacency.get(relationship.targetAgentId)?.add(relationship.sourceAgentId);
  }

  return adjacency;
}

function findConnectedComponents(agents: AgentLike[], adjacency: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const agent of agents) {
    if (visited.has(agent.id)) continue;

    const queue = [agent.id];
    const component: string[] = [];
    visited.add(agent.id);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component.sort());
  }

  return components.sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));
}

function createInitialComponentPositions(component: string[], random: () => number): Map<string, Point> {
  const positions = new Map<string, Point>();
  const radius = Math.max(120, component.length * 34);

  component.forEach((agentId, index) => {
    const angle = (index / component.length) * Math.PI * 2 - Math.PI / 2;
    const radialJitter = 0.9 + random() * 0.2;
    positions.set(agentId, {
      x: Math.cos(angle) * radius * radialJitter,
      y: Math.sin(angle) * radius * radialJitter,
    });
  });

  return positions;
}

function relaxComponentLayout(component: string[], adjacency: Map<string, Set<string>>, random: () => number): Map<string, Point> {
  const positions = createInitialComponentPositions(component, random);
  const velocities = new Map(component.map((agentId) => [agentId, { x: 0, y: 0 }]));
  const area = DEFAULT_WIDTH * DEFAULT_HEIGHT;
  const idealDistance = Math.sqrt(area / Math.max(component.length, 1));

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const cooling = 1 - iteration / ITERATIONS;

    for (const sourceId of component) {
      const source = positions.get(sourceId)!;
      const velocity = velocities.get(sourceId)!;
      let forceX = -source.x * CENTERING_STRENGTH;
      let forceY = -source.y * CENTERING_STRENGTH;

      for (const targetId of component) {
        if (sourceId === targetId) continue;
        const target = positions.get(targetId)!;
        let dx = source.x - target.x;
        let dy = source.y - target.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 1e-3) {
          dx = (random() - 0.5) * 0.1;
          dy = (random() - 0.5) * 0.1;
          distance = Math.hypot(dx, dy);
        }

        const repulsion = (REPULSION_STRENGTH * idealDistance) / (distance * distance);
        forceX += (dx / distance) * repulsion;
        forceY += (dy / distance) * repulsion;

        const minDistance = idealDistance * 0.42 + COLLISION_PADDING;
        if (distance < minDistance) {
          const collision = (minDistance - distance) * 0.12;
          forceX += (dx / distance) * collision;
          forceY += (dy / distance) * collision;
        }
      }

      for (const targetId of adjacency.get(sourceId) ?? []) {
        if (!positions.has(targetId)) continue;
        const target = positions.get(targetId)!;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const spring = (distance - SPRING_LENGTH) * SPRING_STRENGTH;
        forceX += (dx / distance) * spring;
        forceY += (dy / distance) * spring;
      }

      velocity.x = (velocity.x + forceX) * 0.82;
      velocity.y = (velocity.y + forceY) * 0.82;

      source.x += clamp(velocity.x * cooling, -MAX_STEP, MAX_STEP);
      source.y += clamp(velocity.y * cooling, -MAX_STEP, MAX_STEP);
    }
  }

  return positions;
}

function getBounds(points: Iterable<Point>): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

export function runGraphRelayout(
  agents: AgentLike[],
  relationships: RelLike[],
): Map<string, { x: number; y: number }> {
  if (agents.length === 0) return new Map();
  if (agents.length === 1) return new Map([[agents[0].id, { x: DEFAULT_WIDTH / 2, y: DEFAULT_HEIGHT / 2 }]]);

  const random = createSeededRandom(hashGraph(agents, relationships));
  const adjacency = buildAdjacency(agents, relationships);
  const components = findConnectedComponents(agents, adjacency);
  const componentLayouts = components.map((component) => relaxComponentLayout(component, adjacency, random));

  const positions = new Map<string, Point>();
  let currentX = DEFAULT_MARGIN;
  let currentY = DEFAULT_MARGIN;
  let rowHeight = 0;
  const maxRowWidth = DEFAULT_WIDTH * 1.6;

  for (const layout of componentLayouts) {
    const bounds = getBounds(layout.values());
    const width = Math.max(160, bounds.maxX - bounds.minX + DEFAULT_MARGIN * 0.8);
    const height = Math.max(160, bounds.maxY - bounds.minY + DEFAULT_MARGIN * 0.8);

    if (currentX > DEFAULT_MARGIN && currentX + width > maxRowWidth) {
      currentX = DEFAULT_MARGIN;
      currentY += rowHeight + DEFAULT_MARGIN;
      rowHeight = 0;
    }

    for (const [agentId, point] of layout) {
      positions.set(agentId, {
        x: currentX + (point.x - bounds.minX),
        y: currentY + (point.y - bounds.minY),
      });
    }

    currentX += width + DEFAULT_MARGIN;
    rowHeight = Math.max(rowHeight, height);
  }

  const overallBounds = getBounds(positions.values());
  const offsetX = DEFAULT_MARGIN - overallBounds.minX;
  const offsetY = DEFAULT_MARGIN - overallBounds.minY;

  for (const point of positions.values()) {
    point.x += offsetX;
    point.y += offsetY;
  }

  return positions;
}
