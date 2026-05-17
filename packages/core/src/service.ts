import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHANGE_RECORD_PERSISTENCE,
  CHANGE_RECORD_SOURCES,
  CHANGE_RECORD_STATUSES,
  CHANGE_RECORD_TYPES,
  COLLECTION_BY_ENTITY_TYPE,
  type BundleCollections,
  type EntityByCollection,
  DEFAULT_TAG_COLOUR,
  PSPF_SLICE_VERSION,
  SAVED_VIEW_EVIDENCE_COVERAGE,
  SAVED_VIEW_LIMITS,
  SAVED_VIEW_REQUIREMENT_COLUMNS,
  SAVED_VIEW_RELATIONSHIP_COLUMNS,
  SAVED_VIEW_REQUIREMENT_SORT_KEYS,
  SAVED_VIEW_SCOPES,
  SAVED_VIEW_SORT_DIRECTIONS,
  SAVED_VIEW_TAGS_MODES,
  SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS,
  TAG_COLOURS,
  TAG_LIMITS,
  type ActionStatus,
  type AssessmentStatus,
  type RiskStatus,
  type V01Collection,
  type V01Entity,
  PSPF_DOMAINS,
  VERSION_AXES,
  V0_1_COLLECTIONS,
  enrichActionsWithImpact,
  isValidSingleGrapheme,
  isValidSavedViewName,
  isValidTagLabel,
  normaliseSavedViewName,
  normaliseTagLabel,
  nowIso,
  sanitiseEntityForPublication,
  withEnvelope
} from "@pspf/contracts";
import { ISM_SOURCE_CONTROLS } from "@pspf/ism-source-library";
import { PSPF_BASELINE_DIRECTIONS, PSPF_BASELINE_DIRECTION_LINKS, PSPF_BASELINE_REQUIREMENTS } from "@pspf/reference-data";
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";

const SQLITE_BUSY_TIMEOUT_MS = 5000;
const workspaceOperationQueues = new Map<string, Promise<void>>();
let sqlJsPromise: Promise<SqlJsStatic> | undefined;

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
  readonly planImportBundle: (bundlePath: string, mode: ImportMode) => Promise<ImportResult>;
  readonly importBundle: (bundlePath: string, mode: ImportMode) => Promise<ImportResult>;
  readonly undoLastImport: () => Promise<ImportUndoResult>;
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
  readonly planImportBundle: (bundlePath: string, mode: ImportMode) => Promise<ImportResult>;
  readonly importBundle: (bundlePath: string, mode: ImportMode) => Promise<ImportResult>;
  readonly undoLastImport: () => Promise<ImportUndoResult>;
}

export interface CoreIntegrityApi {
  readonly verifyIntegrity: () => Promise<{ ok: boolean; detail: string }>;
  readonly runIntegrityScan: () => Promise<IntegrityScanReport>;
}

export type ImportMode = "additive-merge" | "full-replace" | "plan-apply";

export interface ImportTypeSummary {
  readonly total: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly written: number;
}

export interface ImportSummary {
  readonly total: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly written: number;
  readonly byType: Record<string, ImportTypeSummary>;
  readonly examples: readonly string[];
  readonly conflicts: readonly string[];
}

export interface ImportResult {
  readonly imported: number;
  readonly mode: ImportMode;
  readonly bundlePath: string;
  readonly importId: string;
  readonly summary: ImportSummary;
}

export interface ImportUndoResult {
  readonly undone: boolean;
  readonly restored: number;
  readonly importId?: string;
  readonly message: string;
}

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
    validateWorkspace: () => serialiseWorkspaceOperation(workspaceRoot, () => validateWorkspace(workspaceRoot)),
    listEntities: (entityType) => serialiseWorkspaceOperation(workspaceRoot, () => listEntities(workspaceRoot, entityType))
  };
}

export function createCoreWriteApi(workspaceRoot: string): CoreWriteApi {
  return {
    initialiseWorkspace: () => serialiseWorkspaceOperation(workspaceRoot, () => initialiseWorkspace(workspaceRoot)),
    createSnapshot: () => serialiseWorkspaceOperation(workspaceRoot, () => createSnapshot(workspaceRoot)),
    getWriterLock: () => serialiseWorkspaceOperation(workspaceRoot, () => getWriterLock(workspaceRoot)),
    upsertEntity: (entity) => serialiseWorkspaceOperation(workspaceRoot, () => upsertEntity(workspaceRoot, entity)),
    upsertEntities: (entities) => serialiseWorkspaceOperation(workspaceRoot, () => upsertEntities(workspaceRoot, entities))
  };
}

export function createCoreExchangeApi(workspaceRoot: string): CoreExchangeApi {
  return {
    exportBundle: () => serialiseWorkspaceOperation(workspaceRoot, () => exportBundle(workspaceRoot)),
    planImportBundle: (bundlePath, mode) => serialiseWorkspaceOperation(workspaceRoot, () => planImportBundle(workspaceRoot, bundlePath, mode)),
    importBundle: (bundlePath, mode) => serialiseWorkspaceOperation(workspaceRoot, () => importBundle(workspaceRoot, bundlePath, mode)),
    undoLastImport: () => serialiseWorkspaceOperation(workspaceRoot, () => undoLastImport(workspaceRoot))
  };
}

