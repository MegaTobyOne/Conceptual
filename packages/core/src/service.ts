import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import {
  COLLECTION_BY_ENTITY_TYPE,
  type BundleCollections,
  type EntityByCollection,
  PSPF_SLICE_VERSION,
  type V01Collection,
  type V01Entity,
  PSPF_DOMAINS,
  VERSION_AXES,
  V0_1_COLLECTIONS,
  enrichActionsWithImpact,
  nowIso,
  sanitiseEntityForPublication,
  withEnvelope
} from "@pspf/contracts";
import { ISM_SOURCE_CONTROLS } from "@pspf/ism-source-library";

const execFileAsync = promisify(execFile);

export interface WorkspacePaths {
  readonly root: string;
  readonly pspf: string;
  readonly db: string;
  readonly core: string;
  readonly config: string;
  readonly exports: string;
  readonly imports: string;
  readonly snapshots: string;
  readonly logs: string;
  readonly cache: string;
  readonly locks: string;
  readonly journal: string;
  readonly migrations: string;
}

export interface ManifestCollection {
  readonly name: V01Collection;
  readonly path: string;
  readonly count: number;
  readonly hash: {
    readonly alg: "SHA-256";
    readonly value: string;
  };
}

export interface CoreService {
  readonly getWorkspacePaths: () => WorkspacePaths;
  readonly initialiseWorkspace: () => Promise<WorkspacePaths>;
  readonly validateWorkspace: () => Promise<{ ok: boolean; message: string; counts: Record<V01Collection, number> }>;
  readonly verifyIntegrity: () => Promise<{ ok: boolean; detail: string }>;
  readonly runIntegrityScan: () => Promise<IntegrityScanReport>;
  readonly createSnapshot: () => Promise<V01Entity>;
  readonly exportBundle: () => Promise<{ exportDirectory: string; manifestPath: string; collectionCount: number }>;
  readonly importBundle: (bundlePath: string, mode: ImportMode) => Promise<{ imported: number; mode: ImportMode; bundlePath: string }>;
  readonly getWriterLock: () => Promise<WriterLockState>;
  readonly upsertEntity: (entity: V01Entity) => Promise<V01Entity>;
  readonly upsertEntities: (entities: readonly V01Entity[]) => Promise<readonly V01Entity[]>;
  readonly listEntities: (entityType?: V01Entity["entityType"]) => Promise<V01Entity[]>;
}

export interface CoreReadApi {
  readonly getWorkspacePaths: () => WorkspacePaths;
  readonly validateWorkspace: () => Promise<{ ok: boolean; message: string; counts: Record<V01Collection, number> }>;
  readonly listEntities: (entityType?: V01Entity["entityType"]) => Promise<V01Entity[]>;
}

export interface CoreWriteApi {
  readonly initialiseWorkspace: () => Promise<WorkspacePaths>;
  readonly createSnapshot: () => Promise<V01Entity>;
  readonly getWriterLock: () => Promise<WriterLockState>;
  readonly upsertEntity: (entity: V01Entity) => Promise<V01Entity>;
  readonly upsertEntities: (entities: readonly V01Entity[]) => Promise<readonly V01Entity[]>;
}

export interface CoreExchangeApi {
  readonly exportBundle: () => Promise<{ exportDirectory: string; manifestPath: string; collectionCount: number }>;
  readonly importBundle: (bundlePath: string, mode: ImportMode) => Promise<{ imported: number; mode: ImportMode; bundlePath: string }>;
}

export interface CoreIntegrityApi {
  readonly verifyIntegrity: () => Promise<{ ok: boolean; detail: string }>;
  readonly runIntegrityScan: () => Promise<IntegrityScanReport>;
}

export type ImportMode = "additive-merge" | "full-replace";

export interface WriterLockState {
  readonly holderPid?: number;
  readonly acquiredAt?: string;
  readonly currentPid: number;
  readonly policy: "single-writer";
  readonly writable: boolean;
  readonly detail: string;
}

export interface IntegrityScanFinding {
  readonly section: "sqlite" | "payload" | "links" | "writer-lock" | "lifecycle";
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
}

