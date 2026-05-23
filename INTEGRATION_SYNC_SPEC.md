# Rogue CISO External Integration and Local Sync Specification

**Date**: 30 April 2026
**Status**: Phase 1 implementation in progress (manual risk sync live)
**Audience**: Product owner, CISO, delivery lead, engineering

## 1. Purpose

Define a safe, optional integration module that allows PSPF Users to connect to external system-of-record endpoints, fetch published JSON data, compare it with local data, and upsert selected changes into the local datastore.

This specification is explicitly read-only toward external systems. No write-back capability is included.

## 2. Problem Statement

PSPF Users currently maintain local governance datasets that can drift from enterprise systems of record.

Common examples:

- Risks managed in an external Risk API.
- Actions and service work tracked in Service Management platforms (changes, requests, incidents).
- Technology system metadata maintained in infrastructure or CMDB tools.

The product need is to keep local data consistent and aligned without replacing upstream systems.

## 3. Scope

In scope:

- Optional connection profiles to external REST endpoints.
- Read-only fetch from published API endpoints.
- Entity mapping and normalisation into Rogue CISO schema.
- Deterministic compare and preview before apply.
- Local upsert (add new, update existing) with field-level policy controls.
- Sync run ledger and audit evidence.
- User-facing Integration Workspace for configuration and operations.

Out of scope:

- Any outbound write-back to source systems.
- Bi-directional conflict resolution with external updates.
- Real-time streaming/webhook ingestion in initial release.
- Multi-user orchestration features beyond current local-first model.

## 4. Design Principles

1. Read-only external posture: connectors can fetch only.
2. Preview-first safety: no silent bulk changes.
3. Deterministic matching: every upsert decision must be explainable.
4. Local-first durability: preserve existing storage guarantees and migration safety.
5. Incremental adoption: start with risk sync, then action and systems.
6. Defensible governance: every sync run is auditable.

## 5. User Outcomes

1. Users can trust their local risk/action/system records are aligned to system-of-record data.
2. Users can review and approve proposed changes before they are applied.
3. Users can prove what changed, when, and from which source.
4. Users can operate integrations without affecting external systems.

## 6. Functional Requirements

## 6.1 Integration Source Registry

Users can define and manage source profiles with:

- Source name and source type.
- Base URL and endpoint definitions.
- Authentication mode and secret reference.
- Entity scopes (`risk`, `action`, `technologySystem`, and future scopes).
- Sync policy defaults (preview mode, apply policy, timeout, retry).
- Enable/disable status.

Source profiles must never store raw secrets in the datastore. Secret values must be stored in VS Code SecretStorage and referenced by key.

## 6.2 Connector Adapter Contract

Each source adapter must implement:

- Connectivity test.
- Paged fetch for each configured entity scope.
- Optional incremental fetch (`since`, cursor, or watermark).
- Mapping of source records to canonical integration payloads.
- Error classification (auth, network, schema, rate-limit, unexpected).

Connectors are read-only by design and must not expose any external create/update/delete operations.

## 6.3 Canonical Integration Payload

Every incoming record must be normalised to a canonical payload with:

- `sourceId`
- `entityType`
- `remoteId`
- `remoteUpdatedAt` (or equivalent version marker)
- `payload` (normalised fields)
- `rawHash` (integrity and change detection)

Records missing `remoteId` or equivalent stable identifier are treated as non-upsertable and require manual review.

## 6.4 Matching and Identity Resolution

Matching order:

1. Existing external reference mapping (`sourceId` + `remoteId`).
2. Deterministic secondary key rules per entity type.
3. Ambiguous state requiring user confirmation.

Secondary key examples:

- Risk: normalised title + owner + category.
- Action: normalised title + source ticket/reference + status family.
- Technology system: normalised name + system identifier/classification.

## 6.5 Diff and Reconciliation

Compare output must classify each remote record as:

- `new`: no local match found.
- `changed`: local match found with field-level differences.
- `unchanged`: match found with no mapped differences.
- `ambiguous`: multiple plausible matches or low-confidence match.
- `error`: payload invalid or mapping failure.

