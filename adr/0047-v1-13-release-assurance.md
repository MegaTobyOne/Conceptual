# 0047 - v1.13 Release assurance and Marketplace verification

- Status: accepted
- Date: 2026-05-17

## Context

The v1.12 codebase reached green local release gates, but the latest green Marketplace workflow run was dispatched as a dry run. It packaged Core and Workshop VSIX artefacts successfully, then skipped `vsce publish`, receipt tags, and GitHub releases by design. The Marketplace listings therefore remained at v1.6.0 while the repository moved to v1.12.0.

ADR 0040 already chose dispatch-driven Marketplace releases with `dry_run=true` as the safe default. That safety remains useful, but the current operator experience makes a dry-run success too easy to mistake for a real publication.

## Decision

v1.13 is a release-assurance slice over the existing product set. It does not add product entities, bundle collections, or schema compatibility axes.

The release hardening is:

- make Marketplace workflow run names and job summaries state the selected target and `dry_run` value;
- make dry-run publish jobs explicitly state that no Marketplace publication, receipt tag, or GitHub release was created;
- add a post-publish verification step for non-dry-run Marketplace jobs that queries the public Gallery API for the expected Core or Workshop version;
- add a receipt-tag verification step after successful publish;
- document the distinction between repository slice version, Marketplace-listed extension version, and Explorer web publication state; and
- include these checks in the release-candidate/readiness guidance before announcing an extension release.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.13.0"`.
- `VERSION_AXES` remains at `schemaVersion = bundleVersion = apiVersion = "1.7.0"`.
- No new schema directory is introduced.

## Consequences

Positive:

- A green dry-run release is visibly different from a real Marketplace publication.
- Operators get a public-state check before treating a release as shipped.
- Receipt tags continue to mean "this version actually published" rather than "a release attempt happened".

Trade-offs:

- Marketplace publish jobs become a little longer because they wait for public Gallery/API confirmation.
- Transient Marketplace indexing delays may need retry/backoff rather than immediate failure.

## Deferred

v1.13 does not add Open VSX publishing, Shop, Pub, editable posture, plan baselines, compliance-history export controls, or a new release channel.