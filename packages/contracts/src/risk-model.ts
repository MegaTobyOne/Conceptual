// Phase 1A (ADR 0098, v1.74.0): Risk overhaul shared contracts and evaluator.
// Pure and deterministic: no I/O, no persistence, no Core/Workshop/Explorer coupling.
// Nothing here is wired into Core write validation, import, or publication preflight yet (Phase 1B).
import { assertNever, type EntityEnvelope, type RiskEntity } from "./index.js";

// --- D1: assessment shape -------------------------------------------------

/** D1.1: a Risk with no `assessment` field is read as `{ basis: "legacy" }` using the entity's own likelihood/impact (D1.2). */
export interface UnassessedRiskAssessment {
  readonly basis: "unassessed";
}

export interface LegacyRiskAssessment {
  readonly basis: "legacy";
  /** 1..5, invariant E5 scale. */
  readonly likelihood: number;
  /** 1..5, invariant E5 scale. */
  readonly impact: number;
  readonly assessedAt?: string;
  readonly rationale?: string;
}

export interface CustomRiskAssessmentValue {
  readonly likelihoodId: string;
  readonly impactId: string;
}

export interface CustomRiskAssessment {
  readonly basis: "custom";
  readonly methodologyId: string;
  readonly revisionId: string;
  readonly current: CustomRiskAssessmentValue;
  readonly inherent?: CustomRiskAssessmentValue;
  readonly target?: CustomRiskAssessmentValue;
  readonly assessedAt: string;
  readonly rationale?: string;
}

export type RiskAssessment = UnassessedRiskAssessment | LegacyRiskAssessment | CustomRiskAssessment;

/** D1.3: the four states a shared evaluation can resolve to. Never coerced to a number or band (D1.4). */
export type RiskAssessmentState = "assessed" | "unassessed" | "legacy" | "not-comparable";

export type RiskResponse = "reduce" | "avoid" | "share" | "accept" | "not-decided";

/** D3.6: stable `{ id, label }` bow-tie anchor, used for both `causes[]` and `consequences[]`. */
export interface RiskCauseOrConsequence {
  readonly id: string;
  readonly label: string;
}

/** D5.4: a reference to an externally authoritative record; original scale/rating is preserved as text, never converted. */
export interface RiskExternalRef {
  readonly sourceRegisterId: string;
  readonly externalId: string;
  readonly externalRating: string;
  readonly sourceUpdatedAt: string;
  /** Validated `https:` with no userinfo before write (D5.4); validation itself belongs to Core (Phase 1B). */
  readonly referenceUrl?: string;
  readonly reconciledAt: string;
}

// --- D3.5: control application (typed LinkEntity metadata, not a dedicated entity) -----------------

export type RiskControlApplicationRole = "preventive" | "recovery" | "both";
export type RiskControlEffectiveness = "not-assessed" | "ineffective" | "partially-effective" | "effective";

/** D3.5: permitted only when `LinkEntity.linkType === "mitigated-by"`. */
export interface RiskControlApplication {
  readonly role: RiskControlApplicationRole;
  readonly applicability: string;
  readonly effectiveness: RiskControlEffectiveness;
  readonly rationale?: string;
  /** Must resolve to the owning risk's `causes[].id` / `consequences[].id` (D3.6). */
  readonly anchorIds: readonly string[];
}

/** D3.6: returns the anchor IDs on `application` that do not resolve on `risk`; empty means valid. */
export function validateControlApplicationAnchors(
  risk: RiskEntity,
  application: RiskControlApplication
): readonly string[] {
  const knownAnchorIds = new Set<string>([
    ...(risk.causes ?? []).map((cause) => cause.id),
    ...(risk.consequences ?? []).map((consequence) => consequence.id)
  ]);
  return application.anchorIds.filter((anchorId) => !knownAnchorIds.has(anchorId));
}

// --- D2: risk framework (categories, methodology, appetite) ---------------

