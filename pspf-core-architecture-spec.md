# PSPF Core Architecture Specification

## Overview

This specification defines **PSPF Core** as the shared platform backbone for the PSPF extension ecosystem. PSPF Core is the system of record for all VS Code-based products in the ecosystem, provides the shared storage and schema authority, exposes a local extension API for trusted companion products, and offers a small administrative user surface for configuration, integrity, and shared platform operations.

PSPF Core is mandatory for PSPF Workshop, PSPF Shop, and PSPF Pub. PSPF Explorer is a special case: it must remain able to operate as a standalone public-facing web application using JSON import/export, even though it should stay schema-compatible with Core-managed data and snapshots.

The Core architecture is deliberately local-first and does not introduce a network service in version 1. Inter-extension coordination should happen through the VS Code extension host, exported APIs, commands, local files, and shared local storage rather than through a local HTTP server or other listening service.

## Role of Core

PSPF Core has six responsibilities:

1. Maintain the canonical shared schema and migrations.
2. Persist and protect the canonical runtime data store.
3. Expose a versioned local API for trusted PSPF extensions.
4. Maintain integrity, history, and snapshot mechanisms.
5. Manage shared platform configuration and workspace bootstrap.
6. Support JSON-based interchange for export, backup, and Explorer compatibility.

PSPF Core is not the primary operational dashboard. Its user surface is administrative, platform-oriented, and intentionally small.

## Product position

### Mandatory dependency

PSPF Core is required for:

- PSPF Workshop
- PSPF Shop
- PSPF Pub

These extensions must not run in normal mode without Core because Core is the authoritative system of record and schema authority.

### Special relationship with Explorer

PSPF Explorer is not a runtime-dependent Core client. It is a standalone web application that relies on JSON import/export and snapshot bundles at the boundary. Explorer may consume Core-derived exports in connected workflows, but it must also function independently when Core is not present.

This creates two Explorer modes:

- **Standalone mode** — imports and exports schema-compatible JSON bundles only.
- **Connected mode** — consumes JSON or generated payloads derived from Core-managed records.

For v1 implementation scope, Explorer is **JSON-bundle-only**. Connected mode is a post-v1 option and must not introduce any runtime dependency from Explorer to the Core extension API.

## Architecture principles

### System of record

Core is the system of record for extension-based workflows. All authoritative writes from Workshop, Shop, and Pub are committed through Core-controlled storage and APIs.

### Local-first

The runtime architecture should remain local-first. No inbound network surface should be introduced in Core v1. All coordination should stay within the local extension host and local filesystem boundary.

### Sensitive-by-default

All platform data should be treated as sensitive by default until classified otherwise. This has implications for storage, logs, notifications, quick-pick labels, and status displays. Secrets must be stored separately from the shared datastore using the VS Code secret storage facility.

### Defensibility-first

The platform must support traceability, immutable snapshots, governed change history, and clear provenance because PSPF reporting and assurance obligations require confidence in record quality and reporting integrity.

### Minimal API surface

Core should expose only the commands, queries, events, and platform methods needed by trusted products. It should not become a general-purpose programmable platform.

### Predictable workspace layout

Core should create and maintain a consistent workspace structure so that storage, exports, logs, and configuration remain understandable and predictable to the operator.

## Workspace model

### Scope recommendation

The primary canonical datastore should be **workspace-scoped** rather than user-global. VS Code provides both workspace and global storage concepts, but a workspace-scoped primary store better aligns data with a project, entity, or engagement boundary and fits the workspace trust model more naturally.

### Why workspace scope is preferred

A workspace-scoped store:

- reduces cross-project data bleed,
- simplifies portability and backup,
- aligns with trust boundaries,
- improves evidentiary clarity,
- and supports per-workspace assurance and export.

### Other options considered

| Option | Strengths | Weaknesses |
|---|---|---|
| Workspace-scoped canonical DB | Clean boundary, portable, defensible, trust-aligned | Requires explicit aggregation if cross-workspace analysis is ever needed |
| User-global canonical DB | Centralized data, easier reuse | Higher spill risk, harder separation, weaker project boundary |
| Hybrid | Strong flexibility; workspace data plus global cache/defaults | More complexity and stronger governance needed |

### Selected model

The selected model is:

- **Workspace-scoped canonical database** for operational records.
- **Global storage** only for caches, preferences, local product metadata, and non-authoritative defaults.

## Workspace bootstrap and layout

