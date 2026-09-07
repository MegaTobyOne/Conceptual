import {
  evaluateRisk,
  resolveAppetite,
  validateControlApplicationAnchors,
  type ActionEntity,
  type LinkEntity,
  type RiskAppetiteResolution,
  type RiskCategoryNode,
  type RiskControlApplication,
  type RiskControlEntity,
  type RiskEntity,
  type RiskEvaluation,
  type RiskFrameworkEntity,
  type RiskMethodologyRevision,
  type RollUpEdge,
  type V01Entity
} from "@pspf/contracts";

/**
 * Risk Workbench — pure, deterministic view-model builders for Phase 2 of the Workshop Risk
 * overhaul (ADR 0098 §Workbench and Presentation). No I/O, no VS Code coupling: every function
 * here takes already-loaded entity arrays and returns plain data for the extension host to render.
 */

// --- Framework lookup --------------------------------------------------------

export function getActiveRiskFramework(allEntities: readonly V01Entity[]): RiskFrameworkEntity | undefined {
  return allEntities.find(
    (entity): entity is RiskFrameworkEntity =>
      entity.entityType === "risk-framework" && entity.recordStatus !== "deleted"
  );
}

// --- Roll-up hierarchy (`risk -> rolls-up-to -> risk`) -----------------------

export function riskRollUpEdgesFromLinks(links: readonly LinkEntity[]): RollUpEdge[] {
  return links
    .filter((link) => link.linkType === "rolls-up-to" && link.recordStatus !== "deleted")
    .map((link) => ({ fromId: link.fromId, toId: link.toId }));
}

export function findPrimaryParentId(riskId: string, links: readonly LinkEntity[]): string | undefined {
  return riskRollUpEdgesFromLinks(links).find((edge) => edge.fromId === riskId)?.toId;
}

export function findRollUpLink(riskId: string, links: readonly LinkEntity[]): LinkEntity | undefined {
  return links.find(
    (link) => link.linkType === "rolls-up-to" && link.recordStatus !== "deleted" && link.fromId === riskId
  );
}

/**
 * D3.1/D3.3: candidate parents for `risk` exclude itself and any risk that already rolls up
 * (directly or transitively) to `risk`, since accepting one would create a cycle.
 */
export function candidateParentRisks(
  risk: RiskEntity,
  allRisks: readonly RiskEntity[],
  links: readonly LinkEntity[]
): readonly RiskEntity[] {
  const parentOf = new Map<string, string>();
  for (const edge of riskRollUpEdgesFromLinks(links)) {
    if (edge.fromId !== risk.id) {
      parentOf.set(edge.fromId, edge.toId);
    }
  }
  const wouldCycle = (candidateId: string): boolean => {
    const visited = new Set<string>();
    let current: string | undefined = candidateId;
    while (current !== undefined) {
      if (current === risk.id) {
        return true;
      }
      if (visited.has(current)) {
        return false;
      }
      visited.add(current);
      current = parentOf.get(current);
    }
    return false;
  };
  return allRisks.filter(
    (candidate) => candidate.id !== risk.id && candidate.recordStatus !== "deleted" && !wouldCycle(candidate.id)
  );
}

// --- Categories ---------------------------------------------------------------

export interface RiskCategoryOption {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
}