export interface IntegrityScanReport {
  readonly ok: boolean;
  readonly generatedAt: string;
  readonly summary: string;
  readonly findings: readonly IntegrityScanFinding[];
  readonly counts: {
    readonly entities: number;
    readonly links: number;
    readonly orphanedLinks: number;
    readonly mistypedLinks: number;
    readonly unparseablePayloads: number;
  };
}

export function createCoreService(workspaceRoot: string): CoreService {
  return {
    ...createCoreReadApi(workspaceRoot),
    ...createCoreWriteApi(workspaceRoot),
    ...createCoreExchangeApi(workspaceRoot),
    ...createCoreIntegrityApi(workspaceRoot)
  };
}

export function createCoreReadApi(workspaceRoot: string): CoreReadApi {
  return {
    getWorkspacePaths: () => getWorkspacePaths(workspaceRoot),
    validateWorkspace: () => validateWorkspace(workspaceRoot),
    listEntities: (entityType) => listEntities(workspaceRoot, entityType)
  };
}

export function createCoreWriteApi(workspaceRoot: string): CoreWriteApi {
  return {
    initialiseWorkspace: () => initialiseWorkspace(workspaceRoot),
    createSnapshot: () => createSnapshot(workspaceRoot),
    getWriterLock: () => getWriterLock(workspaceRoot),
    upsertEntity: (entity) => upsertEntity(workspaceRoot, entity),
    upsertEntities: (entities) => upsertEntities(workspaceRoot, entities)
  };
}

export function createCoreExchangeApi(workspaceRoot: string): CoreExchangeApi {
  return {
    exportBundle: () => exportBundle(workspaceRoot),
    importBundle: (bundlePath, mode) => importBundle(workspaceRoot, bundlePath, mode)
  };
}

export function createCoreIntegrityApi(workspaceRoot: string): CoreIntegrityApi {
  return {
    verifyIntegrity: () => verifyIntegrity(workspaceRoot),
    runIntegrityScan: () => runIntegrityScan(workspaceRoot)
  };
}

async function initialiseWorkspace(workspaceRoot: string): Promise<WorkspacePaths> {
  const paths = getWorkspacePaths(workspaceRoot);
  await Promise.all([
    mkdir(paths.core, { recursive: true }),
    mkdir(paths.config, { recursive: true }),
    mkdir(paths.exports, { recursive: true }),
    mkdir(paths.imports, { recursive: true }),
    mkdir(paths.snapshots, { recursive: true }),
    mkdir(paths.logs, { recursive: true }),
    mkdir(paths.cache, { recursive: true }),
    mkdir(paths.locks, { recursive: true }),
    mkdir(paths.journal, { recursive: true }),
    mkdir(paths.migrations, { recursive: true })
  ]);
  await acquireWriterLock(paths);

  await writeJson(join(paths.config, "workspace.json"), {
    createdAt: nowIso(),
    versions: VERSION_AXES,
    classification: "OFFICIAL: Sensitive"
  });
  await writeJson(join(paths.config, "products.json"), { trustedCallerOverrides: [] });
  await writeJson(join(paths.config, "policies.json"), { publicationDefault: "sensitive" });

  await runSql(paths.db, `
PRAGMA journal_mode=WAL;
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
INSERT INTO metadata(key, value) VALUES ('schemaVersion', '${VERSION_AXES.schemaVersion}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO metadata(key, value) VALUES ('bundleVersion', '${VERSION_AXES.bundleVersion}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO metadata(key, value) VALUES ('apiVersion', '${VERSION_AXES.apiVersion}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`);

  const timestamp = nowIso();
  for (const domain of PSPF_DOMAINS) {
    await upsertEntity(workspaceRoot, { ...domain, createdAt: timestamp, updatedAt: timestamp });
  }
  for (const sourceControl of ISM_SOURCE_CONTROLS) {
    await upsertEntity(workspaceRoot, { ...sourceControl, createdAt: timestamp, updatedAt: timestamp });
  }

  return paths;
}

