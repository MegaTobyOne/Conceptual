import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createCoreService } from "../packages/core/dist/service.js";
import { buildSampleWorkspaceEntities, buildHomeSampleWorkspaceEntities } from "../packages/contracts/dist/index.js";
import {
  CYBER_REFERENCE_LINKS,
  ISM_SOURCE_CONTROLS,
  PSPF_BASELINE_DIRECTIONS,
  PSPF_BASELINE_DIRECTION_LINKS,
  PSPF_BASELINE_REQUIREMENTS
} from "../packages/reference-data/dist/index.js";
import { validateExportBundle } from "./lib/export-validation.mjs";

const root = process.cwd();

async function runVariant({ name, build, expected }) {
  const workspaceRoot = join(root, ".tmp", `sample-workspace-gate-${name}`);
  await rm(workspaceRoot, { recursive: true, force: true });

  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  let sourceControls = await service.listEntities("source-control");
  if (name === "enterprise") {
    await service.upsertEntity({
      ...sourceControls[0],
      id: "SRC-00000000-0000-7000-8000-000000000999",
      title: "Retired generated ISM fixture",
      controlId: "ISM-RETIRED-FIXTURE",
      statement: "Retired generated fixture that should be pruned during reference-data refresh.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    sourceControls = await service.listEntities("source-control");
    assert.equal(
      sourceControls.length,
      ISM_SOURCE_CONTROLS.length,
      "Core refresh should prune retired generated source controls from existing workspaces."
    );
  }

  const sampleEntities = build({ sourceControls });
  await service.upsertEntities(sampleEntities);

  const validation = await service.validateWorkspace();
  assert.equal(validation.ok, true, validation.message);
  assert.equal(
    validation.counts.requirements,
    PSPF_BASELINE_REQUIREMENTS.length + expected.requirements,
    `${name}: requirements`
  );
  assert.equal(validation.counts.evidence, expected.evidence, `${name}: evidence`);
  assert.equal(validation.counts.actions, expected.actions, `${name}: actions`);
  assert.equal(validation.counts.risks, expected.risks, `${name}: risks`);
  assert.equal(
    validation.counts.directions,
    PSPF_BASELINE_DIRECTIONS.length + expected.directions,
    `${name}: directions`
  );
  assert.equal(
    validation.counts.links,
    PSPF_BASELINE_DIRECTION_LINKS.length + CYBER_REFERENCE_LINKS.length + expected.links,
    `${name}: links`
  );
  assert.equal(validation.counts["source-controls"], ISM_SOURCE_CONTROLS.length, `${name}: source-controls`);
  assert.equal(
    validation.counts["requirement-control-mappings"],
    expected.mappings,
    `${name}: requirement-control-mappings`
  );
  if (expected.strategies !== undefined) {
    assert.equal(validation.counts.strategies ?? 0, expected.strategies, `${name}: strategies`);
  }

  const scan = await service.runIntegrityScan();
  assert.equal(scan.ok, true, scan.summary);

  const exported = await service.exportBundle();
  const report = await validateExportBundle(join(exported.exportDirectory, "bundle.json"), { root });
  assert.equal(report.ok, true, report.failures.join("\n"));
  assert.equal(report.counts.requirements, PSPF_BASELINE_REQUIREMENTS.length + expected.requirements);
  assert.equal(report.counts.directions, PSPF_BASELINE_DIRECTIONS.length + expected.directions);
  assert.equal(
    report.redactionChecks.every((check) => check.ok),
    true,
    JSON.stringify(report.redactionChecks)
  );
  assert.equal(report.mappingRedaction.ok, true, report.mappingRedaction.detail);

  const actions = await service.listEntities("action");
  const enrichedActions = actions.filter((action) => action.impact);
  assert.equal(enrichedActions.length, 0, "Core storage should not persist derived action impact before export.");
}

await runVariant({
  name: "enterprise",
  build: buildSampleWorkspaceEntities,
  expected: {
    requirements: 3,
    evidence: 2,
    actions: 3,
    risks: 4,
    directions: 2,
    links: 12,
    mappings: 16
  }
});

await runVariant({
  name: "home",
  build: buildHomeSampleWorkspaceEntities,
  expected: {
    requirements: 15,
    evidence: 4,
    actions: 5,
    risks: 3,
    directions: 0,
    links: 12,
    mappings: 21,
    strategies: 1
  }
});

console.log("ok sample workspaces (enterprise + home) load, validate, scan, export, and remain publication-safe");
