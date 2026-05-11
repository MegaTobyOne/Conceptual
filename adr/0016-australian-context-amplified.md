# 0016 — Australian context is a strength, not a footnote

- Status: accepted
- Date: 2026-05-10

## Context

PSPF stands for **Protective Security Policy Framework**, the Australian Government's security policy framework administered by the Department of Home Affairs. The four PSPF outcomes (governance, information, personnel, physical) and the 16 PSPF requirements (refreshed in the 2024 release and maintained at protectivesecurity.gov.au) are the entire reason this product exists. The Australian Signals Directorate's **Essential Eight** mitigation strategies and the OAIC's **Australian Privacy Principles** (in particular APP 11.2 retention/destruction, already cited in ADR 0006) anchor the security and privacy posture.

The current spec set treats this Australian framing as background. It uses American English (`color`, `behavior`, `organization`, `optimize`, …) throughout, frames "compliance" in generic terms, and never names the Australian sources explicitly in user-facing copy.

That is a missed strength. Australian Government assurance practitioners are the entire intended audience. They prefer Australian English. They expect AU date and time formatting. They want references back to Home Affairs, ASD, ACSC, OAIC, and AGD when the product makes a claim about a control. Speaking their language is itself a trust signal.

## Decision

Treat the Australian context as a first-class product strength and amplify it across the spec set, the UI, and the documentation.

### 1. Language and copy

- **Australian English in all user-facing copy** (UI strings, errors, docs, README, marketing). Use `colour`, `behaviour`, `organisation`, `optimise`, `recognise`, `customise`, `summarise`, `centre`, `licence` (noun), `defence`, `analyse`. Use `programme` for a scheduled body of work; `program` only for software/computer code. Avoid serial/Oxford commas unless required for clarity.
- **Internal field names, code identifiers, and JSON keys may remain US English** (`color` as a CSS token, `licenseKey` if ever used) for ecosystem consistency with TypeScript/CSS conventions; this is the only carve-out.
- **AU English lint rule**: a CI check (`docs/lint-au-english.mjs` in the monorepo) scans all `.md` files and all extracted UI strings, rejecting US-English variants from a maintained allowlist of pairs. The allowlist lives in [pspf-glossary.md](../pspf-glossary.md) § Spelling.

### 2. Dates, times, numbers

- Default date format in user copy: `DD MMM YYYY` (e.g. `10 May 2026`). Numeric form `DD/MM/YYYY` only where space is constrained.
- Default time zone for UI display: the operator's local zone; tooltips show UTC and the offset.
- Currency: AUD with the `$` glyph and an explicit `AUD` suffix in any context where dollar might be ambiguous (e.g. forecast totals, Shop spend).
- Number grouping: thousands separator is a comma (`12,345`); decimal is a full stop (`12,345.67`).
- Financial year: Australian FY (1 July – 30 June). Format as `FY 2025–26` with an en-dash; avoid US-style `2025-26`.

### 3. Domain naming and primary navigation

- The **PSPF Domains** are the primary navigation grouping in Workshop and Explorer. They follow the four PSPF outcomes from the official catalogue (governance, information, personnel, physical) and any sub-domain split that the active PSPF release actually defines. Renaming "Domain" requires an ADR.
- The Posture screen surfaces Essential Eight as a peer to PSPF outcomes, not buried under a generic "frameworks" header. The eight ASD strategies (application control, patch applications, configure Microsoft Office macros, user application hardening, restrict administrative privileges, patch operating systems, multi-factor authentication, regular backups) are listed by their ASD names.
- "Compliance" copy refers to **PSPF assessment** where it is more accurate, and reserves "compliance" for genuine pass/fail statements.

### 4. Sources and citations

- The product is honest about not being authoritative: a footer line in Explorer publication mode reads `PSPF source: protectivesecurity.gov.au · Essential Eight source: cyber.gov.au` (as text, no live link in v0.1 to preserve the zero-egress invariant).
- Workshop Item Detail for a Requirement shows the canonical Home Affairs reference and date for that requirement, sourced from the static catalogue carried in the bundle.
- Backup runbook citations to cyber.gov.au remain (already present in [pspf-backup-and-restore-runbook.md](../pspf-backup-and-restore-runbook.md)).
- APP 11.2 (retention/destruction) is the named justification for the redaction-event overlay in [adr/0006-snapshot-and-erasure.md](0006-snapshot-and-erasure.md); user-facing copy on erasure references "Australian Privacy Principle 11.2" plainly.

### 5. Classification and handling

- The default operating posture is **OFFICIAL: Sensitive** with **TLP:AMBER+STRICT**, per ADR 0011 and E13. The banner copy uses the Australian Government markings literally; it does not invent its own grade.
- Where copy mentions sensitivity, it links the user to the Information Security Manual (ISM) terminology rather than ad hoc phrasing.

### 6. Accessibility and inclusion

- Accessibility floor (E24) remains WCAG 2.2 AA-aligned, which is consistent with Australian Government Digital Service Standard expectations.
- UI copy uses plain Australian English at a Year 9 reading level where practical; verbose policy quotes are linked, not inlined.

### 7. Documentation framing

- The repo `README.md`, every product `README.md`, and the Explorer About screen open with a one-paragraph statement: *"PSPF is the Australian Government's Protective Security Policy Framework, administered by the Department of Home Affairs. This product helps Australian entities assess and report against PSPF requirements and the ASD Essential Eight, locally and offline."*
- Marketing copy states the product is built for Australian entities; non-Australian users are welcome but the framing is not generic.

## Consequences

### Positive

- The product feels like it was made in Australia for Australian operators, because it was.
- AU English and AU date formatting reduce the friction Australian reviewers feel with US-defaulted SaaS.
- Direct citation to Home Affairs, ASD, OAIC, and AGD makes trust visible and reviewable.
- A maintained AU-English lint catches drift early.

### Negative / accepted trade-offs

- A US-based contributor would need to learn AU spelling for UI copy. The lint flags it; this is fine.
- AU-only framing is explicit; non-Australian use is supported but not the design centre.
- AU English in specs means slightly different prose from many open-source TypeScript projects; the lint exception for code identifiers prevents drift in code.

## Alternatives considered

- **Stay framework-agnostic.** Rejected: PSPF is the entire reason this exists; pretending otherwise dilutes the value proposition.
- **Internationalise from day one.** Rejected as v1 scope; AU English is the only locale in v0.1, and the lint rule does not preclude future i18n if a real need surfaces.