Core should create a predictable workspace structure when initialising a PSPF workspace.

### Recommended layout

```text
workspace-root/
├── .pspf/
│   ├── core/
│   │   ├── pspf-core.db
│   │   ├── migrations/
│   │   ├── journal/
│   │   └── locks/
│   ├── exchange/
│   │   ├── imports/
│   │   ├── exports/
│   │   └── snapshots/
│   ├── config/
│   │   ├── workspace.json
│   │   ├── products.json
│   │   └── policies.json
│   ├── cache/
│   ├── logs/
│   └── README.md
├── .vscode/
│   └── settings.json
└── <user-controlled project files>
```

### Folder purposes

| Path | Purpose |
|---|---|
| `.pspf/core/pspf-core.db` | Canonical runtime datastore |
| `.pspf/core/migrations/` | Migration metadata and scripts |
| `.pspf/core/journal/` | Append-only event or change journal artefacts |
| `.pspf/core/locks/` | Lock files or coordination metadata |
| `.pspf/exchange/imports/` | Imported JSON bundles pending or recorded |
| `.pspf/exchange/exports/` | Generated export bundles |
| `.pspf/exchange/snapshots/` | Immutable reporting snapshots |
| `.pspf/config/` | Shared workspace and platform configuration |
| `.pspf/cache/` | Rebuildable local caches |
| `.pspf/logs/` | Redacted local logs |

### Bootstrap behaviour

Core should support a “Create PSPF Workspace” or “Initialise PSPF Core” workflow that:

- creates the folder structure,
- creates the initial database,
- writes baseline configuration,
- records schema version,
- and verifies workspace trust before enabling sensitive features.

## Storage architecture

### Canonical runtime store

The canonical runtime store is SQLite. SQLite is well suited to a local-first, portable, structured workspace store and is materially better than scattered JSON files once cross-product links, indexing, migrations, and defensible history are required.

### Concurrency configuration

VS Code may activate Core, Workshop, Shop, and Pub in the same window. They share the workspace database. Core enforces a single-writer model:

- The database opens with `journal_mode=WAL` and `synchronous=NORMAL`.
- All connections set `busy_timeout=5000` (milliseconds).
- All writes pass through Core's `pspf.core.commit*` API. Workshop, Shop, and Pub never open the SQLite file directly.
- Internally, Core serialises writes through a single in-process queue. Concurrent reads are unrestricted.
- The `pspf-core.db-wal` and `pspf-core.db-shm` files are part of the workspace dataset and must be present together for backup and restore (see [pspf-backup-and-restore-runbook.md](pspf-backup-and-restore-runbook.md)).

### Writer lock (multi-window safety)

VS Code allows the same workspace folder to be opened in more than one window concurrently, and SQLite WAL mode does not prevent two processes from writing to the same database. Core enforces single-writer semantics with an OS-level lock:

- On activation, Core acquires an exclusive lock on `.pspf/core/locks/writer.lock` and writes its PID, the VS Code window id, and the activation timestamp.
- If the lock is already held by a live PID belonging to another window, Core opens the workspace in **read-only mode**: queries work, mutating commands return `PSPF_WRITER_LOCK_HELD`, and the Health view shows a banner naming the holding window with a single action **“Take over as writer”**. (v0.1 implementation: the same information is surfaced through `PSPF: Show Writer Lock` and the read-only banner inside Workshop webviews; the unified Health view arrives in v0.2.)
- “Take over as writer” re-validates Workspace Trust, prompts the user once, then forces release of the prior lock (after confirming no in-flight writes via the WAL state) and re-acquires it.
- On clean shutdown Core releases the lock; on crash the next activation detects the stale lock by PID liveness and reclaims it after a `PRAGMA wal_checkpoint(TRUNCATE)`.
- The lock file is excluded from backup snapshots (see [pspf-backup-and-restore-runbook.md](pspf-backup-and-restore-runbook.md)).

This is the v0.1 mechanism; multi-writer concurrency is not in scope.

### Runtime vs interchange

The runtime model and interchange model must be distinct:

- **Runtime model** — SQLite plus Core API.
- **Interchange model** — JSON bundles and snapshots.

JSON remains important, but only for import, export, backup, handoff, and Explorer compatibility. It should not be the primary runtime integration path.

### Global storage usage

VS Code global storage may be used for:

- extension preferences,
- UI state,
- local caches,
- product discovery metadata,
- and machine-local defaults.

It must not be treated as the authoritative operational record store.

