import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRequirementFinderResultSummary,
  compareRequirementFinderRecords,
  matchesRequirementFinderFilters,
  searchRequirements,
  type RequirementFinderRecord
} from "./index.js";

const DOMAIN_ORDER = ["gov", "risk", "info"];

const zebraRecord: RequirementFinderRecord = {
  id: "REQ-002",
  title: "Zebra crossing policy",
  domainId: "gov",
  status: "met",
  tagIds: ["urgent"]
};
const alphaRecord: RequirementFinderRecord = {
  id: "REQ-001",
  title: "Alpha access policy",
  domainId: "gov",
  status: "not-met"
};
const betaRecord: RequirementFinderRecord = {
  id: "REQ-003",
  title: "Beta risk register",
  domainId: "risk",
  status: "met",
  searchText: "quarterly review"
};
const RECORDS: readonly RequirementFinderRecord[] = [zebraRecord, alphaRecord, betaRecord];

test("matchesRequirementFinderFilters: query matches title case-insensitively", () => {
  assert.equal(matchesRequirementFinderFilters(zebraRecord, { query: "zebra" }), true);
  assert.equal(matchesRequirementFinderFilters(zebraRecord, { query: "ZEBRA" }), true);
  assert.equal(matchesRequirementFinderFilters(zebraRecord, { query: "giraffe" }), false);
});

test("matchesRequirementFinderFilters: query also matches searchText", () => {
  assert.equal(matchesRequirementFinderFilters(betaRecord, { query: "quarterly" }), true);
});

test("matchesRequirementFinderFilters: query also matches the requirement id (E8, ADR 0096)", () => {
  assert.equal(matchesRequirementFinderFilters(alphaRecord, { query: "REQ-001" }), true);
  assert.equal(matchesRequirementFinderFilters(alphaRecord, { query: "req-001" }), true);
  assert.equal(matchesRequirementFinderFilters(alphaRecord, { query: "REQ-002" }), false);
});

test("matchesRequirementFinderFilters: domainIds and statuses narrow results", () => {
  assert.equal(matchesRequirementFinderFilters(zebraRecord, { domainIds: ["risk"] }), false);
  assert.equal(matchesRequirementFinderFilters(zebraRecord, { statuses: ["not-met"] }), false);
  assert.equal(matchesRequirementFinderFilters(alphaRecord, { statuses: ["not-met"] }), true);
});

test("matchesRequirementFinderFilters: tagsMode any vs all", () => {
  const record = { ...zebraRecord, tagIds: ["urgent", "reviewed"] };
  assert.equal(matchesRequirementFinderFilters(record, { tagIds: ["urgent", "missing"], tagsMode: "any" }), true);
  assert.equal(matchesRequirementFinderFilters(record, { tagIds: ["urgent", "missing"], tagsMode: "all" }), false);
});

test("compareRequirementFinderRecords: orders by domainOrder then title then id", () => {
  const sorted = [...RECORDS].sort((a, b) => compareRequirementFinderRecords(a, b, DOMAIN_ORDER));
  assert.deepEqual(
    sorted.map((r) => r.id),
    ["REQ-001", "REQ-002", "REQ-003"]
  );
});

test("searchRequirements: filters and sorts deterministically, repeatable across calls", () => {
  const first = searchRequirements(RECORDS, { domainIds: ["gov"] }, DOMAIN_ORDER);
  const second = searchRequirements(RECORDS, { domainIds: ["gov"] }, DOMAIN_ORDER);
  assert.deepEqual(
    first.map((r) => r.id),
    ["REQ-001", "REQ-002"]
  );
  assert.deepEqual(
    first.map((r) => r.id),
    second.map((r) => r.id)
  );
});

test("buildRequirementFinderResultSummary: states status, evidence basis, actions, and material risk", () => {
  assert.equal(
    buildRequirementFinderResultSummary({
      statusLabel: "Fully implemented",
      evidenceBasis: "evidenced-fresh",
      openActionCount: 2,
      hasMaterialRisk: true
    }),
    "Fully implemented · Evidenced and fresh · 2 open action(s) · material risk linked"
  );
  assert.equal(
    buildRequirementFinderResultSummary({
      statusLabel: "Not implemented",
      openActionCount: 0,
      hasMaterialRisk: false
    }),
    "Not implemented · no open actions · no material risk linked"
  );
});
