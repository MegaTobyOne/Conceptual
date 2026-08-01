import type { MapNode, RelationshipMapGraph } from './relationship-map.ts';

export type ConnectedView3dConcept = 'space' | 'city' | 'constellation' | 'landscape' | 'timeline';

export type CityRoadClass = 'local' | 'arterial' | 'freeway';
export type CityCongestion = 'flowing' | 'busy' | 'congested';

export interface CityBuildingProfile {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly shape: 'tower' | 'campus' | 'office' | 'civic';
}

export interface CityRoadProfile {
  readonly roadClass: CityRoadClass;
  readonly congestion: CityCongestion;
  readonly lanes: number;
}

export interface ConnectedView3dPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const KIND_ORDER: Record<MapNode['kind'], number> = {
  direction: 0,
  requirement: 1,
  risk: 2,
  action: 3,
};

function stableNumber(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function connectedViewNodeValue(node: MapNode): number {
  if (node.kind === 'action') {
    const value = node.actionValue;
    return (
      (value?.requirementsWithGap ?? 0) * 2 +
      (value?.highOrExtremeRisksTreated ?? 0) * 3 +
      (node.actionOverdue ? 3 : 0) +
      (node.actionStatus === 'blocked' ? 4 : 0)
    );
  }
  if (node.kind === 'risk') {
    const band = { low: 1, medium: 3, high: 6, extreme: 9 }[node.riskBand ?? 'low'];
    return band + (node.riskTreatment?.requirementsWithGap ?? 0) * 2;
  }
  if (node.kind === 'direction') {
    return (node.directionImpact?.requirementsWithGap ?? 0) * 2 + 1;
  }
  return (
    (node.work?.openRiskCount ?? 0) * 2 +
    (node.work?.blockedOrOverdueActionCount ?? 0) * 3 +
    (node.complianceState === 'no' ? 5 : node.complianceState === 'risk-managed' ? 3 : 0)
  );
}

function centredRow(nodes: readonly MapNode[], node: MapNode): number {
  const peers = nodes.filter((candidate) => candidate.kind === node.kind);
  const row = peers.findIndex((candidate) => candidate.id === node.id);
  return (row - (peers.length - 1) / 2) * 3.4;
}

function selectedDistances(
  graph: RelationshipMapGraph,
  selectedId: string,
): ReadonlyMap<string, number> {
  const distances = new Map<string, number>([[selectedId, 0]]);
  let frontier = [selectedId];
  for (let distance = 1; distance <= 3 && frontier.length > 0; distance += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of graph.edges) {
        const neighbour =
          edge.source === id ? edge.target : edge.target === id ? edge.source : undefined;
        if (neighbour && !distances.has(neighbour)) {
          distances.set(neighbour, distance);
          next.push(neighbour);
        }
      }
    }
    frontier = next;
  }
  return distances;
}

export function buildConnectedView3dLayout(
  graph: RelationshipMapGraph,
  concept: ConnectedView3dConcept,
  selectedId = graph.nodes[0]?.id ?? '',
): ReadonlyMap<string, ConnectedView3dPosition> {
  const positions = new Map<string, ConnectedView3dPosition>();
  const distances = selectedDistances(graph, selectedId);

  for (const [index, node] of graph.nodes.entries()) {
    const noise = stableNumber(node.id);
    const kindX = (KIND_ORDER[node.kind] - 1.5) * 11;
    const row = centredRow(graph.nodes, node);
    const value = Math.min(12, connectedViewNodeValue(node));

    if (concept === 'space') {
      positions.set(node.id, { x: kindX, y: row, z: value - 5 });
      continue;
    }

    if (concept === 'city') {
      positions.set(node.id, {
        x: kindX,
        y: 0,
        z: row * 1.8,
      });
      continue;
    }

    if (concept === 'constellation') {
      const distance = distances.get(node.id) ?? 4;
      if (distance === 0) {
        positions.set(node.id, { x: 0, y: 0, z: 2 });
      } else {
        const radius = distance * 7;
        const angle = ((noise % 360) * Math.PI) / 180;
        positions.set(node.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius * 0.58,
          z: (3 - distance) * 3 + ((noise >>> 8) % 5) - 2,
        });
      }
      continue;
    }

    if (concept === 'landscape') {
      const region = stableNumber(node.detail.split('·').at(-1)?.trim() ?? node.kind) % 5;
      positions.set(node.id, {
        x: (region - 2) * 9 + ((noise >>> 8) % 5) - 2,
        y: value * 1.25 + 0.8,
        z: row * 0.7 + KIND_ORDER[node.kind] * 3,
      });
      continue;
    }

    const horizon =
      node.kind === 'action'
        ? node.actionOverdue || node.actionStatus === 'blocked'
          ? 12
          : node.actionStatus === 'in-progress'
            ? 3
            : node.actionStatus === 'done' || node.actionStatus === 'cancelled'
              ? -12
              : -5
        : (KIND_ORDER[node.kind] - 1) * 3;
    positions.set(node.id, { x: kindX, y: row * 0.65, z: horizon + (index % 3) - 1 });
  }

  return positions;
}

