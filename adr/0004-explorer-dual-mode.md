# 0004 — Explorer dual-mode

- Status: accepted
- Date: 2026-05-09

## Context

Earlier drafts described Explorer as **read-only**: a static site that consumes a JSON bundle and presents posture, gaps, and reporting readiness without any authoring capability. This is too narrow for the actual use case. Many users will not have Core/Workshop installed; they want to use Explorer alone, mark requirements with statuses, capture their own working state, and optionally exchange data with a Core-managed workspace via JSON.

## Decision

Explorer operates in two modes simultaneously:

1. **Publication mode** — a static site loads a curated, redacted JSON bundle from disk on first open. The bundle is the read-base. This mode is what gets published to GitHub Pages or hosted privately.

2. **Local authoring mode** — the user can mark requirements with statuses, attach short notes, record evidence references, capture actions and risks, and persist all of that in **browser-local storage** (`IndexedDB`). The user can:
   - import a JSON file from disk to seed Explorer with richer data,
   - export their current state as a JSON file that conforms to the bundle schema,
   - feed that exported file back into Core/Workshop on a machine that has them.

Local authoring is **per-origin and per-browser**. There is no server, no account, no sync. If a user clears site data, their Explorer state is gone unless they exported it.

## Consequences

- Explorer becomes a credible standalone tool for users without Core/Workshop. Onboarding for a new entity is just "open the site and start marking things."
- The bundle schema must support round-tripping: data exported by Explorer must be importable by Core, and vice versa, against the same `bundleVersion.major`. There is one master bundle for all flows (publication, full backup/restore, partial share, GRC capture, work import); see ADR 0009.
- Explorer must clearly distinguish, in the UI, between **published bundle data** (read-only baseline) and **local edits** (user-owned, transient, exportable). Local edits are layered on top of the baseline; a "reset local data" affordance must exist and must be reversible only by re-import.
- Local data is stored in `IndexedDB` to handle realistic data volumes. `localStorage` is too small. A storage-quota warning must show when usage exceeds 60% of the browser's allocation.
- Privacy threat model item T13 applies: Explorer must never embed third-party scripts or trackers. CSP enforces this.
- Explorer is **experimental in v1** and must not be relied on as a system of record. Every page surfaces this.
- There is no concurrency model for two browsers editing the same data; whoever exports last wins.

## Alternatives considered

- **Keep Explorer strictly read-only.** Rejected; loses the standalone-tool use case the user explicitly asked for.
- **Put a backend behind Explorer for sync.** Rejected for v1; introduces hosting, auth, and data residency concerns out of scope.
- **Use `localStorage`.** Rejected; size cap (~5 MB) is too small for even modest datasets.