Users must be able to inspect field-by-field differences for `changed` records.

## 6.6 Local Upsert Execution

Apply modes:

- `add-only`: create new records only.
- `safe-update`: create new and update source-authoritative fields only.
- `full-mapped-update`: create new and update all mapped fields.

Rules:

- Upsert writes to local datastore only.
- Use existing concurrency-safe update patterns.
- Preserve non-authoritative local fields where policy requires.
- Relationship links are resolved in a second pass after entity upsert.
- Unresolved relationships are logged as deferred link actions.

No local delete based on source absence is allowed in initial release.

## 6.7 Sync Run Ledger and Audit

Each run must persist:

- Source profile used.
- Initiator and trigger type (manual/scheduled).
- Start and finish times.
- Entity scope counts (fetched, new, changed, unchanged, ambiguous, errors, applied).
- Applied mode and policy version.
- Error summary and detailed diagnostics.

The ledger supports governance reporting and troubleshooting.

## 6.8 Scheduling and Incremental Sync (Post-MVP)

Initial release supports manual runs only.

Post-MVP supports scheduled runs with:

- Per-source schedule.
- Incremental sync where API supports it.
- Backoff and retry policy.
- Fail-safe behaviour: failed scheduled runs never auto-apply partial changes.

## 7. Data Model Delta

Additive changes only.

New core structures:

- `integrationSources: IntegrationSource[]`
- `integrationSyncProfiles: IntegrationSyncProfile[]`
- `integrationSyncRuns: IntegrationSyncRun[]`

Extend relevant entities (risk/action/technologySystem and future types) with optional external reference metadata:

- `externalRefs?: ExternalReference[]`

Suggested types:

```typescript
interface ExternalReference {
  sourceId: string;
  remoteId: string;
  remoteUpdatedAt?: string;
  lastSyncedAt: string;
  mappingVersion: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface IntegrationSource {
  id: string;
  name: string;
  type: 'risk-api' | 'service-management' | 'systems-api' | 'custom-rest';
  baseUrl: string;
  auth: {
    mode: 'api-key-header' | 'bearer-token' | 'oauth-client-credentials';
    secretRef: string;
    headerName?: string;
    tokenUrl?: string;
    clientId?: string;
    audience?: string;
  };
  scopes: Array<'risk' | 'action' | 'technologySystem'>;
  enabled: boolean;
  createdDate: string;
  modifiedDate: string;
}

interface IntegrationSyncProfile {
  id: string;
  sourceId: string;
  entityType: 'risk' | 'action' | 'technologySystem';
  mappingVersion: string;
  applyPolicy: 'add-only' | 'safe-update' | 'full-mapped-update';
  fieldAuthority: Record<string, 'source' | 'local' | 'manual'>;
  matchRulesVersion: string;
  enabled: boolean;
  createdDate: string;
  modifiedDate: string;
}

interface IntegrationSyncRun {
  id: string;
  sourceId: string;
  status: 'previewed' | 'applied' | 'failed' | 'cancelled';
  trigger: 'manual' | 'scheduled';
  scopes: Array<'risk' | 'action' | 'technologySystem'>;
  startedAt: string;
  completedAt?: string;
  stats: {
    fetched: number;
    new: number;
    changed: number;
    unchanged: number;
    ambiguous: number;
    errors: number;
    appliedCreates: number;
    appliedUpdates: number;
    deferredLinks: number;
  };
  applyMode?: 'add-only' | 'safe-update' | 'full-mapped-update';
  diagnostics?: string[];
}
```

## 8. Architecture Fit

The design aligns with existing layer boundaries.

- `src/domain`: integration types, matching and diff rules, policy evaluation.
- `src/storage`: additive schema support, migration, and run ledger persistence.
- `src/commands`: orchestration commands (`test`, `preview`, `apply`, `view-runs`).
- `src/views`: Integration Workspace webview and status surfaces.
- `src/utils`: connector diagnostics and resilient HTTP helpers.

