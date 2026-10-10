import { describe, expect, it } from "vitest";
import { newId, stripIdTime, isWorkbenchId } from "./ids.ts";
import { parseCapture } from "./parser.ts";
import { suggestMatches } from "./matching.ts";
import { redactForPublish } from "./brief.ts";
import { backupIsDue, createBackup, parseBackup, BackupError } from "./backup.ts";

describe("ids", () => {
  it("generates prefixed UUIDv7 and strips time bits", () => {
    const id = newId("matter", Date.UTC(2026, 9, 10));
    expect(isWorkbenchId(id)).toBe(true);
    expect(id.startsWith("MTR-")).toBe(true);
    expect(stripIdTime(id)).toMatch(/^MTR-00000000-0000-7/);
  });
});

describe("parseCapture", () => {
  const input = [
    "Ask: Confirm restoration risk treatment",
    "Source: DIDC minutes",
    "",
    "Decision: More information requested",
    "Disposition: more-information-requested",
    "Source: DIDC minutes",
    "",
    "Owner: unknown",
    "",
    "stray line"
  ].join("\n");

  it("types labelled items and keeps excerpts", () => {
    const drafts = parseCapture(input);
    expect(drafts.map((d) => d.type)).toEqual(["ask", "decision", "owner", "note"]);
    expect(drafts[1]?.disposition).toBe("more-information-requested");
    expect(drafts[0]?.source.excerpt).toContain("Source: DIDC minutes");
  });

  it("never infers: unknown stays unknown, strays become a note", () => {
    const drafts = parseCapture(input);
    expect(drafts[2]?.state).toBe("unknown");
    expect(drafts[3]?.warnings[0]).toMatch(/nothing was inferred/);
  });

  it("warns on a decision without source and on an invalid disposition", () => {
    const [d] = parseCapture("Decision: Approved\nDisposition: approved-ish");
    expect(d?.warnings.join(" ")).toMatch(/needs a source/);
    expect(d?.warnings.join(" ")).toMatch(/Unrecognised disposition/);
    expect(d?.disposition).toBeUndefined();
  });
});

describe("suggestMatches", () => {
  const candidates = [
    { id: "R-1", title: "Backup restoration is untested" },
    { id: "R-2", title: "Supplier exit plan" }
  ];
  it("prefers exact IDs, then thresholded overlap, and ignores weak matches", () => {
    expect(suggestMatches("see R-2 please", candidates)[0]?.basis).toBe("exact-id");
    expect(suggestMatches("backup restoration untested", candidates)[0]?.candidate.id).toBe("R-1");
    expect(suggestMatches("backup", candidates)).toEqual([]);
  });
});

describe("redactForPublish", () => {
  it("removes emails and listed names and summarises", () => {
    const r = redactForPublish("Ask Jane Citizen (jane@agency.gov.au) to confirm.", ["Jane Citizen"]);
    expect(r.text).toBe("Ask [person] ([email removed]) to confirm.");
    expect(r.summary).toHaveLength(2);
  });
});

describe("backup", () => {
  const empty = { matters: [], trail: [], editions: [], drafts: [], snapshots: [], tombstones: [] };
  it("round-trips and detects tampering", async () => {
    const text = await createBackup(empty, "1.0.0", "2026-10-10T00:00:00.000Z");
    expect((await parseBackup(text)).summary.counts.matters).toBe(0);
    const tampered = text.replace('"matters": []', '"matters": [{}]');
    await expect(parseBackup(tampered)).rejects.toBeInstanceOf(BackupError);
  });
  it("flags a backup older than seven days", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(backupIsDue(undefined, now)).toBe(true);
    expect(backupIsDue("2026-10-15T00:00:00Z", now)).toBe(false);
    expect(backupIsDue("2026-10-01T00:00:00Z", now)).toBe(true);
  });
});
