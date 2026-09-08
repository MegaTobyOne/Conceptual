import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildRiskCrosswalkPreview, buildSampleWorkspaceEntities, type RiskEntity } from "@pspf/contracts";

import {
  applyRiskCrosswalkColumnMapping,
  detectRiskCrosswalkColumnMapping,
  parseRiskCrosswalkDelimitedText,
  RISK_CROSSWALK_TSV_TEMPLATE_HEADER,
  unmappedRequiredFields
} from "./risk-crosswalk.js";

test("parseRiskCrosswalkDelimitedText parses the TSV template with the correct headers", () => {
  const text = `${RISK_CROSSWALK_TSV_TEMPLATE_HEADER}Vendor outage risk\tEXT-1\tHigh\t2026-08-01\thttps://source.example.test/1\n`;
  const parsed = parseRiskCrosswalkDelimitedText(text, "\t");
  assert.deepEqual(parsed.headers, ["Title", "External ID", "External Rating", "Source Updated", "Reference URL"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]!["Title"], "Vendor outage risk");
});

test("parseRiskCrosswalkDelimitedText also parses comma-delimited CSV", () => {
  const text = "Title,External ID,External Rating,Source Updated,Reference URL\nRisk A,EXT-2,Medium,2026-08-01,\n";
  const parsed = parseRiskCrosswalkDelimitedText(text, ",");
  assert.equal(parsed.rows[0]!["External ID"], "EXT-2");
});

test("detectRiskCrosswalkColumnMapping auto-maps the template's own headers", () => {
  const mapping = detectRiskCrosswalkColumnMapping([
    "Title",
    "External ID",
    "External Rating",
    "Source Updated",
    "Reference URL"
  ]);
  assert.equal(mapping.title, "Title");
  assert.equal(mapping.externalId, "External ID");
  assert.equal(mapping.externalRating, "External Rating");
  assert.equal(mapping.sourceUpdatedAt, "Source Updated");
  assert.equal(mapping.referenceUrl, "Reference URL");
  assert.deepEqual(unmappedRequiredFields(mapping), []);
});

test("detectRiskCrosswalkColumnMapping matches common aliases and flags unresolved required fields", () => {
  const mapping = detectRiskCrosswalkColumnMapping(["Risk", "Ref", "Custom Column"]);
  assert.equal(mapping.title, "Risk");
  assert.equal(mapping.externalId, "Ref");
  const unmapped = unmappedRequiredFields(mapping);
  assert.equal(
    unmapped.some((field) => field.key === "externalRating"),
    true
  );
  assert.equal(
    unmapped.some((field) => field.key === "sourceUpdatedAt"),
    true
  );
});

test("applyRiskCrosswalkColumnMapping maps raw rows onto the template shape with 1-based+header row numbers", () => {
  const parsed = parseRiskCrosswalkDelimitedText(
    `${RISK_CROSSWALK_TSV_TEMPLATE_HEADER}Vendor outage risk\tEXT-1\tHigh\t2026-08-01\thttps://source.example.test/1\n`,
    "\t"
  );
  const mapping = detectRiskCrosswalkColumnMapping(parsed.headers);
  const rows = applyRiskCrosswalkColumnMapping(parsed.rows, mapping);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.rowNumber, 2);
  assert.equal(rows[0]!.title, "Vendor outage risk");
  assert.equal(rows[0]!.externalId, "EXT-1");
  assert.equal(rows[0]!.referenceUrl, "https://source.example.test/1");
});

test("applyRiskCrosswalkColumnMapping leaves referenceUrl undefined when the cell is blank", () => {
  const parsed = parseRiskCrosswalkDelimitedText(
    `${RISK_CROSSWALK_TSV_TEMPLATE_HEADER}Risk B\tEXT-3\tLow\t2026-08-01\t\n`,
    "\t"
  );
  const mapping = detectRiskCrosswalkColumnMapping(parsed.headers);
  const rows = applyRiskCrosswalkColumnMapping(parsed.rows, mapping);
  assert.equal(rows[0]!.referenceUrl, undefined);
});

test("end-to-end: the sample crosswalk fixture file previews as update/create/unmatched against sample entities", async () => {
  const text = await readFile(join(process.cwd(), "test-fixtures", "risk-crosswalk-sample.tsv"), "utf8");
  const parsed = parseRiskCrosswalkDelimitedText(text, "\t");
  const mapping = detectRiskCrosswalkColumnMapping(parsed.headers);
  assert.deepEqual(unmappedRequiredFields(mapping), []);
  const rows = applyRiskCrosswalkColumnMapping(parsed.rows, mapping);
  assert.equal(rows.length, 3);

  const existingRisks = buildSampleWorkspaceEntities().filter(
    (entity): entity is RiskEntity => entity.entityType === "risk"
  );
  const preview = buildRiskCrosswalkPreview(rows, existingRisks, "reg-00000000-0000-4000-8000-000000000801");

  const encryptionRow = preview.find((row) => row.input.externalId === "ERR-4021");
  assert.equal(encryptionRow?.action, "update", "matches the seeded externalRef by identity, rating differs");

  const newRow = preview.find((row) => row.input.externalId === "ERR-5010");
  assert.equal(newRow?.action, "create", "no identity match and no similar existing title");

  const duplicateRow = preview.find((row) => row.input.externalId === "ERR-9999");
  assert.equal(
    duplicateRow?.action,
    "unmatched",
    "title matches an existing Risk exactly, but no external identity match — never merged automatically"
  );
  assert.ok(duplicateRow?.possibleDuplicateOfRiskId);
});
