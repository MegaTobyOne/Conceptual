# 0068 - v1.31 6clicks risk source hardening

- Status: proposed
- Date: 2026-05-24

## Context

ADR 0067 introduced a narrow, read-only 6clicks risk source integration inside Workshop. The first slice proved the operator path: configure a source, test the connection, preview mapped risks, apply confirmed local writes, and publish only safe source metadata.

The next release should harden that path for real-tenant validation rather than widening the integration surface. Operators need clearer source-mode intent, stronger live-source validation, local evidence of what happened during each run, and safer preview/apply controls before the integration is treated as release-ready against operational data.

## Decision

Implement v1.31 as **6clicks-risk hardening** inside the existing Workshop Risk Source workflow.

The slice provides:

1. An explicit source mode on the 6clicks profile: `fixture` or `live`.
2. Fixture mode that is credential-free, tenant-free, and backed by named built-in validation data.
3. Live mode that requires an `https://` base URL, endpoint path, auth mode, SecretStorage credential reference, and bounded timeout.
4. Local run logs under `.pspf/logs/risk-source-runs/` with counts, source mode, status, apply counts, mapping version, and redacted diagnostics.
5. Fixture variants that exercise common 6clicks-style payload shapes and rejected records without requiring a live tenant.
6. Preview results that keep invalid source rows as `error` decisions rather than failing the whole preview when valid rows can still be reviewed.
7. Apply-time selection so operators can choose which new or changed risk records to apply from a preview.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.31.1"`.
- Package version target: `1.31.1`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.11.0"` because this slice adds no published bundle fields and no Explorer schema change.

## Non-goals

The following are not under consideration for this integration line unless a later product decision explicitly reopens them:

- Write-back to 6clicks.
- Operator-managed field mapping.

The following remain out of scope for v1.31:

- Endpoint allow-listing.
- Scheduled sync, background polling, webhooks, or incremental cursors.
- Additional source adapters.
- External Actions, technology systems, commercial records, or Pub records.
- Explorer runtime integration with 6clicks or any other external source.
- Broad integration platform abstractions beyond the named `6clicks-risk` path.

## Consequences

Positive:

- Fixture and live behaviour are no longer inferred from an empty base URL.
- The profile can be validated before network access or local writes are attempted.
- Operators gain local operational evidence for each preview/apply run without publishing sensitive diagnostics.
- Rejected source rows are visible and explainable in preview.
- The integration remains read-only toward 6clicks and local-first inside PSPF.

Trade-offs:

- The source profile has one more explicit field, but the added clarity is worth the small configuration cost.
- Run logs are local operational evidence rather than first-class Core entities, so they are not part of Explorer publication or import/export semantics.
- v1.31 still does not solve bespoke tenant field mapping; the adapter remains deterministic and PSPF-owned.