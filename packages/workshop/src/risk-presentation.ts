import {
  LEGACY_5X5_METHODOLOGY,
  evaluateRisk,
  resolveAppetite,
  type ActionEntity,
  type LinkEntity,
  type RiskControlEntity,
  type RiskEntity,
  type RiskEvaluation,
  type RiskEventEntity,
  type RiskFrameworkEntity,
  type RiskPresentationPreset
} from "@pspf/contracts";
import {
  buildRiskBowTieModel,
  buildRiskCoverageRows,
  buildRiskHierarchyForest,
  buildRiskMatrixModel,
  buildRiskTreatmentActions,
  riskAppetiteLabel,
  riskBandLabel,
  riskCategoryPath
} from "./risk-workbench.js";
import { formatShortAuDateTime, formatWorkshopLabel as label } from "./workshop-ui.js";

/**
 * Risk Presentation — Phase 4A of the Workshop Risk overhaul (ADR 0098 D5.1/D5.2). Pure,
 * deterministic construction of an allowlisted `RiskOutputModel` and safe copy-out renderers.
 * Every field an output can ever show is named explicitly here; there is no wildcard/spread of a
 * Risk, `risk-control`, or `risk-framework` record into any output.
 */

export type RiskOutputView = "register" | "hierarchy" | "matrix" | "bowtie" | "coverage" | "cards";
export type RiskOutputDensity = "compact" | "comfortable";
/** "filtered" currently degrades to "all": the live register search text is not yet plumbed into this builder. */
export type RiskOutputScope = "selected" | "filtered" | "all";
export type RiskOutputSectionId = "summary" | "detail" | "notes";

export const RISK_OUTPUT_VIEWS: readonly RiskOutputView[] = [
  "register",
  "hierarchy",
  "matrix",
  "bowtie",
  "coverage",
  "cards"
];

export function isRiskOutputView(value: unknown): value is RiskOutputView {
  return typeof value === "string" && (RISK_OUTPUT_VIEWS as readonly string[]).includes(value);
}

const RISK_OUTPUT_SECTION_IDS: readonly RiskOutputSectionId[] = ["summary", "detail", "notes"];
export const RISK_OUTPUT_DEFAULT_SECTION_ORDER: readonly RiskOutputSectionId[] = ["summary", "detail", "notes"];

function isRiskOutputSectionId(value: unknown): value is RiskOutputSectionId {
  return typeof value === "string" && (RISK_OUTPUT_SECTION_IDS as readonly string[]).includes(value);
}

/**
 * Every optional field an output may ever include, opted in by name (D5.2: never a wildcard).
 * All ten are `sensitive` under `PUBLICATION_FIELD_POLICIES` (directly, or — for `band`/`appetite` on
 * a custom-methodology risk — because they are derived from the sensitive `risk-framework` record);
 * including any one of them escalates the output's classification to `OFFICIAL: Sensitive`.
 */
export type RiskOutputFieldName =
  | "reference"
  | "band"
  | "appetite"
  | "primaryCategoryPath"
  | "ownerTeam"
  | "reviewBy"
  | "response"
  | "rationale"
  | "nextDecision"
  | "treatmentProgress";

const RISK_OUTPUT_FIELD_NAMES: readonly RiskOutputFieldName[] = [
  "reference",
  "band",
  "appetite",
  "primaryCategoryPath",
  "ownerTeam",
  "reviewBy",
  "response",
  "rationale",
  "nextDecision",
  "treatmentProgress"
];

function isRiskOutputFieldName(value: unknown): value is RiskOutputFieldName {
  return typeof value === "string" && (RISK_OUTPUT_FIELD_NAMES as readonly string[]).includes(value);
}

const RISK_OUTPUT_FIELD_LABELS: Readonly<Record<RiskOutputFieldName, string>> = {
  reference: "Reference",
  band: "Assessed band",
  appetite: "Appetite",
  primaryCategoryPath: "Category",
  ownerTeam: "Owner team",
  reviewBy: "Review by",
  response: "Response",
  rationale: "Rationale",
  nextDecision: "Next decision",
  treatmentProgress: "Treatment progress"
};

