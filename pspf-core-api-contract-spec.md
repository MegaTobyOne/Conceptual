# PSPF Core API v1 Contract Specification

## Overview

This specification defines the local-only Core API contract for the PSPF extension ecosystem. It is the contract exposed by PSPF Core to trusted companion extensions such as Workshop, Shop, and Pub, and it governs commands, queries, events, platform negotiation, capability checks, and error handling.

The API is intentionally **local-first**, **minimal**, and **versioned**. It is not a network API and does not introduce a listening service or HTTP endpoint in version 1. Integration is expected to occur through the VS Code extension host, exported extension APIs, commands, and local platform storage rather than through an addressable network surface.

VS Code extensions can expose programmatic APIs through activation and extension exports, and they should use activation events to load lazily rather than eagerly. This makes a narrow exported Core API the correct platform mechanism for trusted local extension-to-extension integration.

## Goals

The Core API v1 must:

1. provide a stable local contract for trusted products,
2. expose only necessary operations,
3. align with the canonical entity and link model,
4. preserve compatibility through semantic versioning,
5. make capability and trust state explicit,
6. and support current-state operations, snapshot operations, and event subscription.

## API style

### Contract style

The Core API should use a **typed async method contract** for extension-to-extension calls, with request/response objects shaped in a consistent envelope style. The API is not required to literally implement JSON-RPC, but it should borrow good protocol ideas from mature request/response designs: explicit method names, mutual exclusivity of success and error outcomes, stable error codes, and correlation metadata where needed.

### Why not expose raw database access

The API should not expose raw database handles or unrestricted table access. All writes and most structured reads should pass through the Core contract so Core remains the authoritative schema and integrity boundary.

### Async-first

All API methods should be async, returning promises, even for cheap in-process operations. This provides a stable evolution path for future validations, migrations, and longer-running integrity checks.

## API versioning

### Version model

The Core API should use semantic versioning, with:

- **major** version changes for breaking contract changes,
- **minor** version changes for additive backward-compatible changes,
- **patch** version changes for fixes without contract changes.

### Compatibility expectations

Consumers should be resilient to additive fields and additive event metadata, which are generally safe minor-version changes in long-lived contracts.

### Version identifiers

Core exposes only the three canonical version axes from ADR 0008:

- `apiVersion` — semver string for the Core API surface
- `schemaVersion` — semver string for entity/schema layer
- `bundleVersion` — semver string for JSON export schema

The earlier `apiMajor` and `exportVersion` fields are retired. Consumers parse semver and inspect the `major` component of any axis they need to gate on.

## Trust and access model

### Trusted callers only

The privileged Core API is available only to trusted PSPF extensions. Core should validate the caller identity during capability negotiation and expose only the approved API surface to trusted products.

### Access levels

Define three access levels:

| Access level | Meaning |
|---|---|
| `platform-admin` | full Core administrative access |
| `domain-write` | read/write in governed domain workflows |
| `read-only` | read/query only |

### Suggested mapping

| Product | Access level |
|---|---|
| Core UI | `platform-admin` |
| Workshop | `domain-write` plus selected platform operations |
| Shop | `domain-write` |
| Pub | `domain-write` |
| Explorer | no local Core API access in v1 |

### Trust constraints

If the workspace is untrusted or running in an unsupported execution mode, Core may restrict or deny privileged operations. This aligns with VS Code workspace trust patterns and the previously selected sensitive-by-default posture.

## Exported API shape

### Discovery and activation

Consumers should obtain the Core API by activating the Core extension and reading its exported API object through the VS Code extension API model.

### Top-level API object

The Core export should expose a single object such as:

```ts
interface PspfCoreApi {
  apiVersion: string;
  schemaVersion: string;
  bundleVersion: string;
  platform: PlatformApi;
  queries: QueryApi;
  commands: CommandApi;
  events: EventApi;
}
```

This keeps the entry point small and makes negotiation obvious.

## Platform API

### Purpose

The Platform API exposes capability negotiation, health, compatibility, trust state, and selected workspace/platform operations.

### Methods

| Method | Purpose |
|---|---|
| `getCapabilities()` | return supported capabilities and access scope |
| `getHealth()` | return current health summary |
| `getWorkspaceInfo()` | return workspace identity and storage info |
| `getCompatibility()` | return API/schema/bundle compatibility details |
| `getTrustState()` | return trust and execution mode state |
| `ping()` | lightweight liveness check |

### Example types

