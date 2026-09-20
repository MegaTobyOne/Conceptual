import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import initSqlJs from "sql.js";
import {
  type ActionEntity,
  type LinkEntity,
  PSPF_DOMAINS,
  PSPF_SLICE_VERSION,
  PspfError,
  type RequirementEntity,
  type RiskCrosswalkRowInput,
  type RiskEntity,
  type RiskEventEntity,
  type RiskFrameworkEntity,
  VERSION_AXES,
  V0_1_COLLECTIONS,
  narrativeSlotFor,
  withEnvelope
} from "@pspf/contracts";
import { createCoreService, releaseAllWriterLocks } from "./service.js";

const testRoot = join(process.cwd(), ".tmp", "core-service-tests");

test.afterEach(async () => {
  await releaseAllWriterLocks();
});

test("plan-apply import is read-only until applied and undo restores prior records", async () => {
  const workspaceRoot = await freshWorkspace("plan-apply-undo");
  const bundlePath = join(workspaceRoot, "incoming-bundle.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const requirement = await service.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Plan apply status fixture",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "in-progress"
      },
      "workshop"
    )
  );
  const incomingRequirement: RequirementEntity = {
    ...(requirement as RequirementEntity),
    assessmentStatus: "met",
    updatedAt: "2026-05-25T00:00:00.000Z"
  };
  await writeBundle(bundlePath, { requirements: [incomingRequirement] });

  const plan = await service.planImportBundle(bundlePath, "plan-apply");
  assert.equal(plan.imported, 1);
  assert.equal(plan.summary.updated, 1);
  assert.match(plan.summary.examples.join("\n"), /status In Progress -> Met/);
  assert.equal(await requirementStatus(service, requirement.id), "in-progress");

  const applied = await service.importBundle(bundlePath, "plan-apply");
  assert.equal(applied.imported, 1);
  assert.equal(await requirementStatus(service, requirement.id), "met");

  const undone = await service.undoLastImport();
  assert.equal(undone.undone, true, undone.message);
  assert.equal(await requirementStatus(service, requirement.id), "in-progress");
});

test("local-authoring imports reject manifest checksum mismatches", async () => {
  const workspaceRoot = await freshWorkspace("local-authoring-checksum");
  const bundlePath = join(workspaceRoot, "incoming-local-authoring-bundle.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const incomingRequirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Tampered local authoring fixture",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "met"
    },
    "explorer"
  );
  await writeBundle(
    bundlePath,
    { requirements: [incomingRequirement] },
    { mode: "local-authoring", hashOverrides: { requirements: "0".repeat(64) } }
  );

  await assert.rejects(
    () => service.planImportBundle(bundlePath, "plan-apply"),
    /checksum does not match the manifest/i
  );
});

test("local-authoring imports reject manifest count mismatches", async () => {
  const workspaceRoot = await freshWorkspace("local-authoring-count");
  const bundlePath = join(workspaceRoot, "incoming-local-authoring-count-bundle.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const incomingRequirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Count mismatch local authoring fixture",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "met"
    },
    "explorer"
  );
  await writeBundle(
    bundlePath,
    { requirements: [incomingRequirement] },
    { mode: "local-authoring", countOverrides: { requirements: 2 } }
  );

  await assert.rejects(() => service.planImportBundle(bundlePath, "plan-apply"), /count mismatch/i);
});

test("full-replace requires a complete current schema-valid bundle", async () => {
  const workspaceRoot = await freshWorkspace("full-replace-complete-bundle");
  const bundlePath = join(workspaceRoot, "incomplete-full-replace.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  await writeBundle(bundlePath, { requirements: [] });

  await assert.rejects(() => service.planImportBundle(bundlePath, "full-replace"), /missing collection domains/i);
});

test("full-replace rejects unknown envelope fields and invalid schema formats", async () => {
  const workspaceRoot = await freshWorkspace("full-replace-strict-schema");
  const bundlePath = join(workspaceRoot, "strict-full-replace.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Strict schema requirement",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "met"
    },
    "explorer"
  );
  await writeBundle(
    bundlePath,
    { requirements: [requirement], posture: [postureFixture("Strict schema posture", 1)] },
    { complete: true }
  );

  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  bundle.unexpected = true;
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await assert.rejects(() => service.planImportBundle(bundlePath, "full-replace"), /unknown top-level properties/i);

  delete bundle.unexpected;
  bundle.manifest.collections.push({
    name: "unknown-collection",
    path: "./collections/unknown-collection.json",
    count: 0,
    hash: { alg: "SHA-256", value: "0".repeat(64) }
  });
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await assert.rejects(() => service.planImportBundle(bundlePath, "full-replace"), /unknown collections/i);

  bundle.manifest.collections.pop();
  bundle.collections.requirements[0].createdAt = "not-a-date";
  await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  await assert.rejects(() => service.planImportBundle(bundlePath, "full-replace"), /date-time/i);
});

test("full-replace rejects mappings whose source control is absent from the bundle", async () => {
  const workspaceRoot = await freshWorkspace("full-replace-exact-source-controls");
  const bundlePath = join(workspaceRoot, "missing-source-control-full-replace.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const requirement = (await service.listEntities("requirement"))[0];
  const sourceControl = (await service.listEntities("source-control"))[0];
  assert.ok(requirement && requirement.entityType === "requirement");
  assert.ok(sourceControl && sourceControl.entityType === "source-control");
  const mapping = withEnvelope(
    "requirement-control-mapping",
    {
      entityType: "requirement-control-mapping",
      title: "Mapping with omitted source control",
      requirementId: requirement.id,
      sourceControlId: sourceControl.id,
      coverageQualifier: "partial",
      applicabilityProfile: "all",
      confidence: "medium",
      provenance: {
        author: "core-test",
        createdAt: "2026-06-10T00:00:00.000Z",
        oscalRelease: sourceControl.provenance.oscalRelease
      }
    },
    "explorer"
  );
  await writeBundle(
    bundlePath,
    {
      requirements: [requirement],
      "requirement-control-mappings": [mapping],
      posture: [postureFixture("Missing source control posture", 1)]
    },
    { complete: true }
  );

  await assert.rejects(() => service.planImportBundle(bundlePath, "full-replace"), /missing source control/i);
});

test("full-replace is undoable and restores the previous workspace", async () => {
  const workspaceRoot = await freshWorkspace("full-replace-undo");
  const bundlePath = join(workspaceRoot, "complete-full-replace.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const previousRequirement = await service.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Requirement restored after full replace",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "in-progress"
      },
      "workshop"
    )
  );
  const replacementRequirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Replacement requirement",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "met"
    },
    "explorer"
  );
  const replacementPosture = postureFixture("Replacement posture", 1);
  await writeBundle(
    bundlePath,
    { requirements: [replacementRequirement], posture: [replacementPosture] },
    { complete: true }
  );

  await service.importBundle(bundlePath, "full-replace");
  assert.equal(
    (await service.listEntities()).some((entity) => entity.id === previousRequirement.id),
    false
  );
  assert.equal(
    (await service.listEntities()).some((entity) => entity.id === replacementRequirement.id),
    true
  );

  const undone = await service.undoLastImport();
  assert.equal(undone.undone, true, undone.message);
  assert.equal(
    (await service.listEntities()).some((entity) => entity.id === previousRequirement.id),
    true
  );
  assert.equal(
    (await service.listEntities()).some((entity) => entity.id === replacementRequirement.id),
    false
  );
});

