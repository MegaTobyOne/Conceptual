// Phase 3B (ADR 0098, v1.75.0): source-register crosswalk matching and preview.
// Pure and deterministic: no I/O, no CSV parsing (that is a Workshop-side concern), no persistence.
// Shared by the Workshop preview UI and Core's pre-commit revalidation so both compute the same answer.
import { createEntityId, nowIso, VERSION_AXES, type RiskEntity } from "./index.js";
import { sameExternalIdentity, validateRiskExternalRef, type RiskExternalRef } from "./risk-model.js";

/** One column of the manual/CSV field template (D5.4 shape, minus `sourceRegisterId`/`reconciledAt`, which are set by the import flow, not per-row). */
export interface RiskCrosswalkTemplateField {
  readonly key: "title" | "externalId" | "externalRating" | "sourceUpdatedAt" | "referenceUrl";
  readonly label: string;
  readonly required: boolean;
}

export const RISK_CROSSWALK_TEMPLATE_FIELDS: readonly RiskCrosswalkTemplateField[] = [
  { key: "title", label: "Title", required: true },
  { key: "externalId", label: "External ID", required: true },
  { key: "externalRating", label: "External rating", required: true },
  { key: "sourceUpdatedAt", label: "Source updated", required: true },
  { key: "referenceUrl", label: "Reference URL", required: false }
];

/** A single row after column mapping has been applied; `sourceRegisterId` is fixed for the whole import (one register per run). */
export interface RiskCrosswalkRowInput {
  readonly rowNumber: number;
  readonly title: string;
  readonly externalId: string;
  readonly externalRating: string;
  readonly sourceUpdatedAt: string;
  readonly referenceUrl?: string;
}

export function validateRiskCrosswalkRowInput(row: RiskCrosswalkRowInput): readonly string[] {
  const issues: string[] = [];
  if (!row.title || row.title.trim().length === 0) {
    issues.push("Title is required.");
  }
  if (!row.externalId || row.externalId.trim().length === 0) {
    issues.push("External ID is required.");
  }
  if (!row.externalRating || row.externalRating.trim().length === 0) {
    issues.push("External rating is required.");
  }
  if (!row.sourceUpdatedAt || Number.isNaN(Date.parse(row.sourceUpdatedAt))) {
    issues.push("Source updated must be a valid date.");
  }
  if (row.referenceUrl !== undefined && row.referenceUrl.trim().length > 0) {
    const refIssues = validateRiskExternalRef({
      sourceRegisterId: "placeholder",
      externalId: row.externalId || "placeholder",
      externalRating: row.externalRating || "placeholder",
      sourceUpdatedAt: row.sourceUpdatedAt || nowIso(),
      referenceUrl: row.referenceUrl,
      reconciledAt: nowIso()
    }).filter((issue) => issue.startsWith("referenceUrl"));
    issues.push(...refIssues);
  }
  return issues;
}

export type RiskCrosswalkRowAction = "create" | "reuse" | "update" | "conflict" | "unmatched";

export interface RiskCrosswalkPreviewRow {
  readonly rowNumber: number;
  readonly action: RiskCrosswalkRowAction;
  readonly input: RiskCrosswalkRowInput;
  /** Set for `reuse`/`update`: the existing Risk already carrying this external identity. */
  readonly matchedRiskId?: string;
  /** Set for `unmatched`: an existing Risk with a similar title but no matching external identity — never merged automatically. */
  readonly possibleDuplicateOfRiskId?: string;
  readonly issues: readonly string[];
}

/** D5.4 match key: an existing Risk carries this external identity in its `externalRefs`. */
export function findRiskByExternalIdentity(
  sourceRegisterId: string,
  externalId: string,
  existingRisks: readonly RiskEntity[]
): RiskEntity | undefined {
  return existingRisks.find((risk) =>
    (risk.externalRefs ?? []).some((ref) => sameExternalIdentity(ref, { sourceRegisterId, externalId }))
  );
}

function normaliseTitle(title: string): string {
  return title.trim().toLocaleLowerCase("en-AU").replace(/\s+/g, " ");
}

/** Cheap Levenshtein distance; titles are short operator-entered strings, so no need for a faster algorithm. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    distances[i]![0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    distances[0]![j] = j;
  }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i]![j] = Math.min(
        distances[i - 1]![j]! + 1,
        distances[i]![j - 1]! + 1,
        distances[i - 1]![j - 1]! + cost
      );
    }
  }
  return distances[rows - 1]![cols - 1]!;
}

/**
 * A possible duplicate is a title-similarity signal only (never an automatic merge, per the External
 * Registers design note). Exact match after normalisation, or a small edit distance relative to length.
 */
export function findPossibleDuplicateByTitle(title: string, candidates: readonly RiskEntity[]): RiskEntity | undefined {
  const normalisedTarget = normaliseTitle(title);
  if (normalisedTarget.length === 0) {
    return undefined;
  }
  for (const candidate of candidates) {
    const normalisedCandidate = normaliseTitle(candidate.title);
    if (normalisedCandidate === normalisedTarget) {
      return candidate;
    }
    const maxLength = Math.max(normalisedCandidate.length, normalisedTarget.length);
    if (maxLength === 0) {
      continue;
    }
    const distance = levenshteinDistance(normalisedCandidate, normalisedTarget);
    if (distance / maxLength <= 0.15) {
      return candidate;
    }
  }
  return undefined;
}