```ts
interface PlatformApi {
  getCapabilities(input: CapabilityRequest): Promise<CapabilityResponse>;
  getHealth(): Promise<HealthSummary>;
  getWorkspaceInfo(): Promise<WorkspaceInfo>;
  getCompatibility(): Promise<CompatibilityInfo>;
  getTrustState(): Promise<TrustState>;
  ping(): Promise<PingResponse>;
}
```

### Capability negotiation

Capability negotiation should be explicit. The caller identifies itself and requests an access profile. Core returns the granted scope, rejected scopes if any, and compatibility information.

```ts
interface CapabilityRequest {
  callerExtensionId: string;
  callerProduct: 'core' | 'workshop' | 'shop' | 'pub' | 'unknown';
  requestedScopes: string[];
  supportedApiVersions: string[];
}

interface CapabilityResponse {
  granted: boolean;
  grantedScopes: string[];
  deniedScopes: string[];
  apiVersion: string;
  schemaVersion: string;
  bundleVersion: string;
  compatibility: 'compatible' | 'degraded' | 'incompatible';
  reasons?: string[];
}
```

## Query API

### Purpose

The Query API supports current-state reads, targeted search, relationship traversal, and summary retrieval. It should be optimised for common product workflows rather than arbitrary SQL-like exposure.

### Query groups

| Group | Purpose |
|---|---|
| Entity retrieval | get by ID, list by type, filter by fields |
| Link retrieval | get links for entity, get related entities |
| Summary retrieval | counts, readiness, freshness, health, risk summaries |
| Snapshot/report retrieval | snapshot detail, report pack detail |
| Search | lightweight text and structured search |

### Methods

| Method | Purpose |
|---|---|
| `getEntity()` | fetch one entity by canonical ID |
| `getEntities()` | fetch entities by type and filter |
| `getLinks()` | fetch links by entity or link criteria |
| `getRelatedEntities()` | fetch linked entities with optional link filters |
| `getSummary()` | fetch named summary views |
| `search()` | keyword/filter search |
| `getSnapshot()` | fetch snapshot by ID |
| `getReportPack()` | fetch report pack by ID |

### Example types

```ts
interface QueryApi {
  getEntity<T extends CanonicalEntity>(input: GetEntityRequest): Promise<GetEntityResponse<T>>;
  getEntities<T extends CanonicalEntity>(input: GetEntitiesRequest): Promise<GetEntitiesResponse<T>>;
  getLinks(input: GetLinksRequest): Promise<GetLinksResponse>;
  getRelatedEntities(input: GetRelatedEntitiesRequest): Promise<GetRelatedEntitiesResponse>;
  getSummary(input: GetSummaryRequest): Promise<GetSummaryResponse>;
  search(input: SearchRequest): Promise<SearchResponse>;
  getSnapshot(input: GetSnapshotRequest): Promise<GetSnapshotResponse>;
  getReportPack(input: GetReportPackRequest): Promise<GetReportPackResponse>;
}
```

### Request patterns

```ts
interface GetEntityRequest {
  id: string;
  includeLinks?: boolean;
  includeHistory?: boolean;
}

interface GetEntitiesRequest {
  entityType: CanonicalEntityType;
  filters?: Record<string, unknown>;
  page?: PageRequest;
  sort?: SortRequest[];
}

interface GetLinksRequest {
  entityId?: string;
  linkType?: string;
  fromId?: string;
  toId?: string;
  status?: 'active' | 'inactive' | 'superseded';
}
```

### Summary query model

`getSummary()` should expose named summary views instead of bespoke product-specific endpoints. Example summary names:

- `requirement-status-overview`
- `evidence-freshness-overview`
- `evidence-review-queue`
- `open-action-overview`
- `action-impact-ranking`
- `risk-posture-overview`
- `direction-response-overview`
- `posture-brief`
- `shop-spend-forecast`
- `shop-savings-opportunities`
- `workspace-health-overview`
- `snapshot-readiness-overview`

This keeps v1 small while supporting rich UI projections.

### Daily operational summaries

The daily Workshop and Explorer surfaces depend on a small set of explainable summary projections:

| Summary | Purpose |
|---|---|
| `evidence-review-queue` | Group old, incomplete, changed, unverified, missing, or unlinked evidence by domain and requirement, with downstream impact counts. |
| `action-impact-ranking` | Rank actions by likely positive effect on requirement, domain, Essential Eight, Direction, and overall posture. |
| `direction-response-overview` | Summarise Directions by response state, affected requirements, missing evidence, and open actions. |
| `posture-brief` | Produce the simple graphic-ready and text-ready posture summary used in reporting surfaces. |
| `shop-spend-forecast` | Forecast planned/committed spend, expected savings, net benefit, payback, and confidence by supplier, contract, domain, requirement, action, financial year, or overall scope. |
| `shop-savings-opportunities` | Rank invest-now-save-later opportunities by expected savings, action impact, linked risk reduction, contract optimisation, and confidence. |

