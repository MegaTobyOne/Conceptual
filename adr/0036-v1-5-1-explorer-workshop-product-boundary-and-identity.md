# 0036 — v1.5.1 Explorer and Workshop product boundary and Explorer identity

- Status: accepted
- Date: 2026-05-15

## Context

Manual validation of v1.5 confirmed the Explorer-to-Workshop round trip works, including Explorer local JSON export, Workshop/Core plan-review-apply import, and undo. The next observed risk is product-role blur: Explorer has gained local status, evidence, Action, and Risk capture, which is useful, but could make it feel like a second Workshop if the visual language and copy do not keep the boundary clear.

Existing specs already describe Workshop as the deep assurance work surface and Explorer as a portable, presentation-ready web view. v1.5.1 records the sharper operating rule now validated in use.

## Decision

Workshop is the system of record and decision surface. It owns canonical authoring, validation, integrity, import review, merge/undo history, evidence queues, Action/Risk management, and audit-friendly decisions.

Explorer is the portable review, briefing, lightweight annotation, and round-trip suggestion surface. It owns fast reading, summary-first posture review, filtering, local browser-held mark-up, local JSON export, and shareable posture artefacts. Explorer local edits are browser-local proposed changes until Workshop accepts them through import.

v1.5.1 establishes an Explorer-specific portable assurance view identity variation:

- Explorer remains in the PSPF family with warm neutrals, restrained teal, source-aware trust markers, and AU-English copy.
- Explorer is warmer, more editorial, and more presentation-ready than Workshop.
- Explorer uses a briefing-style masthead, visible sensitivity/local-storage markers, and a simple mode strip: `Bundle baseline`, `Local changes`, and `Export to Workshop`.
- The visible Explorer authoring section is renamed from `Local Authoring` to `Local Changes`. Internal code identifiers and bundle `generator.mode = "local-authoring"` remain unchanged for compatibility.
- Explorer remembers the latest bundle in browser-local IndexedDB by default and restores it after refresh; it does not retain older bundle history.

No new entity type, collection, schema directory, compatibility-axis bump, Shop, Pub, editable posture, tags, saved views, or compliance-history export control is introduced in v1.5.1. Schema, bundle, and API axes remain `1.3.0`; product version bumps to `1.5.1`.

## Consequences

- Operators get a clearer mental model: Explorer helps review and package observations; Workshop decides and records.
- Explorer becomes visibly distinct without fragmenting the product family.
- Local browser data is treated as important user work and survives ordinary refreshes.
- Workshop remains the place where Explorer suggestions are reviewed, applied, and undone.
- Tests and manuals must use the visible `Local Changes` label while preserving `local-authoring` as the exchange-mode value.

## Alternatives considered

- **Keep Explorer visually identical to Workshop.** Rejected because it weakens the product boundary and makes local browser mark-up look canonical.
- **Make Explorer local changes opt-in or hidden behind a warning.** Rejected because validation showed local review is useful and should be convenient, provided the export-to-Workshop boundary is visible.
- **Rename bundle mode away from `local-authoring`.** Rejected because it would churn the stable exchange contract for a copy-level improvement.
