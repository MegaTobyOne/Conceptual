# PSPF UX Improvement Ideas

Status: **working capture document** — not an authoritative spec. Ideas land here first, get discussed, and graduate into ADRs / the grand plan when accepted. Scores and gaps verified against code at v1.52.0 (2026-08-24).

## Framing

The ecosystem's UX gates measure completeness and consistency. This document tracks the next level: **judgement support** — whether each screen helps an operator compose a defensible answer to the questions they are actually asked. The core finding of the v1.52.0 review: _the data and derivations mostly exist; the judgement is never composed and stated._ Screens present ingredients; operators do the cooking.

## The judgement set

Executive questions the operator must be able to answer using only the product, in under five minutes:

| #   | Judgement                                          | Score (0–2) | Owner surfaces today                                    |
| --- | -------------------------------------------------- | ----------- | ------------------------------------------------------- |
| J1  | What is "compliant" for us, and on what basis?     | 1           | Workshop requirement workbench, continuous compliance   |
| J2  | Why should we care? (consequence chain)            | 0.5         | Workshop strategy, brief-renderer                       |
| J3  | What is blocking us, and who moves next?           | 0.5         | Workshop strategy choice cards only                     |
| J4  | When will we reach the target, and can we hold it? | 1           | Workshop posture sparkline, Explorer analytics temporal |
| J5  | What changed since I last looked / last reported?  | 1           | Explorer analytics recorded-changes table               |
| J6  | Is this supplier a risk I am carrying?             | 1           | Shop only (absent from Explorer)                        |

Supporting operator judgements (from the same review): verdict-first screens, next-action adjacency, change salience, confidence signalling, safe defaults, signal density, earned complexity, trust texture.

## Ideas backlog

### J1 — Definition and basis of "compliant"

- **Trust gradient on every status pill**: asserted → evidenced → evidenced-and-fresh. Freshness data already exists in `continuous-compliance.ts`; surface it where the status is read, not in a separate count.
- **Acceptance definition per requirement**: a short "what an assessor would accept" field, versioned so a tightened bar reads as "definition changed", not "performance dropped".
- Headline metric should carry its basis: "87% met — 40% of that evidenced and fresh".

### J2 — Consequence chain ("why care")

- **Render the chain per requirement**: direction/threat → requirement → linked risks → exposure if unmet. Links exist; no screen composes them.
- **Lead the posture brief with uncovered risk**: "N open risks have no met requirement covering them" before any percentage. brief-renderer already computes requirement-scoped risk sets.
- Candidate real use for Assurance City: consequence made spatial (uncovered-risk districts), not decoration.

### J3 — Blockers and critical path

- **Fan-in bottleneck view over the links graph**: rank unfinished actions/evidence by how many not-met requirements they gate. Pure links-table computation; no schema change.
- **Blocker classification**: waiting-on-us / supplier / funding / assessor — the executive's next move differs per class. Shop already knows the supplier half.
- **Staleness as a future blocker**: "we become less compliant on <date> when these attestations lapse."

### J4 — Trajectory ("when")

- **Burn-up by assessment state over time** from compliance events; show observed closure velocity.
- **Projection as a range with stated assumptions**, visibly coupled to J3 ("resolve top 3 blockers → Q1 instead of Q3"). Never an unqualified date.
- **Sustain line, not finish line**: model decay (evidence expiry, new requirements) so the chart defends ongoing capability, not a disbandment date.

### J5 — What changed

- **Anchor to the reader, not the calendar**: "since your last visit" (local last-seen timestamp) and "since the last posture brief" (snapshot anchor), alongside 30/90/all.
- **Widen the event set**: risks opened/closed, evidence expired, actions slipped — today only compliance-state changes are recorded.
- **Change salience in situ**: badge changed rows in requirements/risks list views; a change table nobody visits is an archive, not an answer.
- **Roll-up narrative**: "3 improved, 1 regressed, 2 assessments went stale" as the section lead.

### J6 — Supplier risk verdict

- **Compose a per-supplier verdict card**: criticality + open linked risks + contract expiry proximity + assurance coverage in one stated judgement ("Critical supplier; 2 open high risks; contract lapses in 60 days"). All inputs already derived in Shop.
- **Surface suppliers in Explorer** (publication-policy permitting) so the review layer can answer J6 at all.
- Contract-expiry ↔ J5 tie-in: expiring contracts should appear in "what changed / what will change".

### Cross-cutting polish (from v1.52.0 review)

- Deduplicate palette titles across core/workshop ("PSPF: Import Master Bundle", "PSPF: Export Team Share Bundle").
- Marketplace icons for all five extensions (categories done; icons still missing).
- Empty / single-item / 500-item state audit per key screen; watch pill wrapping and table column collapse.
- Explorer lit-a11y ruleset into CI so accessibility gates.

## Review harness (agreed approach, built in slice S0)