export function createCoreIntegrityApi(workspaceRoot: string): CoreIntegrityApi {
  return {
    verifyIntegrity: () => serialiseWorkspaceOperation(workspaceRoot, () => verifyIntegrity(workspaceRoot)),
    runIntegrityScan: () => serialiseWorkspaceOperation(workspaceRoot, () => runIntegrityScan(workspaceRoot))
  };
}

async function serialiseWorkspaceOperation<T>(workspaceRoot: string, operation: () => Promise<T>): Promise<T> {
  const previous = workspaceOperationQueues.get(workspaceRoot) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const queueTail = current.then(
    () => undefined,
    () => undefined
  );
  workspaceOperationQueues.set(workspaceRoot, queueTail);
  queueTail.finally(() => {
    if (workspaceOperationQueues.get(workspaceRoot) === queueTail) {
      workspaceOperationQueues.delete(workspaceRoot);
    }
  });
  return current;
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
  PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS};
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
INSERT INTO metadata(key, value) VALUES ('schemaVersion', '${VERSION_AXES.schemaVersion}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO metadata(key, value) VALUES ('bundleVersion', '${VERSION_AXES.bundleVersion}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO metadata(key, value) VALUES ('apiVersion', '${VERSION_AXES.apiVersion}')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`);

  const timestamp = nowIso();
  const seededDomains: V01Entity[] = PSPF_DOMAINS.map((domain) => ({ ...domain, createdAt: timestamp, updatedAt: timestamp }));
  const seededSourceControls: V01Entity[] = ISM_SOURCE_CONTROLS.map((sourceControl) => ({ ...sourceControl, createdAt: timestamp, updatedAt: timestamp }));
  const seededRequirements: V01Entity[] = PSPF_BASELINE_REQUIREMENTS.map((requirement) => ({ ...requirement, createdAt: timestamp, updatedAt: timestamp }));
  const seededDirections: V01Entity[] = PSPF_BASELINE_DIRECTIONS.map((direction) => ({ ...direction, createdAt: timestamp, updatedAt: timestamp }));
  const seededDirectionLinks: V01Entity[] = PSPF_BASELINE_DIRECTION_LINKS.map((link) => ({ ...link, createdAt: timestamp, updatedAt: timestamp }));
  await upsertEntities(workspaceRoot, [...seededDomains, ...seededSourceControls]);
  await insertReferenceEntitiesIfMissing(workspaceRoot, [...seededRequirements, ...seededDirections, ...seededDirectionLinks]);
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
  const byTag = buildByTagIndex(collections);
  const byTagJson = `${JSON.stringify(byTag, null, 2)}\n`;
  await writeFile(join(indexesDirectory, "by-tag.json"), byTagJson, "utf8");

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
      },
      {
        name: "by-tag",
        path: "./indexes/by-tag.json",
        hash: { alg: "SHA-256", value: sha256(byTagJson) }
      }
    ]
  };
  const manifestPath = join(dataDirectory, "manifest.json");
  await writeJson(manifestPath, manifest);
  await writeJson(join(exportDirectory, "bundle.json"), { manifest, collections });
  await recordOperation(paths, "export", "success", exportDirectory);
  return { exportDirectory, manifestPath, collectionCount: manifestCollections.length };
}

async function importBundle(workspaceRoot: string, bundlePath: string, mode: ImportMode): Promise<ImportResult> {
  const paths = await ensureInitialised(workspaceRoot);
  await assertWritable(paths);
  const importId = `import-${crypto.randomUUID()}`;
  const { writeSet, summary } = await buildImportPlan(workspaceRoot, bundlePath, mode);
  const entities = writeSet;
  const existingEntities = await listEntities(workspaceRoot);
  if (mode === "full-replace") {
    await writeJson(join(paths.imports, `pre-full-replace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), {
      generatedAt: nowIso(),
      reason: "pre full-replace import rollback point",
      entities: existingEntities
    });
    await runSql(paths.db, "DELETE FROM entities;");
  } else if (entities.length > 0) {
    await writeJson(join(paths.imports, `pre-${importId}.json`), {
      generatedAt: nowIso(),
      importId,
      mode,
      bundlePath,
      reason: "pre import undo point",
      entities: existingEntities
    });
  }

  if (entities.length > 0) {
    await runSql(paths.db, ["BEGIN IMMEDIATE;", ...entities.map(upsertEntitySql), "COMMIT;"].join("\n"));
  }
  await recordOperation(paths, "import", "success", `${mode}:${importId}:${bundlePath}`);
  return { imported: entities.length, mode, bundlePath, importId, summary };
}

