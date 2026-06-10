import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PSPF_DOMAINS, PSPF_SLICE_VERSION, type RequirementEntity, VERSION_AXES, withEnvelope } from "@pspf/contracts";
import { createCoreService } from "./service.js";

const testRoot = join(process.cwd(), ".tmp", "core-service-tests");

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

test("writer lock blocks every mutating Core service entry point", async () => {
  const workspaceRoot = await freshWorkspace("writer-lock-write-surface");
  const service = createCoreService(workspaceRoot);
  const paths = await service.initialiseWorkspace();
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

async function writeBundle(path: string, collections: Record<string, readonly unknown[]>): Promise<void> {
  const manifestCollections = Object.entries(collections).map(([name, records]) => {
    const serialised = `${JSON.stringify(records, null, 2)}\n`;
    return {
      name,
      path: `./collections/${name}.json`,
      count: records.length,
      hash: { alg: "SHA-256", value: createHash("sha256").update(serialised).digest("hex") }
    };
  });
  const manifest = {
    bundleType: "pspf-explorer-bundle",
    bundleVersion: VERSION_AXES.bundleVersion,
    schemaVersion: VERSION_AXES.schemaVersion,
    apiVersion: VERSION_AXES.apiVersion,
    generatedAt: "2026-06-10T00:00:00.000Z",
    generator: { product: "pspf-core-test", mode: "publication", productVersion: PSPF_SLICE_VERSION },
    collections: manifestCollections
  };
  await writeFile(path, `${JSON.stringify({ manifest, collections }, null, 2)}\n`, "utf8");
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
  await rm(join(paths.locks, "writer.lock"), { force: true });
  await writeFile(join(paths.locks, "writer.lock"), `${value.holderPid}\n`, "utf8");
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