### Secret storage

Credentials, tokens, and any other secrets must be stored only in `SecretStorage`, not in the shared database or workspace config files.

## Identity model

### Requirements for IDs

All canonical object IDs must be:

- globally unique,
- immutable,
- type-guiding,
- partially human-readable,
- safe for cross-product linking,
- and durable across export/import and snapshot flows.

### Selected ID style

Canonical IDs use a **prefix + UUIDv7** pattern, with the 48-bit Unix-millisecond timestamp prefix zeroed before serialisation in any artefact eligible for publication. The prefix identifies the entity type. See [pspf-entity-link-spec.md](pspf-entity-link-spec.md) for the byte-level rule and [adr/0002-id-format.md](adr/0002-id-format.md).

### Example IDs

- `REQ-018f4c2a-0e3a-7c5e-9a4b-3f6d2c1e8a90` (internal storage form)
- `ACT-018f4c2c-2a3b-7c4d-b5e6-f7a8b9c0d1e2`
- `RSK-018f4c2d-3b4c-7d5e-c6f7-a8b9c0d1e2f3`
- `SUP-018f4c2e-4c5d-7e6f-d7e8-f9a0b1c2d3e4`
- `PER-00000000-0000-7c5e-9a4b-3f6d2c1e8a90` (always time-stripped, including internally; see N4)

### Prefix registry

A controlled registry of type prefixes should be maintained by Core. Initial examples:

| Prefix | Entity |
|---|---|
| `REQ` | Requirement |
| `EVD` | Evidence |
| `SNP` | Snapshot |
| `ACT` | Action |
| `RSK` | Risk |
| `SUP` | Supplier |
| `CTR` | Contract |
| `SPD` | Spend item |
| `PER` | Person |
| `ROL` | Role |
| `ASM` | Assignment |
| `NTF` | Notification rule |
| `RPT` | Report pack |

### Friendly display IDs

A short display alias such as `R-123` may be shown in UI tables, but it must never replace the canonical immutable ID.

## Entity model

### Canonical top-level entities

Core should initially support these canonical entity classes:

- Requirement
- Evidence
- Snapshot
- Action
- Risk
- Supplier
- Contract
- Spend item / commitment
- Person
- Role
- Team / unit
- Assignment
- Notification rule
- Report pack

### Shared minimum fields

Every entity should include at least:

- canonical ID,
- entity type,
- created timestamp,
- updated timestamp,
- source product,
- current lifecycle state,
- ownership metadata,
- provenance metadata,
- and soft-delete flag or status if applicable.

### Link model

Cross-product relationships should be represented explicitly rather than as informal embedded references alone. Links should be first-class, queryable, and attributable.

Examples of required links include:

- Supplier → Contract → Requirement → Risk
- Person → Assignment → Action → Snapshot
- Spend item → Control uplift → Reporting narrative

Each link should carry:

- source entity ID,
- target entity ID,
- link type,
- created timestamp,
- created by product,
- optional rationale or notes,
- and lifecycle state if relevant.

## Ownership and write authority

### Authoritative write model

Core owns persistence. Products own primary workflows for their domains, but they should not bypass Core to mutate authoritative state.

### Domain ownership model

Recommended primary ownership model:

| Product | Primary authored entities |
|---|---|
| Core | Configuration, snapshots, links, migration metadata, platform metadata |
| Workshop | Validation actions, structured edits, diagnostics outcomes, analytical artefacts |
| Shop | Supplier, contract, spend, related actions in commercial workflows |
| Pub | Person, role, assignment, capacity/workforce records |
| Explorer | No authoritative runtime writes in Core mode; JSON-boundary edits only in standalone mode |

### Cross-product updates

Cross-product updates should occur through governed Core commands, not direct database writes by peer extensions.

## History and audit model

### History strategy

Core should maintain:

- current-state tables for normal query performance,
- append-only event history for significant changes,
- immutable reporting snapshots,
- and what-changed views between snapshots.

### Required audit depth

History must be maintained for at least:

- status changes,
- rationale changes,
- evidence links,
- action ownership and lifecycle,
- risk decisions,
- supplier and contract changes,
- workforce assignments,
- approvals,
- and snapshot generation.

### Deletion model

Business entities should use soft delete or inactive states rather than destructive deletion by default. Hard deletion should be highly restricted and logged.

## API architecture

### Local-only API model

Core should expose a **local-only extension API** through the VS Code extension host. It should not expose a network listener, local HTTP endpoint, or externally reachable service in version 1.