async function planImportBundle(workspaceRoot: string, bundlePath: string, mode: ImportMode): Promise<ImportResult> {
  await ensureInitialised(workspaceRoot);
  const importId = `plan-${crypto.randomUUID()}`;
  const plan = await buildImportPlan(workspaceRoot, bundlePath, mode);
  return { imported: plan.writeSet.length, mode, bundlePath, importId, summary: plan.summary };
}

async function buildImportPlan(workspaceRoot: string, bundlePath: string, mode: ImportMode): Promise<{ incomingEntities: readonly V01Entity[]; writeSet: readonly V01Entity[]; summary: ImportSummary }> {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8")) as { readonly collections?: Partial<BundleCollections> };
  let incomingEntities = flattenImportEntities(bundle.collections ?? {});
  if (mode === "full-replace") {
    incomingEntities = await includeExistingReferencedSourceControls(workspaceRoot, incomingEntities);
  }
  const existingEntities = await listEntities(workspaceRoot);
  const tagImportResult = mode === "additive-merge" || mode === "plan-apply" ? filterIncomingTagLabelCollisions(incomingEntities, existingEntities) : { entities: incomingEntities, conflicts: [] as string[] };
  incomingEntities = tagImportResult.entities;
  const savedViewImportResult = mode === "additive-merge" || mode === "plan-apply" ? filterIncomingSavedViewNameCollisions(incomingEntities, existingEntities) : { entities: incomingEntities, conflicts: [] as string[] };
  incomingEntities = savedViewImportResult.entities;
  const validationEntities = mode === "additive-merge" || mode === "plan-apply" ? [...existingEntities, ...incomingEntities] : incomingEntities;
  validateImportedMappings(validationEntities);
  validateTagRules(incomingEntities, mode === "full-replace" ? [] : existingEntities);
  validateSavedViewRules(incomingEntities, mode === "full-replace" ? [] : existingEntities);
  validateChangeRecordRules(incomingEntities, mode === "full-replace" ? [] : existingEntities);
  const writeSet = mode === "additive-merge" || mode === "plan-apply" ? additiveMergeWriteSet(incomingEntities, existingEntities) : incomingEntities;
  return { incomingEntities, writeSet, summary: summariseImportChanges(incomingEntities, existingEntities, writeSet, [...tagImportResult.conflicts, ...savedViewImportResult.conflicts]) };
}

function summariseImportChanges(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[], writeSet: readonly V01Entity[], extraConflicts: readonly string[] = []): ImportSummary {
  const existingById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  const writtenIds = new Set(writeSet.map((entity) => entity.id));
  const byType: Record<string, ImportTypeSummary> = {};
  const examples: string[] = [];
  const conflicts: string[] = [...extraConflicts];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const incoming of incomingEntities) {
    const typeSummary = { ...(byType[incoming.entityType] || { total: 0, created: 0, updated: 0, unchanged: 0, written: 0 }) };
    const existing = existingById.get(incoming.id);
    const written = writtenIds.has(incoming.id);
    typeSummary.total += 1;
    if (written) {
      typeSummary.written += 1;
    }

    if (!existing) {
      created += 1;
      typeSummary.created += 1;
      pushImportExample(examples, `Created ${entityChangeLabel(incoming)}`);
    } else if (canonicalEntityJson({ ...incoming, createdAt: existing.createdAt } as V01Entity) === canonicalEntityJson(existing)) {
      unchanged += 1;
      typeSummary.unchanged += 1;
    } else if (written) {
      updated += 1;
      typeSummary.updated += 1;
      const updateDescription = describeEntityUpdate(existing, incoming);
      pushImportExample(examples, updateDescription);
      pushImportExample(conflicts, updateDescription);
    } else {
      unchanged += 1;
      typeSummary.unchanged += 1;
    }
    byType[incoming.entityType] = typeSummary;
  }

  return { total: incomingEntities.length, created, updated, unchanged, written: writeSet.length, byType, examples, conflicts };
}

async function undoLastImport(workspaceRoot: string): Promise<ImportUndoResult> {
  const paths = await ensureInitialised(workspaceRoot);
  await assertWritable(paths);
  const operations = await readOperations(paths);
  const lastImport = operations.find((operation) => operation.operation_type === "import" && operation.status === "success" && (operation.detail.startsWith("additive-merge:import-") || operation.detail.startsWith("plan-apply:import-")));
  if (!lastImport) {
    return { undone: false, restored: 0, message: "No additive or plan-apply import is available to undo." };
  }
  const [, importId] = lastImport.detail.split(":");
  if (!importId) {
    return { undone: false, restored: 0, message: "The last import record is missing its import id." };
  }
  const snapshotPath = join(paths.imports, `pre-${importId}.json`);
  if (!existsSync(snapshotPath)) {
    return { undone: false, restored: 0, importId, message: "The undo snapshot for the last import is no longer available." };
  }
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as { readonly entities?: readonly V01Entity[] };
  const entities = snapshot.entities || [];
  await runSql(paths.db, ["DELETE FROM entities;", ...entities.map(upsertEntitySql)].join("\n"));
  await recordOperation(paths, "import-undo", "success", importId);
  return { undone: true, restored: entities.length, importId, message: `Undid ${importId}; restored ${entities.length} record(s).` };
}