async function validateWorkspace(workspaceRoot: string): Promise<{ ok: boolean; message: string; counts: Record<V01Collection, number> }> {
  const paths = await ensureInitialised(workspaceRoot);
  const requiredPaths = [paths.db, paths.config, paths.exports, paths.imports, paths.snapshots, paths.logs, paths.locks];
  const missing = requiredPaths.filter((path) => !existsSync(path));
  const collections = await getBundleCollections(workspaceRoot, paths);
  const counts = getCollectionCounts(collections);

  if (missing.length > 0) {
    return { ok: false, message: `Missing ${missing.map((path) => basename(path)).join(", ")}`, counts };
  }

  return { ok: true, message: `Workspace ready with ${counts.requirements} requirement(s) and ${counts.evidence} evidence item(s).`, counts };
}

async function verifyIntegrity(workspaceRoot: string): Promise<{ ok: boolean; detail: string }> {
  const paths = await ensureInitialised(workspaceRoot);
  const output = await runSql(paths.db, "PRAGMA integrity_check;");
  const detail = output.trim();
  return { ok: detail === "ok", detail };
}

async function runIntegrityScan(workspaceRoot: string): Promise<IntegrityScanReport> {
  const paths = await ensureInitialised(workspaceRoot);
  const findings: IntegrityScanFinding[] = [];

  const sqliteResult = (await runSql(paths.db, "PRAGMA integrity_check;")).trim();
  if (sqliteResult === "ok") {
    findings.push({ section: "sqlite", severity: "info", message: "SQLite PRAGMA integrity_check returned ok." });
  } else {
    findings.push({ section: "sqlite", severity: "error", message: `SQLite integrity_check returned: ${sqliteResult}` });
  }

  const rawOutput = await runSql(paths.db, "SELECT id, entity_type, payload FROM entities;", ["-json"]);
  const rows = rawOutput.trim() === "" ? [] : JSON.parse(rawOutput) as readonly { id: string; entity_type: string; payload: string }[];
  const entitiesById = new Map<string, V01Entity>();
  let unparseable = 0;
  for (const row of rows) {
    try {
      const entity = JSON.parse(row.payload) as V01Entity;
      if (entity.id !== row.id) {
        findings.push({ section: "payload", severity: "error", message: `Entity row id ${row.id} does not match payload id ${entity.id}.` });
      }
      if (entity.entityType !== row.entity_type) {
        findings.push({ section: "payload", severity: "error", message: `Entity ${entity.id} entity_type column (${row.entity_type}) does not match payload entityType (${entity.entityType}).` });
      }
      entitiesById.set(entity.id, entity);
    } catch (error) {
      unparseable += 1;
      const message = error instanceof Error ? error.message : String(error);
      findings.push({ section: "payload", severity: "error", message: `Entity row ${row.id} payload is not valid JSON: ${message}` });
    }
  }

  let orphanedLinks = 0;
  let mistypedLinks = 0;
  let linkCount = 0;
  for (const entity of entitiesById.values()) {
    if (entity.entityType !== "link") {
      continue;
    }
    linkCount += 1;
    const link = entity as V01Entity & { fromId: string; fromType: string; toId: string; toType: string; linkType: string };
    const fromEntity = entitiesById.get(link.fromId);
    const toEntity = entitiesById.get(link.toId);
    if (!fromEntity) {
      orphanedLinks += 1;
      findings.push({ section: "links", severity: "error", message: `Link ${link.id} references missing fromId ${link.fromId}.` });
    } else if (fromEntity.entityType !== link.fromType) {
      mistypedLinks += 1;
      findings.push({ section: "links", severity: "error", message: `Link ${link.id} fromType ${link.fromType} does not match referenced entity ${link.fromId} (${fromEntity.entityType}).` });
    }
    if (!toEntity) {
      orphanedLinks += 1;
      findings.push({ section: "links", severity: "error", message: `Link ${link.id} references missing toId ${link.toId}.` });
    } else if (toEntity.entityType !== link.toType) {
      mistypedLinks += 1;
      findings.push({ section: "links", severity: "error", message: `Link ${link.id} toType ${link.toType} does not match referenced entity ${link.toId} (${toEntity.entityType}).` });
    }
  }

  const lock = await readWriterLock(paths);
  if (lock.holderPid && lock.holderPid !== process.pid && !isProcessAlive(lock.holderPid)) {
    findings.push({ section: "writer-lock", severity: "warning", message: `Writer lock holder pid ${lock.holderPid} is no longer alive; lock is stale.` });
  } else {
    findings.push({ section: "writer-lock", severity: "info", message: lock.detail });
  }

  const ok = findings.every((finding) => finding.severity !== "error");
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const summary = ok
    ? `Integrity scan passed: ${entitiesById.size} entities, ${linkCount} links, ${warningCount} warning(s).`
    : `Integrity scan failed: ${errorCount} error(s), ${warningCount} warning(s).`;

  const report: IntegrityScanReport = {
    ok,
    generatedAt: nowIso(),
    summary,
    findings,
    counts: {
      entities: entitiesById.size,
      links: linkCount,
      orphanedLinks,
      mistypedLinks,
      unparseablePayloads: unparseable
    }
  };

  await writeJson(join(paths.logs, "integrity-scan.json"), report);
  await recordOperation(paths, "integrity-scan", ok ? "success" : "failure", summary);
  return report;
}

