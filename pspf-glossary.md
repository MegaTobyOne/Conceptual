# PSPF Glossary

## Purpose

This glossary is the single source of truth for **terminology and spelling** across the PSPF spec set, code, and user-facing copy. It exists to:

1. Disambiguate overloaded words (especially "Domain") so two specs cannot quietly mean different things.
2. Reconcile parallel state vocabularies users see between Workshop and Explorer (the **Vocabulary reconciliation matrix**).
3. Pin Australian English as the user-facing standard, with a maintained spelling allowlist that the AU-English lint enforces (see [adr/0016-australian-context-amplified.md](adr/0016-australian-context-amplified.md)).

The glossary is **machine-checked** by the same CI job that runs [pspf-invariants.md](pspf-invariants.md). If a term in this document conflicts with a spec, the glossary wins for terminology; [pspf-invariants.md](pspf-invariants.md) wins for machine-checkable shape rules; [pspf-spec-consistency-index.md](pspf-spec-consistency-index.md) wins for "which spec owns the topic".

---

## Core Australian context terms

### PSPF — Protective Security Policy Framework

The Australian Government's security policy framework, administered by the Department of Home Affairs. Published at protectivesecurity.gov.au. The product is named after the framework. When the abbreviation appears alone, it always refers to the Australian framework — never any other "Protective Security Policy".

### Essential Eight (E8)

The Australian Signals Directorate's eight prioritised mitigation strategies: application control, patch applications, configure Microsoft Office macros, user application hardening, restrict administrative privileges, patch operating systems, multi-factor authentication, regular backups. Source: cyber.gov.au. Use the ASD names; do not paraphrase.

### ISM

The Australian Government **Information Security Manual**, maintained by ASD/ACSC. Published in human-readable form at <https://www.cyber.gov.au/ism> and as a machine-readable OSCAL catalogue at <https://github.com/AustralianCyberSecurityCentre/ism-oscal> (CC BY 4.0). ISM is the implementation control catalogue cyber teams use to deliver and evidence PSPF outcomes; PSPF is the assurance framework, ISM is the control catalogue. They are distinct. See [adr/0017-ism-integration-roadmap.md](adr/0017-ism-integration-roadmap.md) for the integration phasing.

### ISM control

A single control record from the ISM catalogue (for example a configuration, logging, or hardening control). Modelled as a `source-control` entity using the `SRC` prefix from v0.2; carries `externalRefs` to the natural ISM control identifier. ISM controls are read-only; updates arrive by replacing the vendored OSCAL snapshot via an explicit operator command. Never edited in Workshop.

### ISM profile / ISM baseline

A resolved subset of ISM controls scoped to an applicability. ASD publishes resolved profile catalogues for Essential Eight ML1/ML2/ML3 and for the classification baselines Non-classified, OFFICIAL: Sensitive, PROTECTED, SECRET, and TOP SECRET. "Profile" is the OSCAL term; "baseline" is the practitioner term. They mean the same thing in this product.

### OSCAL

NIST's **Open Security Controls Assessment Language**, the XML/JSON/YAML schema family ASD uses to publish the ISM. The product consumes OSCAL files at build time only; no runtime fetch.

### Source control (entity)

An external authority's control record carried in the product as a read-only reference. Modelled with the `SRC` prefix in [pspf-entity-link-spec.md](pspf-entity-link-spec.md). ISM controls are the primary example from v0.2.

### APP 11.2

**Australian Privacy Principle 11.2** (Privacy Act 1988): destruction or de-identification of personal information no longer required. The justification for the snapshot redaction-event overlay in [adr/0006-snapshot-and-erasure.md](adr/0006-snapshot-and-erasure.md). Always cited by name in copy that explains why erasure is overlay-based, not destructive.

### Direction (Home Affairs Direction)

A formal protective-security direction issued under the PSPF. Modelled as an entity in [pspf-entity-link-spec.md](pspf-entity-link-spec.md) (prefix `DIR`). Capitalised "Direction" in this product to distinguish it from generic English "direction". Deferred to v0.2 per [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md); v0.1 records Directions as Tags + a free-text response note.

### Change Record

