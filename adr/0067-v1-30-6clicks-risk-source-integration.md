# 0067 - v1.30 6clicks risk source integration

- Status: proposed
- Date: 2026-05-23

## Context

Operators may hold risk records in 6clicks or another enterprise GRC system while PSPF Workshop remains the local system-of-record and decision surface. Manual re-keying creates drift and weak provenance, but a broad integration platform would be too much scope for the next slice.

The repository already has local-first Core storage, Workshop risk workflows, SecretStorage rules, and Explorer publication redaction. The integration must use those boundaries rather than introducing a network service, Explorer runtime dependency, or external write-back path.

## Decision

Implement v1.30 as a named **6clicks-risk** source integration inside Workshop Risk workflows.

The slice provides:

1. A Workshop-owned **Risk Source panel** opened by `pspf.workshop.openRiskSourcePanel`.
2. A 6clicks source profile mirrored to `.pspf/config/integrations.json` without raw credentials; API key header and bearer token credentials are stored only in VS Code `SecretStorage`.
3. Operator-initiated connection test, preview, and apply commands.
4. Fixture-backed preview support so the mapping and reconciliation workflow can be validated without a live 6clicks tenant.
5. Deterministic matching by existing integration metadata first, then normalised risk title.
6. Local Core writes through existing `pspf.core.upsertEntities` only.
7. Explicit consent before source values overwrite local PSPF-owned risk fields.
8. Risk integration metadata retained locally, with Explorer/generated outputs exposing only source label and last source update.

The integration is read-only toward 6clicks. No external create, update, delete, webhook, schedule, or background polling behaviour is introduced.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.30.0"`.
- Package version target: `1.30.0`.
- `VERSION_AXES` bumps to `schemaVersion = bundleVersion = apiVersion = "1.11.0"` because this slice adds an optional published `risk.integration` object containing only source label and last source update. Earlier schema directories remain immutable.

## Consequences

Positive:

- Operators can start sourcing external risks without weakening the local-first system-of-record boundary.
- The first integration is concrete enough to validate against real 6clicks payloads while still supporting fixture-driven development.
- Visible non-secret configuration, SecretStorage handling, and overwrite consent are explicit release gates.
- Explorer remains a portable review surface rather than a runtime integration client.

Trade-offs:

- Only risk records are supported in v1.30.
- The first matching rules are deliberately conservative and may classify some records as ambiguous.
- The run ledger is local Workshop state for the first slice rather than a first-class canonical entity, while the non-secret source profile is visible in `.pspf/config/integrations.json`.
- The first source profile is intentionally narrow; richer field mapping and scheduled sync remain future work.

## Deferred

- External Actions, technology systems, suppliers, contracts, spend items, and Pub records.
- Scheduled sync, incremental cursors, webhooks, or background polling.
- Operator-managed field mapping.
- External write-back of any kind.
- Explorer runtime integration with 6clicks or any other source system.
- Broad integration platform abstractions beyond the 6clicks risk source path.
