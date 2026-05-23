# PSPF External Risk Source Integration Planning Specification

**Date**: 23 May 2026  
**Status**: v1.30 planning proposal  
**Audience**: Product owner, CISO, delivery lead, engineering

## 1. Purpose

Define a safe, optional integration capability that lets PSPF operators fetch risk records from an external system of record, preview deterministic local changes, and apply selected creates or updates into the PSPF Core datastore.

This capability is read-only toward external systems. PSPF never writes back to the source system in this tranche.

## 2. Planning Position

The current candidate is **v1.30 external risk source integration**.

The integration belongs in **Workshop + Core**, not Explorer:

- Workshop is the operator decision surface and system-of-record workflow.
- Core owns persistence, validation, writer lock, migration safety, and audit evidence.
- Explorer remains a portable review and local-authoring surface and must not gain runtime API integrations.

Initial scope should be deliberately narrow: a named 6clicks risk adapter, manual preview, explicit apply, local audit ledger, and no scheduled sync.

## 3. Problem Statement

PSPF operators often have risk records in another system of record, such as an enterprise GRC platform, risk API, service management tool, or a controlled JSON endpoint. Without a guided import path, local PSPF risk data can drift from authoritative enterprise records or require manual re-keying.

The product need is to source external risks into PSPF while preserving PSPF's local-first, sensitive-by-default, defensible assurance posture.

## 4. Scope

In scope for the first tranche:

- Optional 6clicks risk source profile.
- Operator-initiated connectivity test.
- Operator-initiated fetch of published risk JSON over HTTPS.
- Normalisation into a canonical incoming risk payload.
- Deterministic matching against existing PSPF `risk` records.
- Preview-first reconciliation with field-level differences.
- Explicit apply into local Core storage.
- External reference metadata attached to locally created or updated risks.
- Sync run ledger and redacted diagnostics.
- Risk workflow panel for configuration, preview, and apply.

Out of scope for the first tranche:

- Any outbound write-back to source systems.
- Real-time streaming, webhooks, scheduled sync, or background polling.
- Multi-user orchestration or remote collaboration.
- External Actions, technology systems, suppliers, contracts, spend items, or Pub records.
- Local delete based on source absence.
- Automatic apply without preview.
- Explorer runtime integration with external systems.
- New Explorer publication behaviour unless the chosen metadata becomes part of canonical exported `risk` records.

## 5. Design Principles

1. **Read-only external posture**: connectors fetch only and expose no create, update, or delete operation against external systems.
2. **Preview-first safety**: no external data changes local records until the operator reviews the proposed result and confirms apply.
3. **Explainable matching**: every proposed create, update, ambiguous match, and rejection has a reason.
4. **Local-first durability**: all authoritative PSPF writes go through Core and the existing writer-lock/concurrency model.
5. **Sensitive-by-default**: secrets never enter the datastore, logs, bundles, snapshots, or diagnostics.
6. **Incremental adoption**: risk import first; other entity types only after the risk path proves safe and useful.
7. **Auditability**: every run produces enough local evidence to answer what changed, when, from which source, and by whom.

## 6. User Outcomes

1. Operators can connect PSPF to an approved external risk source without giving PSPF write-back authority.
2. Operators can preview new and changed risks before committing them locally.
3. Operators can preserve local PSPF-only fields while updating source-authoritative fields.
4. Operators can prove the origin and decision trail for imported risk records.
5. Operators can operate the integration without weakening Explorer's portable, no-runtime-egress posture.

## 7. Functional Requirements

### 7.1 Integration Source Registry

Operators can define and manage risk source profiles with:

- Source name.
- Source type: initially `6clicks-risk`.
- Base URL and risk endpoint path.
- Authentication mode and secret reference. MVP supports API key header and bearer token authentication.
- Enabled/disabled status.
- Timeout and bounded retry settings.
- Optional endpoint allow-list policy.
- Mapping version.
- Default apply policy: `safe-update`.

Source profiles must never store raw secrets in Core storage. Secret values must be stored in VS Code `SecretStorage` and referenced by stable secret keys.

### 7.2 Connector Adapter Contract

Each risk source adapter must implement:

- Connectivity test.
- Paged or single-page fetch of risk records.
- Optional incremental fetch marker where the source supports it, but no scheduled sync in this tranche.
- Mapping of source records to canonical incoming risk payloads.
- Error classification: `auth`, `network`, `schema`, `rate-limit`, `timeout`, and `unexpected`.
- Diagnostic redaction for tokens, keys, cookies, and sensitive headers.

