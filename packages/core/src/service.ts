import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
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
  type LinkEntity,
  DEFAULT_TAG_COLOUR,
  PspfError,
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
  hasCompatibleMajorVersion,
  isCompatibleVersionAxes,
  isValidSavedViewName,
  isValidTagLabel,
  normaliseSavedViewName,
  normaliseTagLabel,
  nowIso,
  sanitiseEntityForPublication,
  withEnvelope
} from "@pspf/contracts";
import { ISM_SOURCE_CONTROLS } from "@pspf/ism-source-library";
import {
  CONTROL_THEMES,
  CYBER_FUNCTIONS,
  CYBER_REFERENCE_LINKS,
  CYBER_REFERENCE_MAPPINGS,
  GUIDANCE_FRAMEWORKS,
  MITIGATION_STRATEGIES,
  PSPF_BASELINE_DIRECTIONS,
  PSPF_BASELINE_DIRECTION_LINKS,
  PSPF_BASELINE_REQUIREMENTS,
  PSPF_REFERENCE_DATA_REPORT
} from "@pspf/reference-data";
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";

const SQLITE_BUSY_TIMEOUT_MS = 5000;
const IMPORT_LIMITS = {
  maxBundleBytes: 50 * 1024 * 1024,
  maxItemsPerCollection: 200_000,
  maxTotalEntities: 1_000_000,
  maxStringLength: 64 * 1024,
  maxDepth: 16,
  maxCollections: 64,
  maxLinks: 2_000_000
} as const;
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

interface ImportBundleManifest {
  readonly bundleType?: string;
  readonly bundleVersion?: string;
  readonly schemaVersion?: string;
  readonly apiVersion?: string;
  readonly generator?: { readonly mode?: string };
  readonly collections?: readonly ManifestCollection[];
}

interface ImportBundlePayload {
  readonly manifest?: ImportBundleManifest;
  readonly collections?: Partial<BundleCollections>;
}

export interface CoreService {
  readonly getWorkspacePaths: () => WorkspacePaths;
  readonly initialiseWorkspace: () => Promise<WorkspacePaths>;
  readonly resetWorkspace: () => Promise<WorkspaceResetResult>;
  readonly validateWorkspace: () => Promise<{ ok: boolean; message: string; counts: Record<V01Collection, number> }>;
  readonly verifyIntegrity: () => Promise<{ ok: boolean; detail: string }>;
  readonly runIntegrityScan: () => Promise<IntegrityScanReport>;
  readonly runDatasetDiagnostics: () => Promise<DatasetDiagnosticReport>;
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
  readonly resetWorkspace: () => Promise<WorkspaceResetResult>;
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
  readonly runDatasetDiagnostics: () => Promise<DatasetDiagnosticReport>;
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

export interface WorkspaceResetResult {
  readonly reset: boolean;
  readonly root: string;
  readonly removedPath: string;
  readonly message: string;
  readonly paths: WorkspacePaths;
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
  readonly section: "sqlite" | "payload" | "links" | "references" | "writer-lock" | "lifecycle";
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
    readonly brokenReferences: number;
    readonly unparseablePayloads: number;
  };
}

export interface DatasetDiagnosticFinding {
  readonly section: "counts" | "schema" | "mappings" | "links" | "publication";
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
}

export interface DatasetDiagnosticReport {
  readonly ok: boolean;
  readonly generatedAt: string;
  readonly summary: string;
  readonly findings: readonly DatasetDiagnosticFinding[];
  readonly counts: {
    readonly cyberFunctions: number;
    readonly mitigationStrategies: number;
    readonly guidanceFrameworks: number;
    readonly controlThemes: number;
    readonly cyberReferenceMappings: number;
    readonly cyberReferenceLinks: number;
    readonly brokenMappingEndpoints: number;
    readonly mismatchedCyberLinks: number;
    readonly schemaVersionMismatches: number;
    readonly publicationLeaks: number;
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
    listEntities: (entityType) =>
      serialiseWorkspaceOperation(workspaceRoot, () => listEntities(workspaceRoot, entityType))
  };
}

export function createCoreWriteApi(workspaceRoot: string): CoreWriteApi {
  return {
    initialiseWorkspace: () => serialiseWorkspaceOperation(workspaceRoot, () => initialiseWorkspace(workspaceRoot)),
    resetWorkspace: () => serialiseWorkspaceOperation(workspaceRoot, () => resetWorkspace(workspaceRoot)),
    createSnapshot: () => serialiseWorkspaceOperation(workspaceRoot, () => createSnapshot(workspaceRoot)),
    getWriterLock: () => serialiseWorkspaceOperation(workspaceRoot, () => getWriterLock(workspaceRoot)),
    upsertEntity: (entity) => serialiseWorkspaceOperation(workspaceRoot, () => upsertEntity(workspaceRoot, entity)),
    upsertEntities: (entities) =>
      serialiseWorkspaceOperation(workspaceRoot, () => upsertEntities(workspaceRoot, entities))
  };
}

export function createCoreExchangeApi(workspaceRoot: string): CoreExchangeApi {
  return {
    exportBundle: () => serialiseWorkspaceOperation(workspaceRoot, () => exportBundle(workspaceRoot)),
    planImportBundle: (bundlePath, mode) =>
      serialiseWorkspaceOperation(workspaceRoot, () => planImportBundle(workspaceRoot, bundlePath, mode)),
    importBundle: (bundlePath, mode) =>
      serialiseWorkspaceOperation(workspaceRoot, () => importBundle(workspaceRoot, bundlePath, mode)),
    undoLastImport: () => serialiseWorkspaceOperation(workspaceRoot, () => undoLastImport(workspaceRoot))
  };
}

