/**
 * Integration round-trip against the shipped Core/Explorer sample bundle.
 * Skipped when the legacy Explorer dist has not been built locally.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  applyCoreBundleImport,
  buildCoreBundleExport,
  parseCoreBundle,
  planCoreBundleImport,
} from './core-bundle.ts';
import { allRequirements, requirementByCanonicalId } from '../pspf/index.ts';
import type { ComplianceEntry, RequirementId } from './types.ts';

const samplePath = resolve(__dirname, '../../../explorer/dist/sample-bundle-enterprise.json');
const hasSample = existsSync(samplePath);

describe.skipIf(!hasSample)('sample bundle round-trip', () => {
  const canonicalToApp = new Map<string, RequirementId>(
    [...requirementByCanonicalId].map(([canonicalId, requirement]) => [
      canonicalId,
      requirement.id,
    ]),
  );

  it('parses, plans, applies, and re-exports the enterprise sample bundle', async () => {
    const bundle = parseCoreBundle(JSON.parse(readFileSync(samplePath, 'utf8')));
    const plan = planCoreBundleImport(bundle, { canonicalToApp });

    // The sample carries Workshop-authored requirements only; they must be
    // preserved rather than force-mapped.
    expect(plan.risks.length).toBeGreaterThan(0);
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.directions.length).toBeGreaterThan(0);

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
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
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
    });

    // Every source collection survives with at least its original counts for
    // pass-through kinds.
    for (const name of [
      'domains',
      'strategies',
      'source-controls',
      'requirement-control-mappings',
    ]) {
      const before = bundle.collections[name]?.length ?? 0;
      const after = exported.collections[name]?.length ?? 0;
      expect(after, `collection ${name}`).toBe(before);
    }
    // Managed collections keep their original Core ids.
    const sourceRiskIds = (bundle.collections.risks ?? []).map((r) => r.id).sort();
    const exportedRiskIds = (exported.collections.risks ?? []).map((r) => r.id).sort();
    expect(exportedRiskIds).toEqual(sourceRiskIds);

    // The export parses under our own compatibility rules.
    expect(() => parseCoreBundle(JSON.parse(JSON.stringify(exported)))).not.toThrow();

    // Leave the export where a Core import smoke check can pick it up.
    const outDir = join(tmpdir(), 'pspf-explorer-next');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'sample-roundtrip-export.json'),
      `${JSON.stringify(exported, null, 2)}\n`,
      'utf8',
    );
  });
});
