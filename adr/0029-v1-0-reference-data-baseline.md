# ADR 0029 — v1.0 reference data baseline

- Status: accepted and implemented
- Date: 2026-05-13

## Context

v1.0 currently seeds only PSPF Domains and a small deterministic ISM source-control subset. That is enough for workflow validation, but not enough for a credible operator baseline. Initial assurance users should not have to manually recreate the public PSPF baseline before they can assess their own posture.

The authoritative source investigation found:

- Home Affairs publishes **PSPF Release 2025** at `https://www.protectivesecurity.gov.au/pspf-annual-release` and the source publication `PSPF Annual Release 2025` at `https://www.protectivesecurity.gov.au/publications-library/pspf-annual-release-2025`.
- Home Affairs publishes **PSPF Release 2025 — List of Requirements** at `https://www.protectivesecurity.gov.au/publications-library/pspf-release-2025-list-requirements`, with downloadable source `https://www.protectivesecurity.gov.au/system/files/2026-04/pspf-release-2025-list-requirements.pdf`.
- The list-of-requirements publication date is 24 July 2025 and its page reports last updated 21 April 2026.
- Home Affairs website material is under Creative Commons Attribution 3.0 Australia unless excepted, attributed to the Australian Government Department of Home Affairs.
- ASD publishes the ISM at `https://www.cyber.gov.au/ism` and OSCAL releases at `https://www.cyber.gov.au/ism/oscal`; the GitHub mirror `https://github.com/AustralianCyberSecurityCentre/ism-oscal` reports latest release `v2026.03.24` for the March 2026 ISM.
- ISM material is under Creative Commons Attribution 4.0 International except excluded marks, attributed to ASD/ACSC.

The PSPF Release 2025 requirements list required a deliberate contract change from the simplified v1.0 domain model. The extracted mandatory table uses six domain families (`GOV`, `RISK`, `INFO`, `TECH`, `PER`, `PHYS`) and a numbering range from 1 through 218. The published April 2026 PDF displays 217 numeric requirement rows: requirement `113` is not present in the PDF text/word layer, while requirements `211` through `218` are interleaved earlier in the raw stream. `DomainEntity.code` and the active Explorer domain schema now allow the six Release 2025 domain codes (`governance`, `security-risk`, `information`, `technology`, `personnel`, `physical`).

The PDF is extractable with Poppler `pdftotext -raw`, but the table has page-order and continuation quirks. The baseline package records the source anomaly for requirement `113` rather than fabricating source text that is not present in the published file. Therefore the baseline must be generated from a verified extraction pipeline, not copied from a casual text scrape.

## Decision

Reopen v1.0 scope for an authoritative, offline **reference data baseline** with the implemented constraints below.

1. Add a dedicated reference-data package or module, separate from operator-authored workspace data.
2. Represent PSPF Release 2025 domains, sections, mandatory requirements, and recommended approaches as source-derived reference records with source URL, publication date, last-updated date, licence, attribution, source hash, and extraction timestamp.
3. Expand the domain model from the four legacy domains to the six PSPF Release 2025 domain families before seeding real requirements. This is implemented in the active contract and Explorer schema.
4. Keep operator assessment state separate from reference requirements. A user may assess against a reference requirement, but source text remains read-only.
5. Replace the current hand-written ISM subset with a generated ISM source library from the vendored `v2026.03.24` OSCAL catalogue.
6. Establish explicit PSPF Requirement to ISM Source Control mappings only when the mapping source is reviewable, has provenance, and passes endpoint validation. Do not infer mappings silently from keyword matches.
7. Add a repository agent for reference-data maintenance, source update review, drift detection, and gate reporting.

## Required gates

The implemented v1.0 reference baseline is guarded by automated checks that prove:

1. **PSPF source integrity**: downloaded PSPF source files match recorded SHA-256 hashes and source URLs.
2. **PSPF extraction completeness**: every displayed mandatory PSPF Release 2025 requirement row is extracted, the numbering range is 1 through 218, there are no duplicates, and the published missing requirement `113` anomaly is recorded in the extraction report.
3. **PSPF domain coverage**: extracted requirements cover the six PSPF domain families: `GOV`, `RISK`, `INFO`, `TECH`, `PER`, and `PHYS`.
4. **PSPF metadata completeness**: every requirement has statement text, section code, section title, applicability, start date, release decision, question type, mandatory flag, scored flag, source page/file, licence, and attribution.
5. **ISM OSCAL integrity**: vendored OSCAL files match the selected release hash set for `v2026.03.24` and are generated reproducibly into `source-control` records.
6. **ISM provenance completeness**: every generated source-control has `oscalRelease`, `catalog`, `profile`, `sourceUrl`, `externalRefs`, and `statementChangeStatus`.
7. **Mapping endpoint validity**: every requirement-control mapping references an existing PSPF baseline requirement and an existing generated ISM source-control.
8. **No runtime egress**: Core, Workshop, and Explorer never fetch PSPF or ISM reference data at runtime.
9. **Publication policy coverage**: every new reference-data field declares publication policy and redaction gates still pass.
10. **Attribution surface**: any UI or bundle surface displaying source text includes required Home Affairs or ASD/ACSC attribution.

## Current implementation state

- `@pspf/reference-data` is the source-owned package for the v1.0 baseline.
- Vendored source files live under `packages/reference-data/data/sources/` and are verified by SHA-256 in `scripts/check-reference-data-baseline.mjs`.
- `scripts/generate-reference-data.mjs` generates PSPF baseline domains, PSPF requirement references, PSPF baseline requirement entities, the ISM source-control catalogue, the previous-release drift fixture, and `packages/reference-data/data/reference-data-report.json`.
- Core seeds new workspaces with six PSPF domains, 217 displayed PSPF requirement rows from the published PDF, and 1130 ISM source controls. Requirement `113` remains an explicit source anomaly until a corrected Home Affairs source is available.
- `@pspf/ism-source-library` remains as a compatibility wrapper over `@pspf/reference-data`.
- `check:reference-data-baseline` is part of both `check:gates` and `e2e:v1.0`.

## Consequences

- This is a meaningful v1.0 scope reopening because it changes data contracts, schemas, sample counts, release gates, and manual validation expectations.
- It is safer to ship a transparent baseline with a source anomaly report than to invent missing source text for requirement `113`.
- The current Activity Bar/Home/status-bar usability work remains independent and can still ship without this data baseline.
- Future reference-data updates become a controlled maintenance workflow rather than an ad hoc code edit.

## Implementation plan

1. Done: add a `@pspf/reference-data` package with vendored sources and generated read-only records.
2. Done: add a PSPF extractor script that accepts the Home Affairs PDF as input and writes normalised generated constants plus an extraction report.
3. Done: add an ISM OSCAL generator that consumes vendored `ISM_catalog.json`.
4. Done: expand the active domain contract/schema to six PSPF Release 2025 domain codes.
5. Deferred: add PSPF-to-ISM mapping records only after a human-reviewed mapping table exists.
6. Done: seed new workspaces from generated reference records during Core initialisation.
7. Done: update automated workflow counts to distinguish seeded baseline records from operator-created records.
8. Done: add CI gates for source hashes, extraction completeness, no runtime egress assumptions, redaction, and attribution-sensitive provenance.
