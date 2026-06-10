# 0076 — v1.42 remediation foundation

- Status: accepted
- Date: 2026-06-10

## Context

The June 2026 ecosystem review found that several assurance mechanisms were stronger in the specifications than in the implementation: agent instructions still described the v0.1 slice, ADR coverage had been truncated to a zero-byte no-op, CI did not run package tests, release gates were encoded as a fragile script chain, and Core import accepted bundles without manifest, compatibility, checksum, limit, or entity-envelope checks.

The same review also identified future connected capabilities — PSPF Connect for Microsoft Graph, AI assistance, Office document outputs, and signed assurance publishing — that must not be built on top of untruthful documentation or an open import boundary.

## Decision

v1.42 is a remediation foundation release. It implements the first parts of `pspf-grand-plan.md` Tranches 0-2:

1. Replace stale agent instructions with current v1.42 ecosystem guidance.
2. Add explicit status headers to root specifications and introduce a spec-drift gate.
3. Restore ADR coverage and add a gate-integrity meta-gate so empty or unenforced gate scripts fail.
4. Regenerate the ADR index and remove the duplicate ADR 0069 by renumbering questionnaire population to ADR 0075.
5. Add package tests to CI and introduce a data-driven release-gate runner.
6. Add shared diagnostic codes, `PspfError`, version-compatibility helpers, and Core import checks for manifest presence, version compatibility, checksums, import limits, and entity envelopes.
7. Add a local workspace schema compatibility guard and fsync-backed database persistence.

## Consequences

- Later Graph, AI, Office-output, and assurance-publishing work has a truthful planning base and a safer import boundary.
- The release pipeline has a meta-gate that would have caught the zero-byte ADR gate regression.
- Core now rejects malformed or incompatible bundles earlier and with structured diagnostics.
- The release gate runner exists alongside older compatibility scripts for this slice; a later cleanup can remove the historical linked-list scripts once release-candidate checks no longer depend on them.

## Alternatives considered

- Build Graph and AI first. Rejected because connected features would multiply failure modes before diagnostics and import validation were credible.
- Move all root specs into `docs/` as part of T0. Rejected for this slice because it would create broad link churn and distract from higher-risk gate and import-boundary fixes.
