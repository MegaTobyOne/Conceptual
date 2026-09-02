import assert from "node:assert/strict";
import test from "node:test";
import { searchRequirements, type RequirementFinderRecord } from "./index.js";

// E3 (v1.65.0, ADR 0096): parity fixture. Represents the SAME conceptual requirement set as it
// would be adapted by each host — Explorer's requirements-view.ts and Workshop's
// requirementToFinderRecord (workshop-ui.ts) both produce this exact shape from their own local
// models. This test proves the shared primitive is deterministic and canonical-domain-order
// invariant, which is what makes "one implementation, two hosts" a genuine parity guarantee rather
// than a coincidence of two callers happening to agree.
const CANONICAL_DOMAIN_ORDER = ["gov", "risk", "info", "tech", "per", "phys"];

const FIXTURE: readonly RequirementFinderRecord[] = [
  { id: "REQ-PSPF-2025-001", title: "WoAG protective security roles", domainId: "gov", status: "met" },
  { id: "REQ-PSPF-2025-002", title: "Entity protective security roles", domainId: "gov", status: "not-met" },
  {
    id: "REQ-PSPF-2025-005",
    title: "Security risk management",
    domainId: "risk",
    status: "met",
    searchText: "quarterly risk review"
  },
  { id: "REQ-PSPF-2025-009", title: "Classifications and caveats", domainId: "info", status: "not-set" },
  { id: "REQ-PSPF-2025-013", title: "Technology lifecycle management", domainId: "tech", status: "met" }
];

test("parity: identical fixture and filters produce identical, deterministically ordered results across repeated calls", () => {
  const explorerStyleCall = searchRequirements(FIXTURE, { domainIds: ["gov", "risk"] }, CANONICAL_DOMAIN_ORDER);
  const workshopStyleCall = searchRequirements(FIXTURE, { domainIds: ["gov", "risk"] }, CANONICAL_DOMAIN_ORDER);
  assert.deepEqual(
    explorerStyleCall.map((r) => r.id),
    workshopStyleCall.map((r) => r.id)
  );
  assert.deepEqual(
    explorerStyleCall.map((r) => r.id),
    ["REQ-PSPF-2025-002", "REQ-PSPF-2025-001", "REQ-PSPF-2025-005"]
  );
});

test("parity: text query matches across id/title/searchText identically regardless of caller", () => {
  const results = searchRequirements(FIXTURE, { query: "quarterly" }, CANONICAL_DOMAIN_ORDER);
  assert.deepEqual(
    results.map((r) => r.id),
    ["REQ-PSPF-2025-005"]
  );
});

test("parity: full fixture with no filters returns every record in canonical domain order", () => {
  const results = searchRequirements(FIXTURE, {}, CANONICAL_DOMAIN_ORDER);
  assert.deepEqual(
    results.map((r) => r.id),
    ["REQ-PSPF-2025-002", "REQ-PSPF-2025-001", "REQ-PSPF-2025-005", "REQ-PSPF-2025-009", "REQ-PSPF-2025-013"]
  );
});
