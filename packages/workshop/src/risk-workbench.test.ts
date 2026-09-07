import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_5X5_METHODOLOGY,
  withEnvelope,
  type ActionEntity,
  type LinkEntity,
  type RiskCategoryNode,
  type RiskControlApplication,
  type RiskControlEntity,
  type RiskEntity,
  type RiskFrameworkEntity
} from "@pspf/contracts";
import {
  buildRiskHierarchyForest,
  buildRiskBowTieModel,
  buildRiskCoverageRows,
  buildRiskControlApplications,
  buildRiskMatrixModel,
  buildRiskRegisterRows,
  buildRiskTreatmentActions,
  candidateActionsForTreatment,
  candidateControlsForMitigation,
  candidateParentRisks,
  descendantRiskIds,
  findPrimaryParentId,
  parseCategoryOutline,
  renderCategoryOutline,
  riskCategoryOptions,
  riskCategoryPath
} from "./risk-workbench.js";

const NOW = "2026-09-07T00:00:00.000Z";

function risk(id: string, title: string, overrides: Partial<RiskEntity> = {}): RiskEntity {
  return withEnvelope(
    "risk",
    { entityType: "risk", title, status: "open", likelihood: 3, impact: 3, ...overrides },
    "workshop"
  ) as RiskEntity;
}

function rollsUpLink(fromId: string, toId: string): LinkEntity {
  return withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${fromId} rolls up to ${toId}`,
      linkType: "rolls-up-to",
      fromId,
      fromType: "risk",
      toId,
      toType: "risk"
    },
    "workshop"
  ) as LinkEntity;
}

function action(title: string, overrides: Partial<ActionEntity> = {}): ActionEntity {
  return withEnvelope(
    "action",
    { entityType: "action", title, status: "todo", ...overrides },
    "workshop"
  ) as ActionEntity;
}

function riskControl(title: string, overrides: Partial<RiskControlEntity> = {}): RiskControlEntity {
  return withEnvelope(
    "risk-control",
    {
      entityType: "risk-control",
      title,
      definition: `${title} definition`,
      ownerTeam: "Platform Engineering",
      state: "active",
      ...overrides
    },
    "workshop"
  ) as RiskControlEntity;
}

function treatedByLink(riskId: string, actionId: string): LinkEntity {
  return withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${riskId} treated by ${actionId}`,
      linkType: "treated-by",
      fromId: riskId,
      fromType: "risk",
      toId: actionId,
      toType: "action"
    },
    "workshop"
  ) as LinkEntity;
}

