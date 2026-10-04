# Decision Register

Status: active

Last reviewed: 2026-09-26 against repository v1.76.0.

This register records product decisions, not delivery claims. The [grand plan](../pspf-grand-plan.md) owns implementation sequencing; accepted ADRs still govern the current architecture. The [design specification](../pspf-design-spec.md) and [course-correction plan](course-correction-plan.md) carry the detailed design work.

## Current Decisions: Context-Preserving Workbench

The product owner reports that capture, updating and reporting are all draining. Losing the selected record, working context or unfinished input causes cognitive shock. Substantial workflow, interface and visual redesign is in scope for design and planning now.

| Decision                | Position as of 2026-09-26                                                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product purpose         | Help a cyber security manager protect the organisation by connecting business outcomes, risks or known issues, treatment work, evidence and reviewed decisions. Compliance and reporting support that purpose.                                                                                |
| Design scope            | Reconsider navigation, layout, visual hierarchy, density, controls and transitions alongside the workflow. Compare a persistent workbench-first concept with an outcome-first concept using the same jobs.                                                                                    |
| Continuity              | Preserve the task, filters, selection, scroll, focus, related-item return path and unfinished input. Make interruption and recovery explicit acceptance journeys.                                                                                                                             |
| Saving                  | Recover local drafts across closing and restarting; an explicit Save changes authoritative records. Draft recovery is not record autosave, plan admission, risk acceptance or publication.                                                                                                    |
| Fresh baseline          | There are no active users. Legacy-data retention, old-install coexistence, preference transfer and migration are not required design work. This does not authorise deleting current data or removing protection for future work.                                                              |
| Extension consolidation | One coherent workbench, potentially delivered as one modular VS Code extension, is the preferred candidate to evaluate. Include Shop, Assurance and organisational capabilities; do not simply combine five existing Home screens. The packaging decision is not yet accepted or implemented. |
| Engine reuse            | Retain useful Core write, validation, risk, evidence and reporting mechanisms; fix known meaning gaps before relying on them. Internal module and privacy boundaries remain valuable even if packaging changes.                                                                               |
| Desktop and browser     | Reconsider their jobs rather than assuming desktop must be complex and browser limited. Explorer currently supports publication review and browser-local authoring; no capability retirement, live Core bridge or new publication permission is decided here.                                 |
| Progress                | Keep delivery, observed effectiveness, reviewed risk and business consequence separate. Completed Actions, current documents and priority weights do not prove risk reduction.                                                                                                                |
| Evidence of usefulness  | Start with product-owner walkthroughs on representative records, including interruption, failed Save and restart. Label these separately from simulated checks and future target-user research.                                                                                               |

### Design Decisions Still Open

- Select the primary interface concept and the precise desktop/browser scope.
- Confirm one installed extension versus one visible workbench over separate extensions, including the internal module and activation boundaries.
- Decide the workspace-local draft store, conflict handling and cleanup/recovery policy; sensitive drafts must not leak through generic preferences, logs, snapshots or publication.
- Define the missing justified-work and treatment-effect contracts by reusing existing records before adding any new ones.
- Reconcile later roadmap work with the selected design, explicitly superseding obsolete requirements rather than completing them solely for legacy compatibility.

### Scope Of This Decision

The immediate authorisation is documentation, detailed design and planning only. Five separately packaged extensions and the existing Explorer remain the current implementation. No code, package identity, version, schema, storage, gate, release or data-deletion change is authorised. Current C1/C2 prerequisites remain in force until the grand plan and governing ADRs explicitly adopt a revised implementation sequence.

Local-first operation, Workspace Trust, default-deny publication, restricted-person exclusion, atomic saves and recoverable failure remain requirements for the new baseline. Fewer installations or screens are not evidence of usability or stronger security by themselves.

## Website, Brand And Community Design (2026-09-26)