async function readOperations(paths: WorkspacePaths): Promise<readonly { operation_type: string; status: string; detail: string; created_at: string }[]> {
  const output = await runSql(paths.db, "SELECT operation_type, status, detail, created_at FROM operations ORDER BY created_at DESC;", ["-json"]);
  return output.trim() === "" ? [] : JSON.parse(output) as readonly { operation_type: string; status: string; detail: string; created_at: string }[];
}

function pushImportExample(examples: string[], example: string): void {
  if (examples.length < 8 && example) {
    examples.push(example);
  }
}

function describeEntityUpdate(existing: V01Entity, incoming: V01Entity): string {
  if (existing.entityType === "requirement" && incoming.entityType === "requirement" && existing.assessmentStatus !== incoming.assessmentStatus) {
    return `Updated ${entityChangeLabel(incoming)} status ${labelValue(existing.assessmentStatus)} -> ${labelValue(incoming.assessmentStatus)}`;
  }
  if (existing.entityType === "action" && incoming.entityType === "action" && existing.status !== incoming.status) {
    return `Updated ${entityChangeLabel(incoming)} status ${labelValue(existing.status)} -> ${labelValue(incoming.status)}`;
  }
  if (existing.entityType === "risk" && incoming.entityType === "risk" && existing.status !== incoming.status) {
    return `Updated ${entityChangeLabel(incoming)} status ${labelValue(existing.status)} -> ${labelValue(incoming.status)}`;
  }
  return `Updated ${entityChangeLabel(incoming)}`;
}