export interface RiskOutputPreset {
  readonly id: string;
  readonly label: string;
  readonly view: RiskOutputView;
  readonly density: RiskOutputDensity;
  readonly scope: RiskOutputScope;
  readonly sectionOrder: readonly RiskOutputSectionId[];
  /** Explicit opt-in list; only names from `RiskOutputFieldName` are ever accepted. */
  readonly fields: readonly RiskOutputFieldName[];
}

function builtInPreset(
  view: RiskOutputView,
  variant: "official" | "official-sensitive",
  fields: readonly RiskOutputFieldName[]
): RiskOutputPreset {
  return {
    id: `${view}-${variant}`,
    label: variant === "official" ? "Official" : "Official: Sensitive",
    view,
    density: "comfortable",
    scope: view === "bowtie" ? "selected" : "all",
    sectionOrder: RISK_OUTPUT_DEFAULT_SECTION_ORDER,
    fields
  };
}

const ALL_OPT_IN_FIELDS = RISK_OUTPUT_FIELD_NAMES;

/**
 * Built-in presets, used when the workspace's `risk-framework.presentationPresets` has none declared
 * for a view (D5.2/D2.1: presets are policy; these are the seeded defaults, not the only option).
 */
export const RISK_OUTPUT_BUILT_IN_PRESETS: readonly RiskOutputPreset[] = RISK_OUTPUT_VIEWS.flatMap((view) => [
  builtInPreset(view, "official", []),
  builtInPreset(view, "official-sensitive", ALL_OPT_IN_FIELDS)
]);

export function defaultRiskOutputPresetId(view: RiskOutputView): string {
  return `${view}-official`;
}

/**
 * D5.2/D2.1: resolves the presets declared for `view` from the workspace's `risk-framework`
 * (workspace policy), falling back to the built-in Official/Official: Sensitive pair when none are
 * configured. Stored config is defensively re-validated field-by-field; an unrecognised field name
 * or section id is dropped rather than passed through, so a stale or tampered record can never
 * introduce an unlisted field.
 */
export function resolveRiskOutputPresets(
  view: RiskOutputView,
  framework: RiskFrameworkEntity | undefined
): readonly RiskOutputPreset[] {
  const stored = (framework?.presentationPresets ?? [])
    .map((preset) => parseStoredRiskOutputPreset(preset))
    .filter((preset): preset is RiskOutputPreset => preset !== undefined && preset.view === view);
  return stored.length > 0 ? stored : RISK_OUTPUT_BUILT_IN_PRESETS.filter((preset) => preset.view === view);
}

function parseStoredRiskOutputPreset(stored: RiskPresentationPreset): RiskOutputPreset | undefined {
  if (!isRiskOutputView(stored.view)) {
    return undefined;
  }
  const config = stored.config ?? {};
  const rawFields = config.fields;
  const fields = Array.isArray(rawFields) ? rawFields.filter(isRiskOutputFieldName) : [];
  const density: RiskOutputDensity = config.density === "compact" ? "compact" : "comfortable";
  const scope: RiskOutputScope = config.scope === "selected" || config.scope === "filtered" ? config.scope : "all";
  const rawSectionOrder = config.sectionOrder;
  const sectionOrder = Array.isArray(rawSectionOrder) ? rawSectionOrder.filter(isRiskOutputSectionId) : [];
  return {
    id: stored.id,
    label: stored.label,
    view: stored.view,
    density,
    scope,
    sectionOrder: sectionOrder.length > 0 ? sectionOrder : RISK_OUTPUT_DEFAULT_SECTION_ORDER,
    fields
  };
}

export function findRiskOutputPreset(
  view: RiskOutputView,
  presetId: string | undefined,
  framework: RiskFrameworkEntity | undefined
): RiskOutputPreset {
  const presets = resolveRiskOutputPresets(view, framework);
  return presets.find((preset) => preset.id === presetId) ?? presets[0]!;
}

