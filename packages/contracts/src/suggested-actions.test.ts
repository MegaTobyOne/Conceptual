import assert from "node:assert/strict";
import test from "node:test";
import type { ActionEntity, LinkEntity, RequirementEntity, RiskEntity } from "./index.js";
import { SUGGESTED_DUE_DAYS, buildSuggestedActions, type SuggestedActionInput } from "./index.js";

const NOW = "2026-09-01T00:00:00.000Z";
const STAMP = "2026-08-01T00:00:00.000Z";
const NO_EXPLAINER: SuggestedActionInput["explainerFor"] = () => undefined;

test("only applicable gap requirements with no open linked action are candidates", () => {
  const result = buildSuggestedActions(
    input({
      requirements: [
        requirement("REQ-1", "Patch systems", "not-met"),
        requirement("REQ-2", "Label information", "met"),
        requirement("REQ-3", "Vet contractors", "not-applicable"),
        requirement("REQ-4", "Review access", "partially-met"),
        requirement("REQ-5", "Restrict privileges", "in-progress"),
        requirement("REQ-6", "Deleted gap", "not-met", { recordStatus: "deleted" }),
        requirement("REQ-7", "Retire platforms", "not-started"),
        requirement("REQ-8", "Assess suppliers", "under-review")
      ],
      actions: [
        action("ACT-1", "Open work", "in-progress"),
        action("ACT-2", "Finished work", "done"),
        action("ACT-3", "Deleted open work", "blocked", { recordStatus: "deleted" })
      ],
      links: [
        link("REQ-4", "addressed-by", "action", "ACT-1"),
        link("REQ-5", "addressed-by", "action", "ACT-2"),
        link("REQ-7", "addressed-by", "action", "ACT-3")
      ]
    })
  );

  assert.deepEqual(
    result.map((item) => item.requirementId),
    ["REQ-1", "REQ-8", "REQ-5", "REQ-7"]
  );
});

test("title comes from the first sentence of the explainer, trimmed to 120 characters", () => {
  const longSentence = `${"Confirm the patching cadence with the platform team and ".repeat(3)}record the outcome`;
  const explainers: Record<string, string> = {
    "REQ-1": "Publish the patching standard. Then confirm coverage with asset owners.",
    "REQ-2": `${longSentence}. Second sentence.`,
    "REQ-3": "   "
  };
  const result = buildSuggestedActions(
    input({
      requirements: [
        requirement("REQ-1", "Patch systems", "not-met"),
        requirement("REQ-2", "Review access", "not-met"),
        requirement("REQ-3", "Blank explainer", "not-met"),
        requirement("REQ-4", "No explainer", "not-met")
      ],
      explainerFor: (id) => (explainers[id] === undefined ? undefined : { whatToDoNext: explainers[id] })
    })
  );
  const byId = new Map(result.map((item) => [item.requirementId, item]));

  assert.equal(byId.get("REQ-1")!.title, "Publish the patching standard.");
  const trimmed = byId.get("REQ-2")!.title;
  assert.ok(trimmed.length <= 120, `expected <= 120 chars, got ${trimmed.length}`);
  assert.ok(trimmed.endsWith("…"));
  assert.equal(byId.get("REQ-3")!.title, "Close the gap for Blank explainer");
  assert.equal(byId.get("REQ-4")!.title, "Close the gap for No explainer");
});

test("impact score counts unclosed linked risks and weights status; explanation states the facts", () => {
  const result = buildSuggestedActions(
    input({
      requirements: [
        requirement("REQ-1", "Patch systems", "not-met", { ownerTeam: "Platform" }),
        requirement("REQ-2", "Review access", "partially-met"),
        requirement("REQ-3", "Retire platforms", "not-started")
      ],
      risks: [
        risk("RSK-1", "Exposed hosts", "open"),
        risk("RSK-2", "Monitored exposure", "monitored"),
        risk("RSK-3", "Closed exposure", "closed")
      ],
      links: [
        link("REQ-1", "exposed-by", "risk", "RSK-1"),
        link("REQ-1", "exposed-by", "risk", "RSK-2"),
        link("REQ-1", "exposed-by", "risk", "RSK-3"),
        link("REQ-2", "exposed-by", "risk", "RSK-1")
      ]
    })
  );
  const [first, second, third] = result;

  assert.equal(first!.requirementId, "REQ-1");
  assert.equal(first!.impactScore, 1 + 2 * 2 + 2);
  assert.equal(first!.ownerTeam, "Platform");
  assert.deepEqual(first!.impactExplanation, [
    "Base score of 1 for a requirement gap with no open action.",
    "Linked to 2 risk(s) not yet closed (+2 each).",
    "Assessment status is not met (+2)."
  ]);
  assert.equal(first!.rationale, "Suggested because Patch systems is not met and has no open action.");
  assert.equal(first!.suggestedDueDate, "2026-10-31");
  assert.equal(SUGGESTED_DUE_DAYS, 60);

  assert.equal(second!.requirementId, "REQ-2");
  assert.equal(second!.impactScore, 1 + 2 + 1);
  assert.equal(second!.ownerTeam, undefined);

  assert.equal(third!.requirementId, "REQ-3");
  assert.equal(third!.impactScore, 1);
  assert.equal(third!.rationale, "Suggested because Retire platforms is not started and has no open action.");
});