/** D5.4: fields compared for idempotency, deliberately excluding `reconciledAt` (a provenance stamp, not row data). */
function externalRefDataEquals(a: RiskExternalRef, b: RiskExternalRef): boolean {
  return (
    a.sourceRegisterId === b.sourceRegisterId &&
    a.externalId === b.externalId &&
    a.externalRating === b.externalRating &&
    a.sourceUpdatedAt === b.sourceUpdatedAt &&
    (a.referenceUrl ?? "") === (b.referenceUrl ?? "")
  );
}

export function buildExternalRefFromRow(
  row: RiskCrosswalkRowInput,
  sourceRegisterId: string,
  reconciledAt: string
): RiskExternalRef {
  return {
    sourceRegisterId,
    externalId: row.externalId,
    externalRating: row.externalRating,
    sourceUpdatedAt: row.sourceUpdatedAt,
    referenceUrl: row.referenceUrl,
    reconciledAt
  };
}

/**
 * D5.4/§External Registers: previews every row against the current store. Matching by stable external
 * identity only; title similarity may only flag a possible duplicate as `unmatched`, staged outside the
 * live graph — it is never used to select a merge target automatically.
 */
export function buildRiskCrosswalkPreview(
  rows: readonly RiskCrosswalkRowInput[],
  existingRisks: readonly RiskEntity[],
  sourceRegisterId: string,
  now: string = nowIso()
): readonly RiskCrosswalkPreviewRow[] {
  const nonDeletedRisks = existingRisks.filter((risk) => risk.recordStatus !== "deleted");
  return rows.map((row): RiskCrosswalkPreviewRow => {
    const rowIssues = validateRiskCrosswalkRowInput(row);
    if (rowIssues.length > 0) {
      return { rowNumber: row.rowNumber, action: "conflict", input: row, issues: rowIssues };
    }
    const matched = findRiskByExternalIdentity(sourceRegisterId, row.externalId, nonDeletedRisks);
    if (matched) {
      const incomingRef = buildExternalRefFromRow(row, sourceRegisterId, now);
      const storedRef = (matched.externalRefs ?? []).find((ref) => sameExternalIdentity(ref, incomingRef));
      const unchanged = storedRef !== undefined && externalRefDataEquals(storedRef, incomingRef);
      return {
        rowNumber: row.rowNumber,
        action: unchanged ? "reuse" : "update",
        input: row,
        matchedRiskId: matched.id,
        issues: []
      };
    }
    const possibleDuplicate = findPossibleDuplicateByTitle(
      row.title,
      nonDeletedRisks.filter(
        (risk) =>
          !(risk.externalRefs ?? []).some(
            (ref) => ref.sourceRegisterId === sourceRegisterId && ref.externalId === row.externalId
          )
      )
    );
    if (possibleDuplicate) {
      return {
        rowNumber: row.rowNumber,
        action: "unmatched",
        input: row,
        possibleDuplicateOfRiskId: possibleDuplicate.id,
        issues: [
          `Title resembles existing Risk ${possibleDuplicate.id} (${possibleDuplicate.title}); not linked automatically.`
        ]
      };
    }
    return { rowNumber: row.rowNumber, action: "create", input: row, issues: [] };
  });
}

/**
 * Applies only `create`/`update` rows (D5.4). `reuse` produces no write (idempotency); `conflict` and
 * `unmatched` are staged outside the live graph and never written. New Risks get an explicit
 * `unassessed` basis and a neutral legacy placeholder score, since `likelihood`/`impact` remain
 * required fields (D6.2) but are never read once `assessment` is present (D1.2/evaluateRisk).
 */
export function buildRiskCrosswalkWriteSet(
  confirmedRows: readonly RiskCrosswalkPreviewRow[],
  existingRisks: readonly RiskEntity[],
  sourceRegisterId: string,
  now: string = nowIso(),
  createId: () => string = () => createEntityId("risk")
): readonly RiskEntity[] {
  const existingById = new Map(existingRisks.map((risk) => [risk.id, risk]));
  const writeSet: RiskEntity[] = [];
  for (const row of confirmedRows) {
    if (row.action === "create") {
      writeSet.push({
        id: createId(),
        entityType: "risk",
        schemaVersion: VERSION_AXES.schemaVersion,
        createdAt: now,
        updatedAt: now,
        sourceProduct: "workshop",
        recordStatus: "active",
        title: row.input.title,
        status: "open",
        likelihood: 1,
        impact: 1,
        assessment: { basis: "unassessed" },
        externalRefs: [buildExternalRefFromRow(row.input, sourceRegisterId, now)]
      } as RiskEntity);
      continue;
    }
    if (row.action === "update" && row.matchedRiskId) {
      const existing = existingById.get(row.matchedRiskId);
      if (!existing) {
        continue;
      }
      const incomingRef = buildExternalRefFromRow(row.input, sourceRegisterId, now);
      const otherRefs = (existing.externalRefs ?? []).filter((ref) => !sameExternalIdentity(ref, incomingRef));
      writeSet.push({ ...existing, externalRefs: [...otherRefs, incomingRef], updatedAt: now });
    }
  }
  return writeSet;
}