Connectors must be read-only by design and must not include external mutation methods.

### 7.3 Canonical Incoming Risk Payload

Every incoming risk record is normalised before matching:

```typescript
interface IncomingRiskRecord {
  sourceId: string;
  remoteId: string;
  remoteUpdatedAt?: string;
  remoteUrl?: string;
  rawHash: string;
  payload: {
    title: string;
    description?: string;
    category?: string;
    ownerRef?: string;
    likelihood?: string;
    impact?: string;
    rating?: string;
    status?: string;
    treatment?: string;
    notes?: string;
  };
}
```

Records missing a stable `remoteId` are non-upsertable and appear in preview as `error` or `manual-review`.

### 7.4 Matching and Identity Resolution

Matching order:

1. Existing risk external reference matching `sourceId + remoteId`.
2. Deterministic secondary key: normalised title plus category or owner reference where available.
3. Ambiguous state requiring explicit operator selection or exclusion.

No low-confidence match is auto-applied.

### 7.5 Diff and Reconciliation

Preview classifies each incoming record as:

- `new`: no local match found.
- `changed`: one local match found and mapped fields differ.
- `unchanged`: one local match found and mapped fields are equivalent.
- `ambiguous`: multiple plausible matches or insufficient match confidence.
- `error`: payload invalid, mapping failed, or required identifier absent.

Changed records must show field-by-field differences and identify whether each field is source-authoritative or local-protected.

### 7.6 Local Apply Execution

Apply modes:

- `add-only`: create new risks only.
- `safe-update`: create new risks and update source-authoritative mapped fields only.
- `full-mapped-update`: create new risks and update all mapped fields allowed by policy.

Recommended default: `safe-update`.

Rules:

- Apply writes only to the local Core datastore.
- Apply uses existing Core write APIs, validation, writer lock, and transaction patterns.
- Local-protected fields are preserved unless the operator explicitly chooses a policy that allows overwrite.
- Ambiguous and error records are never auto-applied.
- Source absence never deletes local risks.
- Mid-apply failure records partial progress and supports deterministic replay or manual remediation.

### 7.7 External Reference Metadata

Imported or updated risks should carry source reference metadata as integration metadata rather than general-purpose public entity identity.

Proposed shape:

```typescript
interface ExternalRiskReference {
  sourceId: string;
  remoteId: string;
  remoteUpdatedAt?: string;
  remoteUrl?: string;
  lastSyncedAt: string;
  mappingVersion: string;
  rawHash: string;
  confidence: 'high' | 'medium' | 'low';
}
```

This metadata is not a general `externalRefs` expansion for operational entities. Explorer, posture briefs, and generated reports may show only the source label and last source update time unless a later ADR deliberately expands the publication policy. Any persisted field still requires contract, schema, redaction, fixture, and migration review.

### 7.8 Sync Run Ledger and Audit

Each run persists a local ledger entry with:

- Source profile used.
- Initiator and trigger type.
- Start and finish times.
- Status: `previewed`, `applied`, `failed`, or `cancelled`.
- Counts: fetched, new, changed, unchanged, ambiguous, errors, applied creates, applied updates.
- Apply mode and mapping version.
- Redacted diagnostic summary.
- Optional detailed record decisions, stored locally only.

Ledger details should be sensitive by default and excluded from default Explorer publication unless explicitly designed otherwise.

## 8. Architecture Fit

Recommended ownership:

- `packages/contracts`: canonical types only if persisted in Core or exported in bundles.
- `packages/core`: storage, migrations, validation, write APIs, run ledger, and import transaction execution.
- `packages/workshop`: Risk Source panel UI, commands, preview/review/apply orchestration, and SecretStorage prompts.
- `packages/webview-shell`: shared UI components if the preview table or diff panel should be reused.

No VS Code API imports should enter pure contracts or domain helpers. Secret access remains in extension-host code.

## 9. UX Direction

Introduce a Workshop-owned **Risk Source** panel inside the existing Risk workflows.

Suggested layout:

- Source profile section: enabled state, last run status, and run history.
- Preview section: source configuration, test result, mapping policy, preview table, and field diff drawer.
- Sticky action bar: `Test Connection`, `Run Preview`, `Apply Selected`.

Preview should default to showing only `new`, `changed`, `ambiguous`, and `error` rows. `unchanged` rows should be available but visually quiet.

The apply action requires explicit confirmation and displays the number of creates and updates that will be written. Local PSPF-owned fields must not be overwritten unless the user explicitly consents to each overwrite policy in the Risk panel.

