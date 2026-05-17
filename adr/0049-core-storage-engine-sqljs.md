# ADR 0049 — Core storage engine uses bundled sql.js

## Status

Accepted.

## Context

PSPF Core stores workspace data in `.pspf/core/pspf-core.db` as a local SQLite database. Until v1.14, Core executed SQL by spawning the host `sqlite3` command-line tool from the VS Code extension host.

That made workspace initialisation depend on the user's operating-system `PATH` and local tooling policy. A user could install the extensions successfully but fail to initialise a workspace with `spawn sqlite3 ENOENT` when `sqlite3` was not installed, was not visible to GUI-launched VS Code, or was blocked in a managed environment.

The Core workload is small and conservative: schema creation, metadata writes, entity upserts, entity listing, import/export support, and `PRAGMA integrity_check`. Explorer and other web surfaces consume exported JSON bundles and do not open the SQLite file directly.

## Decision

Core uses `sql.js`, a pure WebAssembly SQLite engine bundled with the Core extension, for normal runtime database access.

The `.pspf/core/pspf-core.db` file remains a standard SQLite database file. Existing workspaces remain readable, and operational backup/restore procedures may still use the external `sqlite3` CLI where available.

The extension build copies `sql-wasm.wasm` into the Core `dist` directory and resolves it from the extension entry-point location at runtime. The host no longer needs a system `sqlite3` executable for workspace initialisation or normal Core operations.

## Alternatives Considered

- Continue spawning `sqlite3`: rejected because it fails in common managed or GUI-launched VS Code environments and creates a fragile first-run dependency.
- `better-sqlite3`: rejected because native `.node` binaries introduce per-platform packaging, Electron ABI, code-signing, and endpoint-security friction.
- `node:sqlite`: rejected for now because availability is tied to the VS Code extension host's bundled Node version and would cut off older managed VS Code deployments.

## Performance Baseline

A local benchmark comparing the current CLI-spawn approach with sql.js is available as `pnpm bench:storage`.

On 17 May 2026, against the representative Core workload (schema init, batched insert, list all, integrity check), sql.js completed faster than the CLI approach across tested sizes:

| Entities | CLI total | sql.js total |
| --- | ---: | ---: |
| 10 | 33.9 ms | 27.4 ms |
| 100 | 32.0 ms | 4.4 ms |
| 1,000 | 48.6 ms | 11.7 ms |
| 5,000 | 109.0 ms | 38.9 ms |

The measured WASM cold-start cost was 6.3 ms once per process. The bundled asset cost was approximately 644 KB for `sql-wasm.wasm` and 45 KB for the JS glue.

## Consequences

- Workspace initialisation no longer fails because `sqlite3` is missing from `PATH`.
- Tightly controlled environments avoid native add-on installation and child-process execution for normal Core storage.
- The VSIX grows by roughly 0.7 MB.
- Core keeps the existing single-writer policy. sql.js loads the database into process memory and persists changes back to the same SQLite file after write operations.
- The external SQLite CLI remains useful for operator backup, restore, and ad hoc inspection workflows, but it is no longer a runtime prerequisite for the extension.