1. Screenshot evidence pack per release: key screens × empty/typical/large × light/dark (Playwright).
2. Interaction-cost counts for two flagship jobs, trended per release like the perf budget.
3. Scored heuristic pass (rubric above) over ~15 key screens; low scores × screen importance = backlog order.
4. 2–3 external think-aloud sessions once the first polish wave lands.

## Implementation plan (proposed)

Eight release slices, v1.53.0 → v1.60.0. Sequencing honours the dependency chain (J1 definition → J2 consequence → J3 blockers → J4 trajectory) and the repo rule of small vertical increments that preserve the operator spine. Only one slice (S4) touches the schema axis; everything before it is pure composition over existing data. Each slice opens with its ADR per repo governance; ADR numbers assume 0087 is next free — renumber at cut time if other work lands first.

### Release mechanics checklist (applies to every slice)

1. Bump root + all 13 workspace `package.json` files to the slice version (keep alignment; `check-release-candidate` asserts it).
2. Add `e2e:vX.Y` to root `package.json`, chained to the **immediate predecessor**, and point `release:readiness` at it.
3. Create the ADR, register it in `scripts/check-adr-coverage.mjs` with its verifying gates.
4. Add the slice's gates section (with the exact version string) to `pspf-acceptance-and-quality-gates.md`.
5. Register the slice in `pspf-spec-consistency-index.md`.
6. Update `validation-scenario-1-operator-workflow.md` when the operator spine gains steps.
7. Update this document: rescore the affected judgement, add a Log entry.
8. Run `pnpm run release:readiness`; all gates green before claiming done.

`VERSION_AXES` stays at `1.14.0` for every slice except S4, which bumps `schemaVersion` to `1.15.0`.

### S0 — v1.53.0 · UX review harness + fast polish (no schema)

**Goal:** measurement exists before improvement starts; close the review's cheap gaps.