test("full-replace rolls back the deletion when a replacement insert fails", async () => {
  const workspaceRoot = await freshWorkspace("full-replace-transaction-rollback");
  const bundlePath = join(workspaceRoot, "failed-full-replace.json");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
  const previousRequirement = await service.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Requirement retained after failed full replace",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "in-progress"
      },
      "workshop"
    )
  );
  const replacementRequirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Replacement that triggers rollback",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "met"
    },
    "explorer"
  );
  await writeBundle(
    bundlePath,
    {
      requirements: [replacementRequirement],
      posture: [postureFixture("Failed replacement posture", 1)]
    },
    { complete: true }
  );

  const SQL = await initSqlJs({ locateFile: () => join(process.cwd(), "dist", "sql-wasm.wasm") });
  const database = new SQL.Database(new Uint8Array(await readFile(paths.db)));
  database.exec(
    `CREATE TRIGGER reject_replacement BEFORE INSERT ON entities WHEN NEW.id = '${replacementRequirement.id}' BEGIN SELECT RAISE(ABORT, 'forced replacement failure'); END;`
  );
  await writeFile(paths.db, Buffer.from(database.export()));
  database.close();

  await assert.rejects(() => service.importBundle(bundlePath, "full-replace"), /forced replacement failure/i);
  const entities = await service.listEntities();
  assert.equal(
    entities.some((entity) => entity.id === previousRequirement.id),
    true
  );
  assert.equal(
    entities.some((entity) => entity.id === replacementRequirement.id),
    false
  );
});

test("writer lock blocks every mutating Core service entry point", async () => {
  const workspaceRoot = await freshWorkspace("writer-lock-write-surface");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
  await service.releaseWriterLock();
  await writeLockState(paths, {
    holderPid: 1,
    acquiredAt: "2026-05-25T00:00:00.000Z",
    policy: "single-writer",
    writable: false,
    detail: "Simulated second-window writer lock."
  });

  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Writer lock blocked write",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );

  await assert.rejects(() => service.upsertEntity(requirement), /read-only|writer lock/i);
  await assert.rejects(() => service.upsertEntities([requirement]), /read-only|writer lock/i);
  await assert.rejects(() => service.createSnapshot(), /read-only|writer lock/i);
  await assert.rejects(() => service.exportBundle(), /read-only|writer lock/i);
});

test("writer lock removes a dead legacy lock before acquiring current ownership", async () => {
  const workspaceRoot = await freshWorkspace("writer-lock-legacy-recovery");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
  await service.releaseWriterLock();
  const legacyLockPath = join(paths.locks, "writer.lock");
  await writeFile(legacyLockPath, "999999\n", "utf8");

  await service.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Legacy lock recovery write",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "in-progress"
      },
      "workshop"
    )
  );

  assert.equal(existsSync(legacyLockPath), false);
  assert.equal((await service.getWriterLock()).writable, true);
});

test("writer lock remains writable when restricted tooling changes its timestamp", async () => {
  const workspaceRoot = await freshWorkspace("writer-lock-restricted-environment");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
  const lockPath = join(paths.locks, "writer-v2.lock");
  const externalTimestamp = new Date(Date.now() - 60_000);
  await utimes(lockPath, externalTimestamp, externalTimestamp);
  assert.equal((await service.getWriterLock()).writable, true);

  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Written without external shell tooling",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );
  await service.upsertEntity(requirement);
  assert.equal(
    (await service.listEntities("requirement")).some((entity) => entity.id === requirement.id),
    true
  );
});

test("checkpoint snapshots persist allowlisted posture metrics", async () => {
  const workspaceRoot = await freshWorkspace("snapshot-metrics");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();

  const snapshot = await service.createSnapshot();
  const payload = JSON.parse(await readFile(join(paths.snapshots, `${snapshot.id}.json`), "utf8")) as {
    snapshot?: { metrics?: { requirementTotal?: number; compliancePercentage?: number } };
    statusSummary?: unknown;
  };

  assert.equal(typeof payload.snapshot?.metrics?.requirementTotal, "number");
  assert.equal(typeof payload.snapshot?.metrics?.compliancePercentage, "number");
  assert.equal(typeof payload.statusSummary, "object");
});

test("checkpoint snapshot side files record per-record status and list newest-first", async () => {
  const workspaceRoot = await freshWorkspace("snapshot-record-status");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();

  const requirement = await service.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Record status fixture",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "met"
      },
      "workshop"
    )
  );
  const action = await service.upsertEntity(
    withEnvelope("action", { entityType: "action", title: "Record status action", status: "in-progress" }, "workshop")
  );
  const risk = await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Record status risk", status: "open", likelihood: 2, impact: 3 },
      "workshop"
    )
  );
  const deletedAction = await service.upsertEntity(
    withEnvelope("action", { entityType: "action", title: "Deleted action", status: "todo" }, "workshop")
  );
  await service.upsertEntity({ ...deletedAction, recordStatus: "deleted" });

  const first = await service.createSnapshot();
  const payload = JSON.parse(await readFile(join(paths.snapshots, `${first.id}.json`), "utf8")) as {
    recordStatus?: {
      requirements: Record<string, string>;
      risks: Record<string, string>;
      actions: Record<string, string>;
    };
  };
  assert.equal(payload.recordStatus?.requirements[requirement.id], "met");
  assert.equal(payload.recordStatus?.actions[action.id], "in-progress");
  assert.equal(payload.recordStatus?.risks[risk.id], "open");
  assert.equal(deletedAction.id in (payload.recordStatus?.actions ?? {}), false);

  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await service.createSnapshot();
  const sideFiles = await service.listSnapshotSideFiles();
  assert.deepEqual(
    sideFiles.map((item) => item.snapshotId),
    [second.id, first.id]
  );
  assert.equal(sideFiles[0]?.capturedAt, second.createdAt);
  assert.equal(sideFiles[0]?.recordStatus?.requirements[requirement.id], "met");
  assert.equal(sideFiles[0]?.counts?.requirements.met, 1);
});

test("integrity scan reports links whose declared endpoint type does not match the target record", async () => {
  const workspaceRoot = await freshWorkspace("integrity-mistyped-link");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Integrity mistyped source requirement",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );
  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: "Integrity mistyped target evidence",
      evidenceType: "document",
      reference: "records/integrity-mistyped-target.pdf",
      freshness: "current"
    },
    "workshop"
  );
  const mistypedLink = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "Requirement exposed by evidence id",
      linkType: "exposed-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: evidence.id,
      toType: "risk"
    },
    "workshop"
  );
  await service.upsertEntities([requirement, evidence, mistypedLink]);

  const report = await service.runIntegrityScan();
  assert.equal(report.ok, false, report.summary);
  assert.equal(report.counts.mistypedLinks, 1);
  assert.match(
    report.findings.map((finding) => finding.message).join("\n"),
    /toType risk does not match referenced entity .*\(evidence\)/
  );
});