function entityChangeLabel(entity: V01Entity): string {
  const title = "title" in entity && typeof entity.title === "string" ? ` ${truncate(entity.title, 80)}` : "";
  return `${labelValue(entity.entityType)} ${entity.id}${title}`;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}...`;
}

function labelValue(value: string | undefined): string {
  return String(value || "not recorded").replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function additiveMergeWriteSet(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[]): V01Entity[] {
  const existingById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  const writeSet: V01Entity[] = [];
  for (const incoming of incomingEntities) {
    const existing = existingById.get(incoming.id);
    if (!existing) {
      writeSet.push(incoming);
      continue;
    }

    const merged = { ...incoming, createdAt: existing.createdAt } as V01Entity;
    if (canonicalEntityJson(merged) !== canonicalEntityJson(existing)) {
      writeSet.push(merged);
    }
  }
  return writeSet;
}

function canonicalEntityJson(entity: V01Entity): string {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...stableEntity } = entity;
  return JSON.stringify(stableEntity);
}

async function upsertEntity(workspaceRoot: string, entity: V01Entity): Promise<V01Entity> {
  const paths = await ensureInitialised(workspaceRoot, false);
  await assertWritable(paths);
  validateTagRules([entity], await readStoredEntities(paths));
  validateSavedViewRules([entity], await readStoredEntities(paths));
  validateChangeRecordRules([entity], await readStoredEntities(paths));
  await runSql(paths.db, upsertEntitySql(entity));
  return entity;
}

async function upsertEntities(workspaceRoot: string, entities: readonly V01Entity[]): Promise<readonly V01Entity[]> {
  const paths = await ensureInitialised(workspaceRoot, false);
  await assertWritable(paths);
  if (entities.length === 0) {
    return entities;
  }
  validateTagRules(entities, await readStoredEntities(paths));
  validateSavedViewRules(entities, await readStoredEntities(paths));
  validateChangeRecordRules(entities, await readStoredEntities(paths));
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
  return readStoredEntities(paths, entityType);
}

async function readStoredEntities(paths: WorkspacePaths, entityType?: V01Entity["entityType"]): Promise<V01Entity[]> {
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
    "saved-views": [],
    "source-controls": [],
    "requirement-control-mappings": [],
    directions: [],
    "change-records": [],
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

async function includeExistingReferencedSourceControls(workspaceRoot: string, entities: readonly V01Entity[]): Promise<V01Entity[]> {
  const entityIds = new Set(entities.map((entity) => entity.id));
  const missingSourceControlIds = new Set<string>();
  for (const entity of entities) {
    if (entity.entityType === "requirement-control-mapping") {
      const sourceControlId = (entity as EntityByCollection["requirement-control-mappings"]).sourceControlId;
      if (!entityIds.has(sourceControlId)) {
        missingSourceControlIds.add(sourceControlId);
      }
    }
  }
  if (missingSourceControlIds.size === 0) {
    return [...entities];
  }

  const existingSourceControls = await listEntities(workspaceRoot, "source-control");
  const sourceControlsToPreserve = existingSourceControls.filter((sourceControl) => missingSourceControlIds.has(sourceControl.id));
  return [...entities, ...sourceControlsToPreserve];
}

function pushEntity<Collection extends V01Collection>(
  collections: BundleCollections,
  collectionName: Collection,
  entity: V01Entity
): void {
  if (entity.recordStatus === "deleted") {
    return;
  }
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
    directionCount: collections.directions.length,
    changeRecordCount: collections["change-records"].length
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
    "saved-views": collections["saved-views"].length,
    "source-controls": collections["source-controls"].length,
    "requirement-control-mappings": collections["requirement-control-mappings"].length,
    directions: collections.directions.length,
    "change-records": collections["change-records"].length,
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

function buildByTagIndex(collections: BundleCollections): Record<string, unknown> {
  const requirementsById = new Map(collections.requirements.map((requirement, index) => [requirement.id, { requirement, index }]));
  const requirementIdsByTag = new Map<string, string[]>();
  for (const link of collections.links) {
    if (link.linkType === "tagged-with" && link.fromType === "requirement" && link.toType === "tag") {
      if (!requirementsById.has(link.fromId)) {
        continue;
      }
      requirementIdsByTag.set(link.toId, [...(requirementIdsByTag.get(link.toId) ?? []), link.fromId]);
    }
  }

  const tags = collections.tags
    .filter((tag) => tag.recordStatus !== "deleted")
    .map((tag) => ({
      tagId: tag.id,
      label: tag.label,
      title: tag.title,
      colour: tag.colour,
      emoji: tag.emoji ?? "",
      requirementIds: [...new Set(requirementIdsByTag.get(tag.id) ?? [])].sort((left, right) => {
        const leftIndex = requirementsById.get(left)?.index;
        const rightIndex = requirementsById.get(right)?.index;
        if (leftIndex !== undefined && rightIndex !== undefined) {
          return leftIndex - rightIndex;
        }
        return left.localeCompare(right);
      })
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }) || left.tagId.localeCompare(right.tagId));

  return { schemaVersion: VERSION_AXES.schemaVersion, generatedAt: nowIso(), tags };
}

function filterIncomingTagLabelCollisions(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[]): { readonly entities: V01Entity[]; readonly conflicts: string[] } {
  const existingTagsByLabel = new Map(existingEntities
    .filter((entity): entity is EntityByCollection["tags"] => entity.entityType === "tag")
    .map((tag) => [normaliseTagLabel(tag.label), tag]));
  const rejectedTagIds = new Set<string>();
  const conflicts: string[] = [];
  const filteredTags = incomingEntities.filter((entity) => {
    if (entity.entityType !== "tag") {
      return true;
    }
    const existing = existingTagsByLabel.get(normaliseTagLabel(entity.label));
    if (existing && existing.id !== entity.id) {
      rejectedTagIds.add(entity.id);
      conflicts.push(`Rejected tag ${entity.id} ${entity.title}: label already exists on ${existing.id} ${existing.title}.`);
      return false;
    }
    return true;
  });
  if (rejectedTagIds.size === 0) {
    return { entities: filteredTags, conflicts };
  }
  return {
    conflicts,
    entities: filteredTags.filter((entity) => !(entity.entityType === "link" && entity.linkType === "tagged-with" && rejectedTagIds.has(entity.toId)))
  };
}

function filterIncomingSavedViewNameCollisions(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[]): { readonly entities: V01Entity[]; readonly conflicts: string[] } {
  const existingSavedViewsByName = new Map(existingEntities
    .filter((entity): entity is EntityByCollection["saved-views"] => entity.entityType === "saved-view")
    .map((savedView) => [savedViewScopeNameKey(savedView.scope, savedView.name), savedView]));
  const conflicts: string[] = [];
  const entities = incomingEntities.filter((entity) => {
    if (entity.entityType !== "saved-view") {
      return true;
    }
    const existing = existingSavedViewsByName.get(savedViewScopeNameKey(entity.scope, entity.name));
    if (existing && existing.id !== entity.id) {
      conflicts.push(`Rejected saved view ${entity.id} ${entity.name}: name already exists on ${existing.id} ${existing.name}.`);
      return false;
    }
    return true;
  });
  return { entities, conflicts };
}

function validateTagRules(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[]): void {
  const mergedById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  for (const entity of incomingEntities) {
    mergedById.set(entity.id, entity);
  }
  const merged = [...mergedById.values()];

  const tags = merged.filter((entity): entity is EntityByCollection["tags"] => entity.entityType === "tag" && entity.recordStatus !== "deleted");
  if (tags.length > TAG_LIMITS.perWorkspaceHard) {
    throw new Error(`Tag limit exceeded: maximum ${TAG_LIMITS.perWorkspaceHard} tags per workspace.`);
  }

  const labelsByNormalisedValue = new Map<string, EntityByCollection["tags"]>();
  for (const tag of tags) {
    if (!isValidTagLabel(tag.label)) {
      throw new Error(`Invalid tag label for ${tag.id}: use 1-${TAG_LIMITS.labelMaxLength} letters, digits, spaces, hyphens, or apostrophes.`);
    }
    if (!tag.title || tag.title.length > TAG_LIMITS.titleMaxLength) {
      throw new Error(`Invalid tag title for ${tag.id}: use 1-${TAG_LIMITS.titleMaxLength} characters.`);
    }
    if ((tag.description ?? "").length > TAG_LIMITS.descriptionMaxLength) {
      throw new Error(`Invalid tag description for ${tag.id}: use at most ${TAG_LIMITS.descriptionMaxLength} characters.`);
    }
    if (!TAG_COLOURS.includes(tag.colour ?? DEFAULT_TAG_COLOUR)) {
      throw new Error(`Invalid tag colour for ${tag.id}.`);
    }
    if (!isValidSingleGrapheme(tag.emoji ?? "")) {
      throw new Error(`Invalid tag emoji for ${tag.id}: use a single grapheme cluster.`);
    }
    const normalisedLabel = normaliseTagLabel(tag.label);
    const existing = labelsByNormalisedValue.get(normalisedLabel);
    if (existing && existing.id !== tag.id) {
      throw new Error(`Duplicate tag label rejected: ${tag.label} conflicts with ${existing.id}.`);
    }
    labelsByNormalisedValue.set(normalisedLabel, tag);
  }

  const entityIds = new Set(merged.map((entity) => entity.id));
  const tagLinksByRequirement = new Map<string, string[]>();
  for (const entity of merged) {
    if (entity.entityType !== "link" || entity.recordStatus === "deleted") {
      continue;
    }
    if (entity.linkType === "tagged-with") {
      if (entity.fromType !== "requirement" || entity.toType !== "tag") {
        throw new Error(`Invalid tagged-with link ${entity.id}: only requirement -> tag is permitted in v1.7.`);
      }
      if (!entityIds.has(entity.fromId) || !entityIds.has(entity.toId)) {
        throw new Error(`Invalid tagged-with link ${entity.id}: endpoint is missing.`);
      }
      tagLinksByRequirement.set(entity.fromId, [...(tagLinksByRequirement.get(entity.fromId) ?? []), entity.toId]);
    }
  }

  for (const [requirementId, tagIds] of tagLinksByRequirement) {
    if (new Set(tagIds).size > TAG_LIMITS.perRequirementHard) {
      throw new Error(`Tag limit exceeded: ${requirementId} has more than ${TAG_LIMITS.perRequirementHard} tags.`);
    }
  }
}

function validateSavedViewRules(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[]): void {
  const mergedById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  for (const entity of incomingEntities) {
    mergedById.set(entity.id, entity);
  }
  const merged = [...mergedById.values()];
  const domainIds = new Set(merged.filter((entity) => entity.entityType === "domain" && entity.recordStatus !== "deleted").map((entity) => entity.id));
  const namesByNormalisedValue = new Map<string, EntityByCollection["saved-views"]>();

  for (const savedView of merged.filter((entity): entity is EntityByCollection["saved-views"] => entity.entityType === "saved-view" && entity.recordStatus !== "deleted")) {
    if (!isValidSavedViewName(savedView.name)) {
      throw new Error(`Invalid saved-view name for ${savedView.id}: use 1-${SAVED_VIEW_LIMITS.nameMaxLength} characters.`);
    }
    if (savedView.title !== savedView.name) {
      throw new Error(`Invalid saved-view title for ${savedView.id}: title must mirror name.`);
    }
    const normalisedName = savedViewScopeNameKey(savedView.scope, savedView.name);
    const existing = namesByNormalisedValue.get(normalisedName);
    if (existing && existing.id !== savedView.id) {
      throw new Error(`Duplicate saved-view name rejected: ${savedView.name} conflicts with ${existing.id}.`);
    }
    namesByNormalisedValue.set(normalisedName, savedView);

    if (!SAVED_VIEW_SCOPES.includes(savedView.scope)) {
      throw new Error(`Invalid saved-view scope for ${savedView.id}.`);
    }
    const filters = savedView.filters ?? {};
    if ((filters.query ?? "").length > SAVED_VIEW_LIMITS.queryMaxLength) {
      throw new Error(`Invalid saved-view query for ${savedView.id}: use at most ${SAVED_VIEW_LIMITS.queryMaxLength} characters.`);
    }
    for (const domainId of filters.domainIds ?? []) {
      if (!domainIds.has(domainId)) {
        throw new Error(`Invalid saved-view domain for ${savedView.id}: ${domainId} is not a known domain.`);
      }
    }
    assertAllAllowed(filters.assessmentStatuses ?? [], ["not-started", "in-progress", "met", "partially-met", "not-met", "not-applicable", "under-review"] satisfies readonly AssessmentStatus[], `Invalid saved-view assessment status for ${savedView.id}`);
    if (filters.tagsMode && !SAVED_VIEW_TAGS_MODES.includes(filters.tagsMode)) {
      throw new Error(`Invalid saved-view tag mode for ${savedView.id}.`);
    }
    if (filters.evidenceCoverage && !SAVED_VIEW_EVIDENCE_COVERAGE.includes(filters.evidenceCoverage)) {
      throw new Error(`Invalid saved-view evidence coverage for ${savedView.id}.`);
    }
    assertAllAllowed(filters.actionStates ?? [], ["todo", "in-progress", "blocked", "done", "cancelled"] satisfies readonly ActionStatus[], `Invalid saved-view action state for ${savedView.id}`);
    assertAllAllowed(filters.riskStates ?? [], ["open", "monitored", "closed"] satisfies readonly RiskStatus[], `Invalid saved-view risk state for ${savedView.id}`);

    const presentation = savedView.presentation ?? {};
    if (presentation.sortKey && !SAVED_VIEW_REQUIREMENT_SORT_KEYS.includes(presentation.sortKey)) {
      throw new Error(`Invalid saved-view sort key for ${savedView.id}.`);
    }
    if (presentation.sortDirection && !SAVED_VIEW_SORT_DIRECTIONS.includes(presentation.sortDirection)) {
      throw new Error(`Invalid saved-view sort direction for ${savedView.id}.`);
    }
    const visibleColumns = presentation.visibleColumns ?? [];
    if (visibleColumns.length > SAVED_VIEW_LIMITS.visibleColumnsHard) {
      throw new Error(`Invalid saved-view columns for ${savedView.id}: too many visible columns.`);
    }
    assertAllAllowed(visibleColumns, [...SAVED_VIEW_REQUIREMENT_COLUMNS, ...SAVED_VIEW_RELATIONSHIP_COLUMNS, ...SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS], `Invalid saved-view column for ${savedView.id}`);
  }
}

function savedViewScopeNameKey(scope: string, name: string): string {
  return `${scope}::${normaliseSavedViewName(name)}`;
}

function validateChangeRecordRules(incomingEntities: readonly V01Entity[], existingEntities: readonly V01Entity[]): void {
  const mergedById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  for (const entity of incomingEntities) {
    mergedById.set(entity.id, entity);
  }
  const merged = [...mergedById.values()];
  const entityIds = new Set(merged.map((entity) => entity.id));
  const permittedTargetTypes = new Set<V01Entity["entityType"]>(["requirement", "action", "risk", "direction", "tag", "saved-view"]);

  for (const changeRecord of merged.filter((entity): entity is EntityByCollection["change-records"] => entity.entityType === "change-record" && entity.recordStatus !== "deleted")) {
    if (!CHANGE_RECORD_TYPES.includes(changeRecord.changeType)) {
      throw new Error(`Invalid change-record type for ${changeRecord.id}.`);
    }
    if (!CHANGE_RECORD_STATUSES.includes(changeRecord.status)) {
      throw new Error(`Invalid change-record status for ${changeRecord.id}.`);
    }
    if (!CHANGE_RECORD_PERSISTENCE.includes(changeRecord.persistence)) {
      throw new Error(`Invalid change-record persistence for ${changeRecord.id}.`);
    }
    if (!CHANGE_RECORD_SOURCES.includes(changeRecord.source)) {
      throw new Error(`Invalid change-record source for ${changeRecord.id}.`);
    }
  }

  for (const entity of merged) {
    if (entity.entityType !== "link" || entity.recordStatus === "deleted" || entity.linkType !== "changes") {
      continue;
    }
    if (entity.fromType !== "change-record" || !permittedTargetTypes.has(entity.toType)) {
      throw new Error(`Invalid changes link ${entity.id}: only change-record -> requirement/action/risk/direction/tag/saved-view is permitted in v1.10.`);
    }
    if (!entityIds.has(entity.fromId) || !entityIds.has(entity.toId)) {
      throw new Error(`Invalid changes link ${entity.id}: endpoint is missing.`);
    }
  }
}

function assertAllAllowed<T extends string>(values: readonly string[], allowedValues: readonly T[], message: string): void {
  for (const value of values) {
    if (!(allowedValues as readonly string[]).includes(value)) {
      throw new Error(`${message}: ${value}.`);
    }
  }
}

function validateImportedMappings(entities: readonly V01Entity[]): void {
  const entityIds = new Set(entities.map((entity) => entity.id));
  for (const mapping of entities.filter((entity) => entity.entityType === "requirement-control-mapping")) {
    if (!entityIds.has(mapping.requirementId)) {
      throw new Error(`Import rejected: mapping ${mapping.id} references missing requirement ${mapping.requirementId}`);
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
  await deleteRetiredCoreReferenceEntities(workspaceRoot, "source-control", new Set(ISM_SOURCE_CONTROLS.map((control) => control.id)));
  await deleteRetiredCoreReferenceEntities(workspaceRoot, "direction", new Set(PSPF_BASELINE_DIRECTIONS.map((direction) => direction.id)), "DIR-PSPF-");
  await deleteRetiredCoreReferenceEntities(workspaceRoot, "link", new Set(PSPF_BASELINE_DIRECTION_LINKS.map((link) => link.id)), "LNK-PSPF-DIRECTION-");
  const seededDomains: V01Entity[] = PSPF_DOMAINS.map((domain) => ({ ...domain, createdAt: timestamp, updatedAt: timestamp }));
  const seededSourceControls: V01Entity[] = ISM_SOURCE_CONTROLS.map((sourceControl) => ({ ...sourceControl, createdAt: timestamp, updatedAt: timestamp }));
  const seededRequirements: V01Entity[] = PSPF_BASELINE_REQUIREMENTS.map((requirement) => ({ ...requirement, createdAt: timestamp, updatedAt: timestamp }));
  const seededDirections: V01Entity[] = PSPF_BASELINE_DIRECTIONS.map((direction) => ({ ...direction, createdAt: timestamp, updatedAt: timestamp }));
  const seededDirectionLinks: V01Entity[] = PSPF_BASELINE_DIRECTION_LINKS.map((link) => ({ ...link, createdAt: timestamp, updatedAt: timestamp }));
  await upsertEntities(workspaceRoot, [...seededDomains, ...seededSourceControls]);
  await insertReferenceEntitiesIfMissing(workspaceRoot, [...seededRequirements, ...seededDirections, ...seededDirectionLinks]);
}

async function deleteRetiredCoreReferenceEntities(workspaceRoot: string, entityType: V01Entity["entityType"], activeIds: ReadonlySet<string>, idPrefix?: string): Promise<void> {
  const paths = getWorkspacePaths(workspaceRoot);
  const output = await runSql(paths.db, `SELECT payload FROM entities WHERE entity_type = '${sqlEscape(entityType)}';`, ["-json"]);
  const rows = output.trim() === "" ? [] : JSON.parse(output) as readonly { payload: string }[];
  const existing = rows.map((row) => JSON.parse(row.payload) as V01Entity);
  const retiredIds = existing
    .filter((entity) => entity.sourceProduct === "core" && (!idPrefix || entity.id.startsWith(idPrefix)) && !activeIds.has(entity.id))
    .map((entity) => entity.id);
  if (retiredIds.length === 0) {
    return;
  }

  await runSql(paths.db, `DELETE FROM entities WHERE id IN (${retiredIds.map((id) => `'${sqlEscape(id)}'`).join(", ")});`);
}

async function insertReferenceEntitiesIfMissing(workspaceRoot: string, entities: readonly V01Entity[]): Promise<void> {
  if (entities.length === 0) {
    return;
  }
  const paths = getWorkspacePaths(workspaceRoot);
  await runSql(paths.db, ["BEGIN IMMEDIATE;", ...entities.map(insertEntityIfMissingSql), "COMMIT;"].join("\n"));
}

function insertEntityIfMissingSql(entity: V01Entity): string {
  return `INSERT INTO entities(id, entity_type, payload, created_at, updated_at)