- `scripts/ux-evidence-pack.mjs` + Explorer Playwright journey specs capturing key screens × {empty, typical, 500-item} × {light, dark} into `.tmp/ux-evidence/<version>/`, with per-journey interaction-step counts written to a JSON summary (trendable like the perf budget).
- Extend `scripts/check-gate-integrity.mjs` to assert `e2e:vX.Y` chain continuity; repair the missing `e2e:v1.15` and `e2e:v1.51` links (or record explicit documented skips).
- Deduplicate cross-extension palette titles (workshop's delegating import/export commands get distinct wording, e.g. "PSPF Workshop: Import Master Bundle (via Core)").
- Marketplace `icon` for all five extensions.
- Wire Explorer's lit-a11y/unicorn lint config into `ci.yml` as a gating step.
- Baseline heuristic scoring pass over ~15 key screens recorded in this document.

**ADR 0087.** Docs: gates doc, consistency index, this doc (baseline scores). Exit: evidence pack generated in CI as an artefact; chain gate red on any future gap.

### S1 — v1.54.0 · J1a Basis and trust gradient (no schema)

**Goal:** every compliance status states its basis.

- `@pspf/contracts`: pure `assessmentBasis()` deriving `asserted | evidenced | evidenced-fresh` from existing evidence links + freshness (single shared implementation so Workshop and Explorer cannot diverge).
- Workshop requirement workbench + posture home: basis on status pills (hover/inline), headline becomes "X% met · Y% evidenced and fresh".
- Explorer requirement/requirements/posture/analytics views: same gradient, same wording.
- `brief-renderer`: basis line under the headline metric.

**ADR 0088.** Docs: design spec (trust-gradient pill pattern), glossary ("basis", "evidenced-fresh"). Exit: no headline percentage renders without its basis; J1 rescored (target 1.5).

### S2 — v1.55.0 · J2 Consequence chain (no schema)

**Goal:** any requirement can answer "why care" in one panel.

- `@pspf/contracts`: consequence-chain query over the links table (direction/threat → requirement → linked risks → exposure statement for unmet).
- Workshop requirement detail: "Consequence" section rendering the chain with linked-record navigation.
- Explorer requirement view: same section, read-only.
- `brief-renderer`: brief leads with "N open risks have no met requirement covering them" ahead of any percentage; redaction gates (`check-brief-redaction`) re-verified.
- Schedule the first external think-aloud sessions against this build.

**ADR 0089.** Docs: design spec (chain panel pattern), glossary ("consequence chain", "uncovered risk"). Exit: chain renders without manual cross-referencing; J2 rescored (target 1.5).

### S3 — v1.56.0 · J3a Blocker fan-in (no schema)

**Goal:** "what's blocking us" is a ranked, defensible list.

- `@pspf/contracts`: fan-in computation — unfinished actions/evidence ranked by count of not-met requirements they gate (pure links-table work).
- Workshop: "Blockers" board section (rank, gated-requirement count, drill-down); heuristic who-moves-next classification (supplier-linked → supplier, overdue-owned → us; explicit field deferred to S4).
- Explorer coverage/GRC view: read-only top-blockers section.
- Staleness preview: "requirements that lose evidence backing in the next 90 days" list from existing freshness dates.

**ADR 0090.** Docs: design spec (blocker board), glossary ("fan-in", "blocker class"). Exit: top blocker identifiable in ≤2 minutes in a walkthrough; J3 rescored (target 1.5).

### S4 — v1.57.0 · Schema slice — definition, events, blocker class (schemaVersion → 1.15.0)

**Goal:** the one batched schema change funding J1b, J4, J5b, J3b.

- New optional fields, every one with an explicit `publication` declaration (default-deny):
  - Requirement: `acceptanceDefinition` (text + definitionVersion history) — J1b.
  - Action: `blockerClass` (`us | supplier | funding | assessor`) — J3b.
  - Event model widened beyond compliance-state changes: risk opened/closed, evidence freshness transitions, action slipped — J4/J5 fuel.
- `schemas/explorer-bundle/1.15.0/` published; bundle spec + entity-link spec updated; migration path verified per the migration safety runbook; import compatibility (major-version rule) covered by tests.
- UI: acceptance definition visible/editable in the requirement workbench; definition-version change renders as "bar moved", not "performance dropped".

**ADR 0091** (schema axis bump gets its own ADR per prior practice). Docs: bundle schema spec, entity-link spec, security-redaction controls (new field policies), glossary, migration runbook check. Exit: round-trip Core→Explorer→Core at 1.15.0 green; J1 rescored (target 2).

### S5 — v1.58.0 · J4 Trajectory (no further schema)

**Goal:** "when" gets an honest, assumption-stated answer.

- Burn-up chart by assessment state over time from the widened event set; observed closure velocity (rolling quarter).
- Projection as a range with stated assumptions, visibly coupled to the S3 blocker list ("resolve top 3 → range shifts"); an unqualified date must not appear anywhere.
- Sustain line: decay from evidence-expiry schedule and definition changes.
- Surfaces: Workshop posture home (replacing/extending the sparkline) + Explorer analytics.

**ADR 0092.** Docs: design spec (burn-up + sustain pattern), glossary ("sustain line", "closure velocity"). Exit: J4 rescored (target 2); walkthrough passes "no unqualified date".

### S6 — v1.59.0 · J5 Reader-anchored change (no schema)

**Goal:** "what changed" answers relative to the reader, not the calendar.

- Explorer: browser-local last-visit anchor ("since your last visit") and snapshot anchor ("since the last posture brief") alongside 30/90/all.
- Change salience in situ: changed-row badges in requirements/risks list views since the active anchor.
- Roll-up narrative lead: "3 improved, 1 regressed, 2 went stale" (from the widened events).
- Workshop: same anchor concept over local state.

**ADR 0093.** Docs: design spec (change-badge pattern), glossary ("change anchor"). Exit: J5 rescored (target 2).

### S7 — v1.60.0 · J6 Supplier verdict + Explorer supplier surface (publication decision)

**Goal:** "is this supplier a risk" is a stated verdict, visible at the review layer.

- Shop: per-supplier verdict card composing criticality + open linked risks + contract-expiry proximity + assurance coverage into one sentence with drill-down (all inputs already derived).
- Explorer: supplier surface **only after** an explicit publication-policy decision in the ADR — commercial fields individually policy-declared, default-deny, `check-explorer-publication` extended to cover them.
- Contract expiry feeds the S6 change anchors ("what will change").

**ADR 0094** (includes the publication decision). Docs: security-redaction controls, bundle schema spec if supplier fields enter the bundle, design spec (verdict card), glossary. Exit: J6 rescored (target 2); redaction gates green.

### Sequencing notes

- S0 is independent and can ship immediately; S1–S3 are pure-composition slices that can compress if velocity allows, but keep one slice per release for gate hygiene.
- S4 is the only schema bump; nothing after it may add fields — anything discovered late queues for a future 1.16.0 batch.
- External think-alouds run against S2 output; findings feed rescoring and may reorder S5–S7.
- Cross-cutting polish items not absorbed above (empty/volume-state fixes found by the S0 evidence pack) ride along in whichever slice touches the owning surface.

## Log

- 2026-08-24: Document created; judgement set J1–J6 defined and scored against v1.52.0 code; initial backlog seeded from executive-questions discussion.
- 2026-08-24: Implementation plan added — slices S0–S7 (v1.53.0 → v1.60.0), single schema bump at S4 (schemaVersion 1.15.0), ADRs 0087–0094 reserved pending renumber at cut time.
- 2026-08-24: S0 shipped (ADR 0087, v1.53.0) — evidence pack harness (`packages/explorer/tests/e2e/ux-evidence-pack.spec.ts`, `scripts/ux-evidence-pack.mjs`) capturing empty/typical/volume × dark/light for 8 key routes plus two flagship-journey interaction-step counts; e2e release-chain continuity now gated (`check-gate-integrity.mjs`), historical `e2e:v1.15`/`e2e:v1.51` gaps closed; cross-extension palette titles deduplicated; Marketplace icons generated for all five extensions (`scripts/generate-extension-icons.mjs`); Explorer lint now gates in CI. Baseline judgement scores unchanged by this slice (measurement only, no composition work yet) — S1 begins the J1 basis work.