test("ordering is impact score descending then requirement title, and limit truncates", () => {
  const base = input({
    requirements: [
      requirement("REQ-1", "zebra gap", "not-met"),
      requirement("REQ-2", "Apple gap", "not-met"),
      requirement("REQ-3", "Mango gap", "partially-met"),
      requirement("REQ-4", "banana gap", "not-started")
    ]
  });

  assert.deepEqual(
    buildSuggestedActions(base).map((item) => item.requirementTitle),
    ["Apple gap", "zebra gap", "Mango gap", "banana gap"]
  );
  assert.deepEqual(
    buildSuggestedActions({ ...base, limit: 2 }).map((item) => item.requirementTitle),
    ["Apple gap", "zebra gap"]
  );
  assert.equal(buildSuggestedActions({ ...base, limit: 0 }).length, 0);
});

test("default limit is 10", () => {
  const requirements = Array.from({ length: 12 }, (_, index) =>
    requirement(`REQ-${index}`, `Gap ${String(index).padStart(2, "0")}`, "not-met")
  );
  assert.equal(buildSuggestedActions(input({ requirements })).length, 10);
});

test("invalid now throws rather than guessing a due date", () => {
  assert.throws(() => buildSuggestedActions(input({ now: "not-a-date" })), /requires an ISO timestamp for now/);
});

test("same input twice produces deep-equal output and does not mutate inputs", () => {
  const source = input({
    requirements: [
      requirement("REQ-1", "Patch systems", "not-met", { ownerTeam: "Platform" }),
      requirement("REQ-2", "Review access", "partially-met")
    ],
    risks: [risk("RSK-1", "Exposed hosts", "open")],
    links: [link("REQ-1", "exposed-by", "risk", "RSK-1")],
    explainerFor: () => ({ whatToDoNext: "Publish the standard. Then confirm.", sectionCode: "7.1" })
  });
  const snapshot = JSON.parse(JSON.stringify(source));

  assert.deepEqual(buildSuggestedActions(source), buildSuggestedActions(source));
  assert.deepEqual(JSON.parse(JSON.stringify(source)), snapshot);
});

// --- Fixtures ------------------------------------------------------------------------------

function input(overrides: Partial<SuggestedActionInput>): SuggestedActionInput {
  return {
    requirements: [],
    actions: [],
    links: [],
    risks: [],
    now: NOW,
    explainerFor: NO_EXPLAINER,
    ...overrides
  };
}

function envelope<T extends string>(entityType: T, id: string) {
  return {
    id,
    entityType,
    schemaVersion: "1.16.0",
    createdAt: STAMP,
    updatedAt: STAMP,
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
}

function requirement(
  id: string,
  title: string,
  assessmentStatus: RequirementEntity["assessmentStatus"],
  extra: Partial<RequirementEntity> = {}
): RequirementEntity {
  return { ...envelope("requirement", id), title, domainId: "DOM-TECH", assessmentStatus, ...extra };
}

function action(
  id: string,
  title: string,
  status: ActionEntity["status"],
  extra: Partial<ActionEntity> = {}
): ActionEntity {
  return { ...envelope("action", id), title, status, ...extra };
}

function risk(id: string, title: string, status: RiskEntity["status"]): RiskEntity {
  return { ...envelope("risk", id), title, status, likelihood: 3, impact: 3 };
}

function link(
  fromId: string,
  linkType: LinkEntity["linkType"],
  toType: LinkEntity["toType"],
  toId: string
): LinkEntity {
  return {
    ...envelope("link", `LNK-${fromId}-${toId}`),
    title: linkType,
    linkType,
    fromId,
    fromType: "requirement",
    toId,
    toType
  };
}