export interface RiskOutputContext {
  readonly risks: readonly RiskEntity[];
  readonly framework: RiskFrameworkEntity | undefined;
  readonly links: readonly LinkEntity[];
  readonly actions: readonly ActionEntity[];
  readonly controls: readonly RiskControlEntity[];
  readonly riskEvents: readonly RiskEventEntity[];
  readonly now: string;
}

export interface RiskOutputRowField {
  readonly name: RiskOutputFieldName;
  readonly label: string;
  readonly value: string;
}

export interface RiskOutputRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly methodologyBasis: string;
  /** Always populated with a safe value; the real band for a custom-methodology risk only appears here when "band" is opted in (see `fields`). */
  readonly bandLabel: string;
  readonly depth: number;
  readonly fields: readonly RiskOutputRowField[];
}

export interface RiskOutputMatrixCell {
  readonly likelihoodLabel: string;
  readonly impactLabel: string;
  readonly bandLabel: string;
  readonly count: number;
}

export interface RiskOutputMatrixModel {
  readonly likelihoodLabels: readonly string[];
  readonly impactLabels: readonly string[];
  readonly cells: readonly RiskOutputMatrixCell[];
  readonly unassessedCount: number;
  readonly notComparableCount: number;
}

export interface RiskOutputBowTieRow {
  readonly label: string;
  readonly controlTitles: readonly string[];
}

export interface RiskOutputBowTieModel {
  readonly eventTitle: string;
  readonly causes: readonly RiskOutputBowTieRow[];
  readonly consequences: readonly RiskOutputBowTieRow[];
  readonly gapCount: number;
}

export interface RiskOutputModel {
  readonly view: RiskOutputView;
  readonly presetId: string;
  /** "OFFICIAL" when no opted-in field is sensitive-tier; "OFFICIAL: Sensitive" the moment one is. */
  readonly classification: "OFFICIAL" | "OFFICIAL: Sensitive";
  readonly title: string;
  readonly asOfIso: string;
  readonly scopeLabel: string;
  readonly density: RiskOutputDensity;
  readonly sectionOrder: readonly RiskOutputSectionId[];
  readonly rows: readonly RiskOutputRow[];
  readonly matrix?: RiskOutputMatrixModel;
  readonly bowtie?: RiskOutputBowTieModel;
  readonly notes: readonly string[];
  readonly excludedFieldNames: readonly RiskOutputFieldName[];
}

function methodologyBasisLabel(evaluation: RiskEvaluation): string {
  switch (evaluation.state) {
    case "unassessed":
      return "Unassessed";
    case "not-comparable":
      return "Not comparable";
    case "legacy":
      return "Legacy 5x5";
    case "assessed":
      return "Custom methodology";
  }
}

/** Safe (never-gated) band text: E5/constant wording for legacy/unassessed/not-comparable; a generic placeholder for custom, whose real band lives behind the opt-in "band" field. */
function safeBandLabel(evaluation: RiskEvaluation): string {
  if (evaluation.state === "legacy" || evaluation.state === "unassessed" || evaluation.state === "not-comparable") {
    return riskBandLabel(evaluation);
  }
  return "Assessed (see opted-in band)";
}

function rationaleFor(risk: RiskEntity): string {
  const assessment = risk.assessment;
  if (assessment?.basis === "legacy" || assessment?.basis === "custom") {
    return assessment.rationale?.trim() || "No rationale recorded";
  }
  return "No rationale recorded";
}