export interface RiskCategoryNode {
  readonly id: string;
  readonly label: string;
  readonly parentId?: string;
  readonly order: number;
  readonly archived: boolean;
}

export interface RiskMethodologyLevel {
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export interface RiskMethodologyBand {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly colourToken?: string;
}

export interface RiskMethodologyCell {
  readonly likelihoodId: string;
  readonly impactId: string;
  readonly bandId: string;
  readonly score?: number;
}

export interface RiskMethodologyRevision {
  readonly revisionId: string;
  /** Immutable once set (D2.4); a new revision is a new array element, never an in-place edit. */
  readonly activatedAt?: string;
  readonly likelihoodLevels: readonly RiskMethodologyLevel[];
  readonly impactLevels: readonly RiskMethodologyLevel[];
  readonly cells: readonly RiskMethodologyCell[];
  readonly bands: readonly RiskMethodologyBand[];
}

export interface RiskMethodology {
  readonly id: string;
  readonly label: string;
  readonly revisions: readonly RiskMethodologyRevision[];
}

export type RiskAppetiteScope =
  | { readonly kind: "workspace" }
  | { readonly kind: "category"; readonly categoryId: string };

export interface RiskAppetiteRule {
  readonly id: string;
  readonly scope: RiskAppetiteScope;
  readonly methodologyId: string;
  readonly revisionId: string;
  readonly allowedBandIds: readonly string[];
  readonly rationale: string;
  readonly effectiveFrom: string;
  readonly reviewBy?: string;
}

export interface RiskSourceRegisterDefinition {
  readonly id: string;
  readonly label: string;
}

export interface RiskPresentationPreset {
  readonly id: string;
  readonly label: string;
  readonly view: string;
  readonly config: Readonly<Record<string, unknown>>;
}

/** D2.1: Core-owned singleton, at most one non-deleted record per workspace. Workspace data, not VS Code settings. */
export interface RiskFrameworkEntity extends EntityEnvelope {
  readonly entityType: "risk-framework";
  readonly categories: readonly RiskCategoryNode[];
  readonly methodologies: readonly RiskMethodology[];
  readonly appetiteRules: readonly RiskAppetiteRule[];
  readonly sourceRegisters: readonly RiskSourceRegisterDefinition[];
  readonly presentationPresets: readonly RiskPresentationPreset[];
}

export const RISK_METHODOLOGY_MIN_LEVELS = 2;
export const RISK_METHODOLOGY_MAX_LEVELS = 10;

export interface RiskFrameworkValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * D2.4/D2.7: bounds-checks every methodology revision (2-10 levels per axis, every likelihood x impact
 * combination mapped to exactly one declared band, no unknown level/band references, no duplicate
 * revision IDs). When `previous` is supplied, also rejects an incoming activated revision whose content
 * differs from the previously stored activated revision with the same ID (D2.4 revision immutability).
 */
export function validateFramework(
  framework: RiskFrameworkEntity,
  previous?: RiskFrameworkEntity
): readonly RiskFrameworkValidationIssue[] {
  const issues: RiskFrameworkValidationIssue[] = [];
  const previousMethodologies = new Map(
    (previous?.methodologies ?? []).map((methodology) => [methodology.id, methodology])
  );

  for (const methodology of framework.methodologies) {
    const seenRevisionIds = new Set<string>();
    const previousRevisionsById = new Map(
      (previousMethodologies.get(methodology.id)?.revisions ?? []).map((revision) => [revision.revisionId, revision])
    );

    for (const revision of methodology.revisions) {
      const path = `${methodology.id}.${revision.revisionId}`;

      if (seenRevisionIds.has(revision.revisionId)) {
        issues.push({ path, message: "duplicate revisionId within methodology" });
      }
      seenRevisionIds.add(revision.revisionId);

      if (
        revision.likelihoodLevels.length < RISK_METHODOLOGY_MIN_LEVELS ||
        revision.likelihoodLevels.length > RISK_METHODOLOGY_MAX_LEVELS
      ) {
        issues.push({
          path,
          message: `likelihoodLevels must have between ${RISK_METHODOLOGY_MIN_LEVELS} and ${RISK_METHODOLOGY_MAX_LEVELS} levels`
        });
      }
      if (
        revision.impactLevels.length < RISK_METHODOLOGY_MIN_LEVELS ||
        revision.impactLevels.length > RISK_METHODOLOGY_MAX_LEVELS
      ) {
        issues.push({
          path,
          message: `impactLevels must have between ${RISK_METHODOLOGY_MIN_LEVELS} and ${RISK_METHODOLOGY_MAX_LEVELS} levels`
        });
      }

      const likelihoodIds = new Set(revision.likelihoodLevels.map((level) => level.id));
      const impactIds = new Set(revision.impactLevels.map((level) => level.id));
      const bandIds = new Set(revision.bands.map((band) => band.id));
      const seenCellKeys = new Set<string>();

      for (const cell of revision.cells) {
        const cellKey = `${cell.likelihoodId}:${cell.impactId}`;
        if (seenCellKeys.has(cellKey)) {
          issues.push({ path, message: `duplicate cell for ${cellKey}` });
        }
        seenCellKeys.add(cellKey);
        if (!likelihoodIds.has(cell.likelihoodId)) {
          issues.push({ path, message: `cell references unknown likelihood level ${cell.likelihoodId}` });
        }
        if (!impactIds.has(cell.impactId)) {
          issues.push({ path, message: `cell references unknown impact level ${cell.impactId}` });
        }
        if (!bandIds.has(cell.bandId)) {
          issues.push({ path, message: `cell references unknown band ${cell.bandId}` });
        }
      }

      for (const likelihood of revision.likelihoodLevels) {
        for (const impact of revision.impactLevels) {
          if (!seenCellKeys.has(`${likelihood.id}:${impact.id}`)) {
            issues.push({ path, message: `missing cell for ${likelihood.id}x${impact.id}` });
          }
        }
      }

      const previousRevision = previousRevisionsById.get(revision.revisionId);
      if (
        previousRevision &&
        isMethodologyRevisionActivated(previousRevision) &&
        !revisionsAreEqual(previousRevision, revision)
      ) {
        issues.push({ path, message: "revision is immutable once activated and cannot be modified" });
      }
    }
  }

  return issues;
}

export function isMethodologyRevisionActivated(revision: RiskMethodologyRevision): boolean {
  return typeof revision.activatedAt === "string" && revision.activatedAt.length > 0;
}

function revisionsAreEqual(a: RiskMethodologyRevision, b: RiskMethodologyRevision): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// --- D2.6/D2.7: appetite resolution ----------------------------------------

export type RiskAppetiteResolution =
  | { readonly state: "not-set" }
  | { readonly state: "in-appetite"; readonly ruleId: string; readonly stale: boolean }
  | { readonly state: "over-appetite"; readonly ruleId: string; readonly stale: boolean };

/**
 * D2.6: resolves the nearest explicit category rule (walking `parentId` upward from
 * `risk.primaryCategoryId`), else the workspace rule, else "Appetite not set". D2.7: an expired
 * (`reviewBy` in the past) rule still applies; the result is flagged `stale: true` rather than
 * treated as unset.
 */
export function resolveAppetite(
  risk: RiskEntity,
  framework: RiskFrameworkEntity | undefined,
  evaluation: RiskEvaluation,
  now: string
): RiskAppetiteResolution {
  if (!framework || !evaluation.methodologyRef || !evaluation.band) {
    return { state: "not-set" };
  }

  const candidates = framework.appetiteRules.filter(
    (rule) =>
      rule.methodologyId === evaluation.methodologyRef!.methodologyId &&
      rule.revisionId === evaluation.methodologyRef!.revisionId
  );

  const rule =
    findNearestCategoryAppetiteRule(candidates, framework.categories, risk.primaryCategoryId) ??
    candidates.find((candidate) => candidate.scope.kind === "workspace");

  if (!rule) {
    return { state: "not-set" };
  }

  const stale = typeof rule.reviewBy === "string" && rule.reviewBy.length > 0 && rule.reviewBy < now;
  const inAppetite = rule.allowedBandIds.includes(evaluation.band.id);

  return inAppetite
    ? { state: "in-appetite", ruleId: rule.id, stale }
    : { state: "over-appetite", ruleId: rule.id, stale };
}

function findNearestCategoryAppetiteRule(
  candidates: readonly RiskAppetiteRule[],
  categories: readonly RiskCategoryNode[],
  primaryCategoryId: string | undefined
): RiskAppetiteRule | undefined {
  if (!primaryCategoryId) {
    return undefined;
  }
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const visited = new Set<string>();
  let currentId: string | undefined = primaryCategoryId;

  while (currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    const match = candidates.find(
      (candidate) => candidate.scope.kind === "category" && candidate.scope.categoryId === currentId
    );
    if (match) {
      return match;
    }
    currentId = categoriesById.get(currentId)?.parentId;
  }
  return undefined;
}

// --- D1.5: legacy 5x5 methodology, encoding invariant E5 exactly -----------

function legacyBandFor(score: number): RiskEvaluationBand {
  if (score < 5) {
    return { id: "low", label: "Low", order: 1 };
  }
  if (score < 10) {
    return { id: "medium", label: "Medium", order: 2 };
  }
  if (score < 16) {
    return { id: "high", label: "High", order: 3 };
  }
  return { id: "extreme", label: "Extreme", order: 4 };
}

function buildLegacyCells(): readonly RiskMethodologyCell[] {
  const cells: RiskMethodologyCell[] = [];
  for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
    for (let impact = 1; impact <= 5; impact += 1) {
      const score = likelihood * impact;
      cells.push({ likelihoodId: `L${likelihood}`, impactId: `I${impact}`, bandId: legacyBandFor(score).id, score });
    }
  }
  return cells;
}

