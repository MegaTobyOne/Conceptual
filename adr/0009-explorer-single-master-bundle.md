# 0009 — Explorer single master bundle

- Status: accepted
- Date: 2026-05-09
- Related: ADR 0004 (Explorer dual-mode), ADR 0008 (Canonical version axes)

## Context

The standalone PSPF Explorer prototype (extracted as `extracted-spec-pspf-explorer.md`) ships with **four distinct JSON shapes**, each with its own format tag and validator:

1. `pspfBackup` — full local-store dump for backup/restore.
2. `pspfShare` — partial export of shareable stores (risks, actions, tags, saved views, directions, relationships) for additive merge.
3. `pspfGrcCapture` — narrow ingest from external GRC tooling, one requirement per entry, evidence URL append-only.
4. `pspfWorkImport` — plan-then-apply ingest of risks and actions with status-alias mapping, link normalisation, and update-mode selection.

The four shapes solved real flows but left consumers and tests with four validators, four version tags, four sets of "unknown field" rules, and four documents to keep aligned. The Conceptual rewrite has separately defined the **manifest-led directory bundle** (`pspf-explorer-json-bundle-schema-spec.md`) with explicit `bundleVersion`, `schemaVersion`, and `apiVersion`, plus `generator.product` / `generator.mode`. That bundle is structurally a strict superset of all four prototype shapes.

## Decision

There is **one master JSON contract** for all Explorer data exchange: the manifest-led directory bundle defined in `pspf-explorer-json-bundle-schema-spec.md`. It is the single durable, versioned shape used for every flow — publication, full local-authoring backup/restore, partial share, GRC capture ingest, and risk/action work import.

The four prototype format tags (`pspfBackup`, `pspfShare`, `pspfGrcCapture`, `pspfWorkImport`) are retired. They do not appear in the rewrite.

Different *flows* are distinguished within the single bundle by:

1. **Generator metadata** — `generator.product` and `generator.mode` (e.g. `local-authoring`, `publication`, `grc-capture`, `work-import`). The `mode` is informational; it MUST NOT be a compatibility gate.
2. **Collection selection** — a flow includes only the collections it touches (e.g. a share-style export includes `risks`, `actions`, `tags`, `saved-views`, `directions`, `links`; a GRC capture includes only requirement-evidence updates).
3. **Bundle-level `intent` marker** — `intent ∈ { full-replace, additive-merge, plan-apply }` declares how a consumer must treat the bundle on import. See the bundle schema spec for semantics.
4. **Per-collection options** — for example, the `links` collection MAY carry a `linkMode` (`as-provided` or `rebuild-bidirectional`); risk and action collections MAY carry a `statusNormalisation` block (`strict`, `map-common` with alias map, or `force` with a fixed value).

## Mapping from prototype shapes

| Prototype shape | Replacement in the master bundle |
|---|---|
| `pspfBackup` v1 | Full local-authoring bundle with `intent: full-replace`. Restore is clear-then-load in a single transaction. |
| `pspfShare` v1 | Local-authoring bundle with `intent: additive-merge` and a chosen subset of collections. Merge policy is owned by `pspf-explorer-json-bundle-schema-spec.md` (see ADR 0004 round-trip). |
| `pspfGrcCapture` v1 | Local-authoring bundle with `intent: additive-merge`, generator `mode: grc-capture`, carrying only requirement-keyed compliance updates and evidence references. Evidence URLs append, never replace. |
| `pspfWorkImport` v1 | Local-authoring bundle with `intent: plan-apply`, generator `mode: work-import`, carrying `risks`, `actions`, and optional `links`. The consumer materialises a plan, lets the user review, and only applies confirmed rows. |

## Consequences

- One JSON Schema set governs every Explorer data exchange. CI validates one contract, not four.
- Compatibility gates use only the three canonical version axes (ADR 0008). Format tags as compatibility signals are gone.
- The "additive merge", "full replace", and "plan-apply" semantics are documented once, in the bundle schema spec, and reused by every flow.
- Validation behaviours that the prototype proved valuable — reject unknown top-level and per-entry fields, status-alias maps for work import, link-mode normalisation, evidence URL append-only — survive as *options of the master bundle*, not as separate formats.
- Existing prototype data files with the old format tags are not auto-migrated. Users export a fresh master bundle from the rewrite or are guided through a one-shot conversion. See `pspf-migration-safety-runbook.md`.
- Round-trip into Core/Workshop continues to use the same bundle, consistent with ADR 0004.

## Alternatives considered

- **Keep all four shapes.** Rejected; doubles the validator, schema, and test surface for no behavioural gain. The prototype's separation was historical, not architectural.
- **Three shapes (merge GRC into work import).** Rejected; GRC capture and work import have genuinely different *intent* (additive evidence append vs. plan-apply on risks/actions), but those are configuration of one bundle, not two.
- **Promote `intent` to a fourth canonical version axis.** Rejected; `intent` is per-bundle behaviour, not a compatibility gate. ADR 0008 stays at three axes.