test("integrity scan reports a Requirement with a missing legacy title", async () => {
  const workspaceRoot = await freshWorkspace("integrity-missing-requirement-title");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Title removed by legacy persistence",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );
  await service.upsertEntity(requirement);
  const paths = service.getWorkspacePaths();
  const SQL = await initSqlJs({ locateFile: () => join(process.cwd(), "dist", "sql-wasm.wasm") });
  const database = new SQL.Database(new Uint8Array(await readFile(paths.db)));
  const malformedRequirement = JSON.stringify({ ...requirement, title: undefined });
  database.exec(
    `UPDATE entities SET payload = '${malformedRequirement.replace(/'/g, "''")}' WHERE id = '${requirement.id.replace(/'/g, "''")}';`
  );
  await writeFile(paths.db, Buffer.from(database.export()));
  database.close();

  const report = await service.runIntegrityScan();

  assert.equal(report.ok, false);
  assert.match(report.findings.map((finding) => finding.message).join("\n"), /missing or invalid title/i);
});

test("Core rejects malformed Requirement titles on single and batch writes", async () => {
  const workspaceRoot = await freshWorkspace("reject-invalid-requirement-titles");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const validRequirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Valid Requirement",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );
  const malformedRequirement = {
    ...validRequirement,
    id: `${validRequirement.id}-invalid`,
    title: undefined
  } as unknown as RequirementEntity;

  await assert.rejects(() => service.upsertEntity(malformedRequirement), /title must be a non-empty string/i);
  await assert.rejects(
    () => service.upsertEntities([validRequirement, malformedRequirement]),
    /title must be a non-empty string/i
  );
  assert.equal(
    (await service.listEntities("requirement")).some((entity) => entity.id === validRequirement.id),
    false
  );
});