async function createSnapshot(workspaceRoot: string): Promise<V01Entity> {
  const paths = await ensureInitialised(workspaceRoot);
  await assertWritable(paths);
  const collections = await getBundleCollections(workspaceRoot, paths);
  const counts = getCollectionCounts(collections);
  const snapshot = withEnvelope(
    "snapshot",
    {
      entityType: "snapshot",
      title: `Checkpoint ${formatDisplayDate(new Date())}`,
      snapshotType: "checkpoint"
    },
    "core"
  );

  await upsertEntity(workspaceRoot, snapshot);
  await writeJson(join(paths.snapshots, `${snapshot.id}.json`), { snapshot, counts, generatedAt: nowIso() });
  await recordOperation(paths, "snapshot", "success", snapshot.id);
  return snapshot;
}

async function exportBundle(workspaceRoot: string): Promise<{ exportDirectory: string; manifestPath: string; collectionCount: number }> {
  const paths = await ensureInitialised(workspaceRoot);
  await assertWritable(paths);
  const collections = await getBundleCollections(workspaceRoot, paths);
  const exportDirectory = join(paths.exports, `export-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const dataDirectory = join(exportDirectory, "data");
  const collectionsDirectory = join(dataDirectory, "collections");
  const indexesDirectory = join(dataDirectory, "indexes");
  await Promise.all([mkdir(collectionsDirectory, { recursive: true }), mkdir(indexesDirectory, { recursive: true })]);

  const manifestCollections: ManifestCollection[] = [];
  for (const collectionName of V0_1_COLLECTIONS) {
    const collection = collections[collectionName];
    const serialised = `${JSON.stringify(collection, null, 2)}\n`;
    const collectionPath = join(collectionsDirectory, `${collectionName}.json`);
    await writeFile(collectionPath, serialised, "utf8");
    manifestCollections.push({
      name: collectionName,
      path: `./collections/${collectionName}.json`,
      count: collection.length,
      hash: { alg: "SHA-256", value: sha256(serialised) }
    });
  }

  const statusSummary = buildStatusSummary(collections);
  const statusSummaryJson = `${JSON.stringify(statusSummary, null, 2)}\n`;
  await writeFile(join(indexesDirectory, "status-summary.json"), statusSummaryJson, "utf8");

  const manifest = {
    $schema: "./schemas/manifest.schema.json",
    bundleType: "pspf-explorer-bundle",
    bundleVersion: VERSION_AXES.bundleVersion,
    schemaVersion: VERSION_AXES.schemaVersion,
    apiVersion: VERSION_AXES.apiVersion,
    generatedAt: nowIso(),
    generator: {
      product: "pspf-core",
      mode: "publication",
      productVersion: PSPF_SLICE_VERSION,
      workspaceId: `WS-${sha256(paths.root).slice(0, 12)}`
    },
    compatibility: {
      explorerMin: PSPF_SLICE_VERSION,
      explorerTested: PSPF_SLICE_VERSION
    },
    security: {
      classification: "OFFICIAL: Sensitive",
      containsSensitiveData: true,
      redactionProfile: "explorer-default"
    },
    collections: manifestCollections,
    indexes: [
      {
        name: "status-summary",
        path: "./indexes/status-summary.json",
        hash: { alg: "SHA-256", value: sha256(statusSummaryJson) }
      }
    ]
  };
  const manifestPath = join(dataDirectory, "manifest.json");
  await writeJson(manifestPath, manifest);
  await writeJson(join(exportDirectory, "bundle.json"), { manifest, collections });
  await recordOperation(paths, "export", "success", exportDirectory);
  return { exportDirectory, manifestPath, collectionCount: manifestCollections.length };
}

async function importBundle(workspaceRoot: string, bundlePath: string, mode: ImportMode): Promise<{ imported: number; mode: ImportMode; bundlePath: string }> {
  const paths = await ensureInitialised(workspaceRoot);
  await assertWritable(paths);
  const bundle = JSON.parse(await readFile(bundlePath, "utf8")) as { readonly collections?: Partial<BundleCollections> };
  const entities = flattenImportEntities(bundle.collections ?? {});
  validateImportedMappings(entities);

  if (mode === "full-replace") {
    const existing = await listEntities(workspaceRoot);
    await writeJson(join(paths.imports, `pre-full-replace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), {
      generatedAt: nowIso(),
      reason: "pre full-replace import rollback point",
      entities: existing
    });
    await runSql(paths.db, "DELETE FROM entities;");
  }

  for (const entity of entities) {
    await upsertEntity(workspaceRoot, entity);
  }
  await recordOperation(paths, "import", "success", `${mode}:${bundlePath}`);
  return { imported: entities.length, mode, bundlePath };
}

