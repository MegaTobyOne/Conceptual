import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_5X5_METHODOLOGY,
  withEnvelope,
  type LinkEntity,
  type RiskCategoryNode,
  type RiskEntity,
  type RiskFrameworkEntity
} from "@pspf/contracts";
import {
  buildRiskHierarchyForest,
  buildRiskMatrixModel,
  buildRiskRegisterRows,
  candidateParentRisks,
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