test("tag validation permits Assurance finding actions to be tagged", async () => {
  const workspaceRoot = await freshWorkspace("assurance-action-tag-link");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const assessmentTag = withEnvelope(
    "tag",
    {
      entityType: "tag",
      title: "PENTEST-2026-Web",
      label: "PENTEST-2026-Web",
      colour: "teal"
    },
    "workshop"
  );
  const finding = withEnvelope(
    "action",
    {
      entityType: "action",
      title: "[High] Public portal finding",
      status: "todo"
    },
    "workshop"
  );
  const taggedFinding = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${finding.title} tagged with ${assessmentTag.label}`,
      linkType: "tagged-with",
      fromId: finding.id,
      fromType: "action",
      toId: assessmentTag.id,
      toType: "tag"
    },
    "workshop"
  );

  await service.upsertEntities([assessmentTag, finding, taggedFinding]);

  const links = await service.listEntities("link");
  assert.equal(
    links.some((link) => link.id === taggedFinding.id),
    true
  );
});

test("workspace reset returns to a clean cyber reference-data baseline", async () => {
  const workspaceRoot = await freshWorkspace("reset-clean-baseline");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const localRequirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Local requirement removed by reset",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );
  await service.upsertEntity(localRequirement);

  const result = await service.resetWorkspace();
  assert.equal(result.reset, true);
  assert.equal((await stat(join(result.paths.locks, "writer-v2.lock"))).isDirectory(), true);

  const requirements = await service.listEntities("requirement");
  assert.equal(
    requirements.some((requirement) => requirement.id === localRequirement.id),
    false
  );
  assert.equal((await service.listEntities("cyber-function")).length, 4);
  assert.equal((await service.listEntities("mitigation-strategy")).length, 9);
  assert.equal((await service.listEntities("guidance-framework")).length, 6);
  assert.equal((await service.listEntities("control-theme")).length, 2);
  assert.equal((await service.listEntities("cyber-reference-mapping")).length > 0, true);
});

test("dataset diagnostics validate cyber reference mappings and clean reset", async () => {
  const workspaceRoot = await freshWorkspace("dataset-diagnostics");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const report = await service.runDatasetDiagnostics();
  assert.equal(report.ok, true, report.summary);
  assert.equal(report.counts.cyberFunctions, 4);
  assert.equal(report.counts.mitigationStrategies, 9);
  assert.equal(report.counts.guidanceFrameworks, 6);
  assert.equal(report.counts.controlThemes, 2);
  assert.equal(report.counts.brokenMappingEndpoints, 0);
  assert.equal(report.counts.mismatchedCyberLinks, 0);
  assert.equal(report.counts.publicationLeaks, 0);
});

test("dataset diagnostics refresh stale cyber reference records without reset", async () => {
  const workspaceRoot = await freshWorkspace("dataset-diagnostics-refresh-stale-reference-data");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const cyberFunction = (await service.listEntities("cyber-function"))[0];
  assert.ok(cyberFunction);
  await service.upsertEntity({ ...cyberFunction, schemaVersion: "0.0.0", title: "Stale cyber function title" });

  const report = await service.runDatasetDiagnostics();
  const refreshedCyberFunction = (await service.listEntities("cyber-function")).find(
    (entity) => entity.id === cyberFunction.id
  );

  assert.equal(report.ok, true, report.summary);
  assert.equal(report.counts.schemaVersionMismatches, 0);
  assert.equal(refreshedCyberFunction?.schemaVersion, cyberFunction.schemaVersion);
  assert.equal(refreshedCyberFunction?.title, cyberFunction.title);
});

test("additive import does not downgrade existing Core reference data", async () => {
  const workspaceRoot = await freshWorkspace("additive-import-skips-older-core-reference-data");
  const bundlePath = join(workspaceRoot, "older-core-reference-bundle.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const cyberFunction = (await service.listEntities("cyber-function"))[0];
  assert.ok(cyberFunction);
  await writeBundle(bundlePath, {
    "cyber-functions": [{ ...cyberFunction, schemaVersion: "1.5.0", title: "Older public cyber function" }]
  });

  const result = await service.importBundle(bundlePath, "additive-merge");
  const currentCyberFunction = (await service.listEntities("cyber-function")).find(
    (entity) => entity.id === cyberFunction.id
  );

  assert.equal(result.imported, 0);
  assert.equal(result.summary.written, 0);
  assert.equal(result.summary.unchanged, 1);
  assert.equal(currentCyberFunction?.schemaVersion, cyberFunction.schemaVersion);
  assert.equal(currentCyberFunction?.title, cyberFunction.title);
});

test("action writes append due-date history and seed legacy actions from their stored date", async () => {
  const workspaceRoot = await freshWorkspace("action-due-date-history");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const created = (await service.upsertEntity(
    withEnvelope(
      "action",
      { entityType: "action", title: "History fixture", status: "todo", dueDate: "2026-10-01" },
      "workshop"
    )
  )) as ActionEntity;
  assert.deepEqual(
    created.dueDateHistory?.map((entry) => entry.dueDate),
    ["2026-10-01"]
  );

  const unchanged = (await service.upsertEntity({ ...created, title: "Renamed, same date" })) as ActionEntity;
  assert.equal(unchanged.dueDateHistory?.length, 1);

  const moved = (await service.upsertEntity({ ...unchanged, dueDate: "2026-10-15" })) as ActionEntity;
  assert.deepEqual(
    moved.dueDateHistory?.map((entry) => entry.dueDate),
    ["2026-10-01", "2026-10-15"]
  );
  const stored = (await service.listEntities("action")).find((entity) => entity.id === created.id) as ActionEntity;
  assert.equal(stored.dueDateHistory?.length, 2);

  // Legacy honesty: an action persisted before 1.16.0 has a dueDate but no history.
  const legacy = withEnvelope(
    "action",
    { entityType: "action", title: "Legacy fixture", status: "todo", dueDate: "2026-03-01" },
    "workshop"
  );
  const { dueDateHistory: _seeded, ...legacyStored } = (await service.upsertEntity(legacy)) as ActionEntity;
  await writeRawEntityPayload(service.getWorkspacePaths().db, legacyStored);
  const legacyMoved = (await service.upsertEntity({
    ...legacyStored,
    dueDate: "2026-04-01",
    updatedAt: "2026-03-20T00:00:00.000Z"
  })) as ActionEntity;
  assert.deepEqual(
    legacyMoved.dueDateHistory?.map((entry) => entry.dueDate),
    ["2026-03-01", "2026-04-01"]
  );
  assert.equal(legacyMoved.dueDateHistory?.[0]?.changedAt, legacyStored.updatedAt);
});

test("Core history write boundary preserves existing history", async () => {
  const workspaceRoot = await freshWorkspace("history-write-boundary-immutability");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const created = (await service.upsertEntity(
    withEnvelope(
      "action",
      { entityType: "action", title: "History boundary fixture", status: "todo", dueDate: "2026-10-01" },
      "workshop"
    )
  )) as ActionEntity;
  const moved = (await service.upsertEntity({ ...created, dueDate: "2026-10-15" })) as ActionEntity;
  assert.equal(moved.dueDateHistory?.length, 2);

  const ordinaryWrite = (await service.upsertEntity({
    ...moved,
    title: "Renamed without changing the date",
    dueDateHistory: []
  })) as ActionEntity;
  assert.deepEqual(ordinaryWrite.dueDateHistory, moved.dueDateHistory);

  const returnedHistory = ordinaryWrite.dueDateHistory as Array<{ dueDate?: string; changedAt: string }> | undefined;
  returnedHistory?.pop();
  const reread = (await service.listEntities("action")).find((entity) => entity.id === moved.id) as ActionEntity;
  assert.equal(reread.dueDateHistory?.length, 2);
});

test("older-schema additive imports preserve Core-owned history", async () => {
  const workspaceRoot = await freshWorkspace("history-older-schema-import");
  const bundlePath = join(workspaceRoot, "older-schema-action-bundle.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const created = (await service.upsertEntity(
    withEnvelope(
      "action",
      { entityType: "action", title: "Import history fixture", status: "todo", dueDate: "2026-10-01" },
      "workshop"
    )
  )) as ActionEntity;
  const moved = (await service.upsertEntity({ ...created, dueDate: "2026-10-15" })) as ActionEntity;
  const { dueDateHistory: _omitted, ...olderSchemaAction } = moved;
  await writeBundle(bundlePath, {
    actions: [{ ...olderSchemaAction, schemaVersion: "1.15.0", title: "Imported older action" }]
  });

  const result = await service.importBundle(bundlePath, "additive-merge");
  const stored = (await service.listEntities("action")).find((entity) => entity.id === moved.id) as ActionEntity;

  assert.equal(result.summary.written, 1);
  assert.deepEqual(stored.dueDateHistory, moved.dueDateHistory);
  assert.equal(stored.title, "Imported older action");
});

test("narrative writes enforce slot, body, and supersedes rules with a structured diagnostic", async () => {
  const workspaceRoot = await freshWorkspace("narrative-write-rules");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();

  const original = await service.upsertEntity(
    withEnvelope(
      "narrative",
      {
        entityType: "narrative",
        title: "Where we stand",
        slot: narrativeSlotFor("exec-brief.where-we-stand"),
        body: "Posture is steady.",
        audience: "executive"
      },
      "workshop"
    )
  );

  await assert.rejects(
    () =>
      service.upsertEntity(
        withEnvelope(
          "narrative",
          {
            entityType: "narrative",
            title: "Bad supersede",
            slot: narrativeSlotFor("exec-brief.where-we-stand"),
            body: "Replacement text.",
            audience: "executive",
            supersedesId: "NAR-does-not-exist"
          },
          "workshop"
        )
      ),
    (error: unknown) =>
      error instanceof PspfError &&
      error.code === "PSPF_NARRATIVE_RULE_VIOLATION" &&
      /not a known narrative/.test(error.message)
  );
  await assert.rejects(
    () =>
      service.upsertEntities([
        withEnvelope(
          "narrative",
          {
            entityType: "narrative",
            title: "Slot mismatch",
            slot: narrativeSlotFor("exec-brief.what-changed"),
            body: "Replacement text.",
            audience: "executive",
            supersedesId: original.id
          },
          "workshop"
        )
      ]),
    (error: unknown) => error instanceof PspfError && error.code === "PSPF_NARRATIVE_RULE_VIOLATION"
  );

  const replacement = await service.upsertEntity(
    withEnvelope(
      "narrative",
      {
        entityType: "narrative",
        title: "Where we stand (revised)",
        slot: narrativeSlotFor("exec-brief.where-we-stand"),
        body: "Posture improved this period.",
        audience: "executive",
        supersedesId: original.id
      },
      "workshop"
    )
  );
  assert.equal((await service.listEntities("narrative")).length, 2);

  const snapshot = await service.createSnapshot();
  const sideFile = JSON.parse(await readFile(join(paths.snapshots, `${snapshot.id}.json`), "utf8")) as {
    counts: Record<string, number>;
    statusSummary: { narratives?: Record<string, number> };
  };
  assert.equal(sideFile.counts.narratives, 2);
  assert.equal(sideFile.statusSummary.narratives?.executive, 2);

  const exported = await service.exportBundle();
  const bundle = JSON.parse(await readFile(join(exported.exportDirectory, "bundle.json"), "utf8")) as {
    manifest: { collections: { name: string; count: number }[] };
    collections: { narratives: { id: string; body?: string }[] };
  };
  assert.equal(bundle.manifest.collections.find((item) => item.name === "narratives")?.count, 2);
  assert.ok(bundle.collections.narratives.some((item) => item.id === replacement.id));
  assert.equal(
    bundle.collections.narratives.every((item) => item.body === undefined),
    true,
    "narrative body is sensitive and must be redacted from the publication bundle"
  );
});

test("migrateRiskFramework seeds the legacy 5x5 methodology once and is idempotent", async () => {
  const workspaceRoot = await freshWorkspace("risk-migrate-framework");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const framework = await service.migrateRiskFramework();
  assert.equal(framework.entityType, "risk-framework");
  assert.equal(framework.methodologies.length, 1);
  assert.equal(framework.methodologies[0]?.id, "legacy-5x5");

  const again = await service.migrateRiskFramework();
  assert.equal(again.id, framework.id);
  assert.equal(again.updatedAt, framework.updatedAt);
  const frameworks = (await service.listEntities("risk-framework")).filter(
    (entity) => entity.recordStatus !== "deleted"
  );
  assert.equal(frameworks.length, 1);
});

test("Core rejects a second non-deleted risk-framework record and an invalid methodology revision", async () => {
  const workspaceRoot = await freshWorkspace("risk-framework-singleton");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  const framework = await service.migrateRiskFramework();

  const secondFramework = withEnvelope(
    "risk-framework",
    {
      entityType: "risk-framework",
      categories: [],
      methodologies: [],
      appetiteRules: [],
      sourceRegisters: [],
      presentationPresets: []
    },
    "workshop"
  );
  await assert.rejects(() => service.upsertEntity(secondFramework), /only one non-deleted risk-framework/i);

  const invalidRevision = {
    ...framework,
    methodologies: [
      {
        ...framework.methodologies[0]!,
        revisions: [{ ...framework.methodologies[0]!.revisions[0]!, cells: [] }]
      }
    ]
  };
  await assert.rejects(() => service.upsertEntity(invalidRevision), /missing cell/i);
});

test("risk writes derive assessmentState and reject a client-authored risk-event", async () => {
  const workspaceRoot = await freshWorkspace("risk-assessment-state");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const legacyRisk = await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Legacy scored risk", status: "open", likelihood: 4, impact: 4 },
      "workshop"
    )
  );
  assert.equal((legacyRisk as RiskEntity).assessmentState, "legacy");

  const unassessedRisk = await service.upsertEntity(
    withEnvelope(
      "risk",
      {
        entityType: "risk",
        title: "Unassessed risk",
        status: "open",
        likelihood: 1,
        impact: 1,
        assessment: { basis: "unassessed" }
      },
      "workshop"
    )
  );
  assert.equal((unassessedRisk as RiskEntity).assessmentState, "unassessed");

  const forgedEvent = withEnvelope(
    "risk-event",
    {
      entityType: "risk-event",
      riskId: legacyRisk.id,
      kind: "reassessed",
      occurredAt: "2026-09-07T00:00:00.000Z",
      summary: "Forged event"
    },
    "workshop"
  );
  await assert.rejects(
    () => service.upsertEntity(forgedEvent),
    /Core-derived and cannot be created or modified directly/i
  );
});

test("risk writes append reassessed, reclassified, and reparented events; no-op saves add none", async () => {
  const workspaceRoot = await freshWorkspace("risk-event-derivation");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const parentA = await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Enterprise parent A", status: "open", likelihood: 3, impact: 3 },
      "workshop"
    )
  );
  const parentB = await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Enterprise parent B", status: "open", likelihood: 3, impact: 3 },
      "workshop"
    )
  );
  const child = (await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Child risk", status: "open", likelihood: 2, impact: 2 },
      "workshop"
    )
  )) as RiskEntity;

  await service.upsertEntity(child);
  assert.equal((await service.listEntities("risk-event")).length, 0, "no-op save must not emit a risk-event");

  await service.upsertEntity({ ...child, likelihood: 5, impact: 5 });
  let events = (await service.listEntities("risk-event")) as RiskEventEntity[];
  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "reassessed");
  assert.equal(events[0]?.riskId, child.id);

  await service.upsertEntity({ ...child, likelihood: 5, impact: 5, primaryCategoryId: "cat_technology" });
  events = (await service.listEntities("risk-event")) as RiskEventEntity[];
  assert.equal(events.filter((event) => event.kind === "reclassified").length, 1);

  const rollUpLink = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "Child rolls up to Parent A",
      linkType: "rolls-up-to",
      fromId: child.id,
      fromType: "risk",
      toId: parentA.id,
      toType: "risk"
    },
    "workshop"
  );
  await service.upsertEntity(rollUpLink);
  events = (await service.listEntities("risk-event")) as RiskEventEntity[];
  assert.equal(events.filter((event) => event.kind === "reparented").length, 1);

  await service.upsertEntities([
    { ...rollUpLink, recordStatus: "deleted" },
    withEnvelope(
      "link",
      {
        entityType: "link",
        title: "Child rolls up to Parent B",
        linkType: "rolls-up-to",
        fromId: child.id,
        fromType: "risk",
        toId: parentB.id,
        toType: "risk"
      },
      "workshop"
    )
  ]);
  events = (await service.listEntities("risk-event")) as RiskEventEntity[];
  assert.equal(events.filter((event) => event.kind === "reparented").length, 2);
});

test("rolls-up-to writes reject self-links, more than one parent, and cycles", async () => {
  const workspaceRoot = await freshWorkspace("risk-rollup-validation");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const riskA = await service.upsertEntity(
    withEnvelope("risk", { entityType: "risk", title: "Risk A", status: "open", likelihood: 1, impact: 1 }, "workshop")
  );
  const riskB = await service.upsertEntity(
    withEnvelope("risk", { entityType: "risk", title: "Risk B", status: "open", likelihood: 1, impact: 1 }, "workshop")
  );

  await assert.rejects(
    () =>
      service.upsertEntity(
        withEnvelope(
          "link",
          {
            entityType: "link",
            title: "Self link",
            linkType: "rolls-up-to",
            fromId: riskA.id,
            fromType: "risk",
            toId: riskA.id,
            toType: "risk"
          },
          "workshop"
        )
      ),
    /cannot roll up to itself/i
  );

  const firstParentLink = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "A rolls up to B",
      linkType: "rolls-up-to",
      fromId: riskA.id,
      fromType: "risk",
      toId: riskB.id,
      toType: "risk"
    },
    "workshop"
  );
  await service.upsertEntity(firstParentLink);

  const riskC = await service.upsertEntity(
    withEnvelope("risk", { entityType: "risk", title: "Risk C", status: "open", likelihood: 1, impact: 1 }, "workshop")
  );
  await assert.rejects(
    () =>
      service.upsertEntity(
        withEnvelope(
          "link",
          {
            entityType: "link",
            title: "A also rolls up to C",
            linkType: "rolls-up-to",
            fromId: riskA.id,
            fromType: "risk",
            toId: riskC.id,
            toType: "risk"
          },
          "workshop"
        )
      ),
    /at most one rolls-up-to parent/i
  );

  await service.upsertEntity({ ...firstParentLink, recordStatus: "deleted" });
  const bToA = withEnvelope(
    "link",
    {
      entityType: "link",
      title: "B rolls up to A",
      linkType: "rolls-up-to",
      fromId: riskB.id,
      fromType: "risk",
      toId: riskA.id,
      toType: "risk"
    },
    "workshop"
  );
  await service.upsertEntity(bToA);
  await assert.rejects(
    () =>
      service.upsertEntity(
        withEnvelope(
          "link",
          {
            entityType: "link",
            title: "A rolls up to B again (cycle)",
            linkType: "rolls-up-to",
            fromId: riskA.id,
            fromType: "risk",
            toId: riskB.id,
            toType: "risk"
          },
          "workshop"
        )
      ),
    /cycle/i
  );
});

test("mitigated-by control application anchors must resolve on the owning risk", async () => {
  const workspaceRoot = await freshWorkspace("risk-control-application-anchors");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const risk = await service.upsertEntity(
    withEnvelope(
      "risk",
      {
        entityType: "risk",
        title: "Risk with causes",
        status: "open",
        likelihood: 3,
        impact: 3,
        causes: [{ id: "cause_1", label: "Weak MFA" }]
      },
      "workshop"
    )
  );
  const control = await service.upsertEntity(
    withEnvelope(
      "risk-control",
      {
        entityType: "risk-control",
        title: "MFA enforcement",
        definition: "Enforce MFA for privileged access.",
        ownerTeam: "Identity",
        state: "active"
      },
      "workshop"
    )
  );

  await assert.rejects(
    () =>
      service.upsertEntity(
        withEnvelope(
          "link",
          {
            entityType: "link",
            title: "Risk mitigated by MFA control",
            linkType: "mitigated-by",
            fromId: risk.id,
            fromType: "risk",
            toId: control.id,
            toType: "risk-control",
            application: {
              role: "preventive",
              applicability: "All accounts",
              effectiveness: "effective",
              anchorIds: ["cause_unknown"]
            }
          },
          "workshop"
        )
      ),
    /unknown anchors/i
  );

  const validLink = await service.upsertEntity(
    withEnvelope(
      "link",
      {
        entityType: "link",
        title: "Risk mitigated by MFA control",
        linkType: "mitigated-by",
        fromId: risk.id,
        fromType: "risk",
        toId: control.id,
        toType: "risk-control",
        application: {
          role: "preventive",
          applicability: "All accounts",
          effectiveness: "effective",
          anchorIds: ["cause_1"]
        }
      },
      "workshop"
    )
  );
  assert.equal((validLink as LinkEntity).application?.anchorIds[0], "cause_1");
});

test("publication preflight blocks export when a Risk is unassessed and when a rolls-up-to link exists", async () => {
  const workspaceRoot = await freshWorkspace("risk-publication-preflight");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const legacyRisk = await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Publishable legacy risk", status: "open", likelihood: 2, impact: 2 },
      "workshop"
    )
  );
  await service.exportBundle();

  const unassessedRisk = await service.upsertEntity(
    withEnvelope(
      "risk",
      {
        entityType: "risk",
        title: "Unassessed risk",
        status: "open",
        likelihood: 1,
        impact: 1,
        assessment: { basis: "unassessed" }
      },
      "workshop"
    )
  );
  await assert.rejects(() => service.exportBundle(), /Export blocked/i);
  await assert.rejects(() => service.exportTeamShareBundle(), /Export blocked/i);

  await service.upsertEntity({ ...unassessedRisk, recordStatus: "deleted" });
  await service.exportBundle();

  const secondRisk = await service.upsertEntity(
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Second risk", status: "open", likelihood: 1, impact: 1 },
      "workshop"
    )
  );
  await service.upsertEntity(
    withEnvelope(
      "link",
      {
        entityType: "link",
        title: "Second rolls up to legacy",
        linkType: "rolls-up-to",
        fromId: secondRisk.id,
        fromType: "risk",
        toId: legacyRisk.id,
        toType: "risk"
      },
      "workshop"
    )
  );
  await assert.rejects(() => service.exportBundle(), /Export blocked/i);
});

test("additive-merge import preserves sensitive Risk fields omitted by a sanitised bundle", async () => {
  const workspaceRoot = await freshWorkspace("risk-additive-merge-preserve");
  const bundlePath = join(workspaceRoot, "sanitised-risk-bundle.json");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();

  const risk = (await service.upsertEntity(
    withEnvelope(
      "risk",
      {
        entityType: "risk",
        title: "Risk with sensitive local fields",
        status: "open",
        likelihood: 3,
        impact: 3,
        reference: "RISK-LOCAL-001",
        ownerTeam: "Identity and Access",
        description: "Local sensitive description"
      },
      "workshop"
    )
  )) as RiskEntity;

  const sanitisedIncoming = {
    id: risk.id,
    entityType: risk.entityType,
    schemaVersion: risk.schemaVersion,
    title: risk.title,
    createdAt: risk.createdAt,
    updatedAt: "2026-09-08T00:00:00.000Z",
    sourceProduct: risk.sourceProduct,
    recordStatus: risk.recordStatus,
    status: "monitored",
    likelihood: risk.likelihood,
    impact: risk.impact
  };
  await writeBundle(bundlePath, { risks: [sanitisedIncoming] });

  await service.importBundle(bundlePath, "additive-merge");
  const merged = (await service.listEntities("risk")).find((entity) => entity.id === risk.id) as
    | { status?: string; reference?: string; ownerTeam?: string; description?: string }
    | undefined;
  assert.equal(merged?.status, "monitored");
  assert.equal(merged?.reference, "RISK-LOCAL-001");
  assert.equal(merged?.ownerTeam, "Identity and Access");
  assert.equal(merged?.description, "Local sensitive description");
});

test("cold restore preserves risk framework, risk fields, and risk-event history (D7.1)", async () => {
  const workspaceRoot = await freshWorkspace("risk-cold-restore-source");
  const restoredWorkspaceRoot = await freshWorkspace("risk-cold-restore-target");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();

  const framework = await service.migrateRiskFramework();
  const risk = (await service.upsertEntity(
    withEnvelope(
      "risk",
      {
        entityType: "risk",
        title: "Cold restore risk",
        status: "open",
        likelihood: 3,
        impact: 4,
        reference: "RISK-COLD-001",
        ownerTeam: "Identity",
        causes: [{ id: "cause_1", label: "Weak controls" }],
        assessment: { basis: "legacy", likelihood: 3, impact: 4, rationale: "Initial assessment" }
      },
      "workshop"
    )
  )) as RiskEntity;
  await service.upsertEntity({
    ...risk,
    assessment: { basis: "legacy", likelihood: 5, impact: 5, rationale: "Reassessed" }
  });
  const control = await service.upsertEntity(
    withEnvelope(
      "risk-control",
      {
        entityType: "risk-control",
        title: "Cold restore control",
        definition: "Definition",
        ownerTeam: "Identity",
        state: "active"
      },
      "workshop"
    )
  );
  const escalation = await service.recordRiskEscalation(risk.id, {
    state: "proposed",
    governanceLabel: "Risk Committee",
    reason: "Needs enterprise visibility"
  });

  const beforeEntities = await service.listEntities();
  const beforeRisk = beforeEntities.find((entity) => entity.id === risk.id) as RiskEntity;
  await service.releaseWriterLock();
  await rm(join(restoredWorkspaceRoot, ".pspf"), { recursive: true, force: true });
  await cp(paths.pspf, join(restoredWorkspaceRoot, ".pspf"), { recursive: true });

  const restored = createCoreService(restoredWorkspaceRoot);
  const integrity = await restored.verifyIntegrity();
  assert.equal(integrity.ok, true, integrity.detail);

  const afterEntities = await restored.listEntities();
  // Scope equality to the Risk-specific records this test wrote; unrelated baseline
  // reference-data records may be re-stamped by the routine reference-data refresh on open.
  assert.equal(afterEntities.length, beforeEntities.length);
  const afterRisk = afterEntities.find((entity) => entity.id === risk.id) as RiskEntity;
  assert.deepEqual(afterRisk, beforeRisk);
  assert.equal(
    afterEntities.some((entity) => entity.id === framework.id),
    true
  );
  assert.equal(
    afterEntities.some((entity) => entity.id === control.id),
    true
  );
  const afterEscalation = afterEntities.find((entity) => entity.id === escalation.id);
  assert.deepEqual(afterEscalation, escalation);
  const afterFramework = afterEntities.find((entity) => entity.id === framework.id);
  assert.deepEqual(afterFramework, framework);

  await restored.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Restored workspace write-lock check",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "in-progress"
      },
      "workshop"
    )
  );
  await restored.releaseWriterLock();
});

async function ensureSourceRegister(
  service: ReturnType<typeof createCoreService>,
  registerId: string,
  label: string
): Promise<RiskFrameworkEntity> {
  const framework = await service.migrateRiskFramework();
  if (framework.sourceRegisters.some((register) => register.id === registerId)) {
    return framework;
  }
  return (await service.upsertEntity({
    ...framework,
    sourceRegisters: [...framework.sourceRegisters, { id: registerId, label }]
  })) as RiskFrameworkEntity;
}

test("commitRiskCrosswalk creates, then updates, then reuses (idempotent reimport, D5.4/D6.4)", async () => {
  const workspaceRoot = await freshWorkspace("risk-crosswalk-idempotent");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  await ensureSourceRegister(service, "reg-a", "Register A");

  const row: RiskCrosswalkRowInput = {
    rowNumber: 2,
    title: "Vendor outage risk",
    externalId: "EXT-1",
    externalRating: "High",
    sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
    referenceUrl: "https://source.example.test/risks/1"
  };

  const first = await service.commitRiskCrosswalk("reg-a", [row]);
  assert.equal(first.created, 1);
  assert.equal(first.updated, 0);
  assert.ok(first.importId);

  const afterFirst = await service.listEntities();
  const created = afterFirst.find(
    (entity): entity is RiskEntity =>
      entity.entityType === "risk" && (entity.externalRefs ?? []).some((ref) => ref.externalId === "EXT-1")
  );
  assert.ok(created);
  assert.equal(created!.title, "Vendor outage risk");
  assert.equal(created!.assessment?.basis, "unassessed");
  assert.equal(created!.likelihood, 1);
  assert.equal(created!.impact, 1);
  const entityCountAfterFirst = afterFirst.length;
  const eventCountAfterFirst = afterFirst.filter((entity) => entity.entityType === "risk-event").length;
  // A brand-new Risk emits no risk-event, matching reassessed/reclassified precedent (no prior state to diff).
  assert.equal(eventCountAfterFirst, 0);

  // Reimporting the identical row must change nothing at all (D5.4/D6.4 idempotency).
  const second = await service.commitRiskCrosswalk("reg-a", [row]);
  assert.equal(second.created, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.reused, 1);
  assert.equal(second.importId, undefined, "an unchanged reimport performs no write and leaves no import id");
  const afterSecond = await service.listEntities();
  assert.equal(afterSecond.length, entityCountAfterFirst, "second identical import writes nothing");
  assert.equal(
    afterSecond.filter((entity) => entity.entityType === "risk-event").length,
    eventCountAfterFirst,
    "second identical import derives no events"
  );

  // A genuine source-side change reconciles the existing Risk's externalRef only; local fields untouched.
  const changedRow: RiskCrosswalkRowInput = { ...row, externalRating: "Extreme" };
  const third = await service.commitRiskCrosswalk("reg-a", [changedRow]);
  assert.equal(third.created, 0);
  assert.equal(third.updated, 1);
  assert.ok(third.importId);
  const afterThird = await service.listEntities();
  const updated = afterThird.find((entity) => entity.id === created!.id) as RiskEntity;
  assert.equal(updated.title, "Vendor outage risk", "local title is unaffected by reconciliation");
  assert.equal(updated.externalRefs?.find((ref) => ref.externalId === "EXT-1")?.externalRating, "Extreme");
  const reconciledEvents = afterThird.filter(
    (entity): entity is RiskEventEntity => entity.entityType === "risk-event" && entity.kind === "reconciled"
  );
  assert.equal(reconciledEvents.length, 1);
  assert.equal(reconciledEvents[0]?.riskId, created!.id);
});

test("commitRiskCrosswalk rejects a dangling source-register reference and writes nothing", async () => {
  const workspaceRoot = await freshWorkspace("risk-crosswalk-dangling-register");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  await service.migrateRiskFramework();
  const before = await service.listEntities();

  const row: RiskCrosswalkRowInput = {
    rowNumber: 2,
    title: "Row against an undefined register",
    externalId: "EXT-9",
    externalRating: "High",
    sourceUpdatedAt: "2026-08-01T00:00:00.000Z"
  };
  await assert.rejects(() => service.commitRiskCrosswalk("unknown-register", [row]), /dangling reference/i);

  const after = await service.listEntities();
  assert.equal(after.length, before.length, "a rejected commit writes nothing");
});

test("commitRiskCrosswalk rolls back every risk in the batch when one insert fails mid-transaction (atomicity)", async () => {
  const workspaceRoot = await freshWorkspace("risk-crosswalk-atomicity");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
  await ensureSourceRegister(service, "reg-a", "Register A");

  const rows: RiskCrosswalkRowInput[] = [
    {
      rowNumber: 2,
      title: "Atomicity risk one",
      externalId: "EXT-B1",
      externalRating: "High",
      sourceUpdatedAt: "2026-08-01T00:00:00.000Z"
    },
    {
      rowNumber: 3,
      title: "Atomicity risk two",
      externalId: "EXT-B2",
      externalRating: "High",
      sourceUpdatedAt: "2026-08-01T00:00:00.000Z"
    }
  ];
  const beforeEntities = await service.listEntities();

  const SQL = await initSqlJs({ locateFile: () => join(process.cwd(), "dist", "sql-wasm.wasm") });
  const database = new SQL.Database(new Uint8Array(await readFile(paths.db)));
  database.exec(
    `CREATE TRIGGER reject_second_crosswalk_risk BEFORE INSERT ON entities WHEN NEW.entity_type = 'risk' AND NEW.payload LIKE '%Atomicity risk two%' BEGIN SELECT RAISE(ABORT, 'forced crosswalk failure'); END;`
  );
  await writeFile(paths.db, Buffer.from(database.export()));
  database.close();

  await assert.rejects(() => service.commitRiskCrosswalk("reg-a", rows), /forced crosswalk failure/i);

  const afterEntities = await service.listEntities();
  assert.equal(afterEntities.length, beforeEntities.length, "no risk from the failed batch should persist");
  assert.equal(
    afterEntities.some(
      (entity) => entity.entityType === "risk" && (entity as RiskEntity).title.startsWith("Atomicity risk")
    ),
    false,
    "neither the risk before the trigger nor the risk that triggered it should be committed"
  );
  assert.equal(
    afterEntities.some((entity) => entity.entityType === "risk-event"),
    false
  );
});

test("Risk write-rule validation rejects an invalid or duplicate manual externalRefs entry", async () => {
  const workspaceRoot = await freshWorkspace("risk-external-ref-validation");
  const service = createCoreService(workspaceRoot);
  await service.initialiseWorkspace();
  await ensureSourceRegister(service, "reg-a", "Register A");

  const validRef = {
    sourceRegisterId: "reg-a",
    externalId: "EXT-1",
    externalRating: "High",
    sourceUpdatedAt: "2026-08-01T00:00:00.000Z",
    referenceUrl: "https://source.example.test/risks/1",
    reconciledAt: "2026-08-02T00:00:00.000Z"
  };
  const riskA = await service.upsertEntity(
    withEnvelope(
      "risk",
      {
        entityType: "risk",
        title: "Manually reconciled risk",
        status: "open",
        likelihood: 3,
        impact: 3,
        externalRefs: [validRef]
      },
      "workshop"
    )
  );
  assert.deepEqual((riskA as RiskEntity).externalRefs, [validRef]);

  const riskWithBadUrl = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Bad reference URL",
      status: "open",
      likelihood: 3,
      impact: 3,
      externalRefs: [{ ...validRef, externalId: "EXT-2", referenceUrl: "http://insecure.example.test/1" }]
    },
    "workshop"
  );
  await assert.rejects(() => service.upsertEntity(riskWithBadUrl), /https:/i);

  const riskWithUnknownRegister = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Unknown register",
      status: "open",
      likelihood: 3,
      impact: 3,
      externalRefs: [{ ...validRef, sourceRegisterId: "not-defined", externalId: "EXT-3" }]
    },
    "workshop"
  );
  await assert.rejects(() => service.upsertEntity(riskWithUnknownRegister), /dangling reference/i);

  const riskWithDuplicateIdentity = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Duplicate identity",
      status: "open",
      likelihood: 3,
      impact: 3,
      externalRefs: [validRef]
    },
    "workshop"
  );
  await assert.rejects(() => service.upsertEntity(riskWithDuplicateIdentity), /claimed by more than one risk/i);
  void riskA;
});

test("a same-major legacy workspace opens under the current axes and is moved forward on first write", async () => {
  const workspaceRoot = await freshWorkspace("legacy-schema-version-workspace");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
  await writeMetadataSchemaVersion(paths.db, "1.15.0");
  await writeFile(
    join(paths.config, "workspace.json"),
    JSON.stringify({ createdAt: "2026-08-01T00:00:00.000Z", versions: { ...VERSION_AXES, schemaVersion: "1.15.0" } }),
    "utf8"
  );

  const requirement = await service.upsertEntity(
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "Written by newer Core",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "in-progress"
      },
      "workshop"
    )
  );
  assert.equal(
    (await service.listEntities("requirement")).some((entity) => entity.id === requirement.id),
    true
  );
  assert.equal(await readMetadataSchemaVersion(paths.db), VERSION_AXES.schemaVersion);
  const workspaceJson = JSON.parse(await readFile(join(paths.config, "workspace.json"), "utf8")) as {
    createdAt: string;
    versions: { schemaVersion: string };
  };
  assert.equal(workspaceJson.versions.schemaVersion, VERSION_AXES.schemaVersion);
  assert.equal(workspaceJson.createdAt, "2026-08-01T00:00:00.000Z");

  await writeMetadataSchemaVersion(paths.db, "0.9.0");
  await assert.rejects(
    () => service.upsertEntity(requirement),
    (error: unknown) => error instanceof PspfError && error.code === "PSPF_MIGRATION_REQUIRED"
  );
});

test("mutating operations require an initialised workspace", async () => {
  const workspaceRoot = await freshWorkspace("mutating-requires-initialised-workspace");
  const service = createCoreService(workspaceRoot);
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Workspace initialisation required",
      domainId: PSPF_DOMAINS[0]!.id,
      assessmentStatus: "in-progress"
    },
    "workshop"
  );

  await assert.rejects(() => service.upsertEntity(requirement), /workspace is not initialised/i);
});

async function freshWorkspace(name: string): Promise<string> {
  const workspaceRoot = join(testRoot, name);
  await rm(workspaceRoot, { recursive: true, force: true });
  await mkdir(workspaceRoot, { recursive: true });
  return workspaceRoot;
}

async function withRawDatabase(dbPath: string, statement: string): Promise<string | undefined> {
  const SQL = await initSqlJs({ locateFile: () => join(process.cwd(), "dist", "sql-wasm.wasm") });
  const database = new SQL.Database(new Uint8Array(await readFile(dbPath)));
  try {
    const rows = database.exec(statement);
    const value = rows[0]?.values[0]?.[0];
    await writeFile(dbPath, Buffer.from(database.export()));
    return value === undefined || value === null ? undefined : String(value);
  } finally {
    database.close();
  }
}

async function writeRawEntityPayload(dbPath: string, entity: { readonly id: string }): Promise<void> {
  const payload = JSON.stringify(entity).replace(/'/g, "''");
  await withRawDatabase(
    dbPath,
    `UPDATE entities SET payload = '${payload}' WHERE id = '${entity.id.replace(/'/g, "''")}';`
  );
}