export const LEGACY_METHODOLOGY_ID = "legacy-5x5" as const;
export const LEGACY_METHODOLOGY_REVISION_ID = "r1" as const;

/** D2.5: seeded methodology matching invariant E5 exactly. Created by Phase 1B migration only; not auto-applied. */
export const LEGACY_5X5_METHODOLOGY: RiskMethodology = {
  id: LEGACY_METHODOLOGY_ID,
  label: "Legacy 5x5",
  revisions: [
    {
      revisionId: LEGACY_METHODOLOGY_REVISION_ID,
      activatedAt: "2026-09-07T00:00:00.000Z",
      likelihoodLevels: [1, 2, 3, 4, 5].map((n) => ({ id: `L${n}`, label: String(n), order: n })),
      impactLevels: [1, 2, 3, 4, 5].map((n) => ({ id: `I${n}`, label: String(n), order: n })),
      cells: buildLegacyCells(),
      bands: [
        { id: "low", label: "Low", order: 1 },
        { id: "medium", label: "Medium", order: 2 },
        { id: "high", label: "High", order: 3 },
        { id: "extreme", label: "Extreme", order: 4 }
      ]
    }
  ]
};

// --- D1.3: shared evaluator -------------------------------------------------

export interface RiskEvaluationBand {
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export interface RiskMethodologyRef {
  readonly methodologyId: string;
  readonly revisionId: string;
}

/** D1.3/D1.4: `band`/`score` are only ever present for `"legacy"` and `"assessed"` states. */
export interface RiskEvaluation {
  readonly state: RiskAssessmentState;
  readonly band?: RiskEvaluationBand;
  readonly score?: number;
  readonly methodologyRef?: RiskMethodologyRef;
  readonly explanation: readonly string[];
}

function evaluateLegacyScore(likelihood: number, impact: number): RiskEvaluation {
  const score = likelihood * impact;
  const band = legacyBandFor(score);
  return {
    state: "legacy",
    band,
    score,
    methodologyRef: { methodologyId: LEGACY_METHODOLOGY_ID, revisionId: LEGACY_METHODOLOGY_REVISION_ID },
    explanation: [`Legacy score ${likelihood} x ${impact} = ${score} (${band.label}).`]
  };
}

function evaluateCustomAssessment(
  assessment: CustomRiskAssessment,
  framework: RiskFrameworkEntity | undefined
): RiskEvaluation {
  const methodologyRef: RiskMethodologyRef = {
    methodologyId: assessment.methodologyId,
    revisionId: assessment.revisionId
  };
  const notComparable = (reason: string): RiskEvaluation => ({
    state: "not-comparable",
    methodologyRef,
    explanation: [reason]
  });

  if (!framework) {
    return notComparable("No risk framework is configured; a custom assessment cannot be resolved to a band.");
  }
  const methodology = framework.methodologies.find((entry) => entry.id === assessment.methodologyId);
  if (!methodology) {
    return notComparable(`Methodology ${assessment.methodologyId} is not defined in the risk framework.`);
  }
  const revision = methodology.revisions.find((entry) => entry.revisionId === assessment.revisionId);
  if (!revision) {
    return notComparable(
      `Revision ${assessment.revisionId} is not defined for methodology ${assessment.methodologyId}.`
    );
  }
  const cell = revision.cells.find(
    (entry) => entry.likelihoodId === assessment.current.likelihoodId && entry.impactId === assessment.current.impactId
  );
  if (!cell) {
    return notComparable("No matrix cell maps this likelihood/impact combination to a band.");
  }
  const band = revision.bands.find((entry) => entry.id === cell.bandId);
  if (!band) {
    return notComparable(`Cell references unknown band ${cell.bandId}.`);
  }

  return {
    state: "assessed",
    band: { id: band.id, label: band.label, order: band.order },
    score: cell.score,
    methodologyRef,
    explanation: [`Custom assessment against ${methodology.label} revision ${assessment.revisionId}: ${band.label}.`]
  };
}

/**
 * D1.3: the single shared evaluator. Every score consumer must call this rather than multiplying
 * `likelihood x impact` directly (D1.3/1.4); `unassessed` and `not-comparable` never carry a `band`
 * or `score`, so a missing/incomparable rating can never be silently read as zero or Low.
 */
export function evaluateRisk(risk: RiskEntity, framework?: RiskFrameworkEntity): RiskEvaluation {
  const assessment = risk.assessment;

  if (assessment === undefined) {
    // D1.2: no `assessment` means the entity's own likelihood/impact is the legacy projection.
    return evaluateLegacyScore(risk.likelihood, risk.impact);
  }

  switch (assessment.basis) {
    case "unassessed":
      return { state: "unassessed", explanation: ["No assessment has been recorded for this risk."] };
    case "legacy":
      return evaluateLegacyScore(assessment.likelihood, assessment.impact);
    case "custom":
      return evaluateCustomAssessment(assessment, framework);
    default:
      return assertNever(assessment);
  }
}

// --- D3.1/D3.3: roll-up hierarchy (`risk -> rolls-up-to -> risk`) ----------

export interface RollUpEdge {
  readonly fromId: string;
  readonly toId: string;
}

export interface RollUpValidationIssue {
  readonly riskId: string;
  readonly message: string;
}

export interface RollUpCycleResult {
  readonly hasCycle: boolean;
  readonly cyclePath?: readonly string[];
}

/** D3.1/D3.3: walks each outgoing edge toward its root; a self-link or repeated ancestor is a cycle. */
export function detectRollUpCycle(edges: readonly RollUpEdge[]): RollUpCycleResult {
  const parentOf = new Map<string, string>();
  for (const edge of edges) {
    parentOf.set(edge.fromId, edge.toId);
  }

  for (const edge of edges) {
    const path: string[] = [edge.fromId];
    const visited = new Set<string>([edge.fromId]);
    let current: string | undefined = edge.toId;

    while (current !== undefined) {
      if (current === edge.fromId) {
        return { hasCycle: true, cyclePath: [...path, current] };
      }
      if (visited.has(current)) {
        break;
      }
      path.push(current);
      visited.add(current);
      current = parentOf.get(current);
    }
  }

  return { hasCycle: false };
}

/**
 * D3.1/D3.3: full validation for a proposed `rolls-up-to` edge set — self-links, more than one
 * outgoing parent per risk, dangling endpoints against `knownRiskIds`, and cycles.
 */
export function validateRollUpEdges(
  edges: readonly RollUpEdge[],
  knownRiskIds: ReadonlySet<string>
): readonly RollUpValidationIssue[] {
  const issues: RollUpValidationIssue[] = [];
  const outgoingCountByFromId = new Map<string, number>();

  for (const edge of edges) {
    outgoingCountByFromId.set(edge.fromId, (outgoingCountByFromId.get(edge.fromId) ?? 0) + 1);

    if (edge.fromId === edge.toId) {
      issues.push({ riskId: edge.fromId, message: "a risk cannot roll up to itself" });
    }
    if (!knownRiskIds.has(edge.fromId)) {
      issues.push({ riskId: edge.fromId, message: "rolls-up-to source risk does not exist" });
    }
    if (!knownRiskIds.has(edge.toId)) {
      issues.push({ riskId: edge.toId, message: "rolls-up-to target risk does not exist" });
    }
  }

  for (const [riskId, count] of outgoingCountByFromId) {
    if (count > 1) {
      issues.push({ riskId, message: "a risk may have at most one rolls-up-to parent" });
    }
  }

  const cycle = detectRollUpCycle(edges);
  if (cycle.hasCycle) {
    for (const riskId of cycle.cyclePath ?? []) {
      issues.push({ riskId, message: "rolls-up-to graph contains a cycle" });
    }
  }

  return issues;
}

// --- D3.4: organisational control ------------------------------------------

export type RiskControlState = "proposed" | "active" | "retired";

/** D3.4: never modifies or duplicates the vendored ISM source-control catalogue; `sourceControlIds` is read-only reference. */
export interface RiskControlEntity extends EntityEnvelope {
  readonly entityType: "risk-control";
  readonly title: string;
  readonly definition: string;
  readonly ownerTeam: string;
  readonly state: RiskControlState;
  readonly reviewBy?: string;
  readonly sourceControlIds?: readonly string[];
}

// --- D4: risk events and escalation -----------------------------------------

export type RiskEventKind = "reassessed" | "reparented" | "reclassified" | "reconciled" | "escalation";
export type RiskEscalationState = "proposed" | "accepted" | "declined" | "withdrawn";

export interface RiskEscalationDetail {
  readonly state: RiskEscalationState;
  readonly destinationRiskId?: string;
  readonly governanceLabel?: string;
  readonly reason: string;
  readonly decidedAt?: string;
  readonly references?: readonly string[];
}

/**
 * D4.1/D4.2: Core is the only author, deriving events from the stored/incoming diff in the same
 * transaction as the mutating write (Phase 1B). Client-supplied `risk-event` entities are rejected
 * on write and on import unless they match an existing stored event byte-for-byte.
 */
export interface RiskEventEntity extends EntityEnvelope {
  readonly entityType: "risk-event";
  readonly riskId: string;
  readonly kind: RiskEventKind;
  readonly occurredAt: string;
  readonly summary: string;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly after?: Readonly<Record<string, unknown>>;
  readonly escalation?: RiskEscalationDetail;
}
