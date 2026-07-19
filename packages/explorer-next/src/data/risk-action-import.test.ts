import { describe, it, expect } from 'vitest';
import {
  applyRiskActionImport,
  planRiskActionImport,
  RiskActionImportValidationError,
  validateRiskActionImport,
  type ApplyTarget,
} from './risk-action-import.ts';
import { asActionId, asRequirementId, asRiskId, type Action, type Risk } from './types.ts';

const validBase = {
  pspfWorkImport: 'v1',
  source: 'ext',
  capturedAt: '2025-01-01T00:00:00Z',
};

describe('risk-action import validation', () => {
  it('rejects unknown top-level fields', () => {
    expect(() => validateRiskActionImport({ ...validBase, rogue: true })).toThrow(
      RiskActionImportValidationError,
    );
  });

  it('rejects unsupported format', () => {
    expect(() => validateRiskActionImport({ ...validBase, pspfWorkImport: 'v2' })).toThrow(
      /Unsupported format/,
    );
  });

  it('rejects bad risk likelihood', () => {
    expect(() =>
      validateRiskActionImport({
        ...validBase,
        risks: [{ title: 'r', likelihood: 9, impact: 1, status: 'open' }],
      }),
    ).toThrow(/likelihood/);
  });

  it('rejects bad action status', () => {
    expect(() =>
      validateRiskActionImport({
        ...validBase,
        actions: [{ title: 'a', type: 'remediation', status: 'pending' }],
      }),
    ).toThrow(/status/);
  });

  it('maps common status aliases in map-common mode', () => {
    const out = validateRiskActionImport(
      {
        ...validBase,
        risks: [{ title: 'r1', likelihood: 3, impact: 4, status: 'In Progress' }],
        actions: [{ title: 'a1', type: 'remediation', status: 'open' }],
      },
      { status: { mode: 'map-common' } },
    );
    expect(out.risks?.[0]?.status).toBe('open');
    expect(out.actions?.[0]?.status).toBe('in-progress');
  });

  it('maps additional action aliases and separator variants in map-common mode', () => {
    const out = validateRiskActionImport(
      {
        ...validBase,
        actions: [
          { title: 'a1', type: 'remediation', status: 'Pending' },
          { title: 'a2', type: 'review', status: 'pending_review' },
        ],
      },
      { status: { mode: 'map-common' } },
    );
    expect(out.actions?.[0]?.status).toBe('todo');
    expect(out.actions?.[1]?.status).toBe('todo');
  });

  it('forces statuses when force mode is selected', () => {
    const out = validateRiskActionImport(
      {
        ...validBase,
        risks: [{ title: 'r1', likelihood: 1, impact: 1, status: 'anything' as never }],
        actions: [{ title: 'a1', type: 'review', status: 'something else' as never }],
      },
      {
        status: {
          mode: 'force',
          forcedRiskStatus: 'monitored',
          forcedActionStatus: 'todo',
        },
      },
    );
    expect(out.risks?.[0]?.status).toBe('monitored');
    expect(out.actions?.[0]?.status).toBe('todo');
  });

  it('rejects unknown risk fields', () => {
    expect(() =>
      validateRiskActionImport({
        ...validBase,
        risks: [{ title: 'r', likelihood: 1, impact: 1, status: 'open', extra: 1 }],
      }),
    ).toThrow(/extra/);
  });

  it('accepts a minimal valid payload', () => {
    const out = validateRiskActionImport({
      ...validBase,
      risks: [{ title: 'r1', likelihood: 3, impact: 4, status: 'open' }],
      actions: [{ title: 'a1', type: 'remediation', status: 'todo' }],
    });
    expect(out.risks).toHaveLength(1);
    expect(out.actions).toHaveLength(1);
  });
});

