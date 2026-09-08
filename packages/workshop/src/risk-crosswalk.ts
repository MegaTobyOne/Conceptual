import { parse } from "csv-parse/sync";
import {
  RISK_CROSSWALK_TEMPLATE_FIELDS,
  type RiskCrosswalkRowInput,
  type RiskCrosswalkTemplateField
} from "@pspf/contracts";

/**
 * Risk Crosswalk (Phase 3B, ADR 0098 §External Registers) — Workshop-side CSV/TSV parsing and column
 * mapping. Matching, preview, and write-set logic are pure and live in `@pspf/contracts`'s
 * `risk-crosswalk.ts` so Core can reuse the identical logic when it revalidates before commit; this
 * file only concerns the file-format/column-mapping step that is specific to reading an operator file.
 */

export const RISK_CROSSWALK_TSV_TEMPLATE_HEADER =
  "Title\tExternal ID\tExternal Rating\tSource Updated\tReference URL\n";

const TEMPLATE_HEADER_ALIASES: Readonly<Record<RiskCrosswalkTemplateField["key"], readonly string[]>> = {
  title: ["title", "risk", "risk title", "name"],
  externalId: ["external id", "externalid", "id", "ref", "external ref"],
  externalRating: ["external rating", "rating", "severity", "risk rating"],
  sourceUpdatedAt: ["source updated", "sourceupdatedat", "updated", "last updated", "date"],
  referenceUrl: ["reference url", "url", "link", "referenceurl"]
};

function normaliseHeader(header: string): string {
  return header.trim().toLocaleLowerCase("en-AU");
}

export interface RiskCrosswalkParsedFile {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
}

/** `delimiter` is inferred from the file extension by the caller; both CSV and TSV use the same parser. */
export function parseRiskCrosswalkDelimitedText(text: string, delimiter: "," | "\t"): RiskCrosswalkParsedFile {
  const records = parse(text, {
    columns: true,
    delimiter,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  }) as Record<string, string>[];
  const headers = records.length > 0 ? Object.keys(records[0]!) : [];
  return { headers, rows: records };
}

/** Maps each template field to a detected header name, or `undefined` when no alias matches (needs manual mapping). */
export type RiskCrosswalkColumnMapping = Readonly<Partial<Record<RiskCrosswalkTemplateField["key"], string>>>;

export function detectRiskCrosswalkColumnMapping(headers: readonly string[]): RiskCrosswalkColumnMapping {
  const mapping: Record<string, string> = {};
  for (const field of RISK_CROSSWALK_TEMPLATE_FIELDS) {
    const aliases = TEMPLATE_HEADER_ALIASES[field.key];
    const match = headers.find((header) => aliases.includes(normaliseHeader(header)));
    if (match) {
      mapping[field.key] = match;
    }
  }
  return mapping;
}

/** Template fields the mapping could not resolve; the import flow must ask the operator to map these manually. */
export function unmappedRequiredFields(mapping: RiskCrosswalkColumnMapping): readonly RiskCrosswalkTemplateField[] {
  return RISK_CROSSWALK_TEMPLATE_FIELDS.filter((field) => field.required && !mapping[field.key]);
}

export function applyRiskCrosswalkColumnMapping(
  rows: readonly Record<string, string>[],
  mapping: RiskCrosswalkColumnMapping
): readonly RiskCrosswalkRowInput[] {
  return rows.map((raw, index) => ({
    rowNumber: index + 2,
    title: (mapping.title ? raw[mapping.title] : undefined)?.trim() ?? "",
    externalId: (mapping.externalId ? raw[mapping.externalId] : undefined)?.trim() ?? "",
    externalRating: (mapping.externalRating ? raw[mapping.externalRating] : undefined)?.trim() ?? "",
    sourceUpdatedAt: (mapping.sourceUpdatedAt ? raw[mapping.sourceUpdatedAt] : undefined)?.trim() ?? "",
    referenceUrl: trimOptionalCell(mapping.referenceUrl ? raw[mapping.referenceUrl] : undefined)
  }));
}

function trimOptionalCell(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
