import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import {
  validateNarrativeRules,
  validateRegisterEntityEnvelope,
  validateRegisterLinkPairs,
  validateRegisterWriteRules
} from "../packages/contracts/dist/index.js";

const STORE_VERSION = 2;
const REGISTER_IMPORT_TYPE = "pspf-workbench-register";
let sqlPromise;

export class RegisterMigrationError extends Error {
  constructor(issues) {
    super(issues.map((issue) => `${issue.id}: ${issue.violations.join(" ")}`).join("\n"));
    this.issues = issues;
  }
}

export async function migrateCoreDatabase(databaseBytes, sourceDatabasePathHash) {
  const SQL = await getSql();
  const database = new SQL.Database(new Uint8Array(databaseBytes));
  try {
    const results = database.exec("SELECT id, entity_type, payload FROM entities ORDER BY id;");
    if (results.length === 0) throw new Error("The SQLite database has no entities table or contains no rows.");
    const rows = results[0].values.map(([id, entityType, payload]) => ({
      id: String(id),
      entityType: String(entityType),
      payload: String(payload)
    }));
    return buildRegisterImport(rows, sourceDatabasePathHash);
  } finally {
    database.close();
  }
}

export function buildRegisterImport(rows, sourceDatabasePathHash) {
  const issues = [];
  const records = [];
  for (const row of rows) {
    let record;
    try {
      record = JSON.parse(row.payload);
    } catch {
      issues.push({ id: row.id, violations: ["payload is not valid JSON."] });
      continue;
    }
    const violations = [...validateRegisterEntityEnvelope(record)];
    if (record?.id !== row.id) violations.push("SQLite id does not match payload id.");
    if (record?.entityType !== row.entityType) violations.push("SQLite entity_type does not match payload entityType.");
    if (violations.length) issues.push({ id: row.id, violations });
    else records.push(record);
  }

  for (const violation of validateRegisterWriteRules(records)) {
    const id = /^Requirement (\S+)/.exec(violation)?.[1] ?? "unknown";
    addIssue(issues, id, violation);
  }
  for (const violation of validateNarrativeRules(records, [])) {
    addIssue(issues, violation.narrativeId, violation.message);
  }
  for (const violation of validateRegisterLinkPairs(records, [])) {
    const id = /^Link (\S+)/.exec(violation)?.[1] ?? "unknown";
    addIssue(issues, id, violation);
  }
  if (issues.length) throw new RegisterMigrationError(issues);

  const entities = records.filter((record) => record.entityType !== "link").sort((a, b) => a.id.localeCompare(b.id));
  const links = records.filter((record) => record.entityType === "link").sort((a, b) => a.id.localeCompare(b.id));
  const recordCounts = {};
  for (const record of records) recordCounts[record.entityType] = (recordCounts[record.entityType] ?? 0) + 1;
  const orderedCounts = Object.fromEntries(Object.entries(recordCounts).sort(([a], [b]) => a.localeCompare(b)));
  const newestUpdate = records
    .map((record) => record.updatedAt)
    .sort()
    .at(-1);
  const payload = {
    type: REGISTER_IMPORT_TYPE,
    storeVersion: STORE_VERSION,
    sourceDatabasePathHash,
    recordCounts: orderedCounts,
    ...(newestUpdate ? { newestUpdate } : {}),
    entities,
    links
  };
  return { ...payload, checksum: sha256(canonicalJson(payload)) };
}

function addIssue(issues, id, message) {
  const current = issues.find((issue) => issue.id === id);
  if (current) current.violations.push(message);
  else issues.push({ id, violations: [message] });
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const fields = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${fields.join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function getSql() {
  sqlPromise ??= initSqlJs({
    locateFile: (file) => resolve(dirname(fileURLToPath(import.meta.resolve("sql.js"))), file)
  });
  return sqlPromise;
}

async function runCli() {
  const [databasePath, outputPath] = process.argv.slice(2);
  if (!databasePath || !outputPath) {
    throw new Error("Usage: node scripts/migrate-core-register.mjs <core.db> <register-import.json>");
  }
  const absoluteDatabasePath = resolve(databasePath);
  const sourceDatabasePathHash = sha256(absoluteDatabasePath);
  const bytes = await readFile(absoluteDatabasePath);
  const result = migrateCoreDatabase(bytes, sourceDatabasePathHash);
  const file = await result;
  await writeFile(resolve(outputPath), `${JSON.stringify(file, null, 2)}\n`, { flag: "wx" });
  console.log(
    JSON.stringify(
      {
        output: resolve(outputPath),
        recordCounts: file.recordCounts,
        newestUpdate: file.newestUpdate ?? null,
        checksum: file.checksum
      },
      null,
      2
    )
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    if (error instanceof RegisterMigrationError) {
      console.error(JSON.stringify({ message: error.message, records: error.issues }, null, 2));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  });
}