/** Flattened, depth-first, parent-before-child; archived nodes are excluded unless requested. */
export function riskCategoryOptions(
  framework: RiskFrameworkEntity | undefined,
  includeArchived = false
): readonly RiskCategoryOption[] {
  if (!framework) {
    return [];
  }
  const byParent = new Map<string | undefined, RiskCategoryNode[]>();
  for (const category of framework.categories ?? []) {
    if (!includeArchived && category.archived) {
      continue;
    }
    const key = category.parentId;
    const siblings = byParent.get(key) ?? [];
    siblings.push(category);
    byParent.set(key, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, "en-AU"));
  }
  const options: RiskCategoryOption[] = [];
  const visit = (parentId: string | undefined, depth: number): void => {
    for (const category of byParent.get(parentId) ?? []) {
      options.push({ id: category.id, label: category.label, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(undefined, 0);
  return options;
}

export function riskCategoryLabel(
  framework: RiskFrameworkEntity | undefined,
  categoryId: string | undefined
): string | undefined {
  if (!framework || !categoryId) {
    return undefined;
  }
  return (framework.categories ?? []).find((category) => category.id === categoryId)?.label;
}

export function riskCategoryPath(framework: RiskFrameworkEntity | undefined, categoryId: string | undefined): string {
  if (!framework || !categoryId) {
    return "No category";
  }
  const byId = new Map((framework.categories ?? []).map((category) => [category.id, category]));
  const path: string[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = categoryId;
  while (currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    const category = byId.get(currentId);
    if (!category) {
      break;
    }
    path.unshift(category.label);
    currentId = category.parentId;
  }
  return path.length > 0 ? path.join(" \u203a ") : "No category";
}

/**
 * Parses a plain-text category outline (two spaces per nesting level) into `RiskCategoryNode[]`,
 * preserving existing stable IDs by matching (label, resolved parent label) against `existing`.
 * Categories present in `existing` but no longer in the outline are archived, never deleted, so
 * Risk references never dangle (D2.2).
 */
export function parseCategoryOutline(
  text: string,
  existing: readonly RiskCategoryNode[],
  createId: () => string
): RiskCategoryNode[] {
  type StackEntry = { readonly depth: number; readonly id: string };
  const stack: StackEntry[] = [];
  const result: RiskCategoryNode[] = [];
  const matchedExistingIds = new Set<string>();
  const findExisting = (label: string, parentId: string | undefined): RiskCategoryNode | undefined =>
    existing.find(
      (candidate) =>
        !matchedExistingIds.has(candidate.id) && candidate.label === label && candidate.parentId === parentId
    );
  let order = 0;
  for (const rawLine of text.split("\n")) {
    if (rawLine.trim().length === 0) {
      continue;
    }
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const depth = Math.floor(indent / 2);
    const label = rawLine.trim();
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop();
    }
    const parentId = stack.length > 0 ? stack[stack.length - 1]!.id : undefined;
    const matched = findExisting(label, parentId);
    const id = matched?.id ?? createId();
    if (matched) {
      matchedExistingIds.add(matched.id);
    }
    result.push({ id, label, parentId, order: order++, archived: false });
    stack.push({ depth, id });
  }
  for (const category of existing) {
    if (!matchedExistingIds.has(category.id) && !result.some((entry) => entry.id === category.id)) {
      result.push({ ...category, archived: true });
    }
  }
  return result;
}

export function renderCategoryOutline(categories: readonly RiskCategoryNode[]): string {
  const byParent = new Map<string | undefined, RiskCategoryNode[]>();
  for (const category of categories) {
    if (category.archived) {
      continue;
    }
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) => left.order - right.order);
  }
  const lines: string[] = [];
  const visit = (parentId: string | undefined, depth: number): void => {
    for (const category of byParent.get(parentId) ?? []) {
      lines.push(`${"  ".repeat(depth)}${category.label}`);
      visit(category.id, depth + 1);
    }
  };
  visit(undefined, 0);
  return lines.join("\n");
}

// --- Evaluation labels ---------------------------------------------------------

export function riskBandLabel(evaluation: RiskEvaluation): string {
  if (evaluation.band) {
    return evaluation.band.label;
  }
  return evaluation.state === "unassessed" ? "Unassessed" : "Not comparable";
}

export function riskAppetiteLabel(resolution: RiskAppetiteResolution): string {
  switch (resolution.state) {
    case "not-set":
      return "Appetite not set";
    case "in-appetite":
      return resolution.stale ? "In appetite (review overdue)" : "In appetite";
    case "over-appetite":
      return resolution.stale ? "Over appetite (review overdue)" : "Over appetite";
  }
}

// --- Register -------------------------------------------------------------------

export interface RiskRegisterRow {
  readonly risk: RiskEntity;
  readonly categoryLabel: string;
  readonly bandLabel: string;
  readonly appetiteLabel: string;
  readonly parentTitle?: string;
}

export function buildRiskRegisterRows(
  risks: readonly RiskEntity[],
  framework: RiskFrameworkEntity | undefined,
  links: readonly LinkEntity[],
  now: string
): readonly RiskRegisterRow[] {
  const risksById = new Map(risks.map((risk) => [risk.id, risk]));
  return risks.map((risk) => {
    const evaluation = evaluateRisk(risk, framework);
    const appetite = resolveAppetite(risk, framework, evaluation, now);
    const parentId = findPrimaryParentId(risk.id, links);
    return {
      risk,
      categoryLabel: riskCategoryPath(framework, risk.primaryCategoryId),
      bandLabel: riskBandLabel(evaluation),
      appetiteLabel: riskAppetiteLabel(appetite),
      parentTitle: parentId ? risksById.get(parentId)?.title : undefined
    };
  });
}

// --- Hierarchy ------------------------------------------------------------------

export interface RiskHierarchyNode {
  readonly risk: RiskEntity;
  readonly bandLabel: string;
  readonly appetiteLabel: string;
  readonly children: readonly RiskHierarchyNode[];
}

/** Builds a forest rooted at risks with no primary parent. Tolerates cycles defensively. */
export function buildRiskHierarchyForest(
  risks: readonly RiskEntity[],
  framework: RiskFrameworkEntity | undefined,
  links: readonly LinkEntity[],
  now: string
): readonly RiskHierarchyNode[] {
  const childrenOf = new Map<string, RiskEntity[]>();
  const hasParent = new Set<string>();
  for (const edge of riskRollUpEdgesFromLinks(links)) {
    hasParent.add(edge.fromId);
    const siblings = childrenOf.get(edge.toId) ?? [];
    const child = risks.find((risk) => risk.id === edge.fromId);
    if (child) {
      siblings.push(child);
    }
    childrenOf.set(edge.toId, siblings);
  }
  const buildNode = (risk: RiskEntity, ancestry: ReadonlySet<string>): RiskHierarchyNode => {
    const evaluation = evaluateRisk(risk, framework);
    const appetite = resolveAppetite(risk, framework, evaluation, now);
    const nextAncestry = new Set(ancestry).add(risk.id);
    const children = (childrenOf.get(risk.id) ?? [])
      .filter((child) => !ancestry.has(child.id))
      .sort((left, right) => left.title.localeCompare(right.title, "en-AU"))
      .map((child) => buildNode(child, nextAncestry));
    return { risk, bandLabel: riskBandLabel(evaluation), appetiteLabel: riskAppetiteLabel(appetite), children };
  };
  return risks
    .filter((risk) => !hasParent.has(risk.id))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU"))
    .map((risk) => buildNode(risk, new Set()));
}

// --- Matrix -----------------------------------------------------------------------

export interface RiskMatrixCellModel {
  readonly likelihoodId: string;
  readonly impactId: string;
  readonly bandId: string;
  readonly bandLabel: string;
  readonly count: number;
}

export interface RiskMatrixModel {
  readonly likelihoodLevels: readonly { readonly id: string; readonly label: string }[];
  readonly impactLevels: readonly { readonly id: string; readonly label: string }[];
  readonly cells: readonly RiskMatrixCellModel[];
  readonly unassessedCount: number;
  readonly notComparableCount: number;
}

/** Placement for a risk on `revision`'s grid; `undefined` when unassessed or evaluated on another methodology. */
function matrixPlacementFor(
  risk: RiskEntity,
  revision: RiskMethodologyRevision
): { readonly likelihoodId: string; readonly impactId: string } | undefined {
  const assessment = risk.assessment;
  if (assessment === undefined) {
    return { likelihoodId: `L${risk.likelihood}`, impactId: `I${risk.impact}` };
  }
  if (assessment.basis === "legacy") {
    return { likelihoodId: `L${assessment.likelihood}`, impactId: `I${assessment.impact}` };
  }
  if (assessment.basis === "custom") {
    const knownLikelihood = revision.likelihoodLevels.some((level) => level.id === assessment.current.likelihoodId);
    const knownImpact = revision.impactLevels.some((level) => level.id === assessment.current.impactId);
    return knownLikelihood && knownImpact
      ? { likelihoodId: assessment.current.likelihoodId, impactId: assessment.current.impactId }
      : undefined;
  }
  return undefined;
}

export function buildRiskMatrixModel(risks: readonly RiskEntity[], revision: RiskMethodologyRevision): RiskMatrixModel {
  const bandsById = new Map(revision.bands.map((band) => [band.id, band]));
  const counts = new Map<string, number>();
  let unassessedCount = 0;
  let notComparableCount = 0;
  for (const risk of risks) {
    const placement = matrixPlacementFor(risk, revision);
    if (!placement) {
      if (risk.assessment?.basis === "unassessed") {
        unassessedCount += 1;
      } else {
        notComparableCount += 1;
      }
      continue;
    }
    const key = `${placement.likelihoodId}:${placement.impactId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const cells = revision.cells.map((cell) => ({
    likelihoodId: cell.likelihoodId,
    impactId: cell.impactId,
    bandId: cell.bandId,
    bandLabel: bandsById.get(cell.bandId)?.label ?? cell.bandId,
    count: counts.get(`${cell.likelihoodId}:${cell.impactId}`) ?? 0
  }));
  return {
    likelihoodLevels: revision.likelihoodLevels.map((level) => ({ id: level.id, label: level.label })),
    impactLevels: revision.impactLevels.map((level) => ({ id: level.id, label: level.label })),
    cells,
    unassessedCount,
    notComparableCount
  };
}

// --- Phase 3A (ADR 0098 D3.7/D3.8): treatments (`risk -> treated-by -> action`) ----------------

function activeLinks(links: readonly LinkEntity[]): readonly LinkEntity[] {
  return links.filter((link) => link.recordStatus !== "deleted");
}

export interface RiskTreatmentActionRow {
  readonly link: LinkEntity;
  readonly action: ActionEntity;
  /** D3.7 "affected-risk preview": titles of other risks this same Action also treats. */
  readonly otherRiskTitles: readonly string[];
}

/** All `risk -> treated-by -> action` treatments directly on `risk`, with the shared-Action preview. */
export function buildRiskTreatmentActions(
  risk: RiskEntity,
  links: readonly LinkEntity[],
  actions: readonly ActionEntity[],
  allRisks: readonly RiskEntity[]
): readonly RiskTreatmentActionRow[] {
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const risksById = new Map(allRisks.map((candidate) => [candidate.id, candidate]));
  const treatedByLinks = activeLinks(links).filter(
    (link) =>
      link.linkType === "treated-by" && link.fromType === "risk" && link.toType === "action" && link.fromId === risk.id
  );
  const rows: RiskTreatmentActionRow[] = [];
  for (const link of treatedByLinks) {
    const action = actionsById.get(link.toId);
    if (!action) {
      continue;
    }
    const otherRiskTitles = activeLinks(links)
      .filter(
        (candidate) =>
          candidate.linkType === "treated-by" &&
          candidate.toType === "action" &&
          candidate.toId === action.id &&
          candidate.fromType === "risk" &&
          candidate.fromId !== risk.id
      )
      .map((candidate) => risksById.get(candidate.fromId)?.title ?? candidate.fromId);
    rows.push({ link, action, otherRiskTitles });
  }
  return rows;
}

/** Open Actions not already linked via `treated-by` to `risk`, offered for reuse. */
export function candidateActionsForTreatment(
  risk: RiskEntity,
  actions: readonly ActionEntity[],
  links: readonly LinkEntity[]
): readonly ActionEntity[] {
  const linkedIds = new Set(
    activeLinks(links)
      .filter((link) => link.linkType === "treated-by" && link.fromType === "risk" && link.fromId === risk.id)
      .map((link) => link.toId)
  );
  return actions
    .filter(
      (action) =>
        action.recordStatus !== "deleted" &&
        action.status !== "done" &&
        action.status !== "cancelled" &&
        !linkedIds.has(action.id)
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU"));
}

// --- Phase 3A (ADR 0098 D3.4/D3.5): control applications (`risk -> mitigated-by -> risk-control`) ----

export interface RiskControlApplicationRow {
  readonly link: LinkEntity;
  readonly control: RiskControlEntity;
  readonly application: RiskControlApplication;
  /** Should always be empty for a Core-validated link; a non-empty result flags a stale anchor. */
  readonly unresolvedAnchorIds: readonly string[];
}

/** All `risk -> mitigated-by -> risk-control` applications directly on `risk`. */
export function buildRiskControlApplications(
  risk: RiskEntity,
  links: readonly LinkEntity[],
  controls: readonly RiskControlEntity[]
): readonly RiskControlApplicationRow[] {
  const controlsById = new Map(controls.map((control) => [control.id, control]));
  const rows: RiskControlApplicationRow[] = [];
  for (const link of activeLinks(links)) {
    if (link.linkType !== "mitigated-by" || link.fromType !== "risk" || link.fromId !== risk.id || !link.application) {
      continue;
    }
    const control = controlsById.get(link.toId);
    if (!control) {
      continue;
    }
    rows.push({
      link,
      control,
      application: link.application,
      unresolvedAnchorIds: validateControlApplicationAnchors(risk, link.application)
    });
  }
  return rows;
}

/** Active risk-controls not already mitigating `risk`, offered for reuse. */
export function candidateControlsForMitigation(
  risk: RiskEntity,
  controls: readonly RiskControlEntity[],
  links: readonly LinkEntity[]
): readonly RiskControlEntity[] {
  const linkedIds = new Set(
    activeLinks(links)
      .filter((link) => link.linkType === "mitigated-by" && link.fromType === "risk" && link.fromId === risk.id)
      .map((link) => link.toId)
  );
  return controls
    .filter(
      (control) => control.recordStatus !== "deleted" && control.state !== "retired" && !linkedIds.has(control.id)
    )
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU"));
}

// --- Phase 3A (ADR 0098 D3.6): bow-tie (causes / preventive controls / event / recovery controls / consequences) ---

export interface RiskBowTieCauseRow {
  readonly cause: RiskCauseOrConsequenceEntry;
  readonly preventiveControlTitles: readonly string[];
}

export interface RiskBowTieConsequenceRow {
  readonly consequence: RiskCauseOrConsequenceEntry;
  readonly recoveryControlTitles: readonly string[];
}

export interface RiskCauseOrConsequenceEntry {
  readonly id: string;
  readonly label: string;
}

export interface RiskBowTieModel {
  readonly causes: readonly RiskBowTieCauseRow[];
  readonly consequences: readonly RiskBowTieConsequenceRow[];
  /** Applications whose anchors no longer resolve on this risk (e.g. a cause was later removed). */
  readonly unresolvedApplicationCount: number;
}

/** Groups this risk's `mitigated-by` control applications by cause (preventive) and consequence (recovery). */
export function buildRiskBowTieModel(
  risk: RiskEntity,
  links: readonly LinkEntity[],
  controls: readonly RiskControlEntity[]
): RiskBowTieModel {
  const applications = buildRiskControlApplications(risk, links, controls);
  const preventiveByCauseId = new Map<string, string[]>();
  const recoveryByConsequenceId = new Map<string, string[]>();
  let unresolvedApplicationCount = 0;

  for (const row of applications) {
    if (row.unresolvedAnchorIds.length > 0) {
      unresolvedApplicationCount += 1;
    }
    const isPreventive = row.application.role === "preventive" || row.application.role === "both";
    const isRecovery = row.application.role === "recovery" || row.application.role === "both";
    for (const anchorId of row.application.anchorIds) {
      if (isPreventive) {
        const list = preventiveByCauseId.get(anchorId) ?? [];
        list.push(row.control.title);
        preventiveByCauseId.set(anchorId, list);
      }
      if (isRecovery) {
        const list = recoveryByConsequenceId.get(anchorId) ?? [];
        list.push(row.control.title);
        recoveryByConsequenceId.set(anchorId, list);
      }
    }
  }

  return {
    causes: (risk.causes ?? []).map((cause) => ({
      cause,
      preventiveControlTitles: preventiveByCauseId.get(cause.id) ?? []
    })),
    consequences: (risk.consequences ?? []).map((consequence) => ({
      consequence,
      recoveryControlTitles: recoveryByConsequenceId.get(consequence.id) ?? []
    })),
    unresolvedApplicationCount
  };
}

// --- Phase 3A (ADR 0098 D3.8): treatment/control coverage --------------------------------------

/** Descendant risk IDs reachable by following `rolls-up-to` edges downward (children, grandchildren, ...). Cycle-tolerant. */
export function descendantRiskIds(riskId: string, links: readonly LinkEntity[]): ReadonlySet<string> {
  const childrenOf = new Map<string, string[]>();
  for (const edge of riskRollUpEdgesFromLinks(links)) {
    const siblings = childrenOf.get(edge.toId) ?? [];
    siblings.push(edge.fromId);
    childrenOf.set(edge.toId, siblings);
  }
  const result = new Set<string>();
  const visit = (currentId: string): void => {
    for (const childId of childrenOf.get(currentId) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        visit(childId);
      }
    }
  };
  visit(riskId);
  return result;
}

export interface RiskCoverageRow {
  readonly risk: RiskEntity;
  readonly bandLabel: string;
  /** Distinct action IDs directly treating this risk. */
  readonly directActionIds: readonly string[];
  /** Distinct action IDs treating a descendant risk, excluding any already counted as direct. */
  readonly descendantActionIds: readonly string[];
  /** Distinct control IDs directly mitigating this risk. */
  readonly directControlIds: readonly string[];
  /** Distinct control IDs mitigating a descendant risk, excluding any already counted as direct. */
  readonly descendantControlIds: readonly string[];
  readonly uncovered: boolean;
}

/**
 * D3.8: many-to-many treatment/control coverage across risks. Counts distinct treatment/control
 * IDs and distinguishes direct from descendant coverage; never sums or averages ordinal bands.
 */
export function buildRiskCoverageRows(
  risks: readonly RiskEntity[],
  links: readonly LinkEntity[],
  framework: RiskFrameworkEntity | undefined
): readonly RiskCoverageRow[] {
  const directActionIdsByRisk = new Map<string, Set<string>>();
  const directControlIdsByRisk = new Map<string, Set<string>>();
  for (const link of activeLinks(links)) {
    if (link.linkType === "treated-by" && link.fromType === "risk" && link.toType === "action") {
      const set = directActionIdsByRisk.get(link.fromId) ?? new Set<string>();
      set.add(link.toId);
      directActionIdsByRisk.set(link.fromId, set);
    }
    if (link.linkType === "mitigated-by" && link.fromType === "risk" && link.toType === "risk-control") {
      const set = directControlIdsByRisk.get(link.fromId) ?? new Set<string>();
      set.add(link.toId);
      directControlIdsByRisk.set(link.fromId, set);
    }
  }
  return risks.map((risk) => {
    const directActionIds = directActionIdsByRisk.get(risk.id) ?? new Set<string>();
    const directControlIds = directControlIdsByRisk.get(risk.id) ?? new Set<string>();
    const descendantActionIds = new Set<string>();
    const descendantControlIds = new Set<string>();
    for (const descendantId of descendantRiskIds(risk.id, links)) {
      for (const actionId of directActionIdsByRisk.get(descendantId) ?? []) {
        if (!directActionIds.has(actionId)) {
          descendantActionIds.add(actionId);
        }
      }
      for (const controlId of directControlIdsByRisk.get(descendantId) ?? []) {
        if (!directControlIds.has(controlId)) {
          descendantControlIds.add(controlId);
        }
      }
    }
    return {
      risk,
      bandLabel: riskBandLabel(evaluateRisk(risk, framework)),
      directActionIds: [...directActionIds],
      descendantActionIds: [...descendantActionIds],
      directControlIds: [...directControlIds],
      descendantControlIds: [...descendantControlIds],
      uncovered:
        directActionIds.size === 0 &&
        directControlIds.size === 0 &&
        descendantActionIds.size === 0 &&
        descendantControlIds.size === 0
    };
  });
}
