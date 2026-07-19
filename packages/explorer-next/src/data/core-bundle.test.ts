import { describe, expect, it } from 'vitest';
import { VERSION_AXES } from '@pspf/contracts';
import {
  type CoreBundle,
  type CoreImportPlan,
  applyCoreBundleImport,
  buildCoreBundleExport,
  coreBundleIdentity,
  parseCoreBundle,
  planCoreBundleImport,
  CoreBundleError,
} from './core-bundle.ts';
import { allRequirements, requirementByCanonicalId } from '../pspf/index.ts';
import { asRiskId } from './types.ts';
import type {
  Action,
  ComplianceEntry,
  Direction,
  EvidenceRef,
  Relationship,
  RequirementId,
  Risk,
} from './types.ts';

const GOV_001_CANONICAL = 'REQ-PSPF-2025-001';
const govRequirement = requirementByCanonicalId.get(GOV_001_CANONICAL);
if (!govRequirement) throw new Error('Fixture requires REQ-PSPF-2025-001 in the baseline.');
const GOV_001 = govRequirement.id;

const canonicalToApp = new Map<string, RequirementId>(
  [...requirementByCanonicalId].map(([canonicalId, requirement]) => [canonicalId, requirement.id]),
);

let seq = 0;
const gen = (): string => `TESTID${String((seq += 1)).padStart(20, '0')}`;