async function upsertEntity(workspaceRoot: string, entity: V01Entity): Promise<V01Entity> {
  const paths = await ensureInitialised(workspaceRoot, false);
  await assertWritable(paths);
  await runSql(paths.db, upsertEntitySql(entity));
  return entity;
}

async function upsertEntities(workspaceRoot: string, entities: readonly V01Entity[]): Promise<readonly V01Entity[]> {
  const paths = await ensureInitialised(workspaceRoot, false);
  await assertWritable(paths);
  if (entities.length === 0) {
    return entities;
  }
  await runSql(paths.db, ["BEGIN IMMEDIATE;", ...entities.map(upsertEntitySql), "COMMIT;"].join("\n"));
  return entities;
}

function upsertEntitySql(entity: V01Entity): string {
  return `INSERT INTO entities(id, entity_type, payload, created_at, updated_at)
VALUES ('${sqlEscape(entity.id)}', '${sqlEscape(entity.entityType)}', '${sqlEscape(JSON.stringify(entity))}', '${sqlEscape(entity.createdAt)}', '${sqlEscape(entity.updatedAt)}')
ON CONFLICT(id) DO UPDATE SET
  entity_type = excluded.entity_type,
  payload = excluded.payload,
  updated_at = excluded.updated_at;`;
}

async function getWriterLock(workspaceRoot: string): Promise<WriterLockState> {
  const paths = await ensureInitialised(workspaceRoot, false);
  return readWriterLock(paths);
}

async function listEntities(workspaceRoot: string, entityType?: V01Entity["entityType"]): Promise<V01Entity[]> {
  const paths = await ensureInitialised(workspaceRoot);
  const where = entityType ? ` WHERE entity_type = '${sqlEscape(entityType)}'` : "";
  const output = await runSql(paths.db, `SELECT payload FROM entities${where} ORDER BY created_at ASC;`, ["-json"]);
  const rows = output.trim() === "" ? [] : JSON.parse(output) as readonly { payload: string }[];
  return rows.map((row) => JSON.parse(row.payload) as V01Entity);
}

