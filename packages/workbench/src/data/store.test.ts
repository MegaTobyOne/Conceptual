import { describe, expect, it } from "vitest";
import { Store, StoreError } from "./store.ts";
import { buildDossier } from "../domain/dossier.ts";
import { composeBrief, editionMarkdown, redactForPublish } from "../domain/brief.ts";
import { createBackup, parseBackup } from "../domain/backup.ts";
import { parseCapture } from "../domain/parser.ts";
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
    const bad = { matters: [{} as Matter], trail: [], editions: [], drafts: [], snapshots: [], tombstones: [] };
    await expect(store.replaceAll(bad)).rejects.toBeDefined();
    expect(await store.getMatter(matter.id)).toBeDefined();

    await store.eraseMatter(matter.id, "2026-10-06T00:00:00.000Z");
    expect(await store.getMatter(matter.id)).toBeUndefined();
    expect((await store.listTombstones())[0]).toEqual({ id: matter.id, erasedAt: "2026-10-06T00:00:00.000Z" });
  });
});
