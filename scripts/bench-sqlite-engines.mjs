#!/usr/bin/env node
// Benchmark: current CLI-spawn approach vs sql.js (pure WASM) for PSPF Core's
// SQLite workload. Mirrors the shape of operations in packages/core/src/service.ts
// (initialiseWorkspace schema, upsertEntities, listEntities, integrity_check),
// but executed against a throwaway temp DB so it cannot affect any workspace.
//
// Run: node scripts/bench-sqlite-engines.mjs
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import initSqlJs from "sql.js";

const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

// Representative entity payload similar to PSPF entities (domain/requirement/etc.)
function makeEntity(i) {
    const now = new Date().toISOString();
    return {
        id: `bench-entity-${String(i).padStart(6, "0")}`,
        entityType: i % 3 === 0 ? "Requirement" : i % 3 === 1 ? "Direction" : "Domain",
        payload: {
            title: `Benchmark entity ${i}`,
            description:
                "Representative payload to mimic real assessment data; long enough to be non-trivial JSON but not pathological.",
            tags: ["bench", "pspf", `cat-${i % 7}`],
            classification: "OFFICIAL: Sensitive",
            meta: { index: i, nested: { a: 1, b: 2, c: [1, 2, 3, 4, 5] } }
        },
        createdAt: now,
        updatedAt: now
    };
}

