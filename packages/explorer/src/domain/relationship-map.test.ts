import { describe, expect, it } from 'vitest';
import {
  buildRelationshipMapGraph,
  formatRelationshipMapSummary,
  orderRelationshipMapNodes,
} from './relationship-map.ts';
import {
  asActionId,
  asDirectionId,
  asRequirementId,
  asRiskId,
  type Action,
  type ComplianceEntry,
  type Direction,
  type Relationship,
  type RequirementId,
  type Risk,
  type WorkTrackingEntry,
} from '../data/types.ts';

const NOW = '2026-05-07T00:00:00.000Z';

function compliance(
  requirementId: RequirementId,
  state: ComplianceEntry['state'],
): ComplianceEntry {
  return { requirementId, state, evidence: [], createdAt: NOW, updatedAt: NOW };
}

function baseRisk(patch: Partial<Risk> = {}): Risk {
  return {
    id: asRiskId('risk-1'),
    title: 'Unowned privileged access',
    likelihood: 4,
    impact: 4,
    status: 'open',
    requirementIds: [],
    actionIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

function baseAction(patch: Partial<Action> = {}): Action {
  return {
    id: asActionId('action-1'),
    title: 'Review admin accounts',
    type: 'review',
    status: 'in-progress',
    requirementIds: [],
    riskIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

function baseDirection(patch: Partial<Direction> = {}): Direction {
  return {
    id: asDirectionId('direction-1'),
    reference: 'PSPF Direction 001-2026',
    title: 'Increase assurance reporting',
    issuedAt: '2026-05-01',
    requirementIds: [],
    responseState: 'not-set',
    evidence: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

describe('buildRelationshipMapGraph', () => {
  const requirementId = asRequirementId('GOV-001');

  it('adds compliance and work metadata to requirement nodes', () => {
    const risk = baseRisk({ requirementIds: [requirementId] });
    const action = baseAction({
      requirementIds: [requirementId],
      dueAt: '2026-01-01',
      status: 'blocked',
    });
    const direction = baseDirection({ requirementIds: [requirementId], responseState: 'no' });
    const work: WorkTrackingEntry = {
      id: 'work-1' as WorkTrackingEntry['id'],
      requirementId,
      note: 'Started control uplift',
      createdAt: NOW,
      updatedAt: NOW,
    };

    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [risk],
      actions: [action],
      directions: [direction],
      relationships: [],
      workTracking: [work],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
      now: Date.parse('2026-05-07'),
    });

    const requirement = graph.nodes.find((node) => node.id === requirementId);
    expect(requirement?.complianceState).toBe('no');
    expect(requirement?.work).toMatchObject({
      riskCount: 1,
      openRiskCount: 1,
      actionCount: 1,
      activeActionCount: 1,
      blockedOrOverdueActionCount: 1,
      directionCount: 1,
      directionsNeedingResponseCount: 1,
      workLogCount: 1,
      hasWork: true,
    });
    expect(graph.summary).toMatchObject({
      requirements: 1,
      complianceGapsWithWork: 1,
      complianceGapsWithoutWork: 0,
      blockedOrOverdueActions: 1,
      directionsNeedingResponse: 1,
    });
  });

  it('deduplicates implicit and stored relationship edges', () => {
    const risk = baseRisk({ requirementIds: [requirementId] });
    const relationship: Relationship = {
      id: 'rel-1' as Relationship['id'],
      kind: 'requirement-risk',
      endpoints: [requirementId, risk.id],
      createdAt: NOW,
      updatedAt: NOW,
    };

    const graph = buildRelationshipMapGraph({
      compliance: new Map(),
      risks: [risk],
      actions: [],
      directions: [],
      relationships: [relationship],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      source: requirementId,
      target: risk.id,
      label: 'Risk affects requirement',
    });
  });

  it('filters hidden work nodes and their edges', () => {
    const risk = baseRisk({ requirementIds: [requirementId] });
    const action = baseAction({ requirementIds: [requirementId] });

    const graph = buildRelationshipMapGraph({
      compliance: new Map(),
      risks: [risk],
      actions: [action],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: false, actions: true, directions: true },
    });

    expect(graph.nodes.some((node) => node.id === risk.id)).toBe(false);
    expect(graph.nodes.some((node) => node.id === action.id)).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.kind).toBe('requirement-action');
  });

  it('shows recorded compliance gaps before work has been linked', () => {
    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [],
      actions: [],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ id: requirementId, complianceState: 'no' });
    expect(graph.edges).toHaveLength(0);
    expect(graph.summary).toMatchObject({
      complianceGapsWithWork: 0,
      complianceGapsWithoutWork: 1,
    });
  });

  it('filters to unlinked compliance gaps only', () => {
    const linkedRequirementId = asRequirementId('GOV-002');
    const risk = baseRisk({ requirementIds: [linkedRequirementId] });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([
        [requirementId, compliance(requirementId, 'no')],
        [linkedRequirementId, compliance(linkedRequirementId, 'risk-managed')],
      ]),
      risks: [risk],
      actions: [],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: {
        requirements: true,
        risks: true,
        actions: true,
        directions: true,
        unlinkedGapsOnly: true,
      },
    });

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject({ id: requirementId, kind: 'requirement' });
    expect(graph.edges).toHaveLength(0);
    expect(graph.summary).toMatchObject({
      complianceGapsWithWork: 0,
      complianceGapsWithoutWork: 1,
    });
  });

  it('formats visible assurance paths for copying', () => {
    const risk = baseRisk({ requirementIds: [requirementId] });
    const action = baseAction({ requirementIds: [requirementId], riskIds: [risk.id] });
    const direction = baseDirection({ requirementIds: [requirementId] });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [risk],
      actions: [action],
      directions: [direction],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });

    const text = formatRelationshipMapSummary(graph);

    expect(text).toContain('Relationship map summary');
    expect(text).toContain('Gaps with work: 1');
    expect(text).toContain('GOV-001:');
    expect(text).toContain('Risks: Unowned privileged access (extreme, open)');
    expect(text).toContain('Actions: Review admin accounts (in-progress)');
    expect(text).toContain('Directions: PSPF Direction 001-2026 (not-set)');
    expect(text).toContain('Action compliance value');
    expect(text).toContain('Review admin accounts: in-progress');
    expect(text).toContain('Requirements addressed: 1 (1 currently a gap)');
    expect(text).toContain('Uniquely covered: 1 requirement would be uncovered');
    expect(text).toContain('Risks treated: 1 (1 open, 1 high or extreme)');
    expect(text).toContain('Risk treatment progress');
    expect(text).toContain('Unowned privileged access (extreme, open)');
    expect(text).toContain('Actions treating: 1 active / 1 total (0 blocked or overdue)');
    expect(text).toContain('Direction impact');
    expect(text).toContain('PSPF Direction 001-2026: not-set');
    expect(text).toContain('Requirements modified: 1 (1 currently a gap)');
  });

  it('summarises the compliance value of an action node', () => {
    const otherRequirementId = asRequirementId('GOV-002');
    const coveredRequirementId = asRequirementId('GOV-003');
    const risk = baseRisk({
      requirementIds: [requirementId],
      likelihood: 4,
      impact: 4,
      status: 'open',
    });
    const action = baseAction({
      id: asActionId('action-uplift'),
      title: 'Uplift access controls',
      requirementIds: [requirementId, otherRequirementId, coveredRequirementId],
      riskIds: [risk.id],
      status: 'in-progress',
    });
    // A second active action also covers `otherRequirementId`, so only
    // requirementId and coveredRequirementId are uniquely covered by `action`.
    const otherAction = baseAction({
      id: asActionId('action-other'),
      title: 'Concurrent review',
      requirementIds: [otherRequirementId],
      status: 'in-progress',
    });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([
        [requirementId, compliance(requirementId, 'no')],
        [otherRequirementId, compliance(otherRequirementId, 'risk-managed')],
        [coveredRequirementId, compliance(coveredRequirementId, 'yes')],
      ]),
      risks: [risk],
      actions: [action, otherAction],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });

    const node = graph.nodes.find((n) => n.id === action.id);
    expect(node?.actionValue).toEqual({
      requirementsAddressed: 3,
      requirementsWithGap: 2,
      uniquelyCoveredRequirements: 2,
      risksTreated: 1,
      openRisksTreated: 1,
      highOrExtremeRisksTreated: 1,
    });
    expect(node?.connections).toMatchObject({
      requirementIds: [requirementId, otherRequirementId, coveredRequirementId].sort(),
      riskIds: [risk.id],
    });
  });

  it('summarises treatment progress on a risk node', () => {
    const risk = baseRisk({ requirementIds: [requirementId], status: 'open' });
    const blockedAction = baseAction({
      id: asActionId('action-blocked'),
      title: 'Blocked treatment',
      requirementIds: [requirementId],
      riskIds: [risk.id],
      status: 'blocked',
    });
    const doneAction = baseAction({
      id: asActionId('action-done'),
      title: 'Completed treatment',
      requirementIds: [requirementId],
      riskIds: [risk.id],
      status: 'done',
    });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [risk],
      actions: [blockedAction, doneAction],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
      now: Date.parse(NOW),
    });

    const node = graph.nodes.find((n) => n.id === risk.id);
    expect(node?.riskTreatment).toEqual({
      requirementsAffected: 1,
      requirementsWithGap: 1,
      actionsTreating: 2,
      activeActionsTreating: 1,
      blockedOrOverdueActionsTreating: 1,
    });
  });

  it('summarises a direction node impact', () => {
    const requirementWithGap = asRequirementId('GOV-100');
    const requirementSatisfied = asRequirementId('GOV-101');
    const direction = baseDirection({
      requirementIds: [requirementWithGap, requirementSatisfied],
    });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([
        [requirementWithGap, compliance(requirementWithGap, 'no')],
        [requirementSatisfied, compliance(requirementSatisfied, 'yes')],
      ]),
      risks: [],
      actions: [],
      directions: [direction],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });

    const node = graph.nodes.find((n) => n.id === direction.id);
    expect(node?.directionImpact).toEqual({
      requirementsModified: 2,
      requirementsWithGap: 1,
    });
    expect(node?.connections?.requirementIds).toEqual(
      [requirementWithGap, requirementSatisfied].sort(),
    );
  });

  it('filters by compliance state', () => {
    const otherRequirementId = asRequirementId('GOV-002');
    const graph = buildRelationshipMapGraph({
      compliance: new Map([
        [requirementId, compliance(requirementId, 'no')],
        [otherRequirementId, compliance(otherRequirementId, 'risk-managed')],
      ]),
      risks: [],
      actions: [],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: {
        requirements: true,
        risks: true,
        actions: true,
        directions: true,
        filters: { complianceStates: ['no'] },
      },
    });

    const requirementNodes = graph.nodes.filter((n) => n.kind === 'requirement');
    expect(requirementNodes).toHaveLength(1);
    expect(requirementNodes[0]?.id).toBe(requirementId);
  });

  it('filters by risk band', () => {
    const lowRisk = baseRisk({
      id: asRiskId('risk-low'),
      title: 'Low risk',
      likelihood: 1,
      impact: 1,
      requirementIds: [requirementId],
    });
    const extremeRisk = baseRisk({
      id: asRiskId('risk-extreme'),
      title: 'Extreme risk',
      likelihood: 5,
      impact: 5,
      requirementIds: [requirementId],
    });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [lowRisk, extremeRisk],
      actions: [],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: {
        requirements: true,
        risks: true,
        actions: true,
        directions: true,
        filters: { riskBands: ['extreme', 'high'] },
      },
    });

    const riskNodes = graph.nodes.filter((n) => n.kind === 'risk');
    expect(riskNodes.map((n) => n.id)).toEqual([extremeRisk.id]);
    // Edge to the filtered-out low risk should not be present.
    expect(
      graph.edges.every((edge) => edge.target !== lowRisk.id && edge.source !== lowRisk.id),
    ).toBe(true);
  });

  it('filters actions to blocked or overdue only', () => {
    const inProgress = baseAction({
      id: asActionId('action-in-progress'),
      requirementIds: [requirementId],
      status: 'in-progress',
    });
    const blocked = baseAction({
      id: asActionId('action-blocked'),
      requirementIds: [requirementId],
      status: 'blocked',
    });
    const overdue = baseAction({
      id: asActionId('action-overdue'),
      requirementIds: [requirementId],
      status: 'in-progress',
      dueAt: '2026-01-01',
    });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [],
      actions: [inProgress, blocked, overdue],
      directions: [],
      relationships: [],
      workTracking: [],
      visibility: {
        requirements: true,
        risks: true,
        actions: true,
        directions: true,
        filters: { actionOverdueOnly: true },
      },
      now: Date.parse(NOW),
    });

    const actionNodes = graph.nodes.filter((n) => n.kind === 'action');
    expect(actionNodes.map((n) => n.id).sort()).toEqual([blocked.id, overdue.id].sort());
    expect(graph.summary.blockedOrOverdueActions).toBe(2);
  });

  it('filters by direction response state', () => {
    const needs = baseDirection({
      id: asDirectionId('dir-needs'),
      reference: 'PSPF Direction needs',
      requirementIds: [requirementId],
      responseState: 'not-set',
    });
    const dealt = baseDirection({
      id: asDirectionId('dir-dealt'),
      reference: 'PSPF Direction dealt',
      requirementIds: [requirementId],
      responseState: 'yes',
    });

    const graph = buildRelationshipMapGraph({
      compliance: new Map([[requirementId, compliance(requirementId, 'no')]]),
      risks: [],
      actions: [],
      directions: [needs, dealt],
      relationships: [],
      workTracking: [],
      visibility: {
        requirements: true,
        risks: true,
        actions: true,
        directions: true,
        filters: { directionResponseStates: ['not-set', 'no'] },
      },
    });

    const directionNodes = graph.nodes.filter((n) => n.kind === 'direction');
    expect(directionNodes.map((n) => n.id)).toEqual([needs.id]);
  });
});

