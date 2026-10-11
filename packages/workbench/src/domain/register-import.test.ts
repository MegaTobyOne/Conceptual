import { describe, expect, it } from "vitest";
import type { RequirementEntity } from "@pspf/contracts";
import {
  canonicalJson,
  parseRegisterImport,
  REGISTER_IMPORT_STORE_VERSION,
  REGISTER_IMPORT_TYPE
} from "./register-import.ts";
import { sha256Hex } from "./hash.ts";

const requirement = (updatedAt: string, title = "Document protective security roles"): RequirementEntity => ({
  id: "REQ-PSPF-2025-001",
  entityType: "requirement",
  schemaVersion: "1.17.0",
  title,
  domainId: "DOM-governance",
  assessmentStatus: "not-started",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt,
  sourceProduct: "workshop",
  recordStatus: "active",
  acceptanceDefinition: "A sensitive field remains present."
});

async function migrationText(record: RequirementEntity): Promise<string> {
  const payload = {
    type: REGISTER_IMPORT_TYPE,
    storeVersion: REGISTER_IMPORT_STORE_VERSION,
    sourceDatabasePathHash: "a".repeat(64),
    recordCounts: { requirement: 1 },
    newestUpdate: record.updatedAt,
    entities: [record],
    links: []
  };
  return JSON.stringify({ ...payload, checksum: await sha256Hex(canonicalJson(payload)) });
}

describe("register migration import", () => {
  it("validates checksums and preserves sensitive entity fields", async () => {
    const text = await migrationText(requirement("2026-10-01T00:00:00.000Z"));
    const parsed = await parseRegisterImport(text);
    expect(parsed.entities[0]?.entityType).toBe("requirement");
    expect((parsed.entities[0] as RequirementEntity | undefined)?.acceptanceDefinition).toBe(
      "A sensitive field remains present."
    );
    await expect(parseRegisterImport(text.replace("Document", "Edited"))).rejects.toThrow(/checksum/);
  });

  it("rejects records that violate the canonical envelope", async () => {
    const record = { ...requirement("2026-10-01T00:00:00.000Z"), id: "bad-id" };
    await expect(parseRegisterImport(await migrationText(record))).rejects.toThrow(/registered REQ prefix/);
  });
});
