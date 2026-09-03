import test from "node:test";
import assert from "node:assert/strict";
import type { ActionEntity, LinkEntity, RequirementEntity, RiskEntity, V01Entity } from "@pspf/contracts";
import { buildAcceptedActionDrafts, buildWorkbenchSuggestions } from "./reporting-suggestions.js";

const NOW = "2026-09-03T00:00:00.000Z";
const envelope = {
  schemaVersion: "1.16.0",
  createdAt: NOW,
  updatedAt: NOW,
  sourceProduct: "workshop",
  recordStatus: "active"
} as const;

function requirement(overrides: Partial<RequirementEntity> & { readonly id: string }): RequirementEntity {
  return {
    ...envelope,
    entityType: "requirement",
    title: `Requirement ${overrides.id}`,
    domainId: "DOM-INFO",
    assessmentStatus: "not-met",
    ...overrides
  };
}

function action(overrides: Partial<ActionEntity> & { readonly id: string }): ActionEntity {
  return { ...envelope, entityType: "action", title: `Action ${overrides.id}`, status: "todo", ...overrides };
}

function risk(overrides: Partial<RiskEntity> & { readonly id: string }): RiskEntity {
  return {
    ...envelope,
    entityType: "risk",
    title: `Risk ${overrides.id}`,
    status: "open",
    likelihood: 3,
    impact: 3,
    ...overrides
  };
}

function link(fromId: string, toId: string, toType: "action" | "risk"): LinkEntity {
  return {
    ...envelope,
    entityType: "link",
    id: `LNK-${fromId}-${toId}`,
    title: `${fromId} → ${toId}`,
    linkType: toType === "action" ? "addressed-by" : "exposed-by",
    fromId,
    fromType: "requirement",
    toId,
    toType
  };
}

const stubExplainer = (requirementId: string) =>
  requirementId === "REQ-1" ? { whatToDoNext: "Confirm the CISO appointment is recorded. Then file it." } : undefined;

test("buildWorkbenchSuggestions ranks scoped gaps and uses the explainer for titles", () => {
  const entities: V01Entity[] = [
    requirement({ id: "REQ-1", title: "Appoint a CISO", ownerTeam: "Security" }),
    requirement({ id: "REQ-2", title: "Classify information", assessmentStatus: "partially-met" }),
    requirement({ id: "REQ-3", title: "Met already", assessmentStatus: "met" }),
    requirement({ id: "REQ-4", title: "Other domain", domainId: "DOM-TECH" }),
    risk({ id: "RSK-1" }),
    link("REQ-2", "RSK-1", "risk")
  ];
  const all = buildWorkbenchSuggestions(entities, { kind: "all", domainIds: [] }, NOW, stubExplainer);
  assert.deepEqual(
    all.map((item) => item.requirementId),
    ["REQ-2", "REQ-1", "REQ-4"]
  );
  assert.equal(all[0]?.impactScore, 4);
  assert.equal(all[1]?.title, "Confirm the CISO appointment is recorded.");
  assert.equal(all[1]?.ownerTeam, "Security");
  assert.equal(all[2]?.title, "Close the gap for Other domain");
  assert.equal(all[0]?.suggestedDueDate, "2026-11-02");

  const me = buildWorkbenchSuggestions(entities, { kind: "me", domainIds: ["DOM-INFO"] }, NOW, stubExplainer);
  assert.deepEqual(
    me.map((item) => item.requirementId),
    ["REQ-2", "REQ-1"]
  );
});

test("buildWorkbenchSuggestions is empty when every gap already has an open action", () => {
  const entities: V01Entity[] = [
    requirement({ id: "REQ-1" }),
    requirement({ id: "REQ-2", assessmentStatus: "partially-met" }),
    action({ id: "ACT-1", status: "in-progress" }),
    action({ id: "ACT-2", status: "blocked" }),
    link("REQ-1", "ACT-1", "action"),
    link("REQ-2", "ACT-2", "action")
  ];
  assert.deepEqual(buildWorkbenchSuggestions(entities, { kind: "all", domainIds: [] }, NOW, stubExplainer), []);

  const closedOnly = [
    ...entities.slice(0, 2),
    action({ id: "ACT-1", status: "done" }),
    link("REQ-1", "ACT-1", "action")
  ];
  assert.equal(buildWorkbenchSuggestions(closedOnly, { kind: "all", domainIds: [] }, NOW, stubExplainer).length, 2);
});

test("buildWorkbenchSuggestions falls back to the reference-data explainer", () => {
  const entities: V01Entity[] = [requirement({ id: "REQ-CUSTOM-1", title: "Custom requirement" })];
  const [suggestion] = buildWorkbenchSuggestions(entities, { kind: "all", domainIds: [] }, NOW);
  assert.equal(suggestion?.title, "Record your own rationale for this requirement's current state.");
});

test("buildAcceptedActionDrafts creates one todo Action and addressed-by link per selected suggestion", () => {
  const entities: V01Entity[] = [
    requirement({ id: "REQ-1", title: "Appoint a CISO", ownerTeam: "Security" }),
    requirement({ id: "REQ-2", title: "Classify information" })
  ];
  const suggestions = buildWorkbenchSuggestions(entities, { kind: "all", domainIds: [] }, NOW, stubExplainer);
  const drafts = buildAcceptedActionDrafts(suggestions, ["REQ-1", "REQ-1", "REQ-UNKNOWN"], NOW);
  assert.equal(drafts.length, 1);
  const [draft] = drafts;
  assert.ok(draft);
  assert.equal(draft.action.entityType, "action");
  assert.equal(draft.action.title, "Confirm the CISO appointment is recorded.");
  assert.equal(draft.action.status, "todo");
  assert.equal(draft.action.dueDate, "2 Nov 2026");
  assert.equal(draft.action.ownerTeam, "Security");
  assert.deepEqual(draft.action.commentary, [
    { createdAt: NOW, text: "Suggested because Appoint a CISO is not met and has no open action." }
  ]);
  assert.equal(draft.action.sourceProduct, "workshop");
  assert.equal(draft.link.linkType, "addressed-by");
  assert.equal(draft.link.fromId, "REQ-1");
  assert.equal(draft.link.fromType, "requirement");
  assert.equal(draft.link.toId, draft.action.id);
  assert.equal(draft.link.toType, "action");
  assert.equal(draft.link.title, "Appoint a CISO addressed by Confirm the CISO appointment is recorded.");

  const unowned = buildAcceptedActionDrafts(suggestions, ["REQ-2"], NOW);
  assert.equal("ownerTeam" in (unowned[0]?.action ?? {}), false);
  assert.deepEqual(buildAcceptedActionDrafts(suggestions, [], NOW), []);
});