VALUES ('${sqlEscape(entity.id)}', '${sqlEscape(entity.entityType)}', '${sqlEscape(JSON.stringify(entity))}', '${sqlEscape(entity.createdAt)}', '${sqlEscape(entity.updatedAt)}')
ON CONFLICT(id) DO NOTHING;`;
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
  const SQL = await getSqlJs();
  const db = await openSqlDatabase(SQL, dbPath);
  try {
    const results = db.exec(sql);
    if (sqlContainsWrite(sql)) {
      await persistSqlDatabase(db, dbPath);
    }
    return extraArgs.includes("-json") ? sqlResultsToJson(results) : sqlResultsToText(results);
  } finally {
    db.close();
  }
}

function sqlContainsWrite(sql: string): boolean {
  return /\b(?:BEGIN|COMMIT|CREATE|DELETE|DROP|INSERT|REPLACE|UPDATE|VACUUM)\b/i.test(sql);
}

async function getSqlJs(): Promise<SqlJsStatic> {
  sqlJsPromise ??= initSqlJs({ locateFile: (file) => join(dirname(fileURLToPath(import.meta.url)), file) });
  return sqlJsPromise;
}

async function openSqlDatabase(SQL: SqlJsStatic, dbPath: string): Promise<SqlJsDatabase> {
  try {
    const database = await readFile(dbPath);
    return new SQL.Database(new Uint8Array(database));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return new SQL.Database();
    }
    throw error;
  }
}

async function persistSqlDatabase(db: SqlJsDatabase, dbPath: string): Promise<void> {
  const tmpPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, Buffer.from(db.export()));
  await rename(tmpPath, dbPath);
}

function sqlResultsToJson(results: readonly SqlJsQueryResult[]): string {
  const rows = results.flatMap((result) => result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))));
  return rows.length === 0 ? "" : JSON.stringify(rows);
}

function sqlResultsToText(results: readonly SqlJsQueryResult[]): string {
  return results.flatMap((result) => result.values.map((values) => values.join("|"))).join("\n");
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