function record(id: string, entityType: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    title: `${entityType} ${id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    sourceProduct: 'core',
    recordStatus: 'active',
    ...extra,
  };
}

function fixtureBundle(): CoreBundle {
  return parseCoreBundle({
    manifest: {
      bundleType: 'pspf-explorer-bundle',
      bundleVersion: VERSION_AXES.bundleVersion,
      schemaVersion: VERSION_AXES.schemaVersion,
      apiVersion: VERSION_AXES.apiVersion,
      generatedAt: '2026-01-02T00:00:00.000Z',
      generator: { product: 'pspf-core', workspaceId: 'ws-test' },
      security: { classification: 'OFFICIAL: Sensitive', redactionProfile: 'explorer-default' },
      collections: [],
    },
    collections: {
      domains: [record('DOM-1', 'domain')],
      requirements: [
        record(GOV_001_CANONICAL, 'requirement', { assessmentStatus: 'met' }),
        record('REQ-PSPF-2025-002', 'requirement', { assessmentStatus: 'partially-met' }),
        record('REQ-custom-workshop', 'requirement', { assessmentStatus: 'met' }),
      ],
      evidence: [
        record('EVD-1', 'evidence', {
          evidenceType: 'url',
          reference: 'https://example.gov.au/evidence',
          freshness: 'current',
        }),
        record('EVD-orphan', 'evidence', { evidenceType: 'document', reference: 'x.pdf' }),
      ],
      risks: [record('RSK-1', 'risk', { status: 'open', likelihood: 4, impact: 5 })],
      actions: [record('ACT-1', 'action', { status: 'todo', dueDate: '2026-06-30T00:00:00.000Z' })],
      directions: [
        record('DIR-1', 'direction', {
          reference: 'HA-DIR-2026-01',
          sourceAuthority: 'Department of Home Affairs',
          issuedAt: '2026-04-01T00:00:00.000Z',
          responseState: 'not-set',
        }),
      ],
      links: [
        record('LNK-1', 'link', {
          linkType: 'supported-by',
          fromId: GOV_001_CANONICAL,
          fromType: 'requirement',
          toId: 'EVD-1',
          toType: 'evidence',
        }),
        record('LNK-2', 'link', {
          linkType: 'exposed-by',
          fromId: GOV_001_CANONICAL,
          fromType: 'requirement',
          toId: 'RSK-1',
          toType: 'risk',
        }),
        record('LNK-3', 'link', {
          linkType: 'addressed-by',
          fromId: GOV_001_CANONICAL,
          fromType: 'requirement',
          toId: 'ACT-1',
          toType: 'action',
        }),
        record('LNK-4', 'link', {
          linkType: 'targets',
          fromId: 'DIR-1',
          fromType: 'direction',
          toId: GOV_001_CANONICAL,
          toType: 'requirement',
        }),
      ],
      'source-controls': [record('SRC-1', 'source-control')],
    },
  });
}

describe('parseCoreBundle', () => {
  it('rejects non-bundle JSON', () => {
    expect(() => parseCoreBundle({ hello: 'world' })).toThrow(CoreBundleError);
  });

  it('rejects incompatible version axes', () => {
    const raw = {
      manifest: {
        bundleType: 'pspf-explorer-bundle',
        bundleVersion: '99.0.0',
        schemaVersion: VERSION_AXES.schemaVersion,
        apiVersion: VERSION_AXES.apiVersion,
      },
      collections: {},
    };
    expect(() => parseCoreBundle(raw)).toThrow(/bundleVersion 99\.0\.0/);
  });

  it('accepts a compatible bundle and derives its identity', () => {
    const bundle = fixtureBundle();
    expect(coreBundleIdentity(bundle.manifest)).toBe(`ws-test::${VERSION_AXES.schemaVersion}`);
  });
});

describe('planCoreBundleImport', () => {
  const plan = (): CoreImportPlan =>
    planCoreBundleImport(fixtureBundle(), {
      canonicalToApp,
      generateId: gen,
      now: '2026-02-01T00:00:00.000Z',
    });

  it('maps assessment statuses onto compliance states', () => {
    const result = plan();
    const gov = result.compliance.find((c) => c.canonicalId === GOV_001_CANONICAL);
    expect(gov?.state).toBe('yes');
    const partial = result.compliance.find((c) => c.canonicalId === 'REQ-PSPF-2025-002');
    expect(partial?.state).toBe('no');
    expect(partial?.note).toMatch(/partially-met/);
  });

  it('skips Workshop-authored requirements but keeps them for round-trip', () => {
    const result = plan();
    expect(result.compliance.some((c) => c.canonicalId === 'REQ-custom-workshop')).toBe(false);
    expect(
      result.skipped.some((s) => s.collection === 'requirements' && s.id === 'REQ-custom-workshop'),
    ).toBe(true);
  });

  it('maps risks, actions, and directions with cross-references from links', () => {
    const result = plan();
    expect(result.risks).toHaveLength(1);
    expect(result.risks[0]!.record.requirementIds).toEqual([GOV_001]);
    expect(result.actions[0]!.record.requirementIds).toEqual([GOV_001]);
    expect(result.directions[0]!.record.requirementIds).toEqual([GOV_001]);
    expect(result.directions[0]!.record.description).toMatch(/Department of Home Affairs/);
    expect(result.relationships).toHaveLength(3);
  });

  it('turns linked evidence into evidence references and flags orphans', () => {
    const result = plan();
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]!.ref.kind).toBe('url');
    expect(result.evidence[0]!.ref.value).toBe('https://example.gov.au/evidence');
    expect(result.skipped.some((s) => s.id === 'EVD-orphan')).toBe(true);
  });

  it('reports pass-through collections', () => {
    const result = plan();
    expect(result.passThrough).toContainEqual({ collection: 'domains', count: 1 });
    expect(result.passThrough).toContainEqual({ collection: 'source-controls', count: 1 });
  });
});

describe('applyCoreBundleImport', () => {
  it('applies the plan and returns an id map for round-trips', async () => {
    const bundle = fixtureBundle();
    const plan = planCoreBundleImport(bundle, { canonicalToApp, generateId: gen });
    const calls: string[] = [];
    const target = {
      setCompliance: (id: RequirementId) => Promise.resolve(calls.push(`compliance:${id}`)),
      addEvidence: (id: RequirementId) => Promise.resolve(calls.push(`evidence:${id}`)),
      upsertRiskRecord: (risk: Risk) => Promise.resolve(calls.push(`risk:${risk.id}`)),
      upsertActionRecord: (action: Action) => Promise.resolve(calls.push(`action:${action.id}`)),
      upsertDirectionRecord: (direction: Direction) =>
        Promise.resolve(calls.push(`direction:${direction.id}`)),
      upsertRelationshipRecord: (relationship: Relationship) =>
        Promise.resolve(calls.push(`relationship:${relationship.id}`)),
    };
    const { summary, idMap } = await applyCoreBundleImport(plan, target);
    expect(summary.compliance).toBe(2);
    expect(summary.risks).toBe(1);
    expect(idMap[`risk:${plan.risks[0]!.record.id}`]).toBe('RSK-1');
    expect(idMap[`direction:${plan.directions[0]!.record.id}`]).toBe('DIR-1');
    expect(calls.length).toBeGreaterThan(5);
  });
});

describe('buildCoreBundleExport', () => {
  const NOW = '2026-03-01T00:00:00.000Z';

  function localState() {
    const evidence: EvidenceRef[] = [
      { kind: 'url', value: 'https://example.gov.au/new-evidence', addedAt: NOW },
    ];
    const compliance = new Map<RequirementId, ComplianceEntry>([
      [
        GOV_001,
        {
          requirementId: GOV_001,
          state: 'risk-managed',
          evidence,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    ]);
    const risk: Risk = {
      id: asRiskId(gen()),
      title: 'Local risk',
      likelihood: 2,
      impact: 3,
      status: 'open',
      requirementIds: [GOV_001],
      actionIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    return { compliance, risks: [risk], actions: [], directions: [], relationships: [] };
  }

  it('produces a valid manifest with hashed collections', async () => {
    const state = localState();
    const { bundle } = await buildCoreBundleExport({
      requirements: allRequirements,
      ...state,
      idMap: {},
      now: NOW,
    });
    expect(bundle.manifest.bundleType).toBe('pspf-explorer-bundle');
    expect(bundle.manifest.schemaVersion).toBe(VERSION_AXES.schemaVersion);
    expect(bundle.manifest.generator?.product).toBe('pspf-explorer');
    expect(bundle.manifest.generator?.mode).toBe('local-authoring');
    const manifestRequirements = bundle.manifest.collections?.find(
      (c) => c.name === 'requirements',
    );
    expect(manifestRequirements?.count).toBe(bundle.collections.requirements?.length);
    expect(manifestRequirements?.hash?.value).toMatch(/^[0-9a-f]{64}$/);
    // The parser must accept our own exports.
    expect(() => parseCoreBundle(JSON.parse(JSON.stringify(bundle)))).not.toThrow();
  });

  it('maps local compliance and records onto Core vocabulary', async () => {
    const state = localState();
    const { bundle } = await buildCoreBundleExport({
      requirements: allRequirements,
      ...state,
      idMap: {},
      now: NOW,
    });
    const requirement = bundle.collections.requirements?.find((r) => r.id === GOV_001_CANONICAL);
    expect(requirement?.assessmentStatus).toBe('partially-met');
    expect(requirement?.sourceProduct).toBe('explorer');
    expect(bundle.collections.risks).toHaveLength(1);
    expect(bundle.collections.risks?.[0]!.id).toMatch(/^RSK-[0-9a-f-]{36}$/);
    const link = bundle.collections.links?.find((l) => l.linkType === 'exposed-by');
    expect(link?.fromId).toBe(GOV_001_CANONICAL);
    expect(link?.toId).toBe(bundle.collections.risks?.[0]!.id);
    const evidenceLink = bundle.collections.links?.find((l) => l.linkType === 'supported-by');
    expect(evidenceLink?.toId).toBe(bundle.collections.evidence?.[0]!.id);
  });

  it('keeps stable ids across repeated exports', async () => {
    const state = localState();
    const first = await buildCoreBundleExport({
      requirements: allRequirements,
      ...state,
      idMap: {},
      now: NOW,
    });
    const second = await buildCoreBundleExport({
      requirements: allRequirements,
      ...state,
      idMap: first.idMap,
      now: NOW,
    });
    expect(second.bundle.collections.risks?.[0]!.id).toBe(first.bundle.collections.risks?.[0]!.id);
    expect(second.bundle.manifest.generator?.workspaceId).toBe(
      first.bundle.manifest.generator?.workspaceId,
    );
  });

  it('round-trips an imported bundle without losing pass-through collections', async () => {
    const bundle = fixtureBundle();
    const plan = planCoreBundleImport(bundle, { canonicalToApp, generateId: gen });
    const { idMap } = await applyCoreBundleImport(plan, {
      setCompliance: () => Promise.resolve(undefined),
      addEvidence: () => Promise.resolve(undefined),
      upsertRiskRecord: () => Promise.resolve(undefined),
      upsertActionRecord: () => Promise.resolve(undefined),
      upsertDirectionRecord: () => Promise.resolve(undefined),
      upsertRelationshipRecord: () => Promise.resolve(undefined),
    });
    const compliance = new Map<RequirementId, ComplianceEntry>(
      plan.compliance.map((item) => [
        item.requirementId,
        {
          requirementId: item.requirementId,
          state: item.state,
          evidence: plan.evidence
            .filter((e) => e.requirementId === item.requirementId)
            .map((e) => e.ref),
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]),
    );
    const { bundle: exported } = await buildCoreBundleExport({
      requirements: allRequirements,
      compliance,
      risks: plan.risks.map((r) => r.record),
      actions: plan.actions.map((a) => a.record),
      directions: plan.directions.map((d) => d.record),
      relationships: plan.relationships.map((r) => r.record),
      source: bundle,
      idMap,
      now: NOW,
    });
    // Pass-through kept.
    expect(exported.collections.domains).toHaveLength(1);
    expect(exported.collections['source-controls']).toHaveLength(1);
    // Workshop-authored requirement retained untouched.
    expect(exported.collections.requirements?.some((r) => r.id === 'REQ-custom-workshop')).toBe(
      true,
    );
    // Imported records keep their original Core ids.
    expect(exported.collections.risks?.[0]!.id).toBe('RSK-1');
    expect(exported.collections.actions?.[0]!.id).toBe('ACT-1');
    expect(exported.collections.directions?.[0]!.id).toBe('DIR-1');
    // Imported evidence is not duplicated.
    expect(exported.collections.evidence?.filter((e) => e.id.startsWith('EVD-'))).toHaveLength(2);
    // Rebuilt links reference original Core ids.
    const exposedBy = exported.collections.links?.find((l) => l.linkType === 'exposed-by');
    expect(exposedBy?.toId).toBe('RSK-1');
    const targets = exported.collections.links?.find((l) => l.linkType === 'targets');
    expect(targets?.fromId).toBe('DIR-1');
    expect(targets?.toId).toBe(GOV_001_CANONICAL);
    // Workspace identity is carried through.
    expect(exported.manifest.generator?.workspaceId).toBe('ws-test');
  });
});