A Workshop-authored explanation of a significant change affecting a Requirement, Action, Risk, Direction, Tag, or Saved View. Modelled as `change-record` with the `CHG` prefix. Explorer publication shows the public summary in the "Why This Changed" view and excludes sensitive reasons, impact notes, and restricted decision-owner references.

### OFFICIAL: Sensitive

The Australian Government information classification at which Explorer's default posture sits. Used literally in the banner. See [adr/0011-explorer-sensitive-labelling-only.md](adr/0011-explorer-sensitive-labelling-only.md).

### TLP:AMBER+STRICT

The Traffic Light Protocol marking that accompanies OFFICIAL: Sensitive in Explorer's banner. Use the literal string.

---

## Overloaded terms — pinned meanings

### Domain

In this product, **Domain always means *PSPF Domain***: a top-level grouping of PSPF requirements as defined by the active PSPF release (governance, information, personnel, physical, and any sub-domains the release actually defines). Modelled as an entity (prefix `DOM`). Used as the primary navigation grouping in Workshop and Explorer.

When any other notion of "domain" is genuinely needed, the spec or copy MUST disambiguate explicitly:

- "**Information domain**" — for a network/data trust boundary (rare; only in security-context discussions of cross-domain data flow).
- "**Business domain**" — for an organisational area (rare; prefer "team" or "function" instead).
- "**DNS domain**" or "**hostname**" — never just "domain" on its own.
- "**Email domain**" — never just "domain".

The AU-English lint flags bare "domain" in copy that lives outside the PSPF Domain context and asks for the disambiguating prefix.

### Compliance

In this product, "compliance" is reserved for **genuine pass/fail statements** about a requirement against an authoritative rule. For the assessor's working state on a Requirement, the right word is **assessment** (e.g. "assessment status: not started / in progress / met / partially met / not met / not applicable / under review"). The AU-English lint accepts both "compliance" and "assessment" but flags "compliance" when used as a synonym for "assessment status".

### Snapshot vs Backup vs Export

- **Snapshot** — an immutable, in-product, defensibility-grade record of state at a point in time (entity `SNP`). Created by Core; never modified. APP 11.2 erasure happens through redaction-event overlays, not by mutating the snapshot. See [adr/0006-snapshot-and-erasure.md](adr/0006-snapshot-and-erasure.md).
- **Backup** — an operational copy of `.pspf/core/pspf-core.db` (and its WAL/SHM siblings) plus `.pspf/config/`, taken via the procedures in [pspf-backup-and-restore-runbook.md](pspf-backup-and-restore-runbook.md). Not in the bundle; not classified as a snapshot.
- **Export** — a master JSON bundle written to `.pspf/exchange/exports/` and consumed by Explorer or another PSPF instance. Subject to the publication policy and personal-data exclusion (S3, S7, N6).

These three are not synonyms.

### Bundle

The **master JSON bundle** defined in [pspf-explorer-json-bundle-schema-spec.md](pspf-explorer-json-bundle-schema-spec.md). Always preceded by an adjective in copy: *export bundle*, *import bundle*, *master bundle*. Never bare "bundle" except where the context is unambiguous.

### Posture

A summary view of overall, per-Domain, and Essential Eight assessment state plus evidence freshness signals. The Posture **brief** is the human-readable rendering of that view; the Posture **screen** is where it is edited (Explorer v0.2+ only). v0.1 ships the brief as a read-only render.

### Action

Two distinct meanings — disambiguate every time:

- **Action (entity)** — `ACT`, the remediation/uplift/review/investigation work item modelled in [pspf-entity-link-spec.md](pspf-entity-link-spec.md).
- **action (verb / UI affordance)** — a button or menu item. Lowercase, never abbreviated to "Action" in UI copy.

### Person, Personnel, People, Pub

The PSPF outcome that covers people is **personnel security**. The product entity is **Person** (`PER`). The product extension that authors people is **PSPF Pub** (a wordplay; the README explains it). The collection name is `roles` / `assignments` / `teams` — `personnel` and `people` MUST NOT appear as collection names in any bundle (see [pspf-invariants.md](pspf-invariants.md) § N6/N2 and Personal data exclusion below).

### Workshop

The PSPF authoring extension. Distinct from "a workshop" (an event). Always capitalised when it refers to the product.

### Explorer