### Why this avoids a network surface

When communication occurs through exported extension APIs, commands, local storage, and the extension host, it remains within the VS Code process/runtime model rather than introducing an addressable network service.

### API groups

Core API v1 should expose four groups only:

| Group | Purpose |
|---|---|
| Queries | Read records, links, summaries, platform state |
| Commands | Create, update, link, snapshot, import, export, validate |
| Events | Subscribe to changed records, migrations, snapshots, health changes |
| Platform | Health, version, capabilities, trust status |

### API design constraints

The API should be:

- async-first,
- versioned,
- capability-checked on activation,
- minimal in surface area,
- and explicit about which products are trusted callers.

### API access control

Core should expose write-capable operations only to trusted PSPF product IDs. External or unrelated extensions should not receive the privileged API surface.

This is not a perfect hostile-code security boundary inside the same editor process, but it is the correct intended control model for extension-to-extension collaboration.

## Commands and events

### Example Core commands

Initial commands may include:

- `pspf.core.initWorkspace`
- `pspf.core.getHealth`
- `pspf.core.createEntity`
- `pspf.core.updateEntity`
- `pspf.core.linkEntities`
- `pspf.core.createSnapshot`
- `pspf.core.importBundle`
- `pspf.core.exportBundle`
- `pspf.core.runMigration`
- `pspf.core.rebuildIndex`
- `pspf.core.verifyIntegrity`

### Example Core events

Initial events may include:

- entity changed
- snapshot created
- import completed
- export completed
- migration completed
- workspace trust changed
- health degraded

## User surface

### Role of the Core UI

Core needs its own small user surface to manage shared platform concerns. It should not duplicate Workshop or Explorer views.

### Core UI responsibilities

The Core surface should support:

- workspace initialisation,
- product detection and status,
- schema version and migration state,
- shared configuration,
- import/export management,
- snapshot and exchange history,
- integrity and repair tools,
- trust and security state,
- and storage health.

### Suggested VS Code integration points

The Core UI should probably use:

- one view container per extension, named by the extension itself (Core, Workshop, Shop, Pub),
- a small number of tree or summary views,
- and selective webviews only where richer repair or migration interfaces are necessary.

## Security model

### Sensitive-by-default handling

All Core-managed data should be treated as sensitive by default. This has visible design implications:

- status bar text must avoid exposing detailed sensitive information,
- notifications should use sparse wording,
- quick-pick labels and logs should be redacted where practical,
- exports should be explicit user actions,
- and debugging output should default to safe summaries.

### Impact on flow and performance

This decision will visibly affect the platform in several ways:

| Area | Likely impact |
|---|---|
| Startup | Integrity checks, migration checks, or trust checks may add startup time |
| Writes | Validation, journaling, and history logging may slow heavy batch writes |
| Notifications | Messages will be less specific to reduce information leakage |
| Logging | Debugging may be harder because logs must be redacted |
| UI convenience | Rich details may be hidden from lightweight surfaces such as status bar |
| Export | Export and snapshot creation will require clearer user intent and confirmation |

### Workspace trust

Sensitive features should honor Workspace Trust. Core should verify workspace trust before enabling full functionality and should either degrade or block sensitive operations in untrusted workspaces.

### Remote development

Because VS Code can run extensions in remote environments, Core must explicitly declare its expected execution model and either support or restrict remote scenarios in version 1.

Recommended v1 position:

- Support local workspaces first.
- Detect remote extension environments explicitly.
- Restrict or warn on unsupported remote modes until tested and assured.

## Migration and versioning

### Schema authority

Core is the schema authority. Only Core should execute authoritative schema migrations.

### Migration process

On startup or workspace open, Core should:

1. detect schema version,
2. compare against supported version,
3. **NOT run any migration automatically.** Per [pspf-migration-safety-runbook.md](pspf-migration-safety-runbook.md), every migration in v1 requires an explicit `pspf.core.runMigration` from a trusted workspace.
4. if the schema is out of date, open the workspace in **degraded read-only mode** with a Health-view banner explaining why and offering the one-click migration command,
5. on operator-invoked migration: back up the database, classify safe vs non-safe, prompt accordingly, run, record outcome, and notify dependent products of compatibility state.

If a migration cannot be classified as safe, Core requires explicit operator confirmation in addition to the standard invocation, and presents a clear recovery path.

### Versioning model

