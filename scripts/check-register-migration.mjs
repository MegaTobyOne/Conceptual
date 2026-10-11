import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { ID_PREFIX_BY_ENTITY_TYPE, V0_1_ENTITY_TYPES } from "../packages/contracts/dist/index.js";
import { migrateCoreDatabase } from "./migrate-core-register.mjs";

const SQL = await initSqlJs({
  locateFile: (file) => resolve(dirname(fileURLToPath(import.meta.resolve("sql.js"))), file)
});
const database = new SQL.Database();
database.run(`CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

const timestamp = "2026-10-10T00:00:00.000Z";
const fixture = V0_1_ENTITY_TYPES.map((entityType, index) => {
  const prefix = ID_PREFIX_BY_ENTITY_TYPE[entityType];
  const id =
    entityType === "posture" ? "POSTURE" : `${prefix}-00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`;
  const entity = {
    id,
    entityType,
    schemaVersion: "1.17.0",
    title: `Migration fixture ${entityType}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProduct: "workshop",
    recordStatus: "active",
    migrationFixtureSensitive: { retained: true, marker: entityType }
  };
  if (entityType === "requirement") {
    entity.domainId = "DOM-00000000-0000-7000-8000-000000000001";
    entity.assessmentStatus = "not-started";
    entity.acceptanceDefinition = "Sensitive acceptance fixture";
    entity.ownerTeam = "Security Operations";
  }
  if (entityType === "action") {
    entity.status = "todo";
    entity.ownerTeam = "Security Operations";
    entity.dueDate = "2026-11-01";
    entity.dueDateHistory = [{ dueDate: "2026-11-01", changedAt: timestamp }];
  }
  if (entityType === "risk") {
    entity.status = "open";
    entity.likelihood = 3;
    entity.impact = 4;
    entity.description = "Sensitive risk fixture";
  }
  if (entityType === "narrative") {
    entity.slot = "exec-brief.where-we-stand";
    entity.body = "Sensitive narrative fixture";
    entity.audience = "executive";
  }
  if (entityType === "evidence") {
    entity.evidenceType = "note";
    entity.reference = "Sensitive evidence reference";
    entity.freshness = "unknown";
  }
  if (entityType === "domain") {
    entity.code = "governance";
    entity.sortOrder = 1;
  }
  if (entityType === "source-control") {
    entity.controlId = "ISM-0001";
    entity.provenance = { oscalRelease: "2026-09", catalog: "ISM", profile: "OFFICIAL" };
  }
  if (entityType === "requirement-control-mapping") {
    entity.requirementId = fixtureId("requirement");
    entity.sourceControlId = fixtureId("source-control");
    entity.coverageQualifier = "primary";
    entity.applicabilityProfile = "OFFICIAL";
    entity.confidence = "medium";
    entity.provenance = { author: "Synthetic operator", createdAt: timestamp, oscalRelease: "2026-09" };
  }
  if (entityType === "link") {
    entity.linkType = "addressed-by";
    entity.fromId = fixtureId("requirement");
    entity.fromType = "requirement";
    entity.toId = fixtureId("action");
    entity.toType = "action";
    entity.evidenceNote = "Sensitive link note";
  }
  return entity;
});

for (const record of fixture) {
  database.run("INSERT INTO entities(id, entity_type, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [
    record.id,
    record.entityType,
    JSON.stringify(record),
    record.createdAt,
    record.updatedAt
  ]);
}

const migrated = await migrateCoreDatabase(database.export(), "a".repeat(64));
const actualRecords = [...migrated.entities, ...migrated.links].sort((a, b) => a.id.localeCompare(b.id));
assert.deepEqual(
  actualRecords,
  [...fixture].sort((a, b) => a.id.localeCompare(b.id))
);
assert.equal(actualRecords.length, 29);
assert.equal(Object.keys(migrated.recordCounts).length, 29);
assert.ok(actualRecords.every((record) => record.migrationFixtureSensitive.retained));
assert.equal(migrated.entities.length, 28);
assert.equal(migrated.links.length, 1);
assert.match(migrated.checksum, /^[0-9a-f]{64}$/);
database.close();
console.log("ok lossless register migration: all 29 entity types and sensitive fixture fields preserved exactly");

export { fixture, migrated };

function fixtureId(entityType) {
  const index = V0_1_ENTITY_TYPES.indexOf(entityType);
  return `${ID_PREFIX_BY_ENTITY_TYPE[entityType]}-00000000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`;
}