No VS Code API imports in domain modules.

## 9. Integration Workspace Decision

Decision: introduce a dedicated Integration Workspace.

Rationale:

1. Sync configuration and reconciliation are operationally distinct from normal entity editing.
2. Preview/diff/apply interactions need focused controls and guardrails.
3. Keeping this in a dedicated workspace avoids overloading Data Workspace and reduces accidental changes.

Proposed UX pattern (aligned to Data Workspace v2 conventions):

- Left panel:
  - Source profiles.
  - Scope filters.
  - Run history list with status chips.
- Right panel:
  - Source configuration form.
  - Mapping and authority policy controls.
  - Preview diff table with per-record and per-field details.
  - Sticky action bar: `Test Connection`, `Run Preview`, `Apply Upsert`.

For MVP delivery speed, launch this as a standalone workspace command and keep Data Workspace integration to contextual links only.

## 10. Command Surface (Proposed)

- `rogue.openIntegrationWorkspace`
- `rogue.createIntegrationSource`
- `rogue.testIntegrationSource`
- `rogue.previewIntegrationSync`
- `rogue.applyIntegrationSync`
- `rogue.viewIntegrationSyncRuns`

## 11. Non-Functional Requirements

- Backward compatibility: additive migration only; no existing data loss.
- Safety: no writes to external systems under any code path.
- Reliability: retries with bounded backoff for transient fetch failures.
- Performance: handle typical enterprise payloads with paging and incremental fetch.
- Auditability: full run ledger and deterministic decision trail.
- Accessibility: keyboard-operable diff and apply workflow in webview.

## 12. Security and Governance Requirements

1. Secrets stored only in VS Code SecretStorage.
2. Endpoint allow-listing option for regulated environments.
3. TLS-only remote endpoints by default.
4. Diagnostic redaction for tokens, keys, and sensitive headers.
5. Explicit user confirmation before any apply operation.

## 13. Risk Controls and Failure Behaviour

- Auth failure: fail run, no local changes.
- Schema mismatch: isolate failed records, continue preview for valid records.
- Ambiguous matches: never auto-apply.
- Mid-apply failure: record partial progress and provide deterministic replay option.
- Concurrency conflict on local updates: mark as conflict and exclude from auto-apply.

## 14. Acceptance Criteria

1. A user can configure a Risk API source, test connectivity, preview differences, and apply local upsert without external write-back.
2. Preview clearly separates new, changed, unchanged, ambiguous, and error records.
3. Applied changes are reflected in local entities with external reference metadata attached.
4. Sync run ledger records complete operational details and diagnostics.
5. No existing workflows regress, and migration preserves all pre-existing data.

## 15. Phased Delivery Plan

Phase 1 (MVP): Risk API manual preview and apply

- Source registry.
- One risk adapter.
- Compare and upsert for risk records.
- Integration Workspace baseline and run ledger.

Phase 2: Service Management actions integration

- Action adapter for changes/requests/incidents mapping.
- Action field authority policies.
- Deferred link handling and richer status mapping.

Phase 3: Technology systems integration

- Systems adapter.
- Two-pass relationship reconciliation for systems and components.

Phase 4: Scheduling and incremental sync

- Scheduled runs.
- Incremental watermark/cursor support.
- Operational tuning and diagnostics refinement.

## 16. Open Questions

1. Which source systems and auth modes should be first-class in v1 versus custom REST profile only?
2. What default field authority policy should apply for each entity type?
3. Should `safe-update` be the default apply mode for all profiles?
4. Which local fields are always protected from source overwrite?
5. What run history retention policy is acceptable for local storage size and audit needs?

## 17. Implementation Readiness Checklist

- Spec approved by product owner and engineering.
- Data model delta reviewed for migration safety.
- Secret handling design validated against extension security posture.
- Risk adapter sample payload and mapping fixtures prepared.
- UX wireframe for Integration Workspace validated against look-and-feel standard.
- Test plan drafted: unit, command, webview contracts, migration fixtures.