export function cityBuildingProfile(node: MapNode): CityBuildingProfile {
  const value = Math.min(12, connectedViewNodeValue(node));
  const height = 2.8 + value * 0.72;
  if (node.kind === 'direction') {
    return { width: 3.8, depth: 3.8, height: Math.max(5.5, height), shape: 'civic' };
  }
  if (node.kind === 'requirement') {
    return { width: 3.4, depth: 3.4, height: Math.max(4.5, height), shape: 'tower' };
  }
  if (node.kind === 'risk') {
    return { width: 4.2, depth: 3.1, height: Math.max(3.8, height), shape: 'office' };
  }
  return {
    width: 4.6 + Math.min(2, node.actionValue?.requirementsAddressed ?? 0) * 0.5,
    depth: 3.8,
    height: Math.max(3.2, height),
    shape: 'campus',
  };
}

export function cityRoadProfile(
  graph: RelationshipMapGraph,
  edge: RelationshipMapGraph['edges'][number],
): CityRoadProfile {
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  const endpointDemand = graph.edges.filter(
    (candidate) =>
      candidate.source === edge.source ||
      candidate.target === edge.source ||
      candidate.source === edge.target ||
      candidate.target === edge.target,
  ).length;
  const blockedDestination = [source, target].some(
    (node) => node?.kind === 'action' && (node.actionStatus === 'blocked' || node.actionOverdue),
  );
  const congestion: CityCongestion = blockedDestination
    ? 'congested'
    : endpointDemand >= 5
      ? 'busy'
      : 'flowing';

  switch (edge.kind) {
    case 'requirement-action':
      return { roadClass: 'freeway', congestion, lanes: 4 };
    case 'requirement-risk':
      return { roadClass: 'local', congestion, lanes: 2 };
    case 'risk-action':
      return { roadClass: 'arterial', congestion, lanes: 2 };
    case 'requirement-direction':
      return { roadClass: 'arterial', congestion, lanes: 2 };
  }
}

export function cityNodeHasThroughRoute(graph: RelationshipMapGraph, nodeId: string): boolean {
  const visited = new Set<string>([nodeId]);
  const frontier = [nodeId];
  while (frontier.length > 0) {
    const current = frontier.shift();
    if (!current) continue;
    for (const edge of graph.edges) {
      const neighbour =
        edge.source === current ? edge.target : edge.target === current ? edge.source : undefined;
      if (neighbour && !visited.has(neighbour)) {
        visited.add(neighbour);
        frontier.push(neighbour);
      }
    }
  }
  const connectedKinds = new Set(
    graph.nodes.filter((node) => visited.has(node.id)).map((node) => node.kind),
  );
  return connectedKinds.has('direction') && connectedKinds.has('action');
}

export function cityNodeCriticalReasons(node: MapNode): readonly string[] {
  const reasons: string[] = [];
  if (node.kind === 'risk' && node.riskBand === 'extreme') reasons.push('Extreme risk');
  if (node.kind === 'action' && node.actionStatus === 'blocked') reasons.push('Blocked action');
  if (node.kind === 'action' && node.actionOverdue) reasons.push('Overdue action');
  if (
    node.kind === 'requirement' &&
    node.complianceState === 'no' &&
    (node.work?.blockedOrOverdueActionCount ?? 0) > 0
  ) {
    reasons.push('Compliance gap with obstructed treatment');
  }
  if (
    node.kind === 'direction' &&
    node.directionResponseState === 'no' &&
    (node.directionImpact?.requirementsWithGap ?? 0) > 0
  ) {
    reasons.push('Direction not dealt with');
  }
  return reasons;
}

export function connectedNodeIds(
  graph: RelationshipMapGraph,
  selectedId: string,
): ReadonlySet<string> {
  const connected = new Set<string>([selectedId]);
  for (const edge of graph.edges) {
    if (edge.source === selectedId) connected.add(edge.target);
    if (edge.target === selectedId) connected.add(edge.source);
  }
  return connected;
}