`action-impact-ranking` MUST return an explanation for each ranked action. Consumers must be able to show why an action ranked highly using facts such as linked not-met requirements, blocked reporting readiness, stale or missing evidence, high-risk treatment, Essential Eight coverage, or affected Directions. The API should not return an opaque recommendation score without the explanatory facts.

## Command API

### Purpose

The Command API is the authoritative mutation boundary. It creates, updates, links, snapshots, imports, exports, and selected repair or migration operations.

### Command groups

| Group | Purpose |
|---|---|
| Entity lifecycle | create, update, archive, restore |
| Link lifecycle | create, supersede, deactivate |
| Snapshot/export | snapshot, bundle export, bundle import |
| Validation | validate entity, validate workspace |
| Platform maintenance | migrate, rebuild indexes, repair links |

### Methods

| Method | Purpose |
|---|---|
| `createEntity()` | create a canonical entity |
| `updateEntity()` | patch an existing entity |
| `archiveEntity()` | archive/inactivate entity |
| `restoreEntity()` | restore archived entity |
| `createLink()` | create semantic link |
| `updateLink()` | update link metadata or status |
| `supersedeLink()` | supersede an existing link |
| `createSnapshot()` | create immutable snapshot |
| `exportBundle()` | create JSON export bundle |
| `importBundle()` | import compatible bundle |
| `validateEntity()` | validate a specific entity |
| `validateWorkspace()` | run broader validation |
| `runMigration()` | execute authorized migration |
| `verifyIntegrity()` | run integrity checks |
| `repairLinks()` | run or propose link repair |
| `recordRedactionEvent()` | record a tombstone that supersedes specified fields on an entity (APP 11.2 support; see ADR 0006) |
| `purgeEntity()` | destructively erase an entity and replace with permanent tombstone; requires `platform-admin`, Workspace Trust, and explicit operator confirmation |

### Example types

```ts
interface CommandApi {
  createEntity<T extends CanonicalEntity>(input: CreateEntityRequest<T>): Promise<CreateEntityResponse<T>>;
  updateEntity<T extends CanonicalEntity>(input: UpdateEntityRequest<T>): Promise<UpdateEntityResponse<T>>;
  archiveEntity(input: ArchiveEntityRequest): Promise<MutationAck>;
  restoreEntity(input: RestoreEntityRequest): Promise<MutationAck>;
  createLink(input: CreateLinkRequest): Promise<CreateLinkResponse>;
  updateLink(input: UpdateLinkRequest): Promise<UpdateLinkResponse>;
  supersedeLink(input: SupersedeLinkRequest): Promise<MutationAck>;
  createSnapshot(input: CreateSnapshotRequest): Promise<CreateSnapshotResponse>;
  exportBundle(input: ExportBundleRequest): Promise<ExportBundleResponse>;
  importBundle(input: ImportBundleRequest): Promise<ImportBundleResponse>;
  validateEntity(input: ValidateEntityRequest): Promise<ValidationResponse>;
  validateWorkspace(input?: ValidateWorkspaceRequest): Promise<ValidationResponse>;
  runMigration(input: RunMigrationRequest): Promise<MigrationResponse>;
  verifyIntegrity(input?: VerifyIntegrityRequest): Promise<IntegrityResponse>;
  repairLinks(input: RepairLinksRequest): Promise<RepairLinksResponse>;
  recordRedactionEvent(input: RecordRedactionEventRequest): Promise<MutationAck>;
  purgeEntity(input: PurgeEntityRequest): Promise<MutationAck>;
}
```

### Bundle import limits

`importBundle()` MUST enforce the limits defined in `pspf-explorer-json-bundle-schema-spec.md` \u00a7 Import limits and reject any bundle exceeding them with the structured error `PSPF_IMPORT_LIMIT_EXCEEDED`. The diagnostic includes the limit name, the configured threshold, and the observed value.

### Privacy-related commands

- `recordRedactionEvent` requires a non-empty `rationale` field and is auditable (who, when, what fields). It does not destroy data on disk; it writes a tombstone overlay applied at query time. Snapshots remain bytewise unchanged.\n- `purgeEntity` requires `platform-admin` scope, Workspace Trust, and an explicit `confirmationToken` obtained from a UI confirmation step. It writes an audit row recording the destruction without the destroyed values, and the entity ID resolves to a permanent tombstone afterwards.

### Mutation rules

