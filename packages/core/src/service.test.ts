import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import initSqlJs from "sql.js";
import {
  PSPF_DOMAINS,
  PSPF_SLICE_VERSION,
  type RequirementEntity,
  VERSION_AXES,
  V0_1_COLLECTIONS,
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
