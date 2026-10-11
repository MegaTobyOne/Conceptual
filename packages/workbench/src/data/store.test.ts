import { describe, expect, it } from "vitest";
import { openDB } from "idb";
import type { ActionEntity, LinkEntity, RequirementEntity } from "@pspf/contracts";
import { DB_NAME, DB_VERSION, Store, StoreError } from "./store.ts";
import { buildDossier } from "../domain/dossier.ts";
import { composeBrief, editionMarkdown, redactForPublish } from "../domain/brief.ts";
import { createBackup, parseBackup } from "../domain/backup.ts";
import { parseCapture } from "../domain/parser.ts";
import {
  canonicalJson,
  parseRegisterImport,
  REGISTER_IMPORT_STORE_VERSION,
  REGISTER_IMPORT_TYPE
} from "../domain/register-import.ts";
import { sha256Hex } from "../domain/hash.ts";
import { newId } from "../domain/ids.ts";
import type { Edition, Matter, TrailItem } from "../domain/types.ts";

let n = 0;
const freshStore = () => Store.open(`wb-test-${n++}`);

function newMatter(now: string): Matter {
  return {
    id: newId("matter"),
    title: "Backup restoration risk",
    scope: "Core platform",
    intendedOutcome: "Treatment decision recorded",
    followUpState: "open",
    nextStep: "Await committee",
    refs: [],
    createdAt: now,
    updatedAt: now,
    log: []
  };
}

function trailFrom(matterId: string, text: string, at: string): TrailItem[] {
  return parseCapture(text).map((d) => ({
    id: newId("trail"),
    matterId,
    type: d.type,
    state: d.state,
    ...(d.disposition ? { disposition: d.disposition } : {}),
    value: d.value,
    source: d.source,
    provenance: "parsed" as const,
    recordedAt: at
  }));
}

