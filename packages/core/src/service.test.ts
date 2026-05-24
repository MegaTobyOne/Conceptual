import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PSPF_DOMAINS, type RequirementEntity, withEnvelope } from "@pspf/contracts";
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
  await writeFile(
    join(paths.locks, "writer-lock.json"),
    `${JSON.stringify(
      {
        holderPid: 1,
        acquiredAt: "2026-05-25T00:00:00.000Z",
        policy: "single-writer",
        writable: false,
        detail: "Simulated second-window writer lock."
      },
      null,
      2
    )}\n`,
    "utf8"
  );

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

async function freshWorkspace(name: string): Promise<string> {
  const workspaceRoot = join(testRoot, name);
  await rm(workspaceRoot, { recursive: true, force: true });
  await mkdir(workspaceRoot, { recursive: true });
  return workspaceRoot;
}

async function writeBundle(path: string, collections: Record<string, readonly unknown[]>): Promise<void> {
  await writeFile(path, `${JSON.stringify({ collections }, null, 2)}\n`, "utf8");
}

async function requirementStatus(
  service: ReturnType<typeof createCoreService>,
  requirementId: string
): Promise<string> {
  const requirement = (await service.listEntities("requirement")).find((entity) => entity.id === requirementId);
  assert.ok(requirement, `Expected ${requirementId} to exist`);
  return (requirement as RequirementEntity).assessmentStatus;
}