This extends the design discussion to the ecosystem website and public product story. It records scope and recommendations, not a website implementation, rename or community launch. The [website and brand brief](../pspf-design-spec.md#website-brand-and-community-design-brief) owns the proposed experience; the [design plan](course-correction-plan.md) owns the next steps.

### Confirmed Boundaries

- Atlas remains a related but separate product in a separate repository at `https://home.tobyharvey.online`. It is not a PSPF module or the parent application. No Atlas changes or shared account/data architecture are in scope.
- Explorer remains a useful capability to retain in the design. Its current publication-review and browser-local-authoring roles should inform a clear hands-on entry point, not be hidden by a packaging discussion. Its exact future scope remains a design decision.
- Discuss the new product description, community-friendly web presence and consistent brand/theme now; update planning documents only. Do not change the ecosystem HTML, application code, package metadata, domains or deployments in this follow-up.

### Recommended Direction For Review

- Evolve the ecosystem page from a catalogue of extensions into a product-and-practice home: understand the purpose, try a clearly labelled synthetic example in Explorer, learn a workflow, follow progress and give feedback. Keep architecture and package details available as secondary material.
- Use one product identity across the website, Explorer, workbench, documentation and generated public material, while adapting density and controls to each task. Consistency means shared terminology, visual tokens, status meaning and interaction expectations, not identical page layouts or forcing a theme over VS Code preferences.
- Keep Atlas's own name and identity, with an explicitly labelled related-project link rather than ambiguous "home" navigation. Shared authorship may be acknowledged without implying one product or repository.
- Consider a distinctive product name with PSPF/ISM described as supported context; retain the current name as an option. No new name, logo, domain or package identity has been chosen, and the independent-project notice remains essential.
- Begin community participation with useful guides, synthetic examples, an honest roadmap/changelog and a maintained feedback/contribution path. Do not imply an active community or public repository access that does not exist.

### Website Decisions Still Open

Select the public name and visual direction; confirm the primary audience and homepage entry actions; choose the scope of a synthetic Explorer example; and decide which feedback/contribution channels can be operated safely. A public forum, account system, uploads, analytics, mailing list, repository visibility change or cross-product integration is not authorised. Decide channel ownership, moderation, privacy, source attribution and private vulnerability reporting before any community service is launched.

## Earlier Compliance-Uplift Decisions

The following records preserve the earlier discussion. Their framing, sequence and next-slice wording are historical; they do not narrow the current design remit or claim delivery of the standard mitigation library.

### 1. Product framing

Decision: Explorer and the adjacent Workshop workflow are a compliance uplift tool, not only a static reporting surface.

Reasoning:

- The user feedback points to an existing effective review flow but a missing bridge from assessment to action.
- The product value is strongest when it supports decision-making, evidence capture, mitigation guidance, and forward work planning.
- The framings “compliance uplift”, “assurance uplift”, and “remediation workflow” are all valid, but the consistent core is: turn assessment outcomes into action.

### 2. Standard mitigation guidance

Decision: add standard mitigation guidance.

Reasoning:

- Users need more than a status field; they need guidance on what a defensible mitigation looks like.
- Standardisation helps keep the output consistent across the operating model.
- Mitigation wording can be templated and then adjusted, rather than forcing users to start from a blank screen.

### 3. Assisted action generation

Decision: add assisted action generation from unresolved or risk-managed items.

Reasoning:

- The current gap is the step between “requirement is recorded” and “work is planned”.
- A draft action should be created in context, with impact, owner, and next-step suggestions.
- The user remains in control: review, edit, accept, or reject before the action becomes active work.

### 4. Simplify after proving the pattern

Decision: start with assisted generation and simplify later once the pattern is proven.

Reasoning:

- Over-automation risks making the tool feel prescriptive or too much like a project tracker.
- The product should feel like an assurance-to-action workflow, not a separate project tool.
- We need a clean proof point before reducing user effort further.

### 5. Primary product value

Decision: the main value is not reporting; it is uplift planning.

Reasoning:

- The user’s strongest request is for a clear line from requirement outcome to intervention and forward work plan.
- Reporting is important, but it is only the output layer of the real workflow.
- The product should help answer “what do we do next?” with more clarity than “what is the current status?”.

## Working principles

- Decision quality matters more than raw data entry volume.
- Evidence and rationale are mandatory for higher-risk or non-compliant outcomes.
- Standard mitigation should be suggested, not enforced.
- Assisted actions should reduce effort without removing operator judgement.
- The requirement detail view is the main decision surface.
- The annual uplift cycle should be visible in the product as a forward planning view, not hidden in separate reporting artefacts.

## Next-slice scope

### In scope

- requirement decision clarity
- evidence and rationale capture
- standard mitigation suggestions
- assisted action generation
- impact summary and prioritisation
- work-plan linkage for the next review cycle

### Out of scope for now

- full PM automation
- predictive analytics
- AI-generated plans without human review
- creating a separate project-management surface

## Working agenda for the next few days

1. Validate the existing requirement flow and identify where users lose momentum.
2. Finalise the core decision states and required rationale/evidence fields.
3. Prototype mitigation suggestions for common control gaps.
4. Test assisted action generation on real requirement examples.
5. Agree the minimum outputs required for a credible forward work plan.
6. Simplify the workflow once the pattern is proven.

## Open questions

- Which status states are mandatory and which are optional?
- What is the minimum field set for a defensible decision?
- Which controls or requirement families need standard mitigations first?
- What should a draft action include before it is accepted?
- What is the simplest executive summary that still supports leadership decisions?

## Ownership

This register is a working product record and should be reviewed every iteration with the current product direction and the latest user feedback.