function sqlEscape(value) {
    return String(value).replace(/'/g, "''");
}

function upsertEntitySql(entity) {
    return `INSERT INTO entities(id, entity_type, payload, created_at, updated_at) VALUES (
    '${sqlEscape(entity.id)}',
    '${sqlEscape(entity.entityType)}',
    '${sqlEscape(JSON.stringify(entity.payload))}',
    '${sqlEscape(entity.createdAt)}',
    '${sqlEscape(entity.updatedAt)}'
  ) ON CONFLICT(id) DO UPDATE SET
    entity_type=excluded.entity_type,
    payload=excluded.payload,
    updated_at=excluded.updated_at;`;
}

// --- CLI engine (current approach) ----------------------------------------
function runSqlCli(dbPath, sql, extraArgs = []) {
    return new Promise((resolve, reject) => {
        const child = spawn("sqlite3", ["-cmd", ".timeout 5000", ...extraArgs, dbPath], {
            stdio: ["pipe", "pipe", "pipe"]
        });
        const out = [];
        const err = [];
        child.stdout.on("data", (c) => out.push(c));
        child.stderr.on("data", (c) => err.push(c));
        child.on("error", reject);
        child.on("close", (code) => {
            const stdout = Buffer.concat(out).toString("utf8");
            const stderr = Buffer.concat(err).toString("utf8");
            if (code !== 0) return reject(new Error(stderr || `sqlite3 exited ${code}`));
            resolve(stdout);
        });
        child.stdin.end(sql);
    });
}

// --- sql.js engine --------------------------------------------------------
let SQL;
async function openSqlJs(dbPath) {
    if (!SQL) SQL = await initSqlJs({});
    let buf;
    try {
        buf = await readFile(dbPath);
    } catch (e) {
        if (e.code !== "ENOENT") throw e;
    }
    return new SQL.Database(buf ? new Uint8Array(buf) : undefined);
}

async function persistSqlJs(db, dbPath) {
    const data = db.export();
    const tmp = `${dbPath}.tmp`;
    await writeFile(tmp, Buffer.from(data));
    // atomic rename
    await (await import("node:fs/promises")).rename(tmp, dbPath);
}

// --- Benchmark workloads --------------------------------------------------
async function benchCli(label, dbPath, entityCount) {
    const t0 = performance.now();
    await runSqlCli(dbPath, SCHEMA_SQL);
    const tSchema = performance.now();

    // Single batched transaction
    const batchedSql = ["BEGIN IMMEDIATE;", ...Array.from({ length: entityCount }, (_, i) => upsertEntitySql(makeEntity(i))), "COMMIT;"].join("\n");
    await runSqlCli(dbPath, batchedSql);
    const tInsert = performance.now();

    const listOut = await runSqlCli(dbPath, "SELECT id, entity_type, payload FROM entities;", ["-json"]);
    const parsed = listOut.trim() ? JSON.parse(listOut) : [];
    const tList = performance.now();

    const integrity = (await runSqlCli(dbPath, "PRAGMA integrity_check;")).trim();
    const tIntegrity = performance.now();

    const size = (await stat(dbPath)).size;
    return {
        engine: "cli",
        label,
        entityCount,
        rowsListed: parsed.length,
        integrity,
        schemaMs: tSchema - t0,
        insertMs: tInsert - tSchema,
        listMs: tList - tInsert,
        integrityMs: tIntegrity - tList,
        totalMs: tIntegrity - t0,
        dbBytes: size
    };
}

async function benchSqlJs(label, dbPath, entityCount) {
    const t0 = performance.now();
    let db = await openSqlJs(dbPath);
    db.exec(SCHEMA_SQL);
    await persistSqlJs(db, dbPath);
    const tSchema = performance.now();

    // Reopen — mirrors "each operation = open, do, persist, close" worst case.
    db.close();
    db = await openSqlJs(dbPath);
    db.exec("BEGIN;");
    const stmt = db.prepare(
        `INSERT INTO entities(id, entity_type, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET entity_type=excluded.entity_type, payload=excluded.payload, updated_at=excluded.updated_at;`
    );
    for (let i = 0; i < entityCount; i++) {
        const e = makeEntity(i);
        stmt.run([e.id, e.entityType, JSON.stringify(e.payload), e.createdAt, e.updatedAt]);
    }
    stmt.free();
    db.exec("COMMIT;");
    await persistSqlJs(db, dbPath);
    const tInsert = performance.now();

    db.close();
    db = await openSqlJs(dbPath);
    const res = db.exec("SELECT id, entity_type, payload FROM entities;");
    const rows = res[0]?.values ?? [];
    const tList = performance.now();

    const integrityRes = db.exec("PRAGMA integrity_check;");
    const integrity = integrityRes[0]?.values?.[0]?.[0] ?? "";
    const tIntegrity = performance.now();
    db.close();

    const size = (await stat(dbPath)).size;
    return {
        engine: "sqljs",
        label,
        entityCount,
        rowsListed: rows.length,
        integrity,
        schemaMs: tSchema - t0,
        insertMs: tInsert - tSchema,
        listMs: tList - tInsert,
        integrityMs: tIntegrity - tList,
        totalMs: tIntegrity - t0,
        dbBytes: size
    };
}

async function measureColdStart() {
    // sql.js WASM init cost (one-off per extension activation)
    SQL = undefined;
    const t0 = performance.now();
    await initSqlJs({});
    const t1 = performance.now();
    return t1 - t0;
}

async function withTmp(fn) {
    const dir = await mkdtemp(join(tmpdir(), "pspf-bench-"));
    try {
        return await fn(dir);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

function fmt(n) {
    return n.toFixed(1).padStart(8);
}

async function main() {
    const sizes = [10, 100, 1000, 5000];
    const results = [];

    const coldStart = await measureColdStart();
    console.log(`sql.js WASM init (cold): ${coldStart.toFixed(1)} ms (one-off per process)`);
    console.log();

    for (const n of sizes) {
        const cli = await withTmp(async (dir) => benchCli(`n=${n}`, join(dir, "cli.db"), n));
        const js = await withTmp(async (dir) => benchSqlJs(`n=${n}`, join(dir, "sqljs.db"), n));
        results.push(cli, js);
    }

    console.log("Workload: init schema + batched insert N entities + list all + integrity check");
    console.log("(Each run uses a fresh temp DB. Times in ms. dbBytes = file size after run.)");
    console.log();
    console.log("engine  N      schema   insert     list  integrity    total   rows    dbBytes");
    console.log("------  ----- -------- -------- -------- ---------- -------- ------ ----------");
    for (const r of results) {
        console.log(
            `${r.engine.padEnd(6)}  ${String(r.entityCount).padEnd(5)} ${fmt(r.schemaMs)} ${fmt(r.insertMs)} ${fmt(r.listMs)} ${fmt(r.integrityMs)} ${fmt(r.totalMs)} ${String(r.rowsListed).padStart(6)} ${String(r.dbBytes).padStart(10)}`
        );
    }

    console.log();
    console.log("Per-row insert latency (ms/row):");
    console.log("N      cli         sqljs       speedup");
    for (const n of sizes) {
        const cli = results.find((r) => r.engine === "cli" && r.entityCount === n);
        const js = results.find((r) => r.engine === "sqljs" && r.entityCount === n);
        const cliPer = cli.insertMs / n;
        const jsPer = js.insertMs / n;
        console.log(`${String(n).padEnd(6)} ${cliPer.toFixed(4).padStart(8)}    ${jsPer.toFixed(4).padStart(8)}    ${(cliPer / jsPer).toFixed(2)}x`);
    }

    // WASM bundle size on disk
    const wasm = await stat(new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url));
    const jsGlue = await stat(new URL("../node_modules/sql.js/dist/sql-wasm.js", import.meta.url));
    console.log();
    console.log(`sql.js shipping cost: sql-wasm.wasm = ${(wasm.size / 1024).toFixed(0)} KB, sql-wasm.js = ${(jsGlue.size / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