export function createCoreIntegrityApi(workspaceRoot: string): CoreIntegrityApi {
  return {
    verifyIntegrity: () => serialiseWorkspaceOperation(workspaceRoot, () => verifyIntegrity(workspaceRoot)),
    runIntegrityScan: () => serialiseWorkspaceOperation(workspaceRoot, () => runIntegrityScan(workspaceRoot)),
    runDatasetDiagnostics: () => serialiseWorkspaceOperation(workspaceRoot, () => runDatasetDiagnostics(workspaceRoot))
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

  await runSql(
    paths.db,
    `
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
`
  );

  const timestamp = nowIso();
  const seededDomains: V01Entity[] = PSPF_DOMAINS.map((domain) => ({
    ...domain,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededSourceControls: V01Entity[] = ISM_SOURCE_CONTROLS.map((sourceControl) => ({
    ...sourceControl,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededRequirements: V01Entity[] = PSPF_BASELINE_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededDirections: V01Entity[] = PSPF_BASELINE_DIRECTIONS.map((direction) => ({
    ...direction,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededDirectionLinks: V01Entity[] = PSPF_BASELINE_DIRECTION_LINKS.map((link) => ({
    ...link,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededCyberReferenceEntities: V01Entity[] = [
    ...CYBER_FUNCTIONS,
    ...MITIGATION_STRATEGIES,
    ...GUIDANCE_FRAMEWORKS,
    ...CONTROL_THEMES,
    ...CYBER_REFERENCE_MAPPINGS,
    ...CYBER_REFERENCE_LINKS
  ].map((entity) => ({
    ...entity,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  await upsertEntities(workspaceRoot, [...seededDomains, ...seededSourceControls]);
  await insertReferenceEntitiesIfMissing(workspaceRoot, [
    ...seededRequirements,
    ...seededDirections,
    ...seededDirectionLinks
  ]);
  await upsertEntities(workspaceRoot, seededCyberReferenceEntities);
  return paths;
}

async function resetWorkspace(workspaceRoot: string): Promise<WorkspaceResetResult> {
  const paths = getWorkspacePaths(workspaceRoot);
  await assertWritable(paths);
  await rm(paths.pspf, { recursive: true, force: true });
  const resetPaths = await initialiseWorkspace(workspaceRoot);
  return {
    reset: true,
    root: workspaceRoot,
    removedPath: paths.pspf,
    message: "PSPF workspace reset to a clean reference-data baseline.",
    paths: resetPaths
  };
}

async function validateWorkspace(
  workspaceRoot: string
): Promise<{ ok: boolean; message: string; counts: Record<V01Collection, number> }> {
  const paths = await ensureInitialised(workspaceRoot);
  const requiredPaths = [
    paths.db,
    paths.config,
    paths.exports,
    paths.imports,
    paths.snapshots,
    paths.logs,
    paths.locks
  ];
  const missing = requiredPaths.filter((path) => !existsSync(path));
  const collections = await getBundleCollections(workspaceRoot, paths);
  const counts = getCollectionCounts(collections);

  if (missing.length > 0) {
    return { ok: false, message: `Missing ${missing.map((path) => basename(path)).join(", ")}`, counts };
  }

  return {
    ok: true,
    message: `Workspace ready with ${counts.requirements} requirement(s) and ${counts.evidence} evidence item(s).`,
    counts
  };
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
    findings.push({
      section: "sqlite",
      severity: "error",
      message: `SQLite integrity_check returned: ${sqliteResult}`
    });
  }

  const rawOutput = await runSql(paths.db, "SELECT id, entity_type, payload FROM entities;", ["-json"]);
  const rows =
    rawOutput.trim() === ""
      ? []
      : (JSON.parse(rawOutput) as readonly { id: string; entity_type: string; payload: string }[]);
  const entitiesById = new Map<string, V01Entity>();
  let unparseable = 0;
  for (const row of rows) {
    try {
      const entity = JSON.parse(row.payload) as V01Entity;
      if (entity.id !== row.id) {
        findings.push({
          section: "payload",
          severity: "error",
          message: `Entity row id ${row.id} does not match payload id ${entity.id}.`
        });
      }
      if (entity.entityType !== row.entity_type) {
        findings.push({
          section: "payload",
          severity: "error",
          message: `Entity ${entity.id} entity_type column (${row.entity_type}) does not match payload entityType (${entity.entityType}).`
        });
      }
      entitiesById.set(entity.id, entity);
    } catch (error) {
      unparseable += 1;
      const message = error instanceof Error ? error.message : String(error);
      findings.push({
        section: "payload",
        severity: "error",
        message: `Entity row ${row.id} payload is not valid JSON: ${message}`
      });
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
    const link = entity as V01Entity & {
      fromId: string;
      fromType: string;
      toId: string;
      toType: string;
      linkType: string;
    };
    const fromEntity = entitiesById.get(link.fromId);
    const toEntity = entitiesById.get(link.toId);
    if (!fromEntity) {
      orphanedLinks += 1;
      findings.push({
        section: "links",
        severity: "error",
        message: `Link ${link.id} references missing fromId ${link.fromId}.`
      });
    } else if (fromEntity.entityType !== link.fromType) {
      mistypedLinks += 1;
      findings.push({
        section: "links",
        severity: "error",
        message: `Link ${link.id} fromType ${link.fromType} does not match referenced entity ${link.fromId} (${fromEntity.entityType}).`
      });
    }
    if (!toEntity) {
      orphanedLinks += 1;
      findings.push({
        section: "links",
        severity: "error",
        message: `Link ${link.id} references missing toId ${link.toId}.`
      });
    } else if (toEntity.entityType !== link.toType) {
      mistypedLinks += 1;
      findings.push({
        section: "links",
        severity: "error",
        message: `Link ${link.id} toType ${link.toType} does not match referenced entity ${link.toId} (${toEntity.entityType}).`
      });
    }
  }

  let brokenReferences = 0;
  for (const entity of entitiesById.values()) {
    if (entity.entityType !== "contract" || entity.recordStatus === "deleted") {
      continue;
    }
    const contract = entity as V01Entity & { supplierId?: unknown };
    if (typeof contract.supplierId !== "string" || contract.supplierId.trim() === "") {
      brokenReferences += 1;
      findings.push({
        section: "references",
        severity: "error",
        message: `Contract ${contract.id} has missing or invalid supplierId.`
      });
      continue;
    }
    const supplier = entitiesById.get(contract.supplierId);
    if (!supplier) {
      brokenReferences += 1;
      findings.push({
        section: "references",
        severity: "error",
        message: `Contract ${contract.id} references missing supplier ${contract.supplierId}.`
      });
    } else if (supplier.entityType !== "supplier") {
      brokenReferences += 1;
      findings.push({
        section: "references",
        severity: "error",
        message: `Contract ${contract.id} supplierId ${contract.supplierId} references ${supplier.entityType}, not supplier.`
      });
    } else if (supplier.recordStatus === "deleted") {
      brokenReferences += 1;
      findings.push({
        section: "references",
        severity: "error",
        message: `Contract ${contract.id} references deleted supplier ${contract.supplierId}.`
      });
    }
  }

  const lock = await readWriterLock(paths);
  if (lock.holderPid && lock.holderPid !== process.pid && !isProcessAlive(lock.holderPid)) {
    findings.push({
      section: "writer-lock",
      severity: "warning",
      message: `Writer lock holder pid ${lock.holderPid} is no longer alive; lock is stale.`
    });
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
      brokenReferences,
      unparseablePayloads: unparseable
    }
  };

  await writeJson(join(paths.logs, "integrity-scan.json"), report);
  await recordOperation(paths, "integrity-scan", ok ? "success" : "failure", summary);
  return report;
}

async function runDatasetDiagnostics(workspaceRoot: string): Promise<DatasetDiagnosticReport> {
  await ensureInitialised(workspaceRoot);
  const findings: DatasetDiagnosticFinding[] = [];
  const allEntities = (await listEntities(workspaceRoot)).filter((entity) => entity.recordStatus !== "deleted");
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const cyberFunctions = allEntities.filter((entity) => entity.entityType === "cyber-function");
  const mitigationStrategies = allEntities.filter((entity) => entity.entityType === "mitigation-strategy");
  const guidanceFrameworks = allEntities.filter((entity) => entity.entityType === "guidance-framework");
  const controlThemes = allEntities.filter((entity) => entity.entityType === "control-theme");
  const cyberReferenceMappings = allEntities.filter((entity) => entity.entityType === "cyber-reference-mapping");
  const cyberReferenceLinks = allEntities.filter(
    (entity): entity is LinkEntity => entity.entityType === "link" && entity.id.startsWith("LNK-CYBER-")
  );
  const expected = PSPF_REFERENCE_DATA_REPORT.cyberReference;

  checkDiagnosticCount(findings, "Cyber functions", cyberFunctions.length, expected.cyberFunctionCount);
  checkDiagnosticCount(
    findings,
    "Mitigation strategies",
    mitigationStrategies.length,
    expected.mitigationStrategyCount
  );
  checkDiagnosticCount(findings, "Guidance frameworks", guidanceFrameworks.length, expected.guidanceFrameworkCount);
  checkDiagnosticCount(findings, "Control themes", controlThemes.length, expected.controlThemeCount);
  checkDiagnosticCount(
    findings,
    "Cyber reference mappings",
    cyberReferenceMappings.length,
    expected.cyberReferenceMappingCount
  );
  checkDiagnosticCount(findings, "Cyber reference links", cyberReferenceLinks.length, expected.cyberReferenceLinkCount);

  let schemaVersionMismatches = 0;
  for (const entity of [
    ...cyberFunctions,
    ...mitigationStrategies,
    ...guidanceFrameworks,
    ...controlThemes,
    ...cyberReferenceMappings,
    ...cyberReferenceLinks
  ]) {
    if (entity.schemaVersion !== VERSION_AXES.schemaVersion) {
      schemaVersionMismatches += 1;
      findings.push({
        section: "schema",
        severity: "error",
        message: `${entity.id} has schemaVersion ${entity.schemaVersion}; expected ${VERSION_AXES.schemaVersion}.`
      });
    }
  }

  let brokenMappingEndpoints = 0;
  for (const mapping of cyberReferenceMappings) {
    for (const endpoint of [mapping.from, mapping.to]) {
      const endpointEntity = entitiesById.get(endpoint.entityId);
      if (!endpointEntity) {
        brokenMappingEndpoints += 1;
        findings.push({
          section: "mappings",
          severity: "error",
          message: `Cyber mapping ${mapping.id} references missing ${endpoint.entityType} ${endpoint.entityId}.`
        });
        continue;
      }
      if (endpointEntity.entityType !== endpoint.entityType) {
        brokenMappingEndpoints += 1;
        findings.push({
          section: "mappings",
          severity: "error",
          message: `Cyber mapping ${mapping.id} endpoint ${endpoint.entityId} is ${endpointEntity.entityType}, not ${endpoint.entityType}.`
        });
      }
    }
  }

  const mappingEndpointKeys = new Set(cyberReferenceMappings.map(cyberReferenceMappingEndpointKey));
  let mismatchedCyberLinks = 0;
  for (const link of cyberReferenceLinks) {
    const linkKey = `${link.fromType}:${link.fromId}:${link.toType}:${link.toId}`;
    if (!mappingEndpointKeys.has(linkKey)) {
      mismatchedCyberLinks += 1;
      findings.push({
        section: "links",
        severity: "error",
        message: `Cyber link ${link.id} does not match any cyber-reference-mapping endpoints.`
      });
    }
  }

  let publicationLeaks = 0;
  for (const mapping of cyberReferenceMappings) {
    const publicMapping = sanitiseEntityForPublication(mapping) as unknown as Record<string, unknown>;
    if ("rationale" in publicMapping) {
      publicationLeaks += 1;
      findings.push({
        section: "publication",
        severity: "error",
        message: `Cyber mapping ${mapping.id} exposes rationale in public sanitisation.`
      });
    }
  }

  if (findings.every((finding) => finding.severity !== "error")) {
    findings.push({
      section: "counts",
      severity: "info",
      message: "Cyber reference dataset counts, mappings, links, schema versions and public redaction passed."
    });
  }

  const counts = {
    cyberFunctions: cyberFunctions.length,
    mitigationStrategies: mitigationStrategies.length,
    guidanceFrameworks: guidanceFrameworks.length,
    controlThemes: controlThemes.length,
    cyberReferenceMappings: cyberReferenceMappings.length,
    cyberReferenceLinks: cyberReferenceLinks.length,
    brokenMappingEndpoints,
    mismatchedCyberLinks,
    schemaVersionMismatches,
    publicationLeaks
  };
  const ok = findings.every((finding) => finding.severity !== "error");
  const summary = ok
    ? `Cyber reference dataset passed with ${counts.cyberReferenceMappings} mapping(s) and ${counts.cyberReferenceLinks} link(s).`
    : `Cyber reference dataset failed with ${findings.filter((finding) => finding.severity === "error").length} error(s).`;
  return { ok, generatedAt: nowIso(), summary, findings, counts };
}

function checkDiagnosticCount(
  findings: DatasetDiagnosticFinding[],
  labelText: string,
  actual: number,
  expected: number
): void {
  if (actual === expected) {
    return;
  }
  findings.push({
    section: "counts",
    severity: "error",
    message: `${labelText} count ${actual} does not match reference-data report count ${expected}.`
  });
}

function cyberReferenceMappingEndpointKey(mapping: V01Entity & { entityType: "cyber-reference-mapping" }): string {
  return `${mapping.from.entityType}:${mapping.from.entityId}:${mapping.to.entityType}:${mapping.to.entityId}`;
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

async function exportBundle(
  workspaceRoot: string
): Promise<{ exportDirectory: string; manifestPath: string; collectionCount: number }> {
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

async function buildImportPlan(
  workspaceRoot: string,
  bundlePath: string,
  mode: ImportMode
): Promise<{ incomingEntities: readonly V01Entity[]; writeSet: readonly V01Entity[]; summary: ImportSummary }> {
  const bundle = await readAndValidateImportBundle(bundlePath);
  let incomingEntities = flattenImportEntities(bundle.collections ?? {});
  if (mode === "full-replace") {
    incomingEntities = await includeExistingReferencedSourceControls(workspaceRoot, incomingEntities);
  }
  const existingEntities = await listEntities(workspaceRoot);
  const tagImportResult =
    mode === "additive-merge" || mode === "plan-apply"
      ? filterIncomingTagLabelCollisions(incomingEntities, existingEntities)
      : { entities: incomingEntities, conflicts: [] as string[] };
  incomingEntities = tagImportResult.entities;
  const savedViewImportResult =
    mode === "additive-merge" || mode === "plan-apply"
      ? filterIncomingSavedViewNameCollisions(incomingEntities, existingEntities)
      : { entities: incomingEntities, conflicts: [] as string[] };
  incomingEntities = savedViewImportResult.entities;
  const validationEntities =
    mode === "additive-merge" || mode === "plan-apply" ? [...existingEntities, ...incomingEntities] : incomingEntities;
  validateImportedMappings(validationEntities);
  validateTagRules(incomingEntities, mode === "full-replace" ? [] : existingEntities);
  validateSavedViewRules(incomingEntities, mode === "full-replace" ? [] : existingEntities);
  validateChangeRecordRules(incomingEntities, mode === "full-replace" ? [] : existingEntities);
  const writeSet =
    mode === "additive-merge" || mode === "plan-apply"
      ? additiveMergeWriteSet(incomingEntities, existingEntities)
      : incomingEntities;
  return {
    incomingEntities,
    writeSet,
    summary: summariseImportChanges(incomingEntities, existingEntities, writeSet, [
      ...tagImportResult.conflicts,
      ...savedViewImportResult.conflicts
    ])
  };
}

async function readAndValidateImportBundle(bundlePath: string): Promise<ImportBundlePayload> {
  const bundleStat = await stat(bundlePath);
  if (bundleStat.size > IMPORT_LIMITS.maxBundleBytes) {
    throwImportLimitExceeded("Total bundle size", IMPORT_LIMITS.maxBundleBytes, bundleStat.size);
  }

  let bundle: ImportBundlePayload;
  try {
    bundle = JSON.parse(await readFile(bundlePath, "utf8")) as ImportBundlePayload;
  } catch (error) {
    throw new PspfError({
      code: "PSPF_IMPORT_BUNDLE_INVALID",
      severity: "error",
      category: "import",
      message: `PSPF bundle import failed because ${basename(bundlePath)} is not valid JSON.`,
      retryable: false,
      recommendedAction: "Select a valid PSPF master bundle JSON file and try again.",
      detail: { cause: error instanceof Error ? error.message : String(error) }
    });
  }

  if (!bundle || typeof bundle !== "object" || !bundle.manifest || !bundle.collections) {
    throwInvalidImportBundle("Bundle must contain a manifest and collections object.");
  }

  const manifest = bundle.manifest;
  if (manifest.bundleType !== "pspf-explorer-bundle") {
    throwInvalidImportBundle(`Unsupported bundleType: ${String(manifest.bundleType ?? "missing")}.`);
  }
  if (!isCompatibleVersionAxes(manifest)) {
    throw new PspfError({
      code: "PSPF_VERSION_UNSUPPORTED",
      severity: "error",
      category: "compatibility",
      message: `PSPF bundle ${String(manifest.schemaVersion ?? "unknown")} is not compatible with schema ${VERSION_AXES.schemaVersion}.`,
      retryable: false,
      recommendedAction: "Use a bundle with the same major schema, bundle, and API versions, or update PSPF Core.",
      detail: {
        bundleVersion: manifest.bundleVersion,
        schemaVersion: manifest.schemaVersion,
        apiVersion: manifest.apiVersion,
        expected: VERSION_AXES
      }
    });
  }

  const manifestCollections = manifest.collections ?? [];
  const isLocalAuthoringBundle = manifest.generator?.mode === "local-authoring";
  if (manifestCollections.length > IMPORT_LIMITS.maxCollections) {
    throwImportLimitExceeded("Number of collections", IMPORT_LIMITS.maxCollections, manifestCollections.length);
  }

  const manifestByName = new Map(manifestCollections.map((collection) => [collection.name, collection]));
  let totalEntities = 0;
  let totalLinks = 0;
  for (const collectionName of V0_1_COLLECTIONS) {
    const collectionPresent = Object.hasOwn(bundle.collections, collectionName);
    const records = bundle.collections[collectionName] ?? [];
    if (!Array.isArray(records)) {
      throwInvalidImportBundle(`Collection ${collectionName} must be an array.`);
    }
    if (records.length > IMPORT_LIMITS.maxItemsPerCollection) {
      throwImportLimitExceeded(`${collectionName} items`, IMPORT_LIMITS.maxItemsPerCollection, records.length);
    }
    totalEntities += records.length;
    if (collectionName === "links") {
      totalLinks = records.length;
    }

    const manifestCollection =
      collectionPresent && !isLocalAuthoringBundle ? manifestByName.get(collectionName) : undefined;
    if (manifestCollection) {
      if (manifestCollection.count !== records.length) {
        throwInvalidImportBundle(
          `Collection ${collectionName} count mismatch: manifest says ${manifestCollection.count}, bundle contains ${records.length}.`
        );
      }
      const serialised = `${JSON.stringify(records, null, 2)}\n`;
      if (manifestCollection.hash?.alg !== "SHA-256" || manifestCollection.hash.value !== sha256(serialised)) {
        throwInvalidImportBundle(`Collection ${collectionName} checksum does not match the manifest.`);
      }
    }

    validateImportDepthAndStrings(records, collectionName);
    for (const record of records) {
      validateImportEntityEnvelope(record, collectionName);
    }
  }

  if (totalEntities > IMPORT_LIMITS.maxTotalEntities) {
    throwImportLimitExceeded("Total entities across all collections", IMPORT_LIMITS.maxTotalEntities, totalEntities);
  }
  if (totalLinks > IMPORT_LIMITS.maxLinks) {
    throwImportLimitExceeded("Number of links", IMPORT_LIMITS.maxLinks, totalLinks);
  }

  return bundle;
}

function validateImportEntityEnvelope(record: unknown, collectionName: V01Collection): asserts record is V01Entity {
  if (!record || typeof record !== "object") {
    throwInvalidImportBundle(`Collection ${collectionName} contains a non-object record.`);
  }
  const candidate = record as Partial<V01Entity>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    throwInvalidImportBundle(`Collection ${collectionName} contains a record without a valid id.`);
  }
  if (typeof candidate.entityType !== "string" || !(candidate.entityType in COLLECTION_BY_ENTITY_TYPE)) {
    throwInvalidImportBundle(`Record ${candidate.id} has unsupported entityType ${String(candidate.entityType)}.`);
  }
  if (COLLECTION_BY_ENTITY_TYPE[candidate.entityType as V01Entity["entityType"]] !== collectionName) {
    throwInvalidImportBundle(
      `Record ${candidate.id} is in ${collectionName} but has entityType ${candidate.entityType}.`
    );
  }
  if (
    typeof candidate.schemaVersion !== "string" ||
    !hasCompatibleMajorVersion(candidate.schemaVersion, VERSION_AXES.schemaVersion)
  ) {
    throwInvalidImportBundle(
      `Record ${candidate.id} has unsupported schemaVersion ${String(candidate.schemaVersion)}.`
    );
  }
}

function validateImportDepthAndStrings(value: unknown, location: string, depth = 0): void {
  if (depth > IMPORT_LIMITS.maxDepth) {
    throwImportLimitExceeded(`${location} nesting depth`, IMPORT_LIMITS.maxDepth, depth);
  }
  if (typeof value === "string") {
    if (value.length > IMPORT_LIMITS.maxStringLength) {
      throwImportLimitExceeded(`${location} string length`, IMPORT_LIMITS.maxStringLength, value.length);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      validateImportDepthAndStrings(item, location, depth + 1);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      validateImportDepthAndStrings(child, `${location}.${key}`, depth + 1);
    }
  }
}

function throwInvalidImportBundle(message: string): never {
  throw new PspfError({
    code: "PSPF_IMPORT_BUNDLE_INVALID",
    severity: "error",
    category: "import",
    message: `PSPF bundle import rejected: ${message}`,
    retryable: false,
    recommendedAction: "Export a fresh PSPF master bundle, or inspect the bundle validation errors before importing.",
    detail: { message }
  });
}

function throwImportLimitExceeded(limitName: string, threshold: number, observed: number): never {
  throw new PspfError({
    code: "PSPF_IMPORT_LIMIT_EXCEEDED",
    severity: "error",
    category: "import",
    message: `PSPF bundle import rejected: ${limitName} exceeds the supported limit.`,
    retryable: false,
    recommendedAction: "Reduce the bundle size or split the data before importing.",
    detail: { limitName, threshold, observed }
  });
}

function summariseImportChanges(
  incomingEntities: readonly V01Entity[],
  existingEntities: readonly V01Entity[],
  writeSet: readonly V01Entity[],
  extraConflicts: readonly string[] = []
): ImportSummary {
  const existingById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  const writtenIds = new Set(writeSet.map((entity) => entity.id));
  const byType: Record<string, ImportTypeSummary> = {};
  const examples: string[] = [];
  const conflicts: string[] = [...extraConflicts];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const incoming of incomingEntities) {
    const typeSummary = {
      ...(byType[incoming.entityType] || { total: 0, created: 0, updated: 0, unchanged: 0, written: 0 })
    };
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
    } else if (
      canonicalEntityJson({ ...incoming, createdAt: existing.createdAt } as V01Entity) === canonicalEntityJson(existing)
    ) {
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

  return {
    total: incomingEntities.length,
    created,
    updated,
    unchanged,
    written: writeSet.length,
    byType,
    examples,
    conflicts
  };
}

async function undoLastImport(workspaceRoot: string): Promise<ImportUndoResult> {
  const paths = await ensureInitialised(workspaceRoot);
  await assertWritable(paths);
  const operations = await readOperations(paths);
  const lastImport = operations.find(
    (operation) =>
      operation.operation_type === "import" &&
      operation.status === "success" &&
      (operation.detail.startsWith("additive-merge:import-") || operation.detail.startsWith("plan-apply:import-"))
  );
  if (!lastImport) {
    return { undone: false, restored: 0, message: "No additive or plan-apply import is available to undo." };
  }
  const [, importId] = lastImport.detail.split(":");
  if (!importId) {
    return { undone: false, restored: 0, message: "The last import record is missing its import id." };
  }
  const snapshotPath = join(paths.imports, `pre-${importId}.json`);
  if (!existsSync(snapshotPath)) {
    return {
      undone: false,
      restored: 0,
      importId,
      message: "The undo snapshot for the last import is no longer available."
    };
  }
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as { readonly entities?: readonly V01Entity[] };
  const entities = snapshot.entities || [];
  await runSql(paths.db, ["DELETE FROM entities;", ...entities.map(upsertEntitySql)].join("\n"));
  await recordOperation(paths, "import-undo", "success", importId);
  return {
    undone: true,
    restored: entities.length,
    importId,
    message: `Undid ${importId}; restored ${entities.length} record(s).`
  };
}

async function readOperations(
  paths: WorkspacePaths
): Promise<readonly { operation_type: string; status: string; detail: string; created_at: string }[]> {
  const output = await runSql(
    paths.db,
    "SELECT operation_type, status, detail, created_at FROM operations ORDER BY created_at DESC;",
    ["-json"]
  );
  return output.trim() === ""
    ? []
    : (JSON.parse(output) as readonly { operation_type: string; status: string; detail: string; created_at: string }[]);
}

function pushImportExample(examples: string[], example: string): void {
  if (examples.length < 8 && example) {
    examples.push(example);
  }
}

function describeEntityUpdate(existing: V01Entity, incoming: V01Entity): string {
  if (
    existing.entityType === "requirement" &&
    incoming.entityType === "requirement" &&
    existing.assessmentStatus !== incoming.assessmentStatus
  ) {
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
  return String(value || "not recorded")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function additiveMergeWriteSet(
  incomingEntities: readonly V01Entity[],
  existingEntities: readonly V01Entity[]
): V01Entity[] {
  const existingById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  const writeSet: V01Entity[] = [];
  for (const incoming of incomingEntities) {
    const existing = existingById.get(incoming.id);
    if (!existing) {
      writeSet.push(incoming);
      continue;
    }
    if (isProtectedCoreReferenceImport(existing, incoming)) {
      continue;
    }

    const merged = { ...incoming, createdAt: existing.createdAt } as V01Entity;
    if (canonicalEntityJson(merged) !== canonicalEntityJson(existing)) {
      writeSet.push(merged);
    }
  }
  return writeSet;
}

function isProtectedCoreReferenceImport(existing: V01Entity, incoming: V01Entity): boolean {
  if (existing.sourceProduct !== "core" || incoming.sourceProduct !== "core") {
    return false;
  }
  if (existing.schemaVersion === incoming.schemaVersion) {
    return false;
  }
  return isCoreReferenceEntity(existing) && isCoreReferenceEntity(incoming);
}

function isCoreReferenceEntity(entity: V01Entity): boolean {
  if (
    [
      "domain",
      "source-control",
      "direction",
      "cyber-function",
      "mitigation-strategy",
      "guidance-framework",
      "control-theme",
      "cyber-reference-mapping"
    ].includes(entity.entityType)
  ) {
    return true;
  }
  return (
    entity.entityType === "link" && (entity.id.startsWith("LNK-CYBER-") || entity.id.startsWith("LNK-PSPF-DIRECTION-"))
  );
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
  const paths = getWorkspacePaths(workspaceRoot);
  if (!existsSync(paths.db)) {
    await initialiseWorkspace(workspaceRoot);
  }
  return readWriterLock(paths);
}

async function listEntities(workspaceRoot: string, entityType?: V01Entity["entityType"]): Promise<V01Entity[]> {
  const paths = await ensureInitialised(workspaceRoot);
  return readStoredEntities(paths, entityType);
}

async function readStoredEntities(paths: WorkspacePaths, entityType?: V01Entity["entityType"]): Promise<V01Entity[]> {
  const where = entityType ? ` WHERE entity_type = '${sqlEscape(entityType)}'` : "";
  const output = await runSql(paths.db, `SELECT payload FROM entities${where} ORDER BY created_at ASC;`, ["-json"]);
  const rows = output.trim() === "" ? [] : (JSON.parse(output) as readonly { payload: string }[]);
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
    suppliers: [],
    contracts: [],
    "spend-items": [],
    "cyber-functions": [],
    "mitigation-strategies": [],
    "guidance-frameworks": [],
    "control-themes": [],
    "cyber-reference-mappings": [],
    strategies: [],
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
    entities.push(...(records as V01Entity[]));
  }
  return entities;
}

async function includeExistingReferencedSourceControls(
  workspaceRoot: string,
  entities: readonly V01Entity[]
): Promise<V01Entity[]> {
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
  const sourceControlsToPreserve = existingSourceControls.filter((sourceControl) =>
    missingSourceControlIds.has(sourceControl.id)
  );
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
    changeRecordCount: collections["change-records"].length,
    supplierCount: collections.suppliers.length,
    contractCount: collections.contracts.length,
    spendItemCount: collections["spend-items"].length,
    strategyCount: collections.strategies.length
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
    suppliers: collections.suppliers.length,
    contracts: collections.contracts.length,
    "spend-items": collections["spend-items"].length,
    "cyber-functions": collections["cyber-functions"].length,
    "mitigation-strategies": collections["mitigation-strategies"].length,
    "guidance-frameworks": collections["guidance-frameworks"].length,
    "control-themes": collections["control-themes"].length,
    "cyber-reference-mappings": collections["cyber-reference-mappings"].length,
    strategies: collections.strategies.length,
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
    sourceControls: countBy(
      collections["source-controls"],
      (sourceControl) => sourceControl.profileTags[0] ?? "unprofiled"
    ),
    requirementControlMappings: countBy(
      collections["requirement-control-mappings"],
      (mapping) => mapping.coverageQualifier
    ),
    suppliers: countBy(collections.suppliers, (supplier) => supplier.status),
    contracts: countBy(collections.contracts, (contract) => contract.status),
    spendItems: countBy(collections["spend-items"], (spendItem) => spendItem.status)
  };
}

function buildByTagIndex(collections: BundleCollections): Record<string, unknown> {
  const requirementsById = new Map(
    collections.requirements.map((requirement, index) => [requirement.id, { requirement, index }])
  );
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
    .sort(
      (left, right) =>
        left.title.localeCompare(right.title, "en-AU", { sensitivity: "base" }) || left.tagId.localeCompare(right.tagId)
    );

  return { schemaVersion: VERSION_AXES.schemaVersion, generatedAt: nowIso(), tags };
}

function filterIncomingTagLabelCollisions(
  incomingEntities: readonly V01Entity[],
  existingEntities: readonly V01Entity[]
): { readonly entities: V01Entity[]; readonly conflicts: string[] } {
  const existingTagsByLabel = new Map(
    existingEntities
      .filter((entity): entity is EntityByCollection["tags"] => entity.entityType === "tag")
      .map((tag) => [normaliseTagLabel(tag.label), tag])
  );
  const rejectedTagIds = new Set<string>();
  const conflicts: string[] = [];
  const filteredTags = incomingEntities.filter((entity) => {
    if (entity.entityType !== "tag") {
      return true;
    }
    const existing = existingTagsByLabel.get(normaliseTagLabel(entity.label));
    if (existing && existing.id !== entity.id) {
      rejectedTagIds.add(entity.id);
      conflicts.push(
        `Rejected tag ${entity.id} ${entity.title}: label already exists on ${existing.id} ${existing.title}.`
      );
      return false;
    }
    return true;
  });
  if (rejectedTagIds.size === 0) {
    return { entities: filteredTags, conflicts };
  }
  return {
    conflicts,
    entities: filteredTags.filter(
      (entity) =>
        !(entity.entityType === "link" && entity.linkType === "tagged-with" && rejectedTagIds.has(entity.toId))
    )
  };
}

function filterIncomingSavedViewNameCollisions(
  incomingEntities: readonly V01Entity[],
  existingEntities: readonly V01Entity[]
): { readonly entities: V01Entity[]; readonly conflicts: string[] } {
  const existingSavedViewsByName = new Map(
    existingEntities
      .filter((entity): entity is EntityByCollection["saved-views"] => entity.entityType === "saved-view")
      .map((savedView) => [savedViewScopeNameKey(savedView.scope, savedView.name), savedView])
  );
  const conflicts: string[] = [];
  const entities = incomingEntities.filter((entity) => {
    if (entity.entityType !== "saved-view") {
      return true;
    }
    const existing = existingSavedViewsByName.get(savedViewScopeNameKey(entity.scope, entity.name));
    if (existing && existing.id !== entity.id) {
      conflicts.push(
        `Rejected saved view ${entity.id} ${entity.name}: name already exists on ${existing.id} ${existing.name}.`
      );
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

  const tags = merged.filter(
    (entity): entity is EntityByCollection["tags"] => entity.entityType === "tag" && entity.recordStatus !== "deleted"
  );
  if (tags.length > TAG_LIMITS.perWorkspaceHard) {
    throw new Error(`Tag limit exceeded: maximum ${TAG_LIMITS.perWorkspaceHard} tags per workspace.`);
  }

  const labelsByNormalisedValue = new Map<string, EntityByCollection["tags"]>();
  for (const tag of tags) {
    if (!isValidTagLabel(tag.label)) {
      throw new Error(
        `Invalid tag label for ${tag.id}: use 1-${TAG_LIMITS.labelMaxLength} letters, digits, spaces, hyphens, or apostrophes.`
      );
    }
    if (!tag.title || tag.title.length > TAG_LIMITS.titleMaxLength) {
      throw new Error(`Invalid tag title for ${tag.id}: use 1-${TAG_LIMITS.titleMaxLength} characters.`);
    }
    if ((tag.description ?? "").length > TAG_LIMITS.descriptionMaxLength) {
      throw new Error(
        `Invalid tag description for ${tag.id}: use at most ${TAG_LIMITS.descriptionMaxLength} characters.`
      );
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
  const domainIds = new Set(
    merged
      .filter((entity) => entity.entityType === "domain" && entity.recordStatus !== "deleted")
      .map((entity) => entity.id)
  );
  const namesByNormalisedValue = new Map<string, EntityByCollection["saved-views"]>();

  for (const savedView of merged.filter(
    (entity): entity is EntityByCollection["saved-views"] =>
      entity.entityType === "saved-view" && entity.recordStatus !== "deleted"
  )) {
    if (!isValidSavedViewName(savedView.name)) {
      throw new Error(
        `Invalid saved-view name for ${savedView.id}: use 1-${SAVED_VIEW_LIMITS.nameMaxLength} characters.`
      );
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
      throw new Error(
        `Invalid saved-view query for ${savedView.id}: use at most ${SAVED_VIEW_LIMITS.queryMaxLength} characters.`
      );
    }
    for (const domainId of filters.domainIds ?? []) {
      if (!domainIds.has(domainId)) {
        throw new Error(`Invalid saved-view domain for ${savedView.id}: ${domainId} is not a known domain.`);
      }
    }
    assertAllAllowed(
      filters.assessmentStatuses ?? [],
      [
        "not-started",
        "in-progress",
        "met",
        "partially-met",
        "not-met",
        "not-applicable",
        "under-review"
      ] satisfies readonly AssessmentStatus[],
      `Invalid saved-view assessment status for ${savedView.id}`
    );
    if (filters.tagsMode && !SAVED_VIEW_TAGS_MODES.includes(filters.tagsMode)) {
      throw new Error(`Invalid saved-view tag mode for ${savedView.id}.`);
    }
    if (filters.evidenceCoverage && !SAVED_VIEW_EVIDENCE_COVERAGE.includes(filters.evidenceCoverage)) {
      throw new Error(`Invalid saved-view evidence coverage for ${savedView.id}.`);
    }
    assertAllAllowed(
      filters.actionStates ?? [],
      ["todo", "in-progress", "blocked", "done", "cancelled"] satisfies readonly ActionStatus[],
      `Invalid saved-view action state for ${savedView.id}`
    );
    assertAllAllowed(
      filters.riskStates ?? [],
      ["open", "monitored", "closed"] satisfies readonly RiskStatus[],
      `Invalid saved-view risk state for ${savedView.id}`
    );

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
    assertAllAllowed(
      visibleColumns,
      [...SAVED_VIEW_REQUIREMENT_COLUMNS, ...SAVED_VIEW_RELATIONSHIP_COLUMNS, ...SAVED_VIEW_WORKSHOP_DASHBOARD_COLUMNS],
      `Invalid saved-view column for ${savedView.id}`
    );
  }
}

function savedViewScopeNameKey(scope: string, name: string): string {
  return `${scope}::${normaliseSavedViewName(name)}`;
}

function validateChangeRecordRules(
  incomingEntities: readonly V01Entity[],
  existingEntities: readonly V01Entity[]
): void {
  const mergedById = new Map(existingEntities.map((entity) => [entity.id, entity]));
  for (const entity of incomingEntities) {
    mergedById.set(entity.id, entity);
  }
  const merged = [...mergedById.values()];
  const entityIds = new Set(merged.map((entity) => entity.id));
  const permittedTargetTypes = new Set<V01Entity["entityType"]>([
    "requirement",
    "action",
    "risk",
    "direction",
    "tag",
    "saved-view"
  ]);

  for (const changeRecord of merged.filter(
    (entity): entity is EntityByCollection["change-records"] =>
      entity.entityType === "change-record" && entity.recordStatus !== "deleted"
  )) {
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
      throw new Error(
        `Invalid changes link ${entity.id}: only change-record -> requirement/action/risk/direction/tag/saved-view is permitted in v1.10.`
      );
    }
    if (!entityIds.has(entity.fromId) || !entityIds.has(entity.toId)) {
      throw new Error(`Invalid changes link ${entity.id}: endpoint is missing.`);
    }
  }
}

function assertAllAllowed<T extends string>(
  values: readonly string[],
  allowedValues: readonly T[],
  message: string
): void {
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
    throw new PspfError({
      code: "PSPF_STORAGE_DB_MISSING",
      severity: "error",
      category: "storage",
      message: `PSPF workspace is not initialised at ${workspaceRoot}.`,
      retryable: false,
      recommendedAction: "Run PSPF: Initialise PSPF Workspace before using this command.",
      detail: { workspaceRoot }
    });
  }
  await assertWorkspaceSchemaCompatible(paths);
  if (createIfMissing) {
    await refreshReferenceData(workspaceRoot);
  }
  return paths;
}

async function assertWorkspaceSchemaCompatible(paths: WorkspacePaths): Promise<void> {
  const output = await runSql(paths.db, "SELECT value FROM metadata WHERE key = 'schemaVersion';", ["-json"]);
  const rows = output.trim() === "" ? [] : (JSON.parse(output) as readonly { value: string }[]);
  const storedSchemaVersion = rows[0]?.value;
  if (!storedSchemaVersion) {
    throw new PspfError({
      code: "PSPF_MIGRATION_REQUIRED",
      severity: "error",
      category: "migration",
      message: "PSPF workspace schema metadata is missing.",
      retryable: false,
      recommendedAction: "Back up the workspace, then re-initialise or restore from a known-good backup.",
      detail: { expected: VERSION_AXES.schemaVersion }
    });
  }
  if (!hasCompatibleMajorVersion(storedSchemaVersion, VERSION_AXES.schemaVersion)) {
    throw new PspfError({
      code: "PSPF_MIGRATION_REQUIRED",
      severity: "error",
      category: "migration",
      message: `PSPF workspace schema ${storedSchemaVersion} is not compatible with ${VERSION_AXES.schemaVersion}.`,
      retryable: false,
      recommendedAction:
        "Open the workspace with a compatible PSPF Core version or run an explicit migration once available.",
      detail: { storedSchemaVersion, expected: VERSION_AXES.schemaVersion }
    });
  }
}

async function refreshReferenceData(workspaceRoot: string): Promise<void> {
  const timestamp = nowIso();
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "source-control",
    new Set(ISM_SOURCE_CONTROLS.map((control) => control.id))
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "direction",
    new Set(PSPF_BASELINE_DIRECTIONS.map((direction) => direction.id)),
    "DIR-PSPF-"
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "link",
    new Set(PSPF_BASELINE_DIRECTION_LINKS.map((link) => link.id)),
    "LNK-PSPF-DIRECTION-"
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "cyber-function",
    new Set(CYBER_FUNCTIONS.map((entity) => entity.id))
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "mitigation-strategy",
    new Set(MITIGATION_STRATEGIES.map((entity) => entity.id))
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "guidance-framework",
    new Set(GUIDANCE_FRAMEWORKS.map((entity) => entity.id))
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "control-theme",
    new Set(CONTROL_THEMES.map((entity) => entity.id))
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "cyber-reference-mapping",
    new Set(CYBER_REFERENCE_MAPPINGS.map((entity) => entity.id))
  );
  await deleteRetiredCoreReferenceEntities(
    workspaceRoot,
    "link",
    new Set(CYBER_REFERENCE_LINKS.map((link) => link.id)),
    "LNK-CYBER-"
  );
  const seededDomains: V01Entity[] = PSPF_DOMAINS.map((domain) => ({
    ...domain,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededSourceControls: V01Entity[] = ISM_SOURCE_CONTROLS.map((sourceControl) => ({
    ...sourceControl,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededRequirements: V01Entity[] = PSPF_BASELINE_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededDirections: V01Entity[] = PSPF_BASELINE_DIRECTIONS.map((direction) => ({
    ...direction,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededDirectionLinks: V01Entity[] = PSPF_BASELINE_DIRECTION_LINKS.map((link) => ({
    ...link,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const seededCyberReferenceEntities: V01Entity[] = [
    ...CYBER_FUNCTIONS,
    ...MITIGATION_STRATEGIES,
    ...GUIDANCE_FRAMEWORKS,
    ...CONTROL_THEMES,
    ...CYBER_REFERENCE_MAPPINGS,
    ...CYBER_REFERENCE_LINKS
  ].map((entity) => ({
    ...entity,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  await upsertEntities(workspaceRoot, [...seededDomains, ...seededSourceControls]);
  await insertReferenceEntitiesIfMissing(workspaceRoot, [
    ...seededRequirements,
    ...seededDirections,
    ...seededDirectionLinks
  ]);
  await upsertCoreReferenceEntitiesIfChanged(workspaceRoot, seededCyberReferenceEntities);
}

async function deleteRetiredCoreReferenceEntities(
  workspaceRoot: string,
  entityType: V01Entity["entityType"],
  activeIds: ReadonlySet<string>,
  idPrefix?: string
): Promise<void> {
  const paths = getWorkspacePaths(workspaceRoot);
  const output = await runSql(
    paths.db,
    `SELECT payload FROM entities WHERE entity_type = '${sqlEscape(entityType)}';`,
    ["-json"]
  );
  const rows = output.trim() === "" ? [] : (JSON.parse(output) as readonly { payload: string }[]);
  const existing = rows.map((row) => JSON.parse(row.payload) as V01Entity);
  const retiredIds = existing
    .filter(
      (entity) =>
        entity.sourceProduct === "core" && (!idPrefix || entity.id.startsWith(idPrefix)) && !activeIds.has(entity.id)
    )
    .map((entity) => entity.id);
  if (retiredIds.length === 0) {
    return;
  }

  await runSql(
    paths.db,
    `DELETE FROM entities WHERE id IN (${retiredIds.map((id) => `'${sqlEscape(id)}'`).join(", ")});`
  );
}

async function insertReferenceEntitiesIfMissing(workspaceRoot: string, entities: readonly V01Entity[]): Promise<void> {
  if (entities.length === 0) {
    return;
  }
  const paths = getWorkspacePaths(workspaceRoot);
  await runSql(paths.db, ["BEGIN IMMEDIATE;", ...entities.map(insertEntityIfMissingSql), "COMMIT;"].join("\n"));
}

async function upsertCoreReferenceEntitiesIfChanged(
  workspaceRoot: string,
  entities: readonly V01Entity[]
): Promise<void> {
  if (entities.length === 0) {
    return;
  }
  const paths = getWorkspacePaths(workspaceRoot);
  const storedEntities = await readStoredEntities(paths);
  const storedById = new Map(storedEntities.map((entity) => [entity.id, entity]));
  const changedEntities = entities.filter((entity) => {
    const stored = storedById.get(entity.id);
    return !stored || referenceComparableJson(stored) !== referenceComparableJson(entity);
  });
  if (changedEntities.length === 0) {
    return;
  }
  await runSql(paths.db, ["BEGIN IMMEDIATE;", ...changedEntities.map(upsertEntitySql), "COMMIT;"].join("\n"));
}

function referenceComparableJson(entity: V01Entity): string {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...comparable } = entity;
  return JSON.stringify(comparable);
}

function insertEntityIfMissingSql(entity: V01Entity): string {
  return `INSERT INTO entities(id, entity_type, payload, created_at, updated_at)
VALUES ('${sqlEscape(entity.id)}', '${sqlEscape(entity.entityType)}', '${sqlEscape(JSON.stringify(entity))}', '${sqlEscape(entity.createdAt)}', '${sqlEscape(entity.updatedAt)}')
ON CONFLICT(id) DO NOTHING;`;
}

async function assertWritable(paths: WorkspacePaths): Promise<void> {
  const lock = await acquireWriterLock(paths);
  if (!lock.writable) {
    throw new PspfError({
      code: "PSPF_WRITER_LOCK_HELD",
      severity: "error",
      category: "storage",
      message: lock.detail,
      retryable: true,
      recommendedAction: "Close the other PSPF workspace window or use the writer-lock recovery flow before retrying.",
      detail: { holderPid: lock.holderPid, currentPid: lock.currentPid }
    });
  }
}

async function acquireWriterLock(paths: WorkspacePaths): Promise<WriterLockState> {
  const lockFilePath = join(paths.locks, "writer.lock");
  const lockStatePath = join(paths.locks, "writer-lock.json");
  const existing = await readWriterLock(paths);
  if (existing.holderPid === process.pid && existsSync(lockFilePath)) {
    return existing;
  }
  if (existing.holderPid && existing.holderPid !== process.pid && isProcessAlive(existing.holderPid)) {
    return existing;
  }
  await rm(lockFilePath, { force: true });
  await rm(lockStatePath, { force: true });
  try {
    const lockFile = await open(lockFilePath, "wx");
    await lockFile.writeFile(`${process.pid}\n`, "utf8");
    await lockFile.close();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      return readWriterLock(paths);
    }
    throw error;
  }

  const state: WriterLockState = {
    holderPid: process.pid,
    acquiredAt: nowIso(),
    currentPid: process.pid,
    policy: "single-writer",
    writable: true,
    detail: "Writer lock held by current process."
  };
  await writeJson(lockStatePath, state);
  return state;
}

async function readWriterLock(paths: WorkspacePaths): Promise<WriterLockState> {
  const lockFilePath = join(paths.locks, "writer.lock");
  const lockStatePath = join(paths.locks, "writer-lock.json");
  const lockFileExists = existsSync(lockFilePath);
  if (!lockFileExists && !existsSync(lockStatePath)) {
    return { currentPid: process.pid, policy: "single-writer", writable: true, detail: "No writer lock exists yet." };
  }
  if (!existsSync(lockStatePath)) {
    return {
      currentPid: process.pid,
      policy: "single-writer",
      writable: false,
      detail: "Workspace is read-only because writer lock metadata is unavailable."
    };
  }

  const value = JSON.parse(await readFile(lockStatePath, "utf8")) as Partial<WriterLockState>;
  const holderPid = typeof value.holderPid === "number" ? value.holderPid : undefined;
  const heldByCurrentProcess = lockFileExists && holderPid === process.pid;
  const writable =
    !lockFileExists || heldByCurrentProcess || (typeof holderPid === "number" && !isProcessAlive(holderPid));
  return {
    holderPid,
    acquiredAt: value.acquiredAt,
    currentPid: process.pid,
    policy: "single-writer",
    writable,
    detail: writable
      ? heldByCurrentProcess
        ? "Writer lock held by current process."
        : "Writer lock is available."
      : `Workspace is read-only because writer lock is held by process ${holderPid ?? "unknown"}.`
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

async function recordOperation(
  paths: WorkspacePaths,
  operationType: string,
  status: string,
  detail: string
): Promise<void> {
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
  await mkdir(dirname(dbPath), { recursive: true });
  const database = Buffer.from(db.export());
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const tmpPath = `${dbPath}.tmp-${process.pid}-${Date.now()}-${attempt}`;
    try {
      const tmpFile = await open(tmpPath, "w");
      try {
        await tmpFile.writeFile(database);
        await tmpFile.sync();
      } finally {
        await tmpFile.close();
      }
      await rename(tmpPath, dbPath);
      await syncDirectory(dirname(dbPath));
      return;
    } catch (error) {
      lastError = error;
      await rm(tmpPath, { force: true }).catch(() => undefined);
    }
  }
  throw lastError;
}

async function syncDirectory(directoryPath: string): Promise<void> {
  let directory: Awaited<ReturnType<typeof open>> | undefined;
  try {
    directory = await open(directoryPath, "r");
    await directory.sync();
  } catch {
    // Directory fsync is not available on every platform; the temp-file fsync still protects the database bytes.
  } finally {
    await directory?.close().catch(() => undefined);
  }
}

function sqlResultsToJson(results: readonly SqlJsQueryResult[]): string {
  const rows = results.flatMap((result) =>
    result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])))
  );
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
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