async function writeMetadataSchemaVersion(dbPath: string, schemaVersion: string): Promise<void> {
  await withRawDatabase(dbPath, `UPDATE metadata SET value = '${schemaVersion}' WHERE key = 'schemaVersion';`);
}

async function readMetadataSchemaVersion(dbPath: string): Promise<string | undefined> {
  return withRawDatabase(dbPath, "SELECT value FROM metadata WHERE key = 'schemaVersion';");
}

async function writeBundle(
  path: string,
  collections: Record<string, readonly unknown[]>,
  options: {
    readonly mode?: "publication" | "local-authoring";
    readonly hashOverrides?: Readonly<Record<string, string>>;
    readonly countOverrides?: Readonly<Record<string, number>>;
    readonly complete?: boolean;
  } = {}
): Promise<void> {
  const bundleCollections = options.complete
    ? Object.fromEntries(V0_1_COLLECTIONS.map((name) => [name, collections[name] ?? []]))
    : collections;
  const manifestCollections = Object.entries(bundleCollections).map(([name, records]) => {
    const serialised = `${JSON.stringify(records, null, 2)}\n`;
    const hash = options.hashOverrides?.[name] ?? createHash("sha256").update(serialised).digest("hex");
    return {
      name,
      path: `./collections/${name}.json`,
      count: options.countOverrides?.[name] ?? records.length,
      hash: { alg: "SHA-256", value: hash }
    };
  });
  const manifest = {
    bundleType: "pspf-explorer-bundle",
    bundleVersion: VERSION_AXES.bundleVersion,
    schemaVersion: VERSION_AXES.schemaVersion,
    apiVersion: VERSION_AXES.apiVersion,
    generatedAt: "2026-06-10T00:00:00.000Z",
    generator: { product: "pspf-core", mode: options.mode ?? "publication", productVersion: PSPF_SLICE_VERSION },
    collections: manifestCollections
  };
  await writeFile(path, `${JSON.stringify({ manifest, collections: bundleCollections }, null, 2)}\n`, "utf8");
}