## 10. Command Surface

Proposed commands:

- `pspf.workshop.openRiskSourcePanel`
- `pspf.workshop.createRiskSource`
- `pspf.workshop.testRiskSource`
- `pspf.workshop.previewRiskSourceImport`
- `pspf.workshop.applyRiskSourceImport`
- `pspf.workshop.viewRiskSourceRuns`

Core API additions should remain smaller than the command surface and expose only the storage and apply primitives Workshop needs.

## 11. Security and Governance Requirements

1. Secrets stored only in VS Code `SecretStorage`.
2. HTTPS-only source endpoints by default.
3. Optional endpoint allow-listing for regulated environments.
4. No token, key, cookie, auth header, or raw response body in logs by default.
5. Explicit operator confirmation before any apply.
6. No external write-back code path.
7. Workspace Trust required for testing, previewing, or applying source imports.
8. Diagnostics must use the existing PSPF error and diagnostics model.

## 12. Failure Behaviour

- Auth failure: fail run, no local changes.
- Network failure: fail or partially fetch according to adapter policy, no local changes unless apply was already explicitly started.
- Schema mismatch: isolate invalid records and continue preview for valid records.
- Ambiguous matches: never auto-apply.
- Writer lock held: preview may run read-only if allowed; apply fails with the existing writer-lock error path.
- Mid-apply failure: record partial progress, failed record IDs, and replay guidance.
- Concurrency conflict: exclude affected records from auto-apply and show conflict diagnostics.

## 13. Candidate v1.30 Acceptance Gates

1. A trusted Workshop operator can create a 6clicks risk source profile with a SecretStorage-backed API key header or bearer token credential reference and no raw secret in Core storage, workspace settings, logs, snapshots, or bundles.
2. `Test Connection` performs a read-only HTTPS request and classifies auth, network, schema, rate-limit, timeout, and unexpected failures.
3. `Run Preview` fetches fixture risk records and classifies them into `new`, `changed`, `unchanged`, `ambiguous`, and `error` with field-level diffs for changed records.
4. `Apply Selected` writes only confirmed new/changed risk records through Core, preserves local PSPF-owned fields unless the user has explicitly consented to the overwrite policy, and never writes to the external source.
5. Imported risks carry integration metadata; Explorer and generated outputs expose only source label and last source update time, with redaction tests proving no other integration metadata leaks.
6. Sync run ledger entries record run status, counts, apply mode, mapping version, and redacted diagnostics.
7. Regression gates pass: `typecheck`, `lint`, `check:gates`, `validate:debug-workspace`, and release-readiness checks selected for the active release line.

## 14. Decisions Required

1. **6clicks payload contract**: v1.30 accepts the fixture and common 6clicks-style fields (`id`, `title`/`name`/`summary`, `status`, `likelihood`, `impact`, and update timestamps); real-tenant payload refinement remains a follow-up.
2. **Protected fields**: local PSPF-owned risk fields (`title`, `status`, `likelihood`, and `impact`) are preserved by default and can use source values only after explicit apply-time consent.
3. **Consent model**: v1.30 uses per-run consent for applying source values to changed risks.
4. **Run ledger storage**: v1.30 keeps run history in Workshop local state; canonical Core ledger remains a later hardening option.
5. **Source label**: Explorer/report-visible source label is `6clicks`.
6. **Last updated semantics**: Explorer/report-visible last source update uses external `remoteUpdatedAt`; Workshop can fall back to local `lastSyncedAt` in the Risk editor if the source omits a timestamp.

## 15. Proposed Planning Path

1. ADR 0067 records the v1.30 decision.
2. Contracts carry the smallest persisted risk integration metadata and publication policy.
3. The fixture-backed 6clicks preview classifies source records without a live tenant.
4. SecretStorage-backed credential handling and read-only HTTPS fetch are implemented in Workshop.
5. Applies write creates/updates through existing Core APIs and preserve local fields unless the user consents to source values.
6. The Risk Source panel exposes configuration, test, preview, apply, and run history.
7. `check:risk-source-integration` covers commands, visible config, SecretStorage boundary, redaction, and schema shape before release readiness.

## 16. Later Phases

Later tranches can consider:

- Named adapters for common GRC platforms.
- External Action sourcing.
- Technology system or CMDB sourcing.
- Scheduled preview-only checks.
- Incremental cursors or watermarks.
- Richer match confirmation workflows.
- Operator-managed source field mapping.

These should remain deferred until the risk import path is proven against real operator data.