The Core API and schema should use semantic versioning so dependent products can negotiate compatibility more safely.

## Explorer boundary

Explorer relies on JSON import/export rather than the local extension API. Core must therefore produce schema-governed JSON bundles that support:

- standalone Explorer operation,
- public-facing sharing workflows,
- offline review,
- and durable snapshot export.

These bundles should be:

- versioned,
- checksummed for accidental-corruption detection,
- and traceable to the originating snapshot or export operation.

## Packaging and repo model

### Product packaging

Core, Workshop, Shop, and Pub are **four separate VS Code extensions**, each published independently to the Marketplace. See ADR 0007.

Workshop, Shop, and Pub each declare a peer-extension dependency on Core via documented compatibility metadata. Activation defers any privileged work until Core's API is reachable. The recommended onboarding flow installs Core+Workshop together for new users, but that is a UX recommendation, not a packaging fact.

No single "platform VSIX" exists. The earlier `pspf-platform` bundling proposal is retired.

### Repo recommendation

Per ADR 0013, the entire ecosystem lives in a **single private GitHub repository** named `pspf` on the maintainer's GitHub Pro account. Each product is a workspace package; the four VSIX-producing extensions still release independently via per-package release tags. The earlier polyrepo proposal (`pspf-core` + `pspf-workshop` + `pspf-shop` + `pspf-pub` + `pspf-explorer` + `pspf-contracts`) is retired.

| Path | Contents |
|---|---|
| `packages/contracts/` | Schema, SDK, API contract types, ID utilities, importer/exporter, brief renderer, chart renderer, fixtures |
| `packages/core/` | Core extension: storage, API, migrations, exporter/importer integration |
| `packages/workshop/` | Workshop extension: authoring surface, depends on Core |
| `packages/shop/` | Shop extension: supplier/contract surface (v0.2+), depends on Core |
| `packages/pub/` | Pub extension: people/role/assignment surface (v0.2+), depends on Core |
| `packages/explorer/` | Explorer SPA and schema-boundary tooling |
| `docs/` | Specs, ADRs, runbooks, glossary, onboarding |
| `schemas/explorer-bundle/<schemaVersion>/` | Per-version bundle JSON Schemas (E23) |

This keeps the tightest coupling together while still allowing each VSIX to release on its own cadence.

### Cross-package coherence

Within the monorepo, packages stay coherent through:

- shared SDK/types in `packages/contracts/`,
- TypeScript project references between packages,
- per-package semver for VSIX-producing packages,
- a compatibility matrix maintained in `docs/specs/`,
- in-tree contract tests run on every PR,
- and a single source of ADR and schema governance under `docs/`.

## Initial v1 decisions

The following decisions are locked for Core v1:

| Topic | Decision |
|---|---|
| Platform role | Core has its own small administrative user surface |
| System of record | Core is authoritative for all extension-based products |
| Runtime storage | SQLite |
| Interchange | JSON bundles and snapshots |
| Scope | Workspace-scoped canonical store |
| IDs | Prefix + immutable globally unique token |
| Write model | Core-controlled persistence with product-owned workflows |
| History | Current state + append-only history + immutable snapshots |
| Secrets | `SecretStorage` only |
| Network exposure | None in v1 |
| Explorer relationship | Standalone-capable, JSON-boundary only |
| Explorer connected mode | Deferred to post-v1 |
| Migration execution | Operator-invoked only; degraded read-only on schema bump until run |
| Packaging | Four separate extensions; install Core+Workshop together by recommendation |

## Implementation priorities

Recommended build order:

1. Define the entity registry and prefix registry.
2. Define the Core API v1 contract.
3. Implement workspace bootstrap and layout creation.
4. Implement SQLite schema and migration framework.
5. Implement identity, link, and history services.
6. Implement Core UI for health, config, migration, and exchange.
7. Implement JSON import/export bundles for Explorer compatibility.
8. Add Shop and Pub integration points.

## Specification summary

PSPF Core is the authoritative local platform for the PSPF extension ecosystem. It owns the runtime store, schema, history, snapshots, and shared platform operations, exposes a minimal local-only API to trusted companion extensions, and provides a small but essential administrative surface for shared configuration and integrity management.

The architecture is deliberately local-first, workspace-scoped, sensitive-by-default, and defensibility-oriented. Explorer remains standalone and JSON-boundary compatible, while Workshop, Shop, and Pub rely on Core as the shared, governable, and auditable foundation for all extension-based workflows.
