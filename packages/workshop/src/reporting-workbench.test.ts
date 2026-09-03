import test from "node:test";
import assert from "node:assert/strict";
import { PSPF_DOMAINS } from "@pspf/contracts";
import {
  REPORTING_DOMAIN_OPTIONS,
  resolveMyDomainIds,
  resolveReportingScope,
  selectReportingAnchor,
  toReportingAnchor
} from "./reporting-workbench.js";

const INFO = PSPF_DOMAINS[2]!.id;
const TECH = PSPF_DOMAINS[3]!.id;

test("reporting domain options carry PSPF family short codes", () => {
  assert.deepEqual(
    REPORTING_DOMAIN_OPTIONS.map((option) => option.family),
    ["GOV", "RISK", "INFO", "TECH", "PER", "PHYS"]
  );
});

test("myDomains setting accepts family codes, entity codes, titles, and ids in any case", () => {
  assert.deepEqual(resolveMyDomainIds(["INFO", "tech"]), [INFO, TECH]);
  assert.deepEqual(resolveMyDomainIds(["information", " Technology "]), [INFO, TECH]);
  assert.deepEqual(resolveMyDomainIds([INFO, "INFO", "unknown", 42, ""]), [INFO]);
});

test("reporting scope defaults to Me when the setting resolves and All otherwise", () => {
  assert.deepEqual(resolveReportingScope(["INFO", "TECH"]), { kind: "me", domainIds: [INFO, TECH] });
  assert.deepEqual(resolveReportingScope([]), { kind: "all", domainIds: [] });
  assert.deepEqual(resolveReportingScope(["bogus"], "me"), { kind: "all", domainIds: [] });
  assert.deepEqual(resolveReportingScope(["INFO"], "all"), { kind: "all", domainIds: [] });
});

test("snapshot side files map to reporting anchors and reject malformed payloads", () => {
  const anchor = toReportingAnchor({
    snapshotId: "SNP-1",
    title: "Checkpoint 1 Sep 2026",
    capturedAt: "2026-09-01T00:00:00.000Z",
    recordStatus: { requirements: { "REQ-1": "met" }, risks: {}, actions: { "ACT-1": "todo" } },
    counts: { requirements: { met: 1 }, risks: {}, actions: { todo: 1 } }
  });
  assert.equal(anchor?.snapshotId, "SNP-1");
  assert.equal(anchor?.recordStatus?.requirements["REQ-1"], "met");
  assert.equal(anchor?.counts?.actions.todo, 1);

  const bare = toReportingAnchor({ snapshotId: "SNP-2", capturedAt: "2026-09-02T00:00:00.000Z", recordStatus: {} });
  assert.equal(bare?.title, "SNP-2");
  assert.equal(bare?.recordStatus, undefined);

  assert.equal(toReportingAnchor({ title: "no id" }), undefined);
  assert.equal(toReportingAnchor(null), undefined);
});

test("anchor selection defaults to the latest snapshot and honours None", () => {
  const anchors = [
    { snapshotId: "SNP-2", title: "Later", capturedAt: "2026-09-02T00:00:00.000Z" },
    { snapshotId: "SNP-1", title: "Earlier", capturedAt: "2026-09-01T00:00:00.000Z" }
  ];
  assert.equal(selectReportingAnchor(anchors, undefined)?.snapshotId, "SNP-2");
  assert.equal(selectReportingAnchor(anchors, "SNP-1")?.snapshotId, "SNP-1");
  assert.equal(selectReportingAnchor(anchors, "missing")?.snapshotId, "SNP-2");
  assert.equal(selectReportingAnchor(anchors, "none"), undefined);
  assert.equal(selectReportingAnchor([], undefined), undefined);
});
