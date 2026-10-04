# 0101 — Product reframe: the manager's three jobs

- Status: proposed
- Date: 2026-10-05
- Supersedes: the "solo offline assurance practitioner" framing in ADR 0001 and ADR 0014 as the design centre (those ADRs remain the record of what was built)

## Context

The 2026-10-05 product review compared the shipped ecosystem at v1.76.0 with the product owner's working day. The product was designed for a solo assurance practitioner who authors structured compliance records offline inside VS Code. The owner's actual job is different: meetings and emails that drive action through conversation, a steady stream of ad hoc urgent requests for information, briefs and reports, and managing a team of security professionals for maximum efficiency. Work happens across Microsoft 365 (Teams, Outlook, SharePoint), a GRC platform, a SIEM and other tooling. Real work data can in principle live in the tool on a work machine with appropriate controls.

The repository already records that the product "works well enough" but has not made the owner's work easier: "capture, updating and reporting are all draining", there are "no active users", and the 2026-09-20 review "could not demonstrate from the repository that recent work improved the operator's experience". The response to each such finding has been a further programme (C0–C6, O1–O3, a six-phase clean-start design, a website and brand brief) rather than a change of design centre. One hundred ADRs and forty-one root specifications now govern a product used by nobody.

Several load-bearing architectural choices follow directly from the superseded framing and obstruct the real jobs: the single-writer lock, Pub's "never leaves the machine" rule, the absence of any team-sharing model beyond bundle export, the deferral of Microsoft 365 and AI capability behind Tranches 0–2, and the VS Code host itself, which is not where conversation-driven work happens.

## Decision

1. **The product's jobs are the manager's three jobs.** Every later design, slice and gate is judged against them:
   - **J1 Capture from conversation.** Turn a meeting recap, email thread or note into owned, dated, linked records with near-zero typing, while retaining the source excerpt and a link back to the conversation as provenance.
   - **J2 Answer ad hoc requests fast.** From a requirement, risk, supplier, person or plain words, reach status, owner, last change, open work and evidence freshness in seconds, and produce a copyable brief in the agency's shape.
   - **J3 Run the team.** See who is carrying what, what is overdue or blocked, and prepare for a meeting from the register; share that view with the team under controls rather than hiding it.
2. **Team sharing is a requirement, not a threat to redact away.** Redaction continues to apply to anything that leaves the team boundary. Inside the team boundary, people, ownership and load are visible by design. ADR 0005 default-deny publication is unchanged; its boundary moves from "this machine" to "this team".
3. **The target deployment is a work machine inside the organisation's Microsoft 365 tenant**, with real work data under the organisation's controls. The personal-repository, personal-machine, synthetic-data setting remains the development and demonstration environment only.
4. **Tenant AI is in scope on a ladder.** Rung 0: publish artefacts where Microsoft 365 Copilot already grounds (a SharePoint library), with no integration code. Rung 1: a declarative agent over that knowledge, optionally with an action against a hosted register. Rung 2: Azure OpenAI in the tenant, called from the product. Public models via personal keys remain out of scope. ADR 0077's draft-and-confirm rule, publication-boundary prompt assembly and human acceptance of every AI output carry forward; its VS Code Language Model API provider choice and `pspf.ai.enabled` mechanics are specific to the superseded host and will be re-decided under ADR 0102.
5. **Pause the C2–C6 and O1–O3 programmes, the six-phase clean-start design and the website and brand brief.** Each is parked with the written reason "superseded design centre" and a single resumption gate: an accepted ADR 0102 that maps the required behaviour to a destination in the new direction, or records that it is no longer required. C0 and C1 remain complete and their evidence remains valid. No slice is marked complete by this pause.
6. **Replace the planned programmes with a short discovery sequence**, recorded in `pspf-grand-plan.md` §"Product reframe and browser-first direction (2026-10-05)": a two-week work-friction log at the owner's workplace, a Rung 0 Copilot grounding trial using existing exports, a timeboxed architecture decision (ADR 0102), then one thin vertical slice.
7. **Governance diet.** Specifications and ADRs that describe the superseded embodiment are retained as history and will be moved under `docs/history/` once ADR 0102 is accepted. Gates for redaction, build, test and accessibility stay. Surface-budget, journey-cost and meta-gates are retired unless the friction log shows they answer a question the owner actually asks.

This ADR changes no code, package, version, schema, bundle, API or gate. `schemaVersion`, `bundleVersion` and `apiVersion` are unchanged.

## Consequences

- The product has, for the first time, a design centre drawn from the owner's recorded working day rather than from a compliance model.
- Roughly fifty deferred items, the Commitment-led operating model Phases 3–7 and the Risk-to-Outcome O1–O3 programme stop competing for attention; their underlying needs are re-tested against J1–J3 in ADR 0102 rather than inherited.
- The master bundle, entity IDs, link taxonomy, `publication` declarations, reference data, ISM source library and brief renderer are host-agnostic and are the assets carried forward.
- Real work data in the tool depends on the owner's organisation accepting the deployment. The friction log therefore also records what the owner can plausibly be permitted to run.
- Documentation describing the five-extension product remains truthful about the shipped state until ADR 0102 is accepted and the extensions are formally frozen.

## Alternatives considered

- **Continue C2–C6 then O1–O3 as planned.** Rejected: both optimise a product for a user who does not exist, and five further releases would pass before the owner's actual jobs were addressed.
- **Treat the jobs as additional requirements layered on the existing framing.** Rejected: the single-writer, local-only-people and no-network constraints are not compatible with J1–J3; layering would preserve the obstacles.
- **Archive the repository and start again.** Rejected as rash: the contracts, reference data, redaction model and Explorer local-authoring store are reusable, and the owner's register exists in the current bundle format.
- **Field test the current product first without changing the framing.** Rejected as the sole response because the host mismatch is already evident from the owner's account of the working day; a friction log is retained as the discovery input, not as a decision gate for the reframe.