describe("FL-009 acceptance (synthetic)", () => {
  it("upgrades the v1 database without losing existing records", async () => {
    const name = `wb-upgrade-${n++}`;
    const oldDatabase = await openDB(name, 1, {
      upgrade(database) {
        database.createObjectStore("matters", { keyPath: "id" });
      }
    });
    const matter = newMatter("2026-10-01T00:00:00.000Z");
    await oldDatabase.put("matters", matter);
    oldDatabase.close();

    const upgraded = await Store.open(name);
    expect(await upgraded.getMatter(matter.id)).toEqual(matter);
    upgraded.close();

    const currentDatabase = await openDB(name);
    expect(currentDatabase.version).toBe(DB_VERSION);
    expect(currentDatabase.objectStoreNames.contains("entities")).toBe(true);
    expect(currentDatabase.objectStoreNames.contains("links")).toBe(true);
    expect(currentDatabase.objectStoreNames.contains("changeLog")).toBe(true);
    currentDatabase.close();
    expect(DB_NAME).toBe("pspf-workbench.v1");
  });

  it("saves register entities, typed links, history and restores them from backup", async () => {
    const store = await freshStore();
    const requirement: RequirementEntity = {
      id: "REQ-PSPF-2025-001",
      entityType: "requirement",
      schemaVersion: "1.17.0",
      title: "Document protective security roles",
      domainId: "DOM-governance",
      assessmentStatus: "not-started",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop",
      recordStatus: "active"
    };
    const action: ActionEntity = {
      id: "ACT-00000000-0000-7000-8000-000000000001",
      entityType: "action",
      schemaVersion: "1.17.0",
      title: "Review role assignments",
      status: "todo",
      dueDate: "2026-10-20",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop",
      recordStatus: "active"
    };
    await store.saveRegisterEntity(requirement, "2026-10-01T00:00:00.000Z");
    await store.saveRegisterEntity(action, "2026-10-01T00:00:00.000Z");
    await store.saveLink(
      {
        id: "LNK-00000000-0000-7000-8000-000000000001",
        entityType: "link",
        schemaVersion: "1.17.0",
        linkType: "addressed-by",
        fromId: requirement.id,
        fromType: "requirement",
        toId: action.id,
        toType: "action",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        sourceProduct: "workshop",
        recordStatus: "active"
      } satisfies LinkEntity,
      "2026-10-01T00:00:00.000Z"
    );
    await store.saveRegisterEntity({ ...action, dueDate: "2026-10-27" }, "2026-10-05T00:00:00.000Z");

    const savedAction = (await store.getRegisterEntity(action.id)) as ActionEntity;
    expect(savedAction.dueDateHistory).toHaveLength(2);
    expect(await store.listLinks(requirement.id)).toHaveLength(1);
    const changes = await store.listChangeLog(action.id);
    expect(changes).toHaveLength(2);
    expect(changes[1]?.fieldSet).toContain("dueDate");
    expect(changes[1]?.previousRevisionHash).toMatch(/^[0-9a-f]{64}$/);

    const backup = await parseBackup(await createBackup(await store.exportAll(), "1.78.0"));
    const restored = await freshStore();
    await restored.replaceAll(backup.data);
    expect(await restored.getRegisterEntity(requirement.id)).toEqual(requirement);
    expect(((await restored.getRegisterEntity(action.id)) as ActionEntity).dueDateHistory).toEqual(
      savedAction.dueDateHistory
    );
    expect((await restored.listChangeLog()).length).toBe(4);
  });

  it("imports a register idempotently by ID and updatedAt", async () => {
    const store = await freshStore();
    const base = {
      id: "REQ-PSPF-2025-002",
      entityType: "requirement" as const,
      schemaVersion: "1.17.0",
      title: "Review identity controls",
      domainId: "DOM-governance",
      assessmentStatus: "not-started" as const,
      createdAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop" as const,
      recordStatus: "active" as const
    };
    const buildFile = async (updatedAt: string, title = base.title) => {
      const entity = { ...base, title, updatedAt };
      const payload = {
        type: REGISTER_IMPORT_TYPE,
        storeVersion: REGISTER_IMPORT_STORE_VERSION,
        sourceDatabasePathHash: "b".repeat(64),
        recordCounts: { requirement: 1 },
        newestUpdate: updatedAt,
        entities: [entity],
        links: []
      };
      return parseRegisterImport(JSON.stringify({ ...payload, checksum: await sha256Hex(canonicalJson(payload)) }));
    };

    expect(await store.importRegister(await buildFile("2026-10-01T00:00:00.000Z"))).toEqual({
      created: 1,
      updated: 0,
      unchanged: 0
    });
    expect(await store.importRegister(await buildFile("2026-10-01T00:00:00.000Z"))).toEqual({
      created: 0,
      updated: 0,
      unchanged: 1
    });
    expect(
      await store.importRegister(await buildFile("2026-10-02T00:00:00.000Z", "Revised identity controls"))
    ).toEqual({
      created: 0,
      updated: 1,
      unchanged: 0
    });
    await expect(
      store.importRegister(await buildFile("2026-10-02T00:00:00.000Z", "Conflicting same-time edit"))
    ).rejects.toThrow(/without a newer updatedAt/);
    expect((await store.getRegisterEntity(base.id))?.title).toBe("Revised identity controls");
  });

  it("validates narrative imports against the versions retained by the merge and rolls back on failure", async () => {
    const store = await freshStore();
    const predecessor = {
      id: "NAR-00000000-0000-7000-8000-000000000001",
      entityType: "narrative" as const,
      schemaVersion: "1.17.0",
      title: "Earlier account",
      slot: "exec-brief.where-we-stand",
      body: "The earlier account.",
      audience: "executive" as const,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop" as const,
      recordStatus: "active" as const
    };
    const retained = { ...predecessor, slot: "exec-brief.next-steps", updatedAt: "2026-10-03T00:00:00.000Z" };
    await store.saveRegisterEntity(retained, retained.updatedAt);
    const successor = {
      ...predecessor,
      id: "NAR-00000000-0000-7000-8000-000000000002",
      title: "Revised account",
      body: "The revised account.",
      supersedesId: predecessor.id,
      updatedAt: "2026-10-02T00:00:00.000Z"
    };
    const payload = {
      type: REGISTER_IMPORT_TYPE,
      storeVersion: REGISTER_IMPORT_STORE_VERSION,
      sourceDatabasePathHash: "b".repeat(64),
      recordCounts: { narrative: 2 },
      newestUpdate: successor.updatedAt,
      entities: [predecessor, successor],
      links: []
    };
    const file = await parseRegisterImport(
      JSON.stringify({ ...payload, checksum: await sha256Hex(canonicalJson(payload)) })
    );

    await expect(store.importRegister(file)).rejects.toThrow(/cannot supersede/);
    expect(await store.getRegisterEntity(predecessor.id)).toEqual(retained);
    expect(await store.getRegisterEntity(successor.id)).toBeUndefined();
  });

  it("rejects invalid entity and link envelopes without recording a change", async () => {
    const store = await freshStore();
    const action: ActionEntity = {
      id: "REQ-invalid-action",
      entityType: "action",
      schemaVersion: "1.17.0",
      title: "Invalid action envelope",
      status: "todo",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop",
      recordStatus: "active"
    };
    await expect(store.saveRegisterEntity(action)).rejects.toThrow(/registered ACT prefix/);
    await expect(
      store.saveLink({
        ...action,
        id: "ACT-invalid-link",
        entityType: "link",
        linkType: "addressed-by",
        fromId: "REQ-missing",
        fromType: "requirement",
        toId: action.id,
        toType: "action"
      })
    ).rejects.toThrow(/registered LNK prefix/);
    expect(await store.listRegisterEntities()).toEqual([]);
    expect(await store.listLinks()).toEqual([]);
    expect(await store.listChangeLog()).toEqual([]);
  });

  it("records Risk escalation events append-only", async () => {
    const store = await freshStore();
    const risk = {
      id: "RSK-00000000-0000-7000-8000-000000000001",
      entityType: "risk" as const,
      schemaVersion: "1.17.0",
      title: "Unverified restoration capability",
      status: "open" as const,
      likelihood: 3,
      impact: 4,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop" as const,
      recordStatus: "active" as const
    };
    await store.saveRegisterEntity(risk);
    const event = {
      id: "RSE-00000000-0000-7000-8000-000000000001",
      entityType: "risk-event" as const,
      schemaVersion: "1.17.0",
      riskId: risk.id,
      kind: "escalation" as const,
      occurredAt: "2026-10-03T00:00:00.000Z",
      summary: "Escalation proposed to the committee",
      escalation: { state: "proposed" as const, reason: "Treatment funding remains unassigned." },
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
      sourceProduct: "workshop" as const,
      recordStatus: "active" as const
    };
    await store.recordRiskEscalation(event, event.occurredAt);
    expect(await store.listRegisterEntities("risk-event")).toHaveLength(1);
    await expect(store.saveRegisterEntity(event)).rejects.toThrow(/append-only/);
  });

  it("composes attached saved narrative revisions without rewriting issued editions", async () => {
    const store = await freshStore();
    const first = {
      id: "NAR-00000000-0000-7000-8000-000000000001",
      entityType: "narrative" as const,
      schemaVersion: "1.17.0",
      slot: "exec-brief.what-changed",
      body: "Earlier reviewed account.",
      audience: "executive" as const,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      sourceProduct: "workshop" as const,
      recordStatus: "active" as const
    };
    await store.saveRegisterEntity(first, first.updatedAt);
    const matter = await store.saveMatter({
      ...newMatter(first.createdAt),
      refs: [
        {
          kind: "register-narrative",
          targetId: first.id,
          label: first.slot,
          lastCheckedAt: first.updatedAt
        }
      ]
    });
    const text = composeBrief(buildDossier(matter, [], [], await store.listRegisterEntities()), "ciso");
    const edition: Edition = {
      id: newId("edition"),
      matterId: matter.id,
      profile: "ciso",
      audience: "CISO",
      occasion: "Weekly",
      issuedAt: first.updatedAt,
      text,
      sourceRevisions: [first.id],
      redactionSummary: []
    };
    await store.issueEdition(edition);
    await store.saveRegisterEntity(
      {
        ...first,
        id: "NAR-00000000-0000-7000-8000-000000000002",
        supersedesId: first.id,
        body: "Revised reviewed account.",
        updatedAt: "2026-10-02T00:00:00.000Z"
      },
      "2026-10-02T00:00:00.000Z"
    );
    const dossier = buildDossier(matter, [], await store.listEditions(matter.id), await store.listRegisterEntities());
    const live = composeBrief(dossier, "ciso");
    expect(live).toContain("Revised reviewed account.");
    expect(live).not.toContain("Earlier reviewed account.");
    expect(dossier.warnings).toContain("An attached narrative changed since the last issued edition.");
    expect((await store.listEditions(matter.id))[0]?.text).toBe(text);
  });

  it("keeps a structured person name out of matter text while preserving the role", async () => {
    const store = await freshStore();
    const matter = await store.saveMatter(newMatter("2026-10-01T00:00:00.000Z"));
    const owner: TrailItem = {
      id: newId("trail"),
      matterId: matter.id,
      type: "owner",
      state: "known",
      value: "Security Operations",
      role: "Security Operations",
      personName: "Person Identifier Canary",
      provenance: "typed",
      recordedAt: "2026-10-02T00:00:00.000Z"
    };
    await store.addTrailItems([owner]);
    const dossier = buildDossier(matter, await store.listTrail(matter.id), []);
    const issuedText = redactForPublish(composeBrief(dossier, "ciso"), []).text;
    expect(dossier.positions.find((position) => position.type === "owner")?.item?.value).toBe("Security Operations");
    expect(issuedText).not.toContain("Person Identifier Canary");
    const backup = await parseBackup(await createBackup(await store.exportAll(), "1.78.0"));
    const restored = await freshStore();
    await restored.replaceAll(backup.data);
    expect((await restored.listTrail(matter.id))[0]?.personName).toBe("Person Identifier Canary");
  });

  it("captures, issues, records a more-information disposition and survives backup/restore", async () => {
    const store = await freshStore();
    const matter = await store.saveMatter(newMatter("2026-10-01T00:00:00.000Z"), "2026-10-01T00:00:00.000Z");

    await store.addTrailItems(
      trailFrom(
        matter.id,
        "Ask: Treat restoration risk\nSource: Risk paper\n\nAdvice: Test restores quarterly\nSource: Risk paper\n\nQuestion: Who owns treatment funding?\nSource: DIDC minutes",
        "2026-10-02T00:00:00.000Z"
      )
    );

    let dossier = buildDossier(matter, await store.listTrail(matter.id), []);
    expect(dossier.warnings.join(" ")).toMatch(/advice is not approval/i);
    expect(dossier.positions.find((p) => p.type === "owner")?.unknown).toBe(true);

    const redaction = redactForPublish(composeBrief(dossier, "ciso"), []);
    const edition: Edition = {
      id: newId("edition"),
      matterId: matter.id,
      profile: "ciso",
      audience: "CISO",
      occasion: "Weekly",
      issuedAt: "2026-10-03T00:00:00.000Z",
      text: redaction.text,
      sourceRevisions: [],
      redactionSummary: redaction.summary
    };
    await store.issueEdition(edition);
    const issuedText = editionMarkdown(edition);

    await store.addTrailItems(
      trailFrom(
        matter.id,
        "Decision: More information requested\nDisposition: more-information-requested\nSource: DIDC minutes\n\nAction: Provide PSPF applicability advice",
        "2026-10-05T00:00:00.000Z"
      )
    );
    await store.saveMatter({ ...matter, nextStep: "Provide PSPF applicability advice" }, "2026-10-05T00:00:00.000Z");

    const editions = await store.listEditions(matter.id);
    const current = (await store.getMatter(matter.id))!;
    dossier = buildDossier(
      { ...current, lastReviewedAt: "2026-10-04T00:00:00.000Z" },
      await store.listTrail(matter.id),
      editions
    );

    expect(editionMarkdown(editions[0]!)).toBe(issuedText);
    expect(dossier.sinceIssue.length).toBe(2);
    expect(dossier.sinceReview.length).toBe(2);
    expect(dossier.positions.find((p) => p.type === "decision")?.item?.disposition).toBe("more-information-requested");
    expect(dossier.positions.find((p) => p.type === "owner")?.unknown).toBe(true);
    expect(current.log.some((l) => l.field === "nextStep" && l.previous === "Await committee")).toBe(true);

    const backup = await parseBackup(await createBackup(await store.exportAll(), "1.0.0"));
    const restored = await freshStore();
    await restored.replaceAll(backup.data);
    expect((await restored.getMatter(matter.id))?.nextStep).toBe("Provide PSPF applicability advice");
    expect((await restored.listTrail(matter.id)).length).toBe(5);
    expect((await restored.listEditions(matter.id))[0]?.text).toBe(edition.text);
  });

  it("keeps issued editions immutable and rejects orphan trail items", async () => {
    const store = await freshStore();
    const matter = await store.saveMatter(newMatter("2026-10-01T00:00:00.000Z"));
    const edition: Edition = {
      id: newId("edition"),
      matterId: matter.id,
      profile: "ops",
      audience: "Ops",
      occasion: "x",
      issuedAt: "2026-10-02T00:00:00.000Z",
      text: "a",
      sourceRevisions: [],
      redactionSummary: []
    };
    await store.issueEdition(edition);
    await expect(store.issueEdition({ ...edition, text: "changed" })).rejects.toBeInstanceOf(StoreError);
    await expect(
      store.addTrailItems(trailFrom("MTR-none", "Ask: x", "2026-10-02T00:00:00.000Z"))
    ).rejects.toBeInstanceOf(StoreError);
  });

  it("a failed restore leaves prior records intact and erasure leaves a tombstone", async () => {
    const store = await freshStore();
    const matter = await store.saveMatter(newMatter("2026-10-01T00:00:00.000Z"));
    const bad = {
      matters: [{} as Matter],
      trail: [],
      editions: [],
      drafts: [],
      snapshots: [],
      tombstones: [],
      entities: [],
      links: [],
      changeLog: []
    };
    await expect(store.replaceAll(bad)).rejects.toBeDefined();
    expect(await store.getMatter(matter.id)).toBeDefined();

    await store.eraseMatter(matter.id, "2026-10-06T00:00:00.000Z");
    expect(await store.getMatter(matter.id)).toBeUndefined();
    expect((await store.listTombstones())[0]).toEqual({ id: matter.id, erasedAt: "2026-10-06T00:00:00.000Z" });
  });
});