describe('orderRelationshipMapNodes', () => {
  const reqA = asRequirementId('GOV-001');
  const reqB = asRequirementId('GOV-002');
  const reqC = asRequirementId('GOV-003');

  function buildGraph() {
    return buildRelationshipMapGraph({
      compliance: new Map([
        [reqA, compliance(reqA, 'no')],
        [reqB, compliance(reqB, 'no')],
        [reqC, compliance(reqC, 'yes')],
      ]),
      // Two risks: risk-1 connects to reqB; risk-2 connects to reqA. Sorting
      // by median requirement index should put risk-2 before risk-1.
      risks: [
        baseRisk({ id: asRiskId('risk-1'), requirementIds: [reqB] }),
        baseRisk({ id: asRiskId('risk-2'), requirementIds: [reqA] }),
      ],
      actions: [
        baseAction({ id: asActionId('action-1'), requirementIds: [reqB] }),
        baseAction({ id: asActionId('action-2'), requirementIds: [reqA] }),
      ],
      directions: [
        baseDirection({ id: asDirectionId('direction-1'), requirementIds: [reqB] }),
        baseDirection({ id: asDirectionId('direction-2'), requirementIds: [reqA] }),
      ],
      relationships: [],
      workTracking: [],
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });
  }

  it('orders each lane so connected items align across columns', () => {
    const ordered = orderRelationshipMapNodes(buildGraph());
    // GOV-001 leads because it has the alphabetically-earliest gap; GOV-003
    // (already 'yes') is dropped from the visible graph.
    expect(ordered.requirements.map((n) => n.id)).toEqual([reqA, reqB]);
    expect(ordered.risks.map((n) => n.id)).toEqual(['risk-2', 'risk-1']);
    expect(ordered.actions.map((n) => n.id)).toEqual(['action-2', 'action-1']);
    expect(ordered.directions.map((n) => n.id)).toEqual(['direction-2', 'direction-1']);
  });

  it('promotes focused and linked nodes to the top of every lane', () => {
    const graph = buildGraph();
    const ordered = orderRelationshipMapNodes(graph, new Set(['risk-1']));
    // reqB is linked to risk-1, so it should rise to the top of the
    // requirements lane even though reqA also has compliance gaps.
    expect(ordered.requirements[0]?.id).toBe(reqB);
    // The focused risk leads its own lane; unlinked risk-2 falls below it.
    expect(ordered.risks.map((n) => n.id)).toEqual(['risk-1', 'risk-2']);
  });
});