async function writeLockState(
  paths: { readonly locks: string },
  value: {
    readonly holderPid: number;
    readonly acquiredAt: string;
    readonly policy: "single-writer";
    readonly writable: boolean;
    readonly detail: string;
  }
): Promise<void> {
  await rm(join(paths.locks, "writer-v2.lock"), { recursive: true, force: true });
  await mkdir(join(paths.locks, "writer-v2.lock"), { recursive: false });
  await writeFile(
    join(paths.locks, "writer-lock.json"),
    `${JSON.stringify({ ...value, currentPid: process.pid }, null, 2)}\n`,
    "utf8"
  );
}

async function requirementStatus(
  service: ReturnType<typeof createCoreService>,
  requirementId: string
): Promise<string> {
  const requirement = (await service.listEntities("requirement")).find((entity) => entity.id === requirementId);
  assert.ok(requirement, `Expected ${requirementId} to exist`);
  return (requirement as RequirementEntity).assessmentStatus;
}

function postureFixture(title: string, requirementCount: number) {
  return withEnvelope(
    "posture",
    {
      entityType: "posture",
      title,
      requirementCount,
      evidenceCount: 0,
      actionCount: 0,
      riskCount: 0,
      sourceControlCount: 0,
      requirementControlMappingCount: 0,
      directionCount: 0,
      changeRecordCount: 0,
      supplierCount: 0,
      contractCount: 0,
      spendItemCount: 0,
      strategyCount: 0
    },
    "explorer"
  );
}