async function getBundleCollections(workspaceRoot: string, paths: WorkspacePaths): Promise<BundleCollections> {
  const entities = await listEntities(workspaceRoot);
  const enriched = enrichActionsWithImpact(entities);
  const collections = createEmptyCollections();

  for (const entity of enriched) {
    const publicationEntity = sanitiseEntityForPublication(entity);
    const collectionName = COLLECTION_BY_ENTITY_TYPE[entity.entityType];
    pushEntity(collections, collectionName, publicationEntity);
  }

  collections.posture = [buildPosture(collections, paths)];
  return collections;
}

function createEmptyCollections(): BundleCollections {
  return {
    domains: [],
    requirements: [],
    evidence: [],
    actions: [],
    risks: [],
    snapshots: [],
    links: [],
    tags: [],
    "source-controls": [],
    "requirement-control-mappings": [],
    directions: [],
    posture: []
  };
}

function flattenImportEntities(collections: Partial<BundleCollections>): V01Entity[] {
  const entities: V01Entity[] = [];
  for (const collectionName of V0_1_COLLECTIONS) {
    if (collectionName === "posture") {
      continue;
    }
    const records = collections[collectionName] ?? [];
    entities.push(...records as V01Entity[]);
  }
  return entities;
}

function pushEntity<Collection extends V01Collection>(
  collections: BundleCollections,
  collectionName: Collection,
  entity: V01Entity
): void {
  (collections[collectionName] as EntityByCollection[Collection][]).push(entity as EntityByCollection[Collection]);
}

