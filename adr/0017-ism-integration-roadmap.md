# 0017 — ISM integration roadmap

- Status: accepted
- Date: 2026-05-11

## Context

PSPF (the Protective Security Policy Framework, administered by the Department of Home Affairs) and the **Information Security Manual** (ISM, maintained by ASD/ACSC) are complementary but distinct:

- **PSPF** sets the assurance outcomes the Australian Government expects an entity to demonstrate.
- **ISM** is the implementation control catalogue cyber teams use to deliver and evidence those outcomes.

Operators routinely answer the question *"which ISM controls implement this PSPF requirement?"* and the inverse *"if my ISM posture changed, which PSPF requirements are affected?"*. Today the product has no model for either side.

ASD publishes the ISM as a machine-readable OSCAL catalogue at <https://github.com/AustralianCyberSecurityCentre/ism-oscal> (the Australian Cyber Security Centre's repository), with the human-readable form at <https://www.cyber.gov.au/ism>. The OSCAL catalogue is released roughly quarterly (the current release at the time of this ADR is `v2026.03.24` — the March 2026 ISM). Each release ships:

- a master `ISM_catalog.{json,xml,yaml}` containing every ISM control, and
- resolved profile catalogues for the published baselines: Essential Eight ML1/ML2/ML3, Non-classified, OFFICIAL: Sensitive, PROTECTED, SECRET, and TOP SECRET.

The licence is CC BY 4.0, which permits redistribution with attribution.

The v0.1 thin slice (ADR 0014) is frozen at four authored entity types (Requirement, Evidence, Action, Risk), a 22-verb closed link taxonomy (ADR 0003), default-deny per-field publication (ADR 0005), UUIDv7 IDs with time-stripping at the publication boundary (ADR 0002), and zero network egress at runtime. Any ISM model has to fit those constraints or earn its own ADR.

## Decision

Treat ISM as a **distinct external control catalogue** that PSPF Requirements reference, not as a second class of PSPF Requirement. Introduce it in phases, with each phase fitting the existing locked decisions.

### Phase 0 — v0.1 (no model change)

- The v0.1 entity set, link taxonomy, and bundle schema do **not** change.
- ISM references, where operators want them today, are recorded as free text in `Evidence.reference`, `Action.notes`, or `Risk.notes`. They are not first-class data.
- The Workshop and Explorer Item Detail surfaces MAY render an "ISM references (free text)" hint, but no parsing, validation, or linking happens.
- The glossary defines ISM, ISM control, ISM profile, ISM baseline, and OSCAL so terminology is pinned ahead of Phase 1.

### Phase 1 — v0.1.x or v0.2 read-only ISM Source Library

- Introduce a **read-only ISM source-control catalogue** loaded from a vendored ISM OSCAL snapshot under `packages/ism-source-library/data/<oscalRelease>/`. The release tag (for example `v2026.03.24`), catalog filename, and profile filename travel with each record as provenance.
- Each ISM control becomes a `source-control` entity using the already-reserved `SRC` prefix (see [pspf-entity-link-spec.md](pspf-entity-link-spec.md) § Prefix registry). The canonical ID is `SRC-<UUIDv7>` (time-stripped on publication per ADR 0002) with an `externalRefs` array carrying the natural ISM identifier and OSCAL UUID for round-tripping back to ASD.
- The catalogue is read-only: the Workshop UI offers no edit affordance for `SRC-*` records; updates only arrive by replacing the vendored snapshot via an explicit operator command. No network fetch at runtime; the zero-egress invariant (E1, ADR 0011) is preserved.
- ISM records carry their own publication policy. `SourceControl.controlId`, `SourceControl.title`, and `SourceControl.profileTags` default to `public` (the ASD catalogue is itself public under CC BY 4.0). `SourceControl.localApplicabilityNote` defaults to `sensitive` because it is an operator interpretation.
- Bundle schema gains a `source-controls` collection; `bundleVersion` rolls forward; `schemaVersion` rolls forward only if Phase 1 ships in the same release that introduces Phase 2.

### Phase 2 — v0.2 explicit Requirement ↔ ISM mapping

