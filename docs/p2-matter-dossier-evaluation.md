# P2 Matter-Dossier Evaluation

Status: **synthetic design probe implemented; design recommendations accepted 2026-10-08; P2 incomplete**
Date: 2026-10-08
Repository baseline: 1.76.0

## Scope And Hypothesis

This is the bounded checkpoint under the [grand plan](../pspf-grand-plan.md#matter-and-dossier-design-option-2026-10-08), not a new product release candidate. The owner accepted all matter-centred first-slice recommendations on 2026-10-08, recorded in the [decision register](decision-register.md#accepted-recommendations-2026-10-08) and [ADR 0102 amendment](../adr/0102-browser-first-workbench-supersedes-extensions.md#accepted-amendment-matter-centred-first-slice-2026-10-08). This accepts design direction, not evidence of reduced effort or implementation. No product version, compatibility axis, entity, field publication policy, browser route or extension capability changes.

Hypothesis: a reference-only projection over one source set can support CISO, Ops and a candidate DIDC view without duplicating current facts, converting advice into approval, hiding uncertainty or rewriting an issued account. A committee request for more information must remain distinct from a treatment decision and a verified outcome. Changes since the last review and the last issued edition must use separate baselines.

The probe tests these structural properties. It cannot establish that the model is useful, that existing canonical entities are sufficient, or that a browser workbench will reduce effort. Fixture IDs are synthetic labels, not allocated canonical ID prefixes. DIDC questions are candidate information needs, not verified committee authority.

## Run And Inspect

From the repository root:

```sh
npx pnpm@10.10.0 run evaluate:p2-matter
```

The command runs the focused Node tests, then generates `.tmp/p2-matter-dossier/report.md` and `.tmp/p2-matter-dossier/report.json`. Inputs are fixed synthetic scenarios; the runner rejects arguments and does not read workplace files, standard input or remote sources. Reports can be regenerated deterministically and are not immutable production records.

The fixed probe reports retain their pre-acceptance OPEN labels; they do not track subsequent governance decisions. The current design acceptance is recorded in ADR 0102, not inferred from or revoked by rerunning the probe. Detailed contracts and validation evidence still remain open.

Implementation: [evaluator](../scripts/lib/p2-matter-dossier.mjs), [tests](../scripts/p2-matter-dossier.test.mjs), [report runner](../scripts/evaluate-p2-matter-dossier.mjs). The command is optional evaluation tooling, not a registered release gate.

## Synthetic Scenario

One restoration concern links cyber, digital and enterprise-risk context, a proposed treatment, a paper-preparation role, contradictory test evidence, an external register pointer and unanswered questions. The wider risk owner and committee authority remain unresolved.

1. **Before:** a brief is submitted; no formal treatment decision or verified security outcome is recorded. Capture a frozen, dated candidate issued edition.
2. **Reviewed:** a newer test log still contradicts successful restoration. This becomes the separate last-review baseline, not a rewrite of the issued edition.
3. **After:** the committee requests PSPF applicability and requirements context. Add the exact follow-up question, resolver role, next step, checkpoint and evidence needed. Keep the original treatment ask open.
4. **Compare:** the review delta includes the meeting update and new question; the issue delta also includes the changed test evidence. All profiles retain the same sourced facts and uncertainty.
5. **Selective capture:** an FL-008-style supplier thread already contains its own trail. Recover its information without requiring a matter. An invitation does not prove the meeting occurred or the transition succeeded.

The report exposes exactly the agreed seven recovery types: ask, proposed action, owner, decision, status, outcome and reason for delay. Each answer carries a source ID, revision and date, including explicit unknowns. External references show when they were last checked; an unchanged pointer does not prove unchanged remote content.

## Automated Evidence

The initial focused run passed 13 tests. Coverage includes profile-invariant facts, contradictions and unknowns; sourced follow-through; independent frozen editions; distinct change baselines; revision-only and content-only changes; source removal and ordering; missing-reference rejection; no-extra-capture recovery; closed inputs and deterministic reporting.

Final runner review identified an omitted existing-thread source in the report catalogue. A regression test reproduced the omission, then passed after the source was registered. All 14 focused tests now pass, including catalogue resolution for every recovery answer, byte-identical report regeneration and argument rejection without overwriting reports.

An independent PSPF Reviewer found no defects in the evaluator and tests within their synthetic scope. This is code-review evidence, not owner acceptance or an observed walkthrough. The generated report deliberately cannot certify external review, so its independent-review prerequisite is not automatically cleared by running the command.

In-memory freezing is not durable history, backup, recovery or erasure. No production export, redaction or permission implementation is provided. Audience selection grants no access; all content is synthetic and for local inspection only.

## Owner Comparison Protocol

Use the same synthetic source contents, dates and before/after updates for all three alternatives. Do not use a preassembled report as the source for one alternative and raw material for another. Record the starting setup separately; do not treat an already-populated fixture as zero capture effort.

| Alternative       | Working arrangement                                                                      | Evidence still needed                                            |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Current workflow  | Existing mail/document/register-reference practice, represented by the synthetic sources | Setup, capture, maintenance, retrieval and briefing effort       |
| Document and list | One working document plus a follow-up list, with the same source references              | The same measures, including duplicated updates and lost context |
| Candidate dossier | Linked-source report with CISO, Ops and DIDC questions                                   | The same measures; no browser interaction or storage claim       |

1. Record initial setup, capture and briefing time and repeated input for each alternative. Prepare the same CISO, Ops and committee account from the before sources.
2. Apply the test-log update and information request. Record maintenance and revised-briefing time, duplicated edits, corrections and unresolved questions separately.
3. Recover each of the seven types. Record lookup time, answering source and revision, whether the answer is known or unknown, and whether contradictory evidence remains discoverable. Wrong answers are not successful fast retrievals.
4. Check that the submitted account remains unchanged; explain both change baselines and the next actionable follow-up without claiming treatment approval.
5. Repeat the FL-008-style thread check without requiring additional capture. Record any imposed work rather than assuming the fixture's zero additional capture operations proves a saving.
6. Record order, prior familiarity, interruptions and limitations. Test whether the adopted design adds enough value over the simpler alternative and revise it if the comparison does not support it. No effort threshold or measured saving has been established.

This protocol is not yet performed. Synthetic findings do not complete P1's workplace baseline, the Rung 0 trial, deployment permission or adoption evidence. Do not bring real workplace artefacts into this repository.

## Handoff Before A Product Candidate

The owner has adopted the thin Matter model, three initial profiles, actual issued editions, separated involvement/outcome, validated read-only bundle reference, Vite/Lit/IndexedDB starting stack, first-slice recovery and conservative parsing/matching. The bounded first workflow and Markdown output are accepted design scope. P2 still needs the owner comparison, field-level contracts and reuse boundaries, publication/history/erasure and recoverable storage design, detailed reference refresh rules, parser stability and finder-match thresholds. Browser editing, density, keyboard operation and context recovery remain unproved.

ADR 0102 now records the accepted amendment. Before product implementation, a separate accepted P3 slice ADR must finalise its contracts, allocate its release version and any axis changes, and resolve the browser release model without bumping the five frozen extensions merely to satisfy current version alignment. Register authoring remains in those extensions during P3; their retirement prerequisites are unchanged.

Fresh repository readiness checks verify regression safety of the 1.76.0 baseline. They do not turn this probe into a shipped SPA, approve P3, satisfy manual accessibility checks or authorise publication or deployment. No branch, commit, promotion, release tag or deployment is part of this checkpoint.