describe('risk-action import plan', () => {
  it('classifies entries with unknown id as add and matching id as update', () => {
    const existing: Risk = {
      id: asRiskId('risk-keep'),
      title: 'old title',
      likelihood: 2,
      impact: 2,
      status: 'open',
      requirementIds: [asRequirementId('GOV-001')],
      actionIds: [],
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
    };
    const payload = validateRiskActionImport({
      ...validBase,
      risks: [
        {
          id: 'risk-keep',
          title: 'new title',
          likelihood: 3,
          impact: 2,
          status: 'open',
          requirementIds: ['GOV-001'],
        },
        { title: 'fresh risk', likelihood: 1, impact: 1, status: 'monitored' },
      ],
    });
    let counter = 0;
    const plan = planRiskActionImport(payload, {
      risksById: new Map([[existing.id, existing]]),
      actionsById: new Map(),
      generateId: () => `gen-${++counter}`,
    });
    expect(plan.risks).toHaveLength(2);
    expect(plan.risks[0]?.mode).toBe('update');
    expect(plan.risks[0]?.changedFields).toEqual(expect.arrayContaining(['title', 'likelihood']));
    expect(plan.risks[0]?.next.createdAt).toBe('2024-12-01T00:00:00Z');
    expect(plan.risks[1]?.mode).toBe('add');
    expect(plan.risks[1]?.next.id).toBe('gen-1');
  });

  it('plans actions and preserves dueAt + relations', () => {
    const payload = validateRiskActionImport({
      ...validBase,
      actions: [
        {
          id: 'act-1',
          title: 'Investigate',
          type: 'investigation',
          status: 'in-progress',
          dueAt: '2025-06-01T00:00:00Z',
          requirementIds: ['GOV-001', 'GOV-002'],
          riskIds: ['risk-1'],
        },
      ],
    });
    const plan = planRiskActionImport(payload, {
      risksById: new Map([
        [
          asRiskId('risk-1'),
          {
            id: asRiskId('risk-1'),
            title: 'Existing risk',
            likelihood: 2,
            impact: 2,
            status: 'open',
            requirementIds: [],
            actionIds: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      ]),
      actionsById: new Map(),
    });
    expect(plan.actions[0]?.next.dueAt).toBe('2025-06-01T00:00:00Z');
    expect(plan.actions[0]?.next.requirementIds).toHaveLength(2);
    expect(plan.actions[0]?.next.riskIds).toEqual([asRiskId('risk-1')]);
  });

  it('rebuilds bidirectional risk-action links and removes unknown links', () => {
    const payload = validateRiskActionImport({
      ...validBase,
      risks: [
        {
          id: 'risk-1',
          title: 'Risk one',
          likelihood: 2,
          impact: 2,
          status: 'open',
          actionIds: ['act-1', 'act-missing'],
        },
      ],
      actions: [
        {
          id: 'act-1',
          title: 'Action one',
          type: 'review',
          status: 'todo',
          riskIds: ['risk-1'],
        },
      ],
    });
    const plan = planRiskActionImport(
      payload,
      {
        risksById: new Map(),
        actionsById: new Map(),
      },
      { linkMode: 'rebuild-bidirectional' },
    );
    expect(plan.risks[0]?.next.actionIds).toEqual([asActionId('act-1')]);
    expect(plan.actions[0]?.next.riskIds).toEqual([asRiskId('risk-1')]);
  });

  it('supports patch mode for updates by preserving omitted optional fields', () => {
    const existing: Risk = {
      id: asRiskId('risk-keep'),
      title: 'old title',
      description: 'keep this note',
      likelihood: 2,
      impact: 2,
      status: 'open',
      requirementIds: [asRequirementId('GOV-001')],
      actionIds: [asActionId('act-1')],
      createdAt: '2024-12-01T00:00:00Z',
      updatedAt: '2024-12-01T00:00:00Z',
    };

    const payload = validateRiskActionImport({
      ...validBase,
      risks: [{ id: 'risk-keep', title: 'new title', likelihood: 3, impact: 2, status: 'open' }],
    });

    const plan = planRiskActionImport(
      payload,
      {
        risksById: new Map([[existing.id, existing]]),
        actionsById: new Map([
          [
            asActionId('act-1'),
            {
              id: asActionId('act-1'),
              title: 'Existing action',
              type: 'review',
              status: 'todo',
              requirementIds: [],
              riskIds: [asRiskId('risk-keep')],
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        ]),
      },
      { updateMode: 'patch' },
    );

    expect(plan.risks[0]?.next.description).toBe('keep this note');
    expect(plan.risks[0]?.next.requirementIds).toEqual([asRequirementId('GOV-001')]);
    expect(plan.risks[0]?.next.actionIds).toEqual([asActionId('act-1')]);
  });
});

describe('risk-action import apply', () => {
  it('only applies selected indexes and returns counts', async () => {
    const payload = validateRiskActionImport({
      ...validBase,
      risks: [
        { title: 'a', likelihood: 1, impact: 1, status: 'open' },
        { title: 'b', likelihood: 2, impact: 2, status: 'open' },
      ],
      actions: [
        { title: 'x', type: 'remediation', status: 'todo' },
        { title: 'y', type: 'review', status: 'in-progress' },
      ],
    });
    const plan = planRiskActionImport(payload, {
      risksById: new Map(),
      actionsById: new Map(),
      generateId: ((): (() => string) => {
        let i = 0;
        return () => `id-${++i}`;
      })(),
    });
    const writtenRisks: Risk[] = [];
    const writtenActions: Action[] = [];
    const target: ApplyTarget = {
      upsertRiskRecord: (r) => {
        writtenRisks.push(r);
        return Promise.resolve();
      },
      upsertActionRecord: (a) => {
        writtenActions.push(a);
        return Promise.resolve();
      },
    };
    const summary = await applyRiskActionImport(
      plan,
      { risks: new Set([0]), actions: new Set([1]) },
      target,
    );
    expect(summary).toEqual({
      risksAdded: 1,
      risksUpdated: 0,
      actionsAdded: 1,
      actionsUpdated: 0,
    });
    expect(writtenRisks).toHaveLength(1);
    expect(writtenRisks[0]?.title).toBe('a');
    expect(writtenActions[0]?.title).toBe('y');
  });

  it('counts updates when entry id matches existing', async () => {
    const existing: Action = {
      id: asActionId('act-1'),
      title: 'old',
      type: 'remediation',
      status: 'todo',
      requirementIds: [],
      riskIds: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    const payload = validateRiskActionImport({
      ...validBase,
      actions: [{ id: 'act-1', title: 'new', type: 'remediation', status: 'in-progress' }],
    });
    const plan = planRiskActionImport(payload, {
      risksById: new Map(),
      actionsById: new Map([[existing.id, existing]]),
    });
    const target: ApplyTarget = {
      upsertRiskRecord: () => Promise.resolve(),
      upsertActionRecord: () => Promise.resolve(),
    };
    const summary = await applyRiskActionImport(
      plan,
      { risks: new Set(), actions: new Set([0]) },
      target,
    );
    expect(summary.actionsUpdated).toBe(1);
    expect(summary.actionsAdded).toBe(0);
  });
});