- Introduce a `requirement-control-mapping` entity (prefix to be chosen in the Phase 2 ADR; candidates: `MAP` or reuse `LNK` if a `Link` of new linkType is sufficient).
- A mapping is **first-class**: it carries `rationale`, `coverageQualifier` (`primary`, `partial`, `compensating`), `applicabilityProfile` (the ISM profile the mapping is asserted against — for example `e8-ml2` or `official-sensitive`), and provenance.
- The closed 22-verb link taxonomy (ADR 0003) is reviewed before Phase 2 ships. Existing verbs are insufficient because the mapping carries its own attributes; a `Link` row would lose them. Either:
  - extend the link taxonomy with a `mapped-to` verb plus a sidecar mapping record, or
  - model the mapping as its own entity with two outbound `supports` and `addressed-by` links.
  The decision belongs in the Phase 2 ADR, not here.
- Mapping `rationale` defaults to `sensitive` publication policy; mapping endpoints and `coverageQualifier` default to `internal` so coverage statistics can roll into the posture brief without leaking interpretive copy.
- The posture brief gains an "ISM coverage" section that is derived from mappings; no claim appears unless it traces to a mapping record (consistent with E27).

### Phase 3 — v0.3+ mapping quality and version drift

- Add `confidence`, `lastReviewedAt`, and `reviewBy` fields to the mapping entity.
- Add an automated harness that detects when the vendored ISM OSCAL release tag changes and flags mappings whose underlying ISM control text changed (version drift).
- Optional: an ISM profile picker on the Posture screen so the operator can ask "what is my coverage against the OFFICIAL: Sensitive baseline today?".

### Cross-cutting constraints (all phases)

1. **No network egress at runtime.** ISM OSCAL files are vendored; updates are an explicit operator command, never an auto-fetch.
2. **No model change without an ADR.** Phase 1 needs its own ADR before implementation; Phase 2 needs its own ADR; Phase 3 likely needs one too.
3. **Default-deny publication still applies.** Every new field declares a `publication` policy. CI gates from [pspf-security-redaction-controls.md](../pspf-security-redaction-controls.md) reject missing policy.
4. **AU English in user-facing copy** (ADR 0016). The vendored ISM text remains in its source form (ISM is itself Australian English).
5. **OFFICIAL: Sensitive labelling-only** (ADR 0011). Mapping rationale and any operator interpretation are treated as `sensitive` at minimum.
6. **CC BY 4.0 attribution.** Any product surface that displays vendored ISM text shows attribution to ASD/ACSC; the Phase 1 ADR fixes the wording.

## Consequences

### Positive

- The v0.1 release is unaffected — no scope creep into an already-frozen thin slice.
- Phase 1 delivers a tangible artefact (an ISM source library that practitioners can browse in Explorer) without the design weight of a full mapping model.
- Mapping arrives only when v0.1 has been validated, so it can react to real operator feedback instead of speculative shape.
- Provenance carrying the ASD OSCAL release tag makes ISM updates auditable and reversible.

### Negative / accepted trade-offs

- Operators who want explicit PSPF↔ISM mapping today must wait. v0.1 free-text ISM references are explicitly second-class.
- The closed link taxonomy will probably need an extension in Phase 2, which is a non-trivial coordinated change across [pspf-entity-link-spec.md](../pspf-entity-link-spec.md), [pspf-invariants.md](../pspf-invariants.md), and the Explorer bundle schema. The Phase 2 ADR is the place to do that work, not this one.
- Vendoring the OSCAL snapshot means the product ships a bit of ASD-maintained content. Licence (CC BY 4.0) permits this; the README and Explorer About surface carry the attribution.

## Alternatives considered

- **Model ISM controls as a second kind of PSPF Requirement.** Rejected: it conflates assurance outcome with implementation control, breaks the PSPF Domain primary navigation (ADR 0016), and forces ISM into the closed 22-verb link taxonomy without the attributes (`coverageQualifier`, `applicabilityProfile`) the mapping actually needs.
- **Skip Phase 1 and jump straight to mapping in v0.2.** Rejected: without a navigable ISM source library, mappings have no UI to attach to and no provenance discipline. Phase 1 is the cheap, useful precursor.
- **Fetch ISM OSCAL at runtime from cyber.gov.au or GitHub.** Rejected: violates the zero-egress invariant (E1) and would couple Explorer publication mode to an external service.
- **Allow ISM mappings as free-form notes indefinitely.** Rejected: defeats the entire point of a defensible assurance product — ISM coverage claims must be traceable to backing records (E27).