- Commands must validate capability scope before execution.
- Commands must reject unknown or incompatible entity types.
- Commands must preserve immutable fields such as canonical ID.
- Commands should return the updated canonical record where useful.
- Commands that materially affect reporting should emit events.

## Event API

### Purpose

The Event API supports local subscription to meaningful Core changes without polling.

### Design principle

Events are long-lived contracts. They should evolve additively where possible, and names should never silently change meaning.

### Event groups

| Event | Purpose |
|---|---|
| `entityChanged` | entity created, updated, archived, restored |
| `linkChanged` | link created, updated, superseded |
| `snapshotCreated` | immutable snapshot produced |
| `bundleExported` | export completed |
| `bundleImported` | import completed |
| `workspaceValidated` | workspace validation completed |
| `integrityVerified` | integrity verification completed |
| `migrationCompleted` | schema migration completed |
| `healthChanged` | platform health meaningfully changed |
| `trustStateChanged` | trust or execution mode changed |

### Example types

```ts
interface EventApi {
  onEntityChanged: vscode.Event<EntityChangedEvent>;
  onLinkChanged: vscode.Event<LinkChangedEvent>;
  onSnapshotCreated: vscode.Event<SnapshotCreatedEvent>;
  onBundleExported: vscode.Event<BundleExportedEvent>;
  onBundleImported: vscode.Event<BundleImportedEvent>;
  onWorkspaceValidated: vscode.Event<WorkspaceValidatedEvent>;
  onIntegrityVerified: vscode.Event<IntegrityVerifiedEvent>;
  onMigrationCompleted: vscode.Event<MigrationCompletedEvent>;
  onHealthChanged: vscode.Event<HealthChangedEvent>;
  onTrustStateChanged: vscode.Event<TrustStateChangedEvent>;
}
```

### Event payload rules

Each event payload should include:

- event name,
- event version,
- event timestamp,
- affected entity IDs if relevant,
- change type,
- correlation ID where relevant,
- and summary metadata.

### Event versioning

Use per-event additive evolution. Add new optional fields first. Avoid renaming or repurposing existing event types without a major API version change.

## Envelope and response conventions

### Success and error discipline

Responses should follow a disciplined envelope model where success and error states are clearly distinguished. Mature request/response protocols such as JSON-RPC enforce mutual exclusivity between success result and error payload, and that discipline is worth adopting even in a TypeScript API contract.

### Suggested response envelope

```ts
interface ApiSuccess<T> {
  ok: true;
  result: T;
  meta?: ResponseMeta;
}

interface ApiFailure {
  ok: false;
  error: ApiError;
  meta?: ResponseMeta;
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

### Response metadata

```ts
interface ResponseMeta {
  apiVersion: string;
  schemaVersion: string;
  correlationId?: string;
  warnings?: string[];
}
```

## Error model

### Error principles

Errors should be structured, machine-readable, and stable enough for consumers to react to safely.

### Error object

```ts
interface ApiError {
  code: string;
  message: string;
  category: 'validation' | 'permission' | 'compatibility' | 'trust' | 'integrity' | 'not-found' | 'conflict' | 'internal';
  details?: Record<string, unknown>;
  retryable?: boolean;
}
```

### Standard error codes

| Code | Meaning |
|---|---|
| `CORE_API_INCOMPATIBLE` | caller and Core major versions incompatible |
| `CORE_SCOPE_DENIED` | requested capability denied |
| `CORE_WORKSPACE_UNTRUSTED` | operation blocked by trust state |
| `CORE_ENTITY_NOT_FOUND` | entity not found |
| `CORE_LINK_NOT_FOUND` | link not found |
| `CORE_VALIDATION_FAILED` | entity or command validation failed |
| `CORE_IMMUTABLE_FIELD` | attempted mutation of immutable field |
| `CORE_DUPLICATE_LINK` | duplicate active link not permitted |
| `CORE_INTEGRITY_FAILED` | integrity verification failed |
| `CORE_IMPORT_INCOMPATIBLE` | import bundle schema unsupported |
| `CORE_MIGRATION_REQUIRED` | operation blocked pending migration |
| `CORE_INTERNAL_ERROR` | unexpected internal failure |

### Error detail guidance

Where possible, `details` should include field names, entity IDs, or unsupported values, but must avoid leaking sensitive information in unsafe contexts.

## Paging, sorting, and filtering

### Paging

List queries should support pagination to avoid uncontrolled large payloads.

```ts
interface PageRequest {
  pageSize?: number;
  cursor?: string;
}

