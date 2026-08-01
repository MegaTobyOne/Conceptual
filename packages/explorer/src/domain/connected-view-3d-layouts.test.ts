import { describe, expect, it } from 'vitest';
import {
  buildConnectedView3dLayout,
  cityBuildingProfile,
  cityNodeCriticalReasons,
  cityNodeHasThroughRoute,
  cityRoadProfile,
  connectedNodeIds,
  type ConnectedView3dConcept,
} from './connected-view-3d-layouts.ts';
import type { RelationshipMapGraph } from './relationship-map.ts';

const graph: RelationshipMapGraph = {
  nodes: [
    {
      id: 'direction-1',
      label: 'Direction',
      detail: 'Direction · GOV',
      href: '',
      kind: 'direction',
    },
    { id: 'GOV-001', label: 'GOV-001', detail: 'Requirement · GOV', href: '', kind: 'requirement' },
    { id: 'risk-1', label: 'Risk', detail: 'Risk · GOV', href: '', kind: 'risk', riskBand: 'high' },
    {
      id: 'action-1',
      label: 'Action',
      detail: 'Action · GOV',
      href: '',
      kind: 'action',
      actionStatus: 'blocked',
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'direction-1',
      target: 'GOV-001',
      kind: 'requirement-direction',
      label: 'modifies',
    },
    {
      id: 'edge-2',
      source: 'GOV-001',
      target: 'risk-1',
      kind: 'requirement-risk',
      label: 'affected by',
    },
    {
      id: 'edge-3',
      source: 'risk-1',
      target: 'action-1',
      kind: 'risk-action',
      label: 'treated by',
    },
  ],
  summary: {
    requirements: 1,
    complianceGapsWithWork: 1,
    complianceGapsWithoutWork: 0,
    blockedOrOverdueActions: 1,
    directionsNeedingResponse: 1,
  },
};

describe('buildConnectedView3dLayout', () => {
  const concepts: readonly ConnectedView3dConcept[] = [
    'space',
    'city',
    'constellation',
    'landscape',
    'timeline',
  ];

  it.each(concepts)('is deterministic and positions every node for %s', (concept) => {
    const first = buildConnectedView3dLayout(graph, concept, 'GOV-001');
    const second = buildConnectedView3dLayout(graph, concept, 'GOV-001');
    expect([...first]).toEqual([...second]);
    expect(first.size).toBe(graph.nodes.length);
    expect([...first.values()].every((point) => Object.values(point).every(Number.isFinite))).toBe(
      true,
    );
  });

  it('uses the selected node as the constellation centre', () => {
    expect(buildConnectedView3dLayout(graph, 'constellation', 'risk-1').get('risk-1')).toEqual({
      x: 0,
      y: 0,
      z: 2,
    });
  });

  it('places blocked actions towards the viewer in timeline mode', () => {
    const layout = buildConnectedView3dLayout(graph, 'timeline');
    expect(layout.get('action-1')?.z).toBeGreaterThan(layout.get('GOV-001')?.z ?? 0);
  });

  it('keeps city districts in the stable left-to-right value-chain order', () => {
    const layout = buildConnectedView3dLayout(graph, 'city');
    expect(layout.get('direction-1')?.x).toBeLessThan(layout.get('GOV-001')?.x ?? 0);
    expect(layout.get('GOV-001')?.x).toBeLessThan(layout.get('risk-1')?.x ?? 0);
    expect(layout.get('risk-1')?.x).toBeLessThan(layout.get('action-1')?.x ?? 0);
  });
});

describe('Neon Assurance City semantics', () => {
  it('scales more valuable or obstructed work into taller buildings', () => {
    const action = graph.nodes.find((node) => node.id === 'action-1');
    expect(action).toBeTruthy();
    const flowingAction = { ...action!, actionStatus: 'todo' as const, actionOverdue: false };
    expect(cityBuildingProfile(action!).height).toBeGreaterThan(
      cityBuildingProfile(flowingAction).height,
    );
    expect(cityBuildingProfile(action!).shape).toBe('campus');
  });

  it('uses a conventional office building for risks', () => {
    const risk = graph.nodes.find((node) => node.id === 'risk-1');
    expect(risk).toBeTruthy();
    expect(cityBuildingProfile(risk!).shape).toBe('office');
  });

  it('uses a familiar road hierarchy for assurance links', () => {
    expect(cityRoadProfile(graph, graph.edges[1]!)).toMatchObject({
      roadClass: 'local',
    });
    expect(cityRoadProfile(graph, graph.edges[2]!)).toMatchObject({
      roadClass: 'arterial',
      congestion: 'congested',
    });
  });

  it('distinguishes complete cross-city routes from cul-de-sacs', () => {
    expect(cityNodeHasThroughRoute(graph, 'GOV-001')).toBe(true);
    expect(cityNodeHasThroughRoute({ ...graph, edges: graph.edges.slice(0, 2) }, 'GOV-001')).toBe(
      false,
    );
  });

  it('reserves fire-worthy criticality for explicit operational conditions', () => {
    const highRisk = graph.nodes.find((node) => node.id === 'risk-1')!;
    expect(cityNodeCriticalReasons({ ...highRisk, riskBand: 'extreme' })).toEqual(['Extreme risk']);
    expect(cityNodeCriticalReasons(graph.nodes.find((node) => node.id === 'action-1')!)).toEqual([
      'Blocked action',
    ]);
    expect(cityNodeCriticalReasons(graph.nodes.find((node) => node.id === 'GOV-001')!)).toEqual([]);
  });
});

describe('connectedNodeIds', () => {
  it('returns the selected node and its immediate neighbours', () => {
    expect([...connectedNodeIds(graph, 'risk-1')].sort()).toEqual([
      'GOV-001',
      'action-1',
      'risk-1',
    ]);
  });
});
