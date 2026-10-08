# Decision Register

Status: active

Last reviewed: 2026-10-08 (all matter-centred first-slice recommendations accepted; repository v1.76.0).

This register records product decisions, not delivery claims. The [grand plan](../pspf-grand-plan.md) owns implementation sequencing; accepted ADRs still govern the current architecture. The [design specification](../pspf-design-spec.md) and [course-correction plan](course-correction-plan.md) carry the detailed design work.

## Product Reframe And Browser-First Direction (2026-10-05)

The product owner reports that the product works but has not made anything at work easier. The working day is meetings and email that drive action through conversation, ad hoc urgent requests for information, briefs and reports, and managing a team of security professionals, across Microsoft 365, a GRC platform, a SIEM and other tooling. Real work data can in principle be held on a work machine with appropriate controls. The owner is prepared to be radical but not rash. Governing records: [ADR 0101](../adr/0101-product-reframe-managers-three-jobs.md) and [ADR 0102](../adr/0102-browser-first-workbench-supersedes-extensions.md), accepted 2026-10-05; sequencing in the [grand plan](../pspf-grand-plan.md#product-reframe-and-browser-first-direction-2026-10-05).

The following table is the dated 2026-10-05 baseline. The [accepted 2026-10-08 recommendations](#accepted-recommendations-2026-10-08) amend the first-slice model, stack, reference approach and output scope; unverified discovery evidence is not completed by that acceptance.

| Decision               | Position as of 2026-10-05                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design centre          | Three jobs: J1 capture from conversation, J2 answer ad hoc requests fast, J3 run the team. The solo offline compliance-authoring framing is superseded as a goal; nothing built under it is deleted by this decision.                                                                 |
| Host                   | One browser single-page application replaces the five VS Code extensions as the only product surface. Navigation by job: Inbox, Ask, Work, Team, Publish. VS Code is not the design centre.                                                                                           |
| Extension fate         | Freeze at 1.76.0; build the SPA to the original spine plus Inbox and Ask; use only the SPA for a fortnight on the real register; then deprecate Marketplace listings and move packages to `packages/legacy/`. Nothing deleted before the last step.                                   |
| What carries forward   | `@pspf/contracts`, `@pspf/reference-data`, `@pspf/ism-source-library`, `@pspf/brief-renderer`, the master bundle format, IDs, link taxonomy and `publication` declarations. Writer lock, trusted-caller policy, Core command API and `.pspf/` layout do not.                          |
| Team sharing           | A requirement, not a threat. People, ownership and load are visible inside the team boundary; redaction applies to everything that leaves it. Pub's local-only rule is replaced.                                                                                                      |
| Tenant AI              | In scope on a ladder: Rung 0 publish to a SharePoint-synced folder so Microsoft 365 Copilot grounds on it (no integration code); Rung 1 declarative agent; Rung 2 Azure OpenAI in tenant. Public models via personal keys stay out. Human acceptance of every AI output.              |
| Capture model          | Copilot extracts where it runs (Teams recap, Outlook summary, or an app-supplied prompt template); the app parses deterministically into typed drafts with source excerpt and deep link; the operator accepts, merges, retypes or discards. An `AiDraft` provenance shape is defined. |
| Paused programmes      | C2–C6, O1–O3, the six-phase clean-start design and the website/brand brief are parked with reason "superseded design centre" and require a behaviour-disposition map before resumption. C0 and C1 remain complete.                                                                    |
| Governance diet        | Completed 2026-10-05: superseded records were archived under `docs/history/`; redaction, build, test and accessibility gates remain; surface-count budgets, the journey-cost ratchet and gate-integrity meta-gate were retired.                                                       |
| Atlas                  | Separate product and repository; adopted as architectural reference (single SPA, one store, small engine modules). Code is not shared until the work-side model stabilises after the first slice.                                                                                     |
| Stack                  | Open between the current Explorer stack (Vite, Lit, IndexedDB) and the Atlas stack (React, Mantine, Dexie); decided in P2 by which reaches a working Inbox sooner.                                                                                                                    |
| Discovery before build | A two-week work-friction log and a Rung 0 Copilot trial precede any code. These produce the real artefact list and tell us what deployment the organisation would permit.                                                                                                             |

### Personal Supplement: First-Trial Scope (2026-10-05)

Following the [work-friction examples and purpose clarification](work-friction-log.md), the product owner resolves the immediate operating model as follows:

- **Authority:** the workbench is the owner's personal supplement, not an authoritative organisational register, approval system or replacement for existing records. Saving a workbench record preserves the owner's account; it does not create an organisational decision or another person's commitment.
- **Understanding:** shared understanding may not be recorded. Confirmation can be sought and captured when available, but it is not a prerequisite for retaining a useful personal account. Keep recollection, interpretation, proposed work and evidenced agreement distinct; missing confirmation remains unknown.
- **Participation:** the owner is the operator for now. Other people's updates continue through email, Teams and existing channels; the owner captures or links relevant updates. No colleague login, direct editing, collaborative store or automatic channel ingestion is required for the first trial.
- **Success:** the immediate test is the owner's situational awareness and ability to evidence their work: recover what was requested, what they advised or delivered, what changed, what is waiting and what outcome is known, with sources and limitations, at acceptable maintenance effort. Team adoption or cultural change is not a first-trial exit criterion.

Design consequence: favour capture, contextual links, a personal follow-up view, dated history and source-backed answers. Confirmation is optional evidence, not a compulsory workflow. A future Team view can initially support the owner's view of team dependencies without requiring team participation. Organisation-approved storage, publication controls and review of sensitive outputs still apply; "personal" does not mean permission to store workplace data on a personal machine.

This narrows the first trial, not the accepted long-term direction: team sharing remains a requirement under ADR 0101, while collaborative updates are not required now. It does not amend the staged retirement, publish-to-folder scope or discovery prerequisites in ADR 0102 and the grand plan, and allocates no implementation, version or schema change.

### Friction-Led Design Decisions (2026-10-06)

Following [FL-006 to FL-008, the owner's synthesis and the Copilot recovery observation](work-friction-log.md#owner-observation-copilot-over-existing-mail-does-not-recover-the-trail), the product owner agrees the following positions. They refine ADR 0102 D2 and are to be carried into the P2 confirmation or amendment of ADR 0102 and the P3 slice ADR; they allocate no version, schema or implementation now.

| Decision            | Position as of 2026-10-06                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spine record        | The first slice centres on a request trail: the ask, owner, outstanding question and its decision owner, decision, status, outcome and reason for delay. Each element carries its source or is explicitly unknown. Actions, decisions and advice link to the trail rather than standing alone. Existing `commitment` and `governance-decision` contracts are candidates for reuse before adding new types. |
| Draft types         | Add Advice (or Recommendation) and an open question awaiting a named decision owner. Decision is reserved for an evidenced decision. Advice is never presented as approval in any view or published artefact.                                                                                                                                                                                              |
| Status semantics    | The owner's involvement and the outcome are tracked separately. "Unknown" and "no response recorded" are explicit values. There is no single completion status; a Completed mail folder or submitted paper is not an outcome.                                                                                                                                                                              |
| External references | Decisions, status and outcomes held in ADO, Planner, the GRC platform or SharePoint are recorded as pointers to the authoritative record, not copies. The reference field defaults to `sensitive`; its schema and publication policy are set in the slice ADR.                                                                                                                                             |
| People outside team | Owners, nominees and decision owners outside the team are recorded as roles or organisational units by default; names are optional, stay inside the team boundary and are never published.                                                                                                                                                                                                                 |
| Measure             | The seven information types (ask, proposed action, owner, decision, status, outcome, reason for delay) are the recovery measure: lookup time and answering source for each, taken on FL-006 and FL-007 in P1 and repeated at P3 exit. This replaces the general J1/J2 effort comparison.                                                                                                                   |
| Capture selectivity | Capture is chosen per thread; threads that already carry their own trail (FL-008) need no capture. No bulk mailbox or channel ingestion.                                                                                                                                                                                                                                                                   |
| AI inference        | Copilot output that infers rather than cites remains a labelled inference with provenance; it never fills an unknown or becomes a sourced fact without the owner's acceptance against a source.                                                                                                                                                                                                            |

### First-Slice Anchor: Trail-First, Register As Reference (2026-10-06)

The product owner chooses option C. Context supplied: the owner maintains a PSPF register and makes most changes personally; the product gives the owner an independent view, so PSPF remains important. Almost every ad hoc question needs more detail than a simple lookup, and very few requests are simple or predictable. Snapshots and bundles are currently used only by the owner. Starting fresh with no imports is acceptable.

- **First-slice proof:** P3 is proven on request trails captured from now on. The trail store starts empty; no existing records are migrated into it.
- **Register's role in P3:** reference, not authoring. Trails link to requirements and risks, and Ask draws on posture and requirement detail when composing an answer. The owner accepted a validated master-bundle export as the read-only source on 2026-10-08; detailed refresh and historical-reference rules remain to be finalised in P2.
- **Ask's emphasis:** because requests are rarely simple or repeatable, Ask's value is assembling trail, posture and requirement context quickly into a brief the owner edits, not replaying a saved answer. Saving the question and answer remains useful as a record of what was said, not as the primary speed mechanism.
- **Register authoring:** continues in the frozen extensions during P3. ADR 0102 D8(ii) spine parity remains the retirement prerequisite, because the owner still performs this job; D8(iii) "use only the SPA for a fortnight" applies once authoring parity exists. Whether the register is then migrated or re-authored is decided at that point.
- **Snapshots and bundles:** single-user artefacts for now; no compatibility work for other consumers is required in P3, and publication controls still apply to anything leaving the owner's workspace.

### Design Option: Matter Dossiers And Audience Profiles (2026-10-08)

Status: **accepted design direction and bounded first-slice scope, 2026-10-08; implementation entry conditions remain open**. After reviewing the recommendations, the owner agreed with all of them and requested that they be recorded in the plan and ADRs. The [dated ADR 0102 amendment](../adr/0102-browser-first-workbench-supersedes-extensions.md#accepted-amendment-matter-centred-first-slice-2026-10-08) governs this acceptance. It develops the trail-first option against FL-009 and FL-002 without claiming that P1/P2 validation or a release is complete.

#### Accepted Recommendations (2026-10-08)

1. **Organise by thin Matter:** concern, scope, intended outcome, personal follow-up state and references. Assemble dossiers from shared linked facts, not duplicate risks, actions or authoritative approvals. Keep selective/no-extra-capture practice.
2. **Start with three profiles:** CISO, Ops and one committee profile, with shared contradictions and unknowns. Profiles change questions and emphasis, not permissions or committee authority. DIDC is the initial synthetic example; verify its real remit. Defer a general-purpose profile designer.
3. **Preserve actual issued editions:** reviewed text including edits, audience, occasion, issue date and source revisions. Corrections create a new edition; separate review/issue change baselines flag narrative. Redaction and erasure requirements remain.
4. **Separate involvement from disposition and outcome:** submitted is not approved; more information requested is not a treatment decision. Keep unknown ownership, outcome and delay reasons visible. Personal capture does not require others' confirmation or create organisational authority.
5. **Read a validated master-bundle export as register reference:** record version/date, link records and refresh explicitly without rewriting history. No migration, live Core bridge or second editable register; register authoring remains in frozen extensions.
6. **Select Vite/Lit/IndexedDB as the starting stack:** reuse browser foundations and shared packages, not old entity-first navigation. Reconsider a React/Mantine rewrite only with a demonstrated advantage in reaching usable capture. Comparative speed is unmeasured; Atlas remains separate.
7. **Require recovery in the first slice:** persisted drafts separate from explicit Save, restored selection/context/unfinished text, validated backup/restore and safe interrupted/failed saves. Browser-local storage is not a backup or workplace approval.
8. **Use conservative parsing and matching:** small explicit input format, unsupported text retained as a note, preserved provenance, exact IDs before fuzzy titles, and confirmed changes/merges. Parser/matching thresholds still require examples and evidence before UI commitment.

The accepted first workflow is **capture -> matter link -> sourced answer -> reviewed brief edition -> response -> next step**, including the three profiles, read-only register context, recovery/backup and controlled Markdown publish-to-folder. Word, CSV and the wider publishing suite are deferred, not removed. Record Save is separate from explicit reviewed issue/publication; default-deny controls apply to copy/export and profiles cannot grant disclosure.

Defer collaborative editing, Graph, in-app AI, a VS Code companion, broad committee tooling and Shop/Assurance expansion. Retain long-term team sharing, the tenant-AI approval ladder and extension retirement prerequisites. No paused programme resumes. Before allocating a release, approve the detailed slice contracts and resolve browser release sequencing independently of frozen extension versions. This is owner acceptance of design, not evidence of usefulness, workplace permission or implementation.

#### Model And Reuse

The principle is **one matter, shared facts, different audience questions**. A matter can span several requests and meetings; one source record can support several matters without being copied.

| Concept          | Accepted design responsibility                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matter           | A small durable record identifying the concern or question, scope, intended outcome, personal follow-up state and links. It is not another risk, action or authoritative approval register.                                                              |
| Dossier          | A derived view assembling the matter's linked records, chronology, current position and uncertainties. It is not a separate store of those facts.                                                                                                        |
| Audience profile | The questions, relevant detail, explanation and readiness checks appropriate to a role or committee. It changes presentation, not facts, access permissions or decision authority.                                                                       |
| Issued brief     | A reviewed, dated edition for an audience and occasion, with source references and available revision identifiers. Preserve what was actually submitted rather than regenerating it from later facts. A meeting pack may contain several dossier briefs. |

The implemented [canonical types](../packages/contracts/src/index.ts) have no first-class matter or request trail. Commitments describe intended or agreed work; governance decisions currently target commitments and strategy choices; change records describe changes. None alone represents a matter awaiting investigation, ownership or a decision. A thin Matter is now the accepted organising unit, but reuse boundaries and its field-level contract still need design; no entity type, ID prefix or schema change is allocated here. Pub's [role records](../packages/pub/src/store.ts) and the narrative audience/revision model are useful inputs, but do not implement these profiles or authorise bringing personal data into dossiers or briefs.

#### Candidate Audience Profiles

These are the owner's proposed information needs, not verified committee mandates. Confirm committee purposes and decision rights against their terms of reference; unknown authority remains unknown. Profiles are explicitly selected, reusable views rather than separate applications or independently maintained accounts.

Only CISO, Ops and one committee profile are in the accepted first-slice design. DIDC is the initial synthetic example; Advisory, DDWG and Board remain possible later catalogue entries, not additional first-slice features.

| Profile  | Questions and emphasis                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| CISO     | Exposure, evidence, assurance basis, freshness, limitations, unverified claims and escalation needs.             |
| Ops      | Next instructions and steps, prerequisites, dependencies, expected result, completion evidence and help route.   |
| Advisory | Applicable PSPF/ISM provisions and versions, interpretation, advice, scope, conditions and limitations.          |
| DIDC     | Risk oversight, enterprise-risk relationships, treatment, escalation and decisions within the committee's remit. |
| DDWG     | Delivery status, planned versus completed work, dependencies, delivery risks and resource decisions.             |
| Board    | Material decisions already made or now required, options, consequences, rationale and remaining uncertainty.     |

All profiles retain relevant contradictory evidence and distinguish advice, agreement, approval, delivery and observed outcome. The owner's involvement and the wider outcome remain separate. A person can use several profiles without changing their access rights. The first trial remains owner-operated; profiles require neither colleague accounts nor committee adoption.

#### Working Experience And Follow-Through

- **Selective capture and contextual work:** capture or link only what improves recovery. Keep a persistent matter list, working document and optional evidence inspector, with recoverable drafts and explicit record Save. Today, Matters and Briefs, with global Capture and Ask, is a navigation candidate to compare with ADR 0102's five places, not an adopted replacement.
- **Source-backed answers:** assemble editable answers from the dossier and read-only register context. Show sources, dates, contradictions and missing facts; help formulate an exact follow-up question where the answer is unknown. Any AI output remains draft-and-confirm with provenance, never evidence by itself.
- **Prepare for the occasion:** distinguish information, discussion and decision items. Apply the audience's checks for the precise ask, decision-maker, options, consultation, evidence and unresolved assumptions. Missing information is visible but does not prevent personal capture or become an invented fact.
- **Issue from shared facts:** prepare the audience brief and, where useful, a technical annex from the same accepted account. Review the output and apply publication controls before issue. The retained issued edition is an intentional historical record, not a competing source of current status; it must not silently change when the live dossier changes. Issued artefacts and their history remain subject to existing redaction and erasure controls.
- **Follow through after the meeting:** link the authoritative disposition and resulting work, or record that no decision or outcome is known. More information requested, deferred, decided and no decision recorded are distinct. Submission, attendance, silence and completion of the owner's part do not establish approval or success.
- **Make obstacles actionable:** expose the exact unanswered question or prerequisite, who can resolve it if known, what can proceed meanwhile, the next follow-up or checkpoint, and the evidence needed to establish resolution. Reuse linked questions, actions and dependencies before introducing another record type. Do not infer delay reasons or turn the view into individual performance scoring.
- **Show meaningful change:** distinguish changes since the operator's last review from changes since the last issued brief. Identify affected asks, evidence, advice, ownership, decisions and next steps, and flag dependent narrative for review. Show the last checked date for external references; a pointer alone does not detect remote changes. Preserve earlier accounts and corrections.
- **Support delivery and handover:** reuse the dossier's evidence, recommendations, intended outcomes, next steps, expected results, help routes and checkpoints in delivery or handover briefs, including unresolved questions. This preserves the positive practice in the friction log without requiring another reporting routine.

#### Next Design Check

Use one explicitly synthetic matter across CISO, Ops and a committee profile, before and after a meeting that asks for more information rather than deciding. Show that linked facts remain coherent, the issued brief stays unchanged, the new request and next step are recoverable, and unknowns remain visible. Compare the seven information types and total capture, maintenance, retrieval and briefing effort with the current workflow and a simple document-and-list alternative. Retain FL-008 as the no-extra-capture comparison. No real workplace artefacts will be requested or placed in this repository; synthetic walkthroughs do not complete P1 or demonstrate adoption.

The [P2 evaluation checkpoint](p2-matter-dossier-evaluation.md) provides an executable synthetic probe and the pending owner comparison protocol. The owner accepted the model and recommendations separately from the automated evidence; the comparison remains unperformed. The starting stack and read-only source approach are selected, while detailed contracts, parser/finder thresholds, refresh/recovery behaviour and publication/history controls remain open.

Before implementation, P2 must finalise the minimum field-level Matter/profile contracts and reuse boundaries, publication, history/erasure, source refresh rules and recoverable storage; perform the owner comparison and prove parser/finder usefulness. ADR 0102 is amended; a separate accepted P3 slice ADR must allocate release version and any axis changes and resolve the browser release model. Selecting an audience never authorises additional disclosure. No compatibility axis, release version, new extension feature or paused programme is allocated or resumed here.

#### VS Code Rationale And Possible Companion

**Owner clarification (2026-10-08):** the original reason for choosing VS Code was its suitability for heavy text work and showing more information than a webpage. The owner no longer sees that distinction as a reason to retain the host. Rich editing, dense layouts, split views, keyboard navigation, search and recovery are capabilities to prove in the browser workbench, not reasons by themselves to maintain a second interface. A browser application need not inherit the layout constraints of a conventional website.

The accepted direction is **browser workbench for everyday use; defer a technical companion unless an in-editor job justifies reconsideration**. No companion is authorised and the extension retirement conditions remain unchanged.

- **During transition:** the shipped extensions continue register authoring and their existing offline workflows until ADR 0102's parity, owner trial and retirement conditions are met. This preserves current work; it does not establish a long-term need for the host, accelerate deletion or restart extension feature development.
- **Potential later contribution:** a technical user could propose versioned repository/file references and reviewed validation results for a matter, validate exchange artefacts with shared contracts, or open the related browser dossier while working with code, Git diffs or language tooling. Evaluate ordinary file workflows or a small CLI first. Text volume and screen density alone do not justify an extension, and merely wrapping the browser adds no demonstrated value.
- **Boundary:** no second matter store, duplicate committee screens or separate business rules. Browser-local IndexedDB is not a shared database that an extension can simply edit. Any exchange, stable links or host bridge needs a separately approved contract, provenance, conflict handling and publication/security controls. Nothing uploads automatically or gains access through a role profile.
- **Decision gate:** retaining a supported companion beyond the planned retirement requires an explicit amendment to ADR 0102, an evidenced technical-user job and a maintenance case. Technical validation remains distinct from management approval or assurance. A companion must not be necessary to capture, answer, brief or follow through in the browser.

### Decisions Still Open

- Field-level Matter/profile contracts and reuse, publication/history/erasure and recoverable storage design (P2).
- Detailed refresh and historical-reference rules for the selected validated read-only master-bundle source (P2).
- Owner comparison against the document-and-list alternative, browser editing/density/keyboard/recovery evidence and measured workplace baseline.
- Hosting the organisation will accept for the SPA.
- Parser stability for the small supported capture format and finder-match thresholds (P2).
- Accepted P3 slice contracts, release version/axis allocation and browser release sequencing independent of frozen extension versions.
- Rung 0 results and permission for any later tenant-AI rung; none is inferred from accepting the workbench design.

Companion, collaborative editing, broad committee tooling and Shop/Assurance expansion are deferred, not immediate P2 decisions. They return only with an evidenced need and applicable approval; long-term team sharing remains required.

### Scope Of This Decision

The accepted direction and 2026-10-08 amendment authorise the staged browser-first design and bounded matter-centred first workflow. They do not claim implementation or authorise out-of-sequence code, package, version, schema, release, deployment or data-deletion changes. The five extensions and dual-mode Explorer remain the shipped product until the staged retirement steps are complete.

## Earlier Decisions: Context-Preserving Workbench (2026-09-26, paused)

Paused 2026-10-05 under ADR 0101 D5. Premises on whole-journey design, working memory, fresh baseline and honest proof carry into ADR 0102; the one-modular-VS-Code-extension candidate is rejected there.

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

## Website, Brand And Community Design (2026-09-26, paused)

Paused 2026-10-05 under ADR 0101 D5; resumes only after an accepted ADR 0102 settles the product surface.
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
