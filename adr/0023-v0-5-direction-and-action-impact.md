# 0023 — v0.5 Directions overlay and Action Impact ranking

- Status: accepted
- Date: 2026-05-11

## Context

Australian Government assurance work distinguishes between **PSPF Requirements** (the standing baseline) and **Directions** issued by the Department of Home Affairs (authoritative overlays that, once issued, always apply to scoped entities). Operators currently have no way to register a Direction, link it to the Requirements or Actions it affects, or record the entity's response state (yes / no / risk-managed / not-set).

Separately, the v0.4 Workshop surface lists Actions in creation order. Operators have asked for a deterministic ranking that explains why an Action matters now — drawing on the requirements it advances, the evidence gaps it closes, the risks it reduces, and any Directions it addresses. The ranking must be explainable (no opaque score) and computed locally with no network egress.

ADR 0014 (v0.1 thin slice) and ADR 0008 (version axes) constrain the change: schemas already published at `1.2.0` are immutable, additive surface bumps `schemaVersion` / `bundleVersion` / `apiVersion` together, and default-deny publication policy applies to every new field.

## Decision

Introduce two additive surfaces at `schemaVersion = bundleVersion = apiVersion = 1.3.0`:

### Directions overlay

- New entity type `direction` with ID prefix `DIR-` (UUIDv7, time-stripped at publication per ADR 0002).
- Required fields: `reference`, `responseState ∈ {not-set, yes, no, risk-managed}`. Optional: `issuedAt`, `sourceAuthority`.
- Directions reuse the existing closed link taxonomy (ADR 0003). The canonical relationships are `direction → targets → requirement` and `direction → addressed-by → action`. No new verbs are introduced.
- Posture record gains optional `directionCount` (integer ≥ 0), summarising how many Directions are registered. The brief MAY surface a "Directions" line; absence of Directions yields `directionCount: 0` and a silent omission, not an error.
- All Direction fields are publication-eligible by default. Directions are intended to be visible in the published Explorer bundle so reviewers can see overlay coverage.

### Action Impact ranking

- Actions gain optional `impact` carrying `postureUplift`, `evidenceUplift`, `riskReduction`, `directionUplift` (all integers ≥ 0), `urgency ∈ {normal, due-soon, overdue, blocked}`, and `explanation` (string array).
- Impact is **derived deterministically** by Core at export time. It is never stored as authored data; the Workshop has no edit affordance for impact fields. The deterministic rules are:
  - `postureUplift = 2 × (non-final linked requirements)`
  - `evidenceUplift = 2 × (missing evidence on linked requirements) + 1 × (stale evidence)`
  - `riskReduction = severity band of linked risks (1 / 2 / 3)`
  - `directionUplift = 2 × (linked Directions whose responseState ≠ yes)`
  - `urgency = blocked` if Action status is `blocked`, else derived from `dueDate` (`overdue` if past, `due-soon` within 7 days, else `normal`).
  - `explanation` is the deduplicated list of human-readable phrases that justify each non-zero component.
- The Explorer renders a "Action Impact ranking" panel with the top ten Actions sorted by the sum of the four uplift components. The panel is publication-only (no operator chart export).

### Authoring surface

- Workshop adds two commands: `pspf.workshop.registerDirection` and `pspf.workshop.updateDirectionResponse`. These exercise the standard `pspf.core.upsertEntity` / `upsertEntities` path so writer-lock and integrity gates apply unchanged.

## Out of scope for v0.5

- Editable Action impact (impact is always derived).
- Direction tags, classification, or operator-authored applicability notes (Directions are simple overlays at this slice).
- Direction-aware filtering on other Explorer panels beyond the Directions table and Action Impact ranking.

## Consequences

- `schemas/explorer-bundle/1.3.0/` is the new immutable schema set. `1.2.0` and earlier directories are unchanged.
- `PUBLICATION_FIELD_POLICIES` adds an entry for `direction` (all fields public) and extends `action.publicFields` and `posture.publicFields` with the new optional surface.
- E2E (`scripts/e2e-v01.mjs`) authors one Direction linked to the Requirement, asserts `directionCount = 1`, asserts `action.impact.postureUplift > 0`, and asserts import count is `19` (was `17`).
- Posture brief redaction gate (`scripts/check-brief-redaction.mjs`) and explorer publication smoke (`scripts/check-explorer-publication.mjs`) include the v0.5 surface in their expected bundles.
- This is the last functional slice before v1.0 polish (ADR 0022).
