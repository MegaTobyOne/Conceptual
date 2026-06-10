# PSPF Reference Data Baseline Specification

Status: **implemented**

## Purpose

This specification defines how PSPF v1.0 should carry authoritative PSPF and ISM reference data as an offline, verifiable asset. It exists because reference data is not ordinary sample data: source text, source versions, provenance, update cadence, attribution, and drift all affect whether an operator can trust assessment results.

## Authoritative sources

### PSPF

- Landing page: `https://www.protectivesecurity.gov.au/pspf-annual-release`
- PSPF Release 2025 publication page: `https://www.protectivesecurity.gov.au/publications-library/pspf-annual-release-2025`
- PSPF Release 2025 PDF: `https://www.protectivesecurity.gov.au/system/files/2025-07/pspf-release-2025.pdf`
- PSPF Release 2025 List of Requirements page: `https://www.protectivesecurity.gov.au/publications-library/pspf-release-2025-list-requirements`
- PSPF Release 2025 List of Requirements PDF: `https://www.protectivesecurity.gov.au/system/files/2026-04/pspf-release-2025-list-requirements.pdf`
- Publication date: 24 July 2025.
- List of Requirements page last updated: 21 April 2026.
- Licence: Creative Commons Attribution 3.0 Australia unless excepted.
- Attribution: Australian Government Department of Home Affairs.

### ISM

- Human-readable ISM: `https://www.cyber.gov.au/ism`
- OSCAL source: `https://www.cyber.gov.au/ism/oscal`
- GitHub mirror: `https://github.com/AustralianCyberSecurityCentre/ism-oscal`
- Selected release for v1.0 baseline work: `v2026.03.24`, March 2026 ISM.
- Licence: Creative Commons Attribution 4.0 International unless excepted.
- Attribution: Australian Signals Directorate / Australian Cyber Security Centre.

## Data model intent

Reference data must be read-only and provenance-rich. Operator-authored assessment state must remain separate.

Required PSPF baseline concepts:

- PSPF release.
- PSPF domain family: `GOV`, `RISK`, `INFO`, `TECH`, `PER`, `PHYS`.
- PSPF section, for example `GOV 01`.
- PSPF mandatory requirement, numbered in the `1` through `218` range for PSPF Release 2025. The April 2026 PDF source currently displays 217 numeric rows and omits requirement `113`; this must remain visible in the generated extraction report until Home Affairs publishes a corrected source.
- PSPF recommended approach, where included in the release source.

Required ISM baseline concepts:

- OSCAL release.
- Source control generated from OSCAL catalogue controls.
- Current v1.0 implementation uses the vendored master OSCAL catalogue and tags generated controls with `master-catalog`. Resolved profile membership can be added when a reviewed profile selection is introduced.
- Statement drift state compared with the previous vendored release.

Required cyber reference concepts:

- ISM Cyber Security Principles grouped as `govern`, `protect`, `detect`, and `respond` functions.
- Essential Eight mitigation strategies plus the remaining mitigation-strategy family from ASD/ACSC guidance.
- Guidance frameworks for ISM Cyber Security Principles, Essential Eight/ISM mapping, Blueprint for Secure Cloud, Gateway Security Guidance Package, Modern Defensible Architecture, and Strategies to Mitigate Cyber Security Incidents.
- Curated control themes for Trustworthy Software and Secure Configuration Management.
- Queryable cyber-reference mappings that connect PSPF Requirements, ISM source controls, mitigation strategies, and control themes without embedding rationale in public outputs.

Required mapping concepts:

- Human-reviewed PSPF requirement to ISM source-control mapping.
- Coverage qualifier.
- Applicability profile.
- Confidence and review provenance.
- Sensitive rationale, excluded from default publication.

## Extraction rules

1. Extraction scripts may fetch or read source files during maintainer-controlled build/update tasks only.
2. Product runtime must not fetch PSPF or ISM reference data from the network.
3. Generated records must include source URL, source file hash, extraction tool version, extraction timestamp, and attribution.
4. Generated output must be deterministic for identical source files.
5. A source update must fail closed until the generated diff is reviewed.
6. PDF extraction must prove requirement numbering completeness because the PSPF list PDF can interleave continuation rows.
7. Mapping generation must not use unreviewed keyword matching as source of truth.

## Minimum validation gates

1. Source hash manifest matches local vendored source files.
2. PSPF mandatory displayed requirement count is 217 for the current PDF source.
3. PSPF mandatory requirement numbers span 1 through 218, with no duplicates and the published missing requirement `113` anomaly recorded.
4. PSPF domain-family set is exactly `GOV`, `RISK`, `INFO`, `TECH`, `PER`, `PHYS`.
5. Every PSPF requirement has the mandatory metadata fields from the source table.
6. Every ISM source-control has required OSCAL provenance and external references.
7. Every mapping endpoint exists and has the expected entity type.
8. Generated reference data has complete publication policies.
9. Explorer and Workshop surfaces show source attribution when displaying reference text.
10. Release readiness includes a generated reference-data report.
11. Cyber reference diagnostics validate counts, endpoint existence/type, generated cyber links, active schema version, and public redaction of mapping rationale.

## Current v1.0 baseline

- Package: `@pspf/reference-data`.
- Generator: `scripts/generate-reference-data.mjs`.
- Source report: `packages/reference-data/data/reference-data-report.json`.
- PSPF baseline: six PSPF Release 2025 domain families and 217 displayed mandatory requirement rows from the April 2026 PDF, with missing requirement `113` recorded as a source anomaly across the 1..218 numbering range.
- ISM baseline: 1130 generated source-control records from the vendored `v2026.03.24` `ISM_catalog.json` master catalogue.
- Cyber reference baseline: 4 cyber functions, 9 mitigation strategies, 6 guidance frameworks, 2 control themes, and generated cyber-reference mappings/links from `packages/reference-data/data/sources/acsc-guidance/v2026-06-02/cyber-reference-catalogue.json`.
- Compatibility: `@pspf/ism-source-library` re-exports the generated ISM baseline for existing imports.
- Runtime posture: Core seeds from vendored/generated package data and does not fetch PSPF or ISM data at runtime.
- Diagnostic posture: `runDatasetDiagnostics()` and `check:cyber-reference-data` prove the seeded cyber reference dataset matches the generated report, survives clean reset, and remains public-redaction safe.

## Agent workflow

The repository includes a dedicated PSPF Reference Data Curator agent for source refresh and drift review. Use that agent when updating PSPF or ISM source snapshots, reviewing generated diffs, or diagnosing baseline validation failures.