function mitigatedByLink(riskId: string, controlId: string, application: RiskControlApplication): LinkEntity {
  return withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${riskId} mitigated by ${controlId}`,
      linkType: "mitigated-by",
      fromId: riskId,
      fromType: "risk",
      toId: controlId,
      toType: "risk-control",
      application
    },
    "workshop"
  ) as LinkEntity;
}

function framework(categories: readonly RiskCategoryNode[] = []): RiskFrameworkEntity {
  return withEnvelope(
    "risk-framework",
    {
      entityType: "risk-framework",
      categories,
      methodologies: [LEGACY_5X5_METHODOLOGY],
      appetiteRules: [],
      sourceRegisters: [],
      presentationPresets: []
    },
    "core"
  ) as RiskFrameworkEntity;
}

test("riskCategoryOptions flattens the tree depth-first and skips archived nodes", () => {
  const cats: RiskCategoryNode[] = [
    { id: "cat_a", label: "Enterprise", order: 0, archived: false },
    { id: "cat_b", label: "Digital", parentId: "cat_a", order: 0, archived: false },
    { id: "cat_c", label: "Technology", parentId: "cat_b", order: 0, archived: false },
    { id: "cat_d", label: "Retired branch", parentId: "cat_a", order: 1, archived: true }
  ];
  const options = riskCategoryOptions(framework(cats));
  assert.deepEqual(
    options.map((option) => `${"  ".repeat(option.depth)}${option.label}`),
    ["Enterprise", "  Digital", "    Technology"]
  );
});

test("riskCategoryPath renders a breadcrumb and falls back to 'No category'", () => {
  const cats: RiskCategoryNode[] = [
    { id: "cat_a", label: "Enterprise", order: 0, archived: false },
    { id: "cat_b", label: "Digital", parentId: "cat_a", order: 0, archived: false }
  ];
  const fw = framework(cats);
  assert.equal(riskCategoryPath(fw, "cat_b"), "Enterprise \u203a Digital");
  assert.equal(riskCategoryPath(fw, undefined), "No category");
  assert.equal(riskCategoryPath(undefined, "cat_b"), "No category");
});

test("parseCategoryOutline preserves stable IDs by (label, parent) and archives removed nodes", () => {
  let counter = 0;
  const createId = () => `cat_new_${counter++}`;
  const existing: RiskCategoryNode[] = [
    { id: "cat_a", label: "Enterprise", order: 0, archived: false },
    { id: "cat_b", label: "Digital", parentId: "cat_a", order: 0, archived: false }
  ];
  const outline = "Enterprise\n  Digital\n  Cyber\n";
  const result = parseCategoryOutline(outline, existing, createId);
  const byLabel = new Map(result.map((category) => [category.label, category]));
  assert.equal(byLabel.get("Enterprise")!.id, "cat_a");
  assert.equal(byLabel.get("Digital")!.id, "cat_b");
  assert.equal(byLabel.get("Cyber")!.id, "cat_new_0");
  assert.equal(byLabel.get("Cyber")!.parentId, "cat_a");

  const removed = parseCategoryOutline("Enterprise\n", result, createId);
  const digital = removed.find((category) => category.id === "cat_b")!;
  assert.equal(digital.archived, true, "removed category is archived, not deleted");
  assert.equal(
    removed.some((category) => category.id === "cat_a" && !category.archived),
    true
  );
});

test("renderCategoryOutline round-trips through parseCategoryOutline", () => {
  const outline = "Enterprise\n  Digital\n    Technology\n  Cyber\n";
  const parsed = parseCategoryOutline(outline, [], () => `cat_${Math.random()}`);
  assert.equal(renderCategoryOutline(parsed), outline.trimEnd());
});

test("candidateParentRisks excludes self and any risk that would create a cycle", () => {
  const a = risk("RSK-A", "A");
  const b = risk("RSK-B", "B");
  const c = risk("RSK-C", "C");
  const links = [rollsUpLink(b.id, a.id)]; // B rolls up to A
  const candidates = candidateParentRisks(a, [a, b, c], links).map((entry) => entry.id);
  assert.equal(candidates.includes(a.id), false, "self excluded");
  assert.equal(candidates.includes(b.id), false, "descendant excluded (would cycle)");
  assert.equal(candidates.includes(c.id), true, "unrelated risk is a valid candidate");
});

test("findPrimaryParentId reads the sole outgoing rolls-up-to link", () => {
  const a = risk("RSK-A", "A");
  const b = risk("RSK-B", "B");
  const links = [rollsUpLink(b.id, a.id)];
  assert.equal(findPrimaryParentId(b.id, links), a.id);
  assert.equal(findPrimaryParentId(a.id, links), undefined);
});

test("buildRiskRegisterRows discloses category path, band, appetite and parent title", () => {
  const cats: RiskCategoryNode[] = [{ id: "cat_a", label: "Enterprise", order: 0, archived: false }];
  const parent = risk("RSK-P", "Parent risk", { likelihood: 4, impact: 4 });
  const child = risk("RSK-C", "Child risk", { likelihood: 2, impact: 2, primaryCategoryId: "cat_a" });
  const links = [rollsUpLink(child.id, parent.id)];
  const rows = buildRiskRegisterRows([parent, child], framework(cats), links, NOW);
  const childRow = rows.find((row) => row.risk.id === child.id)!;
  assert.equal(childRow.categoryLabel, "Enterprise");
  assert.equal(childRow.parentTitle, "Parent risk");
  assert.equal(childRow.bandLabel, "Low");
});

test("buildRiskHierarchyForest roots risks with no parent and nests children, tolerating cycles", () => {
  const a = risk("RSK-A", "A");
  const b = risk("RSK-B", "B");
  const links = [rollsUpLink(b.id, a.id)];
  const forest = buildRiskHierarchyForest([a, b], undefined, links, NOW);
  assert.equal(forest.length, 1);
  assert.equal(forest[0]!.risk.id, a.id);
  assert.equal(forest[0]!.children.length, 1);
  assert.equal(forest[0]!.children[0]!.risk.id, b.id);
});

test("buildRiskMatrixModel counts legacy risks into cells and discloses unassessed/not-comparable", () => {
  const revision = LEGACY_5X5_METHODOLOGY.revisions[0]!;
  const risks = [
    risk("RSK-1", "One", { likelihood: 2, impact: 2 }),
    risk("RSK-2", "Two", { likelihood: 2, impact: 2 }),
    risk("RSK-3", "Three", { assessment: { basis: "unassessed" } })
  ];
  const model = buildRiskMatrixModel(risks, revision);
  const cell = model.cells.find((entry) => entry.likelihoodId === "L2" && entry.impactId === "I2")!;
  assert.equal(cell.count, 2);
  assert.equal(cell.bandLabel, "Low");
  assert.equal(model.unassessedCount, 1);
  assert.equal(model.notComparableCount, 0);
});

// --- Phase 3A: treatments (risk -> treated-by -> action) --------------------------------------

test("buildRiskTreatmentActions discloses the shared-Action affected-risk preview", () => {
  const riskA = risk("RSK-A", "Risk A");
  const riskB = risk("RSK-B", "Risk B");
  const sharedAction = action("Shared remediation");
  const links = [treatedByLink(riskA.id, sharedAction.id), treatedByLink(riskB.id, sharedAction.id)];
  const rowsForA = buildRiskTreatmentActions(riskA, links, [sharedAction], [riskA, riskB]);
  assert.equal(rowsForA.length, 1);
  assert.equal(rowsForA[0]!.action.id, sharedAction.id);
  assert.deepEqual(rowsForA[0]!.otherRiskTitles, ["Risk B"]);
});

test("candidateActionsForTreatment excludes already-linked and closed/cancelled actions", () => {
  const riskA = risk("RSK-A", "Risk A");
  const linkedAction = action("Already linked");
  const doneAction = action("Already done", { status: "done" });
  const cancelledAction = action("Already cancelled", { status: "cancelled" });
  const openAction = action("Still open");
  const links = [treatedByLink(riskA.id, linkedAction.id)];
  const candidates = candidateActionsForTreatment(
    riskA,
    [linkedAction, doneAction, cancelledAction, openAction],
    links
  ).map((entry) => entry.title);
  assert.deepEqual(candidates, ["Still open"]);
});

// --- Phase 3A: control applications (risk -> mitigated-by -> risk-control) ---------------------

test("buildRiskControlApplications resolves anchors and flags a stale anchor as unresolved", () => {
  const causeId = "cause_1";
  const riskA = risk("RSK-A", "Risk A", { causes: [{ id: causeId, label: "A cause" }] });
  const control = riskControl("Encryption policy");
  const validApplication: RiskControlApplication = {
    role: "preventive",
    applicability: "All endpoints",
    effectiveness: "partially-effective",
    anchorIds: [causeId]
  };
  const staleApplication: RiskControlApplication = {
    role: "preventive",
    applicability: "All endpoints",
    effectiveness: "not-assessed",
    anchorIds: ["cause_removed"]
  };
  const links = [mitigatedByLink(riskA.id, control.id, validApplication)];
  const rows = buildRiskControlApplications(riskA, links, [control]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]!.unresolvedAnchorIds, []);

  const staleLinks = [mitigatedByLink(riskA.id, control.id, staleApplication)];
  const staleRows = buildRiskControlApplications(riskA, staleLinks, [control]);
  assert.deepEqual(staleRows[0]!.unresolvedAnchorIds, ["cause_removed"]);
});

test("candidateControlsForMitigation excludes already-linked and retired controls", () => {
  const riskA = risk("RSK-A", "Risk A");
  const linkedControl = riskControl("Already linked");
  const retiredControl = riskControl("Retired", { state: "retired" });
  const activeControl = riskControl("Still active");
  const links = [
    mitigatedByLink(riskA.id, linkedControl.id, {
      role: "preventive",
      applicability: "All",
      effectiveness: "not-assessed",
      anchorIds: []
    })
  ];
  const candidates = candidateControlsForMitigation(riskA, [linkedControl, retiredControl, activeControl], links).map(
    (entry) => entry.title
  );
  assert.deepEqual(candidates, ["Still active"]);
});

// --- Phase 3A: bow-tie (causes / preventive controls / event / recovery controls / consequences) ---

test("buildRiskBowTieModel groups controls by role under their anchored cause/consequence", () => {
  const causeId = "cause_1";
  const consequenceId = "cons_1";
  const riskA = risk("RSK-A", "Risk A", {
    causes: [{ id: causeId, label: "Phishing" }],
    consequences: [{ id: consequenceId, label: "Data loss" }]
  });
  const preventiveControl = riskControl("MFA enforcement");
  const recoveryControl = riskControl("Backup restore");
  const links = [
    mitigatedByLink(riskA.id, preventiveControl.id, {
      role: "preventive",
      applicability: "All accounts",
      effectiveness: "effective",
      anchorIds: [causeId]
    }),
    mitigatedByLink(riskA.id, recoveryControl.id, {
      role: "recovery",
      applicability: "All backups",
      effectiveness: "effective",
      anchorIds: [consequenceId]
    })
  ];
  const model = buildRiskBowTieModel(riskA, links, [preventiveControl, recoveryControl]);
  assert.equal(model.causes.length, 1);
  assert.deepEqual(model.causes[0]!.preventiveControlTitles, ["MFA enforcement"]);
  assert.equal(model.consequences.length, 1);
  assert.deepEqual(model.consequences[0]!.recoveryControlTitles, ["Backup restore"]);
  assert.equal(model.unresolvedApplicationCount, 0);
});

test("buildRiskBowTieModel discloses a visible gap when a cause has no preventive control", () => {
  const riskA = risk("RSK-A", "Risk A", { causes: [{ id: "cause_1", label: "Unmitigated cause" }] });
  const model = buildRiskBowTieModel(riskA, [], []);
  assert.equal(model.causes.length, 1);
  assert.deepEqual(model.causes[0]!.preventiveControlTitles, []);
});

// --- Phase 3A: coverage (distinct IDs, direct vs descendant, never summed/averaged bands) ------

test("descendantRiskIds walks rolls-up-to children transitively and tolerates cycles", () => {
  const parent = risk("RSK-P", "Parent");
  const child = risk("RSK-C", "Child");
  const grandchild = risk("RSK-G", "Grandchild");
  const links = [rollsUpLink(child.id, parent.id), rollsUpLink(grandchild.id, child.id)];
  const descendants = descendantRiskIds(parent.id, links);
  assert.equal(descendants.has(child.id), true);
  assert.equal(descendants.has(grandchild.id), true);

  const cyclicLinks = [rollsUpLink(child.id, parent.id), rollsUpLink(parent.id, child.id)];
  const cyclicDescendants = descendantRiskIds(parent.id, cyclicLinks);
  assert.equal(cyclicDescendants.has(child.id), true);
});

test("buildRiskCoverageRows counts distinct direct vs descendant treatments/controls without double-counting", () => {
  const parent = risk("RSK-P", "Parent");
  const child = risk("RSK-C", "Child");
  const sharedAction = action("Shared action");
  const childOnlyAction = action("Child-only action");
  const links = [
    rollsUpLink(child.id, parent.id),
    treatedByLink(parent.id, sharedAction.id),
    treatedByLink(child.id, sharedAction.id),
    treatedByLink(child.id, childOnlyAction.id)
  ];
  const rows = buildRiskCoverageRows([parent, child], links, undefined);
  const parentRow = rows.find((row) => row.risk.id === parent.id)!;
  assert.deepEqual(parentRow.directActionIds, [sharedAction.id]);
  assert.deepEqual(
    parentRow.descendantActionIds,
    [childOnlyAction.id],
    "shared action already direct is not double-counted"
  );
  assert.equal(parentRow.uncovered, false);

  const untreated = risk("RSK-U", "Untreated");
  const untreatedRows = buildRiskCoverageRows([untreated], [], undefined);
  assert.equal(untreatedRows[0]!.uncovered, true);
});