interface PageInfo {
  nextCursor?: string;
  returned: number;
}
```

### Sorting

```ts
interface SortRequest {
  field: string;
  direction: 'asc' | 'desc';
}
```

### Filtering

Filter shapes should remain conservative in v1. Prefer explicit field filters and small query operators over a generic query language.

## Validation contract

### Validation output

Validation should return structured findings rather than plain strings.

```ts
interface ValidationFinding {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  entityId?: string;
  field?: string;
}

interface ValidationResponse {
  valid: boolean;
  findings: ValidationFinding[];
}
```

### Workspace validation

Workspace validation should be able to check:

- schema compatibility,
- orphaned links,
- required-link rules,
- stale or invalid references,
- and snapshot/export readiness.

## Snapshot and bundle contract

### Snapshot creation request

```ts
interface CreateSnapshotRequest {
  title: string;
  snapshotType: 'reporting' | 'checkpoint' | 'backup' | 'export';
  scope?: SnapshotScope;
  notes?: string;
}
```

### Export bundle request

```ts
interface ExportBundleRequest {
  bundleType: 'explorer' | 'backup' | 'reporting' | 'exchange';
  scope?: ExportScope;
  snapshotId?: string;
  includeHistory?: boolean;
  includeIntegrityHash?: boolean;
}
```

### Import bundle rules

Imports must validate:

- bundle version support,
- schema compatibility,
- integrity metadata if supplied,
- entity and link structure,
- and collision/conflict rules.

## Integrity and maintenance operations

### Integrity verification

`verifyIntegrity()` should support checks for:

- missing foreign references,
- invalid link pairs,
- duplicate prohibited links,
- orphaned assignments,
- stale schema metadata,
- and snapshot consistency.

### Migration operations

Migration commands should be restricted to `platform-admin` scope and should return a structured result including backup reference, applied migration steps, warnings, and final schema version.

## Suggested TypeScript contract

```ts
export interface PspfCoreApi {
  apiVersion: string;
  schemaVersion: string;
  bundleVersion: string;
  platform: PlatformApi;
  queries: QueryApi;
  commands: CommandApi;
  events: EventApi;
}
```

### Consumer bootstrap pattern

```ts
const ext = vscode.extensions.getExtension<PspfCoreApi>('your-org.pspf-core');
if (!ext) throw new Error('PSPF Core not installed');
const api = ext.isActive ? ext.exports : await ext.activate();
const caps = await api.platform.getCapabilities({
  callerExtensionId: 'your-org.pspf-workshop',
  callerProduct: 'workshop',
  requestedScopes: ['domain-write', 'summary-read'],
  supportedApiVersions: ['1.x']
});
```

This pattern aligns with the exported extension API model used by VS Code extensions.

## API surface boundaries

### In scope for v1

- capability negotiation,
- entity queries,
- link queries,
- summary queries,
- entity and link mutation,
- snapshot/export/import,
- validation,
- integrity verification,
- selected maintenance operations,
- event subscriptions.

### Out of scope for v1

- network transport,
- remote multi-user concurrency protocol,
- arbitrary SQL or raw storage access,
- Explorer runtime integration through Core API,
- external plugin ecosystem for third parties.

## Security and logging implications

Because the platform is sensitive-by-default, the API contract must assume that:

- errors may need redaction,
- logs must avoid dumping full record payloads,
- caller identity must be explicit,
- and export/import operations are security-significant actions aligned with broader information security discipline.

## Conformance requirements

A conforming Core implementation must:

- expose the top-level API object,
- provide semantic version identifiers,
- support capability negotiation,
- return structured errors,
- emit stable event names,
- preserve immutable IDs,
- and reject unsupported or unauthorised operations.

A conforming consumer must:

- negotiate capabilities,
- check compatibility before privileged use,
- tolerate additive fields in responses and events,
- and not depend on undocumented fields or side effects.

## Implementation priorities

Recommended implementation order:

1. Platform negotiation and health methods.
2. Basic entity query methods.
3. Basic create/update entity commands.
4. Link query and mutation methods.
5. Snapshot/export/import commands.
6. Validation and integrity operations.
7. Event emission and subscription.
8. Admin-only migration and repair functions.

## Specification summary

The PSPF Core API v1 should be a small, async, versioned, local-only extension API exposed through the VS Code extension host. It should use explicit capability negotiation, stable commands/queries/events, structured errors, and semver-based compatibility rules so that Workshop, Shop, and Pub can rely on Core without bypassing it or introducing a network surface.

The contract should preserve Core’s role as system of record, align to the canonical entity and link model, evolve additively where possible, and treat trust, integrity, and export operations as first-class concerns rather than incidental plumbing.