function nextDecisionFor(risk: RiskEntity, context: RiskOutputContext): string {
  const pendingEscalation = context.riskEvents
    .filter(
      (event) =>
        event.recordStatus !== "deleted" &&
        event.riskId === risk.id &&
        event.kind === "escalation" &&
        event.escalation?.state === "proposed"
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (pendingEscalation?.escalation) {
    return `Escalation decision pending: ${pendingEscalation.escalation.reason}`;
  }
  if (risk.reviewBy) {
    return `Review by ${formatShortAuDateTime(risk.reviewBy) ?? risk.reviewBy}`;
  }
  return "No decision pending";
}

function treatmentProgressFor(risk: RiskEntity, context: RiskOutputContext): string {
  const rows = buildRiskTreatmentActions(risk, context.links, context.actions, context.risks);
  if (rows.length === 0) {
    return "No treatments recorded";
  }
  const done = rows.filter((row) => row.action.status === "done").length;
  return `${done} of ${rows.length} treatment${rows.length === 1 ? "" : "s"} complete`;
}

function buildRowFields(
  risk: RiskEntity,
  evaluation: RiskEvaluation,
  context: RiskOutputContext,
  preset: RiskOutputPreset
): readonly RiskOutputRowField[] {
  const appetite = resolveAppetite(risk, context.framework, evaluation, context.now);
  const fields: RiskOutputRowField[] = [];
  const include = (name: RiskOutputFieldName): boolean => preset.fields.includes(name);
  if (include("reference") && risk.reference) {
    fields.push({ name: "reference", label: RISK_OUTPUT_FIELD_LABELS.reference, value: risk.reference });
  }
  if (include("band") && evaluation.state === "assessed") {
    fields.push({ name: "band", label: RISK_OUTPUT_FIELD_LABELS.band, value: riskBandLabel(evaluation) });
  }
  if (include("appetite")) {
    fields.push({ name: "appetite", label: RISK_OUTPUT_FIELD_LABELS.appetite, value: riskAppetiteLabel(appetite) });
  }
  if (include("primaryCategoryPath")) {
    fields.push({
      name: "primaryCategoryPath",
      label: RISK_OUTPUT_FIELD_LABELS.primaryCategoryPath,
      value: riskCategoryPath(context.framework, risk.primaryCategoryId)
    });
  }
  if (include("ownerTeam")) {
    fields.push({
      name: "ownerTeam",
      label: RISK_OUTPUT_FIELD_LABELS.ownerTeam,
      value: risk.ownerTeam ?? "Not assigned"
    });
  }
  if (include("reviewBy")) {
    fields.push({
      name: "reviewBy",
      label: RISK_OUTPUT_FIELD_LABELS.reviewBy,
      value: risk.reviewBy ? (formatShortAuDateTime(risk.reviewBy) ?? risk.reviewBy) : "Not set"
    });
  }
  if (include("response")) {
    fields.push({
      name: "response",
      label: RISK_OUTPUT_FIELD_LABELS.response,
      value: label(risk.response ?? "not-decided")
    });
  }
  if (include("rationale")) {
    fields.push({ name: "rationale", label: RISK_OUTPUT_FIELD_LABELS.rationale, value: rationaleFor(risk) });
  }
  if (include("nextDecision")) {
    fields.push({
      name: "nextDecision",
      label: RISK_OUTPUT_FIELD_LABELS.nextDecision,
      value: nextDecisionFor(risk, context)
    });
  }
  if (include("treatmentProgress")) {
    fields.push({
      name: "treatmentProgress",
      label: RISK_OUTPUT_FIELD_LABELS.treatmentProgress,
      value: treatmentProgressFor(risk, context)
    });
  }
  return fields;
}

function buildRow(
  risk: RiskEntity,
  depth: number,
  context: RiskOutputContext,
  preset: RiskOutputPreset
): RiskOutputRow {
  const evaluation = evaluateRisk(risk, context.framework);
  return {
    id: risk.id,
    title: risk.title,
    status: label(risk.status),
    methodologyBasis: methodologyBasisLabel(evaluation),
    bandLabel: safeBandLabel(evaluation),
    depth,
    fields: buildRowFields(risk, evaluation, context, preset)
  };
}

function scopedRisks(
  context: RiskOutputContext,
  preset: RiskOutputPreset,
  selectedRiskId: string | undefined
): readonly RiskEntity[] {
  const nonDeleted = context.risks.filter((risk) => risk.recordStatus !== "deleted");
  if (preset.scope === "selected") {
    return nonDeleted.filter((risk) => risk.id === selectedRiskId);
  }
  return nonDeleted;
}

function classificationFor(preset: RiskOutputPreset): "OFFICIAL" | "OFFICIAL: Sensitive" {
  return preset.fields.length > 0 ? "OFFICIAL: Sensitive" : "OFFICIAL";
}

function scopeLabelFor(preset: RiskOutputPreset, count: number): string {
  if (preset.scope === "selected") {
    return "Selected risk";
  }
  return `${count} risk${count === 1 ? "" : "s"} \u00b7 ${preset.scope === "filtered" ? "current filter (not yet distinguished from all)" : "all"}`;
}

export interface RiskOutputBuildOptions {
  readonly selectedRiskId?: string;
}

/**
 * D5.2: the single allowlisted builder for every present/copy output. `view` selects which shape of
 * `RiskOutputModel` is populated (`rows` always; `matrix`/`bowtie` only for their own view). No field
 * is ever included unless it is named in `preset.fields`, and the classification always reflects
 * exactly what was included.
 */
export function buildRiskOutputModel(
  view: RiskOutputView,
  context: RiskOutputContext,
  preset: RiskOutputPreset,
  options: RiskOutputBuildOptions = {}
): RiskOutputModel {
  const risks = scopedRisks(context, preset, options.selectedRiskId);
  const notes: string[] = [];
  let rows: readonly RiskOutputRow[] = [];
  let matrix: RiskOutputMatrixModel | undefined;
  let bowtie: RiskOutputBowTieModel | undefined;

  if (view === "register" || view === "coverage" || view === "cards") {
    const sorted = [...risks].sort((left, right) => left.title.localeCompare(right.title, "en-AU"));
    rows = sorted.map((risk) => buildRow(risk, 0, context, preset));
    if (view === "coverage") {
      const coverageRows = buildRiskCoverageRows(risks, context.links, context.framework);
      const uncovered = coverageRows.filter((row) => row.uncovered).length;
      notes.push(`${uncovered} of ${coverageRows.length} risk(s) have no direct or descendant treatment or control.`);
    }
  } else if (view === "hierarchy") {
    const forest = buildRiskHierarchyForest(risks, context.framework, context.links, context.now);
    const flattened: RiskOutputRow[] = [];
    const visit = (node: ReturnType<typeof buildRiskHierarchyForest>[number], depth: number): void => {
      flattened.push(buildRow(node.risk, depth, context, preset));
      for (const child of node.children) {
        visit(child, depth + 1);
      }
    };
    for (const root of forest) {
      visit(root, 0);
    }
    rows = flattened;
  } else if (view === "matrix") {
    rows = [...risks]
      .sort((left, right) => left.title.localeCompare(right.title, "en-AU"))
      .map((risk) => buildRow(risk, 0, context, preset));
    // Matches the existing Matrix view (renderRiskMatrixContent): Legacy 5x5 only, since custom-methodology
    // matrix authoring does not exist yet in Workshop (Phase 2 Record, "Known follow-ups").
    const revision = LEGACY_5X5_METHODOLOGY.revisions[0]!;
    const matrixModel = buildRiskMatrixModel(risks, revision);
    matrix = {
      likelihoodLabels: matrixModel.likelihoodLevels.map((level) => level.label),
      impactLabels: matrixModel.impactLevels.map((level) => level.label),
      cells: matrixModel.cells.map((cell) => ({
        likelihoodLabel:
          matrixModel.likelihoodLevels.find((level) => level.id === cell.likelihoodId)?.label ?? cell.likelihoodId,
        impactLabel: matrixModel.impactLevels.find((level) => level.id === cell.impactId)?.label ?? cell.impactId,
        bandLabel: cell.bandLabel,
        count: cell.count
      })),
      unassessedCount: matrixModel.unassessedCount,
      notComparableCount: matrixModel.notComparableCount
    };
    notes.push(
      `${matrix.unassessedCount} unassessed and ${matrix.notComparableCount} not comparable, excluded from the matrix.`
    );
  } else if (view === "bowtie") {
    const selected = risks[0];
    if (selected) {
      rows = [buildRow(selected, 0, context, preset)];
      const model = buildRiskBowTieModel(selected, context.links, context.controls);
      bowtie = {
        eventTitle: selected.title,
        causes: model.causes.map((row) => ({ label: row.cause.label, controlTitles: row.preventiveControlTitles })),
        consequences: model.consequences.map((row) => ({
          label: row.consequence.label,
          controlTitles: row.recoveryControlTitles
        })),
        gapCount:
          model.causes.filter((row) => row.preventiveControlTitles.length === 0).length +
          model.consequences.filter((row) => row.recoveryControlTitles.length === 0).length
      };
      if (bowtie.gapCount > 0) {
        notes.push(`${bowtie.gapCount} cause(s)/consequence(s) have no recorded control.`);
      }
    }
  }

  const excludedFieldNames = RISK_OUTPUT_FIELD_NAMES.filter((name) => !preset.fields.includes(name));
  return {
    view,
    presetId: preset.id,
    classification: classificationFor(preset),
    title: `Risk ${viewLabel(view)}`,
    asOfIso: context.now,
    scopeLabel: scopeLabelFor(preset, rows.length),
    density: preset.density,
    sectionOrder: preset.sectionOrder,
    rows,
    matrix,
    bowtie,
    notes,
    excludedFieldNames
  };
}

function viewLabel(view: RiskOutputView): string {
  switch (view) {
    case "register":
      return "register";
    case "hierarchy":
      return "hierarchy";
    case "matrix":
      return "matrix";
    case "bowtie":
      return "bow-tie";
    case "coverage":
      return "coverage";
    case "cards":
      return "executive cards";
  }
}

function asOfLine(model: RiskOutputModel): string {
  return `As of ${formatShortAuDateTime(model.asOfIso) ?? model.asOfIso} \u00b7 ${model.scopeLabel}`;
}

function rowLinesPlainText(row: RiskOutputRow, density: RiskOutputDensity): readonly string[] {
  const indent = "  ".repeat(row.depth);
  const head = `${indent}${row.title} (${row.id}) \u2014 ${row.status} \u00b7 ${row.methodologyBasis} \u00b7 ${row.bandLabel}`;
  if (row.fields.length === 0) {
    return [head];
  }
  if (density === "compact") {
    return [`${head} \u00b7 ${row.fields.map((field) => `${field.label}: ${field.value}`).join(" \u00b7 ")}`];
  }
  return [head, ...row.fields.map((field) => `${indent}  ${field.label}: ${field.value}`)];
}

/** Plain text copy-out; the same text is reused (via a client-side canvas) to render the PNG output. */
export function renderRiskOutputPlainText(model: RiskOutputModel): string {
  const lines: string[] = [];
  for (const section of model.sectionOrder) {
    if (section === "summary") {
      lines.push(model.classification, model.title, asOfLine(model), "");
    }
    if (section === "detail") {
      if (model.matrix) {
        lines.push(
          `Matrix (likelihood \u00d7 impact): ${model.matrix.cells.map((cell) => `${cell.likelihoodLabel}/${cell.impactLabel}=${cell.count} (${cell.bandLabel})`).join(", ")}`,
          ""
        );
      }
      if (model.bowtie) {
        lines.push(`Event: ${model.bowtie.eventTitle}`);
        for (const cause of model.bowtie.causes) {
          lines.push(
            `  Cause: ${cause.label} \u2192 ${cause.controlTitles.join("; ") || "No preventive control recorded"}`
          );
        }
        for (const consequence of model.bowtie.consequences) {
          lines.push(
            `  Consequence: ${consequence.label} \u2192 ${consequence.controlTitles.join("; ") || "No recovery control recorded"}`
          );
        }
        lines.push("");
      }
      for (const row of model.rows) {
        lines.push(...rowLinesPlainText(row, model.density));
      }
      lines.push("");
    }
    if (section === "notes" && model.notes.length > 0) {
      lines.push(...model.notes, "");
    }
  }
  return lines.join("\n").trimEnd();
}

/** Markdown copy-out. */
export function renderRiskOutputMarkdown(model: RiskOutputModel): string {
  const lines: string[] = [];
  for (const section of model.sectionOrder) {
    if (section === "summary") {
      lines.push(`${model.classification}`, "", `# ${model.title}`, "", asOfLine(model), "");
    }
    if (section === "detail") {
      if (model.matrix) {
        lines.push("## Matrix", "");
        for (const cell of model.matrix.cells) {
          lines.push(`- ${cell.likelihoodLabel} \u00d7 ${cell.impactLabel}: **${cell.count}** (${cell.bandLabel})`);
        }
        lines.push("");
      }
      if (model.bowtie) {
        lines.push(`## Bow-tie: ${model.bowtie.eventTitle}`, "", "### Causes \u2192 preventive controls", "");
        for (const cause of model.bowtie.causes) {
          lines.push(`- ${cause.label}: ${cause.controlTitles.join("; ") || "No preventive control recorded"}`);
        }
        lines.push("", "### Consequences \u2192 recovery controls", "");
        for (const consequence of model.bowtie.consequences) {
          lines.push(
            `- ${consequence.label}: ${consequence.controlTitles.join("; ") || "No recovery control recorded"}`
          );
        }
        lines.push("");
      }
      if (model.rows.length > 0) {
        lines.push("## Risks", "");
        for (const row of model.rows) {
          const indent = "  ".repeat(row.depth);
          lines.push(
            `${indent}- **${row.title}** (${row.id}) \u2014 ${row.status} \u00b7 ${row.methodologyBasis} \u00b7 ${row.bandLabel}`
          );
          for (const field of row.fields) {
            lines.push(`${indent}  - ${field.label}: ${field.value}`);
          }
        }
        lines.push("");
      }
    }
    if (section === "notes" && model.notes.length > 0) {
      lines.push("## Notes", "", ...model.notes.map((note) => `- ${note}`), "");
    }
  }
  return lines.join("\n").trimEnd();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Self-contained print HTML: inline styles only, no external resources, no script. */
export function renderRiskOutputPrintHtml(model: RiskOutputModel): string {
  const rowsHtml = model.rows
    .map(
      (row) => `<tr style="padding-left:${row.depth * 16}px">
      <td>${escapeHtml(row.title)}</td>
      <td>${escapeHtml(row.id)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.methodologyBasis)}</td>
      <td>${escapeHtml(row.bandLabel)}</td>
      <td>${row.fields.map((field) => `${escapeHtml(field.label)}: ${escapeHtml(field.value)}`).join("<br>")}</td>
    </tr>`
    )
    .join("");
  const matrixHtml = model.matrix
    ? `<h2>Matrix</h2><table border="1" cellpadding="4"><tbody>${model.matrix.cells
        .map(
          (cell) =>
            `<tr><td>${escapeHtml(cell.likelihoodLabel)}</td><td>${escapeHtml(cell.impactLabel)}</td><td>${escapeHtml(cell.bandLabel)}</td><td>${cell.count}</td></tr>`
        )
        .join("")}</tbody></table>`
    : "";
  const bowtieHtml = model.bowtie
    ? `<h2>Bow-tie: ${escapeHtml(model.bowtie.eventTitle)}</h2>
      <h3>Causes</h3><ul>${model.bowtie.causes.map((cause) => `<li>${escapeHtml(cause.label)}: ${escapeHtml(cause.controlTitles.join("; ") || "No preventive control recorded")}</li>`).join("")}</ul>
      <h3>Consequences</h3><ul>${model.bowtie.consequences.map((consequence) => `<li>${escapeHtml(consequence.label)}: ${escapeHtml(consequence.controlTitles.join("; ") || "No recovery control recorded")}</li>`).join("")}</ul>`
    : "";
  const notesHtml =
    model.notes.length > 0
      ? `<h2>Notes</h2><ul>${model.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
      : "";
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>${escapeHtml(model.title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 13px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; color: #555; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <p class="eyebrow">${escapeHtml(model.classification)}</p>
  <h1>${escapeHtml(model.title)}</h1>
  <p>${escapeHtml(asOfLine(model))}</p>
  ${matrixHtml}
  ${bowtieHtml}
  ${
    model.rows.length > 0
      ? `<table><thead><tr><th>Title</th><th>ID</th><th>Status</th><th>Methodology/basis</th><th>Band</th><th>Details</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
      : ""
  }
  ${notesHtml}
</body>
</html>`;
}