The PSPF static SPA published to GitHub Pages. Always capitalised. Operates in two modes — **publication mode** (read-only, v0.1) and **local-authoring mode** (IndexedDB writes, v0.2+).

### Core, Shop, Pub

The PSPF platform extensions. Always capitalised when referring to the product. "Core" never refers to a generic kernel.

---

## Vocabulary reconciliation matrix

The same business concept is currently expressed in several state vocabularies across the spec set. This matrix is the **single source of truth** for what the user sees. Internal field names may differ for technical reasons; the **UI label column** is what every product MUST display.

### Compliance / assessment status

| Internal field | Owner spec | UI label (Workshop & Explorer) | Definition |
|---|---|---|---|
| `Requirement.assessmentStatus = not-started` | [pspf-entity-link-spec.md](pspf-entity-link-spec.md) | **Not started** | No assessor work yet recorded. Equivalent to Explorer prototype `not-set`. |
| `Requirement.assessmentStatus = in-progress` | entity spec | **In progress** | Assessor has begun but not concluded. |
| `Requirement.assessmentStatus = met` | entity spec | **Met** | Requirement satisfied; evidence attached. Equivalent to prototype `yes`. |
| `Requirement.assessmentStatus = partially-met` | entity spec | **Partially met** | Some elements satisfied; gaps remain. (No prototype equivalent; new in v1.) |
| `Requirement.assessmentStatus = not-met` | entity spec | **Not met** | Requirement not satisfied. Equivalent to prototype `no`. |
| `Requirement.assessmentStatus = not-applicable` | entity spec | **Not applicable** | Out of scope for this entity. Equivalent to prototype `not-applicable`. Excluded from compliance % numerator and denominator (E1). |
| `Requirement.assessmentStatus = under-review` | entity spec | **Under review** | Awaiting formal review. Equivalent to prototype `risk-managed` only when the review concerns a risk-acceptance decision; otherwise distinct. |
| Explorer prototype `risk-managed` | retired | **Risk-accepted** | The state where a known gap has a risk decision recorded. In v1 this is represented as `assessmentStatus = under-review` plus a linked Risk record with `decision = accepted`. |

### Effectiveness (separate axis from assessment)

| Internal field | UI label | Notes |
|---|---|---|
| `Requirement.effectiveness = effective` | **Effective** | Working as intended. |
| `Requirement.effectiveness = partial` | **Partially effective** | Working in some scopes only. |
| `Requirement.effectiveness = ineffective` | **Not effective** | Not working as intended. |
| `Requirement.effectiveness = unknown` | **Effectiveness not assessed** | Default. |

Effectiveness and assessment are independent. A requirement may be `met` and `partially effective`. The UI surfaces both as separate badges; never collapse them into one.

### Reporting readiness (ready-to-report)

| Internal field | UI label |
|---|---|
| `Requirement.reportingReadiness = draft` | **Draft** |
| `Requirement.reportingReadiness = needs-review` | **Needs review** |
| `Requirement.reportingReadiness = ready` | **Ready to report** |
| `Requirement.reportingReadiness = blocked` | **Blocked** |

### Direction response

Per E6 the set is exactly `{not-set, yes, no, risk-managed}`. UI labels:

| Internal | UI label |
|---|---|
| `not-set` | **No response yet** |
| `yes` | **Responding** |
| `no` | **Not responding** |
| `risk-managed` | **Risk-accepted** |

`not-applicable` MUST NOT appear here.

### Action status

| Internal | UI label |
|---|---|
| `todo` | **To do** |
| `in-progress` | **In progress** |
| `blocked` | **Blocked** |
| `done` | **Done** |
| `cancelled` | **Cancelled** |

Overdue is a derived flag, not a status (E4).

### Risk status / band

Status: `open` / `monitored` / `closed` → **Open** / **Monitored** / **Closed**.

Band (derived from `likelihood × impact`, E5): **Low** (<5), **Medium** (5–9), **High** (10–15), **Extreme** (≥16).

### Evidence freshness

| Internal | UI label |
|---|---|
| `current` | **Current** |
| `aging` | **Ageing** (note AU spelling) |
| `stale` | **Stale** |
| `expired` | **Expired** |
| `unknown` | **Freshness unknown** |

