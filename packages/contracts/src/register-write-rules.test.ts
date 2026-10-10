import assert from "node:assert/strict";
import test from "node:test";
import {
  type RequirementEntity,
  validateRegisterEntityEnvelope,
  validateRegisterLinkPairs,
  validateRegisterWriteRules
} from "./index.js";

const requirement = (title: string): RequirementEntity => ({
  id: "REQ-PSPF-2025-001",
  entityType: "requirement",
  schemaVersion: "1.17.0",
  title,
  domainId: "DOM-governance",
  assessmentStatus: "not-started",
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
  sourceProduct: "workshop",
  recordStatus: "active"
});

test("register write rules reject blank Requirement titles", () => {
  assert.deepEqual(validateRegisterWriteRules([requirement("  ")]), [
    "Requirement REQ-PSPF-2025-001 title must be a non-empty string."
  ]);
});

test("register write rules accept a named Requirement and do not mutate input", () => {
  const entity = requirement("Document protective security roles");
  assert.deepEqual(validateRegisterWriteRules([entity]), []);
  assert.equal(entity.title, "Document protective security roles");
});

test("register envelope validation accepts a canonical record and reports malformed fields", () => {
  assert.deepEqual(validateRegisterEntityEnvelope(requirement("Security roles")), []);
  assert.deepEqual(
    validateRegisterEntityEnvelope({ ...requirement("Security roles"), id: "bad-id", recordStatus: "unknown" }),
    ["id must use the registered REQ prefix.", "recordStatus must be a registered status."]
  );
});

test("register link-pair rules accept matching endpoints and report dangling or mistyped pairs", () => {
  const from = requirement("Security roles");
  const to = {
    id: "ACT-00000000-0000-7000-8000-000000000001",
    entityType: "action" as const,
    schemaVersion: "1.17.0",
    title: "Review role assignments",
    status: "todo" as const,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
  const link = {
    id: "LNK-00000000-0000-7000-8000-000000000001",
    entityType: "link" as const,
    schemaVersion: "1.17.0",
    linkType: "addressed-by" as const,
    fromId: from.id,
    fromType: "requirement" as const,
    toId: to.id,
    toType: "action" as const,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
  assert.deepEqual(validateRegisterLinkPairs([link], [from, to]), []);
  assert.deepEqual(validateRegisterLinkPairs([{ ...link, toId: "ACT-missing" }], [from]), [
    "Link LNK-00000000-0000-7000-8000-000000000001 references missing toId ACT-missing."
  ]);
  assert.deepEqual(validateRegisterLinkPairs([{ ...link, toType: "risk" }], [from, to]), [
    "Link LNK-00000000-0000-7000-8000-000000000001 toType risk does not match ACT-00000000-0000-7000-8000-000000000001 (action)."
  ]);
});