function buildPosture(collections: BundleCollections, paths: WorkspacePaths): EntityByCollection["posture"] {
  const timestamp = nowIso();
  return {
    id: "POSTURE",
    entityType: "posture",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: `PSPF posture for ${basename(paths.root)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProduct: "core",
    recordStatus: "active",
    requirementCount: collections.requirements.length,
    evidenceCount: collections.evidence.length,
    actionCount: collections.actions.length,
    riskCount: collections.risks.length,
    sourceControlCount: collections["source-controls"].length,
    requirementControlMappingCount: collections["requirement-control-mappings"].length,
    directionCount: collections.directions.length
  };
}

function getCollectionCounts(collections: BundleCollections): Record<V01Collection, number> {
  return {
    domains: collections.domains.length,
    requirements: collections.requirements.length,
    evidence: collections.evidence.length,
    actions: collections.actions.length,
    risks: collections.risks.length,
    snapshots: collections.snapshots.length,
    links: collections.links.length,
    tags: collections.tags.length,
    "source-controls": collections["source-controls"].length,
    "requirement-control-mappings": collections["requirement-control-mappings"].length,
    directions: collections.directions.length,
    posture: collections.posture.length
  };
}

function buildStatusSummary(collections: BundleCollections): Record<string, unknown> {
  return {
    generatedAt: nowIso(),
    requirements: countBy(collections.requirements, (requirement) => requirement.assessmentStatus),
    evidence: countBy(collections.evidence, (evidence) => evidence.freshness),
    actions: countBy(collections.actions, (action) => action.status),
    risks: countBy(collections.risks, (risk) => risk.status),
    sourceControls: countBy(collections["source-controls"], (sourceControl) => sourceControl.profileTags[0] ?? "unprofiled"),
    requirementControlMappings: countBy(collections["requirement-control-mappings"], (mapping) => mapping.coverageQualifier)
  };
}

function validateImportedMappings(entities: readonly V01Entity[]): void {
  const entityIds = new Set(entities.map((entity) => entity.id));
  for (const mapping of entities.filter((entity) => entity.entityType === "requirement-control-mapping")) {
    if (!entityIds.has(mapping.requirementId)) {
      throw new Error(`Import rejected: mapping ${mapping.id} references missing requirement ${mapping.requirementId}`);
    }
    if (!entityIds.has(mapping.sourceControlId)) {
      throw new Error(`Import rejected: mapping ${mapping.id} references missing source control ${mapping.sourceControlId}`);
    }
  }
}

function countBy<T>(items: readonly T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function getWorkspacePaths(root: string): WorkspacePaths {
  const pspf = join(root, ".pspf");
  return {
    root,
    pspf,
    db: join(pspf, "core", "pspf-core.db"),
    core: join(pspf, "core"),
    config: join(pspf, "config"),
    exports: join(pspf, "exchange", "exports"),
    imports: join(pspf, "exchange", "imports"),
    snapshots: join(pspf, "exchange", "snapshots"),
    logs: join(pspf, "logs"),
    cache: join(pspf, "cache"),
    locks: join(pspf, "core", "locks"),
    journal: join(pspf, "core", "journal"),
    migrations: join(pspf, "core", "migrations")
  };
}

async function ensureInitialised(workspaceRoot: string, createIfMissing = true): Promise<WorkspacePaths> {
  const paths = getWorkspacePaths(workspaceRoot);
  if (!existsSync(paths.db)) {
    if (createIfMissing) {
      return initialiseWorkspace(workspaceRoot);
    }
    await initialiseWorkspace(workspaceRoot);
  }
  if (createIfMissing) {
    await refreshReferenceData(workspaceRoot);
  }
  return paths;
}

async function refreshReferenceData(workspaceRoot: string): Promise<void> {
  const timestamp = nowIso();
  for (const domain of PSPF_DOMAINS) {
    await upsertEntity(workspaceRoot, { ...domain, createdAt: timestamp, updatedAt: timestamp });
  }
  for (const sourceControl of ISM_SOURCE_CONTROLS) {
    await upsertEntity(workspaceRoot, { ...sourceControl, createdAt: timestamp, updatedAt: timestamp });
  }
}

async function assertWritable(paths: WorkspacePaths): Promise<void> {
  const lock = await acquireWriterLock(paths);
  if (!lock.writable) {
    throw new Error(lock.detail);
  }
}

async function acquireWriterLock(paths: WorkspacePaths): Promise<WriterLockState> {
  const existing = await readWriterLock(paths);
  if (existing.holderPid && existing.holderPid !== process.pid && isProcessAlive(existing.holderPid)) {
    return existing;
  }

  const state: WriterLockState = {
    holderPid: process.pid,
    acquiredAt: nowIso(),
    currentPid: process.pid,
    policy: "single-writer",
    writable: true,
    detail: "Writer lock held by current process."
  };
  await writeJson(join(paths.locks, "writer-lock.json"), state);
  return state;
}

async function readWriterLock(paths: WorkspacePaths): Promise<WriterLockState> {
  const lockPath = join(paths.locks, "writer-lock.json");
  if (!existsSync(lockPath)) {
    return { currentPid: process.pid, policy: "single-writer", writable: true, detail: "No writer lock exists yet." };
  }

  const value = JSON.parse(await readFile(lockPath, "utf8")) as Partial<WriterLockState>;
  const holderPid = typeof value.holderPid === "number" ? value.holderPid : undefined;
  const heldByCurrentProcess = holderPid === process.pid;
  const writable = !holderPid || heldByCurrentProcess || !isProcessAlive(holderPid);
  return {
    holderPid,
    acquiredAt: value.acquiredAt,
    currentPid: process.pid,
    policy: "single-writer",
    writable,
    detail: writable
      ? heldByCurrentProcess ? "Writer lock held by current process." : "Writer lock is available."
      : `Workspace is read-only because writer lock is held by process ${holderPid}.`
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "EPERM";
  }
}

async function recordOperation(paths: WorkspacePaths, operationType: string, status: string, detail: string): Promise<void> {
  const id = `${operationType}-${Date.now()}`;
  await runSql(
    paths.db,
    `INSERT INTO operations(id, operation_type, status, detail, created_at)
VALUES ('${sqlEscape(id)}', '${sqlEscape(operationType)}', '${sqlEscape(status)}', '${sqlEscape(detail)}', '${nowIso()}');`
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runSql(dbPath: string, sql: string, extraArgs: readonly string[] = []): Promise<string> {
  const args = [...extraArgs, dbPath, sql];
  const { stdout, stderr } = await execFileAsync("sqlite3", args, { encoding: "utf8" });
  if (stderr.trim().length > 0) {
    throw new Error(stderr.trim());
  }
  return stdout;
}

function sqlEscape(value: string): string {
  return value.replaceAll("'", "''");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}