The "old / incomplete / changed / unverified / missing / unlinked" classification (E26) is the **review queue** taxonomy — different from freshness. Both surfaces use these labels; do not blend them.

### Status chip family (cross-cutting visual)

The design spec lists Draft / In review / Ready / Effective / Partial / Needs update / At risk / Archived. This is the **chip palette**, not a state machine — it visually maps to the labels above:

| Chip | Maps to |
|---|---|
| Draft | `reportingReadiness = draft`, `recordStatus = active` and no other state set |
| In review | `assessmentStatus = under-review` or `reportingReadiness = needs-review` |
| Ready | `reportingReadiness = ready` |
| Effective | `effectiveness = effective` |
| Partial | `effectiveness = partial` or `assessmentStatus = partially-met` |
| Needs update | `evidenceFreshness in {aging, stale}` |
| At risk | linked Risk in band ≥ High, or `effectiveness = ineffective` |
| Archived | `recordStatus = archived` |

A chip is a derived view; it never owns state. Two chips may apply to the same record (e.g. `Ready` + `Effective`).

---

## Personal data exclusion glossary

The fields listed in [pspf-invariants.md](pspf-invariants.md) § N6 — `Person.name`, `Person.email`, `Assignment.personId`, and any field whose `publication` policy is not explicitly `public` — MUST NOT appear in any bundle eligible for publication. The exporter fails closed on any disallowed field. Use:

- `Person.id` (time-stripped per N4) instead of `Person.name`/`email` in published artefacts.
- `Assignment.roleId` or `Assignment.teamId` instead of `Assignment.personId` in published artefacts.

---

## Spelling — Australian English allowlist

The following list is a sample; the canonical machine-readable list lives at `docs/lint/au-english.json` in the monorepo. The lint rule rejects the US variant in any `.md` file under `docs/` and any extracted UI string. Code identifiers are exempt.

<!-- au-english-lint:disable -->

| Use | Avoid |
|---|---|
| organisation, organisations, organisational | organization, organizations, organizational |
| optimise, optimised, optimisation | optimize, optimized, optimization |
| recognise, recognised | recognize, recognized |
| customise, customised, customisation | customize, customized, customization |
| categorise, prioritise, standardise, summarise, emphasise, analyse | categorize, prioritize, standardize, summarize, emphasize, analyze |
| behaviour, behaviours, behavioural | behavior, behaviors, behavioral |
| colour, colours, coloured | color, colors, colored |
| centre, centred | center, centered |
| labelled, labelling | labeled, labeling |
| favourite | favorite |
| grey | gray |
| defence | defense |
| licence (noun), license (verb) | license (as noun), licence (as verb) |
| programme (a body of work) | program (in this sense) |
| initialise, initialised, initialisation | initialize, initialized, initialization |
| utilise (rare; prefer "use") | utilize |
| harmonise | harmonize |
| ageing | aging |
| acknowledgement | acknowledgment |

<!-- au-english-lint:enable -->

Date format: `DD MMM YYYY` (e.g. `10 May 2026`); financial year `FY 2025–26`; currency `$AUD` or trailing ` AUD` where ambiguous; thousands `,`; decimal `.`.

---

## Term retirement list

The following terms MUST NOT appear outside historical ADRs and explicit retirement notes:

- `Hearth`, `Trail`, `Lookout`, `Skylight` (retired product names; superseded by Core, Workshop, Explorer, Shop/Pub).
- `pspf-platform`, `bundled platform VSIX` (retired packaging; superseded by ADR 0007).
- `apiMajor`, `exportVersion` (retired version axes; superseded by ADR 0008 / VR1).
- `pspfBackup`, `pspfShare`, `pspfGrcCapture`, `pspfWorkImport` as active format tags (retired; surviving as bundle `intent` and per-collection options per ADR 0009 / E7).
- `cytoscape`, `force-directed`, network-graph language for v1 Explorer (retired per ADR 0010 / E17).

---

## Change control

Adding, removing, or changing a glossary entry requires:

1. The PR that introduces or changes the term.
2. An update to the AU-English lint allowlist if spelling is involved.
3. A CI run that scans every spec for the changed term.
4. An update to [pspf-spec-consistency-index.md](pspf-spec-consistency-index.md) if the change reassigns ownership of a topic.
