# Work Friction Log

Status: conversation-led qualitative round closed 2026-10-08; not a measured baseline or completion of P1
Started: 2026-10-05

This log supports P1 in the [grand plan](../pspf-grand-plan.md#discovery-sequence-replaces-c2c6-and-o1o3-while-paused) and the three jobs in [ADR 0101](../adr/0101-product-reframe-managers-three-jobs.md). It records the product owner's experience, not accepted requirements or delivery claims. A general account of a working day is not a completed two-week baseline, a measured incident or evidence of deployment permission.

## FL-001: Triage Without A Reliable Follow-Up Loop

Recorded: 2026-10-05. Source: product owner's account in conversation. Observation dates, counts and elapsed times: not supplied.

### Owner's Account

> Ok, what do i do each day? Get to work. Read emails. Mark and Archive all the ones I don't have to do anything more about, then apply categories and markers to the stuff that really needs my attention, either high priority or review or action. And... then go through and review and update calendar schedules. And from there, it's into meetings, talk to people. Have discussions about stuff, get asked questions, provide advice. Provide recommendations, and then repeat the next day, With very little follow up or ability to track the outcomes of discussions and whether people are listening, acting, or whether I'm just speaking into the breeze. Within those emails, are questions, requests and actions, all jumbled up together and seemingly without any central co-ordination

### Reported Workflow

| Stage            | Current activity                                                                                                                  | Reported friction or limit                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email triage     | Read email; mark and archive items needing no further attention; categorise and mark the rest as high priority, review or action. | Questions, requests and actions are mixed together. Categories and markers identify attention needs; no central coordination is apparent to the owner.                    |
| Calendar review  | Review and update schedules before moving into meetings.                                                                          | No specific scheduling failure reported. Retain this as workflow context, not a request to replace the calendar.                                                          |
| Conversation     | Attend meetings, talk to people, discuss issues, answer questions, give advice and make recommendations.                          | Very little follow-up or ability to track what happens after discussions.                                                                                                 |
| Next working day | Repeat the routine.                                                                                                               | The owner cannot readily tell whether advice is being heard or acted on, or what outcomes followed. This is missing visibility, not evidence that recipients did nothing. |

Source systems: email, calendar, meetings and direct conversations. Specific applications were not identified in this sample. Output shapes: answers, advice and recommendations are reported, but their format and delivery channel are unknown. Recipients, volumes, time spent, deadlines, agreed owners, existing follow-up tools and concrete outcomes were not supplied.

### Interpretation To Test

**Local hypothesis:** the largest gap in this sample is between identifying or discussing work and maintaining a retrievable follow-up trail, rather than an inability to prioritise email. Attention markers alone may not connect a question or request to an answer, an agreed action and an observed outcome.

**Cheap discriminating check:** trace one recent email containing mixed asks and one recent discussion that produced advice or a recommendation. Using the existing tools, try to recover what was asked, what was answered or recommended, whether anyone agreed to act, who owns the next step, when it should be reviewed, and what happened. Record lookup time and missing facts. If that trail is already easy to recover, revise the hypothesis towards interruption, review habits or another observed constraint rather than assuming a missing register.

Candidate needs to validate, not new architecture decisions:

- **J1 capture:** separate multiple questions, requests and possible actions within one source while retaining their shared context. Advice or a recommendation must not become an agreed Action or Decision merely because it was spoken.
- **J2 answer:** retain the question and the answer or advice already given so a later ask can be answered without reconstructing the discussion.
- **J3 follow through:** make agreed next steps, items awaiting a response, review points and reported outcomes retrievable across email and meetings. Keep acknowledgement, agreement, action taken and observed effect distinct; silence means unknown, not refusal or completion.
- **Effort constraint to test:** the follow-up trail must reduce reconstruction and chasing without adding a second daily transcription routine. Email triage and calendar review already exist; replacing them is not established as a need.

### Next Event-Level Entry

For the next real example, record only what is known: event date, source/channel, anonymised ask or discussion, current triage marker, intended output and recipient role, actual handling and lookup time, agreed next step/owner/review date if any, follow-up attempt, observed result, and the point where context or coordination was lost. Use "unknown" or "not agreed" rather than inventing missing facts.

Keep workplace material in organisation-approved storage. These repository entries contain only general workflow accounts; do not add identifiable people, raw workplace emails, restricted excerpts or confidential source links. Deployment permission, the Rung 0 trial, artefact ranking and the remainder of the two-week log remain unverified.

## FL-002: Committee Report, Late Review And Limited Outcome Visibility

Recorded: 2026-10-05. Source: product owner's retrospective example in conversation, paraphrased below. M means the owner's manager. Event dates, frequency, deadlines and time spent were not supplied; this is not a timed observation.

### Committee Reporting Workflow

| Stage                   | Reported activity                                                                                                                              | Friction or visibility limit                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request                 | M forwards a committee request for a report using the usual templates.                                                                         | A template exists; missing document structure is not the reported problem. The original ask and acceptance criteria were not supplied here.                                                  |
| Draft and collaboration | The owner drafts the first version, sets themes and shares the document. The team reviews and collaborates; the owner polishes and reviews it. | Substantial drafting and review happen before the committee's later change request. The account does not establish that this collaboration itself is inefficient.                            |
| Manager review          | The owner shares the draft with M's office. M reviews late, requests minor changes and sends it to the committee.                              | Late review is reported; the intended review date and reason for delay are unknown.                                                                                                          |
| Committee changes       | The committee requests more substantial changes, not always matching what was originally requested.                                            | The ask can shift after internal review. Whether this reflects changed needs, an ambiguous brief or disagreement is not established.                                                         |
| Urgent finalisation     | M's office and the owner exchange urgent messages to rush final content for review and M's final endorsement.                                  | Late substantive changes create a compressed revision and endorsement loop. Version confusion or missed endorsement is not reported.                                                         |
| After submission        | The committee takes the paper; very little is heard about it again.                                                                            | Submission and endorsement are visible, but subsequent decisions, actions or use of the paper are not readily visible to the owner. Silence does not establish that the paper had no effect. |

Sources and outputs: a forwarded request, the usual report template, a shared collaborative document, review comments and urgent messages. Recipient roles: team reviewers, M's office, M and the committee. Specific applications, document versions, actual review intervals and committee outcomes are unknown.

### Reporting Interpretation To Test

**Local hypothesis:** reporting friction lies in coordinating the ask, review dependencies and late changes, then recovering the committee's disposition, rather than in generating a first draft alone.

**Cheap discriminating check:** reconstruct one completed report using the original request, reviewed drafts, comments and final submission. Compare the original ask with the committee's change request; recover planned and actual review points, the endorsed version and any committee decision or next step. Record lookup time and missing facts. If changes and outcomes are already easy to recover, investigate review capacity, timing or access to committee feedback rather than assuming a missing tracking tool.

Candidate needs to validate: retain the original ask and later changes; see whose review is outstanding and when it is needed; recover what M endorsed; distinguish submitted, endorsed, committee consideration, committee decision and resulting work. Do not treat submission as an outcome, or imply that tracking can prevent a committee from changing its mind.

## FL-003: Project Guidance Treated As Approval, Operational Problems Surface Later

Recorded: 2026-10-05. Source: product owner's retrospective example in conversation, paraphrased below. The owner reports that operational teams can take up to 12 months to get hold of the service. This is a reported interval, not a measured average or a duration established for every project. Event dates, frequency and handling time were not supplied.

### Project Guidance And Handover Workflow

| Stage                     | Reported activity                                                                                                                                            | Friction or visibility limit                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guidance request          | A project asks how to meet security requirements.                                                                                                            | The scope of the question and any formal approval request are not supplied.                                                                                                                                      |
| Advice                    | The owner refers the project to published material, answers questions and, where important, shares the answers with everyone.                                | Guidance and some knowledge sharing already exist. Who received the shared answers and how they were recorded are unknown.                                                                                       |
| Project interpretation    | In the owner's account, the project proceeds as it intended and believes the owner's input approves the whole project.                                       | Advice on particular questions is being interpreted as broader approval. The account does not establish an explicit approval, its authority or the project's reasons for its interpretation.                     |
| Late operating-model work | People swarm near the end to establish an operating model for the project output.                                                                            | Operational arrangements are established under late pressure; agreed service ownership, support arrangements and readiness evidence were not supplied.                                                           |
| Project closure           | The project succeeds and closes; operational teams take over.                                                                                                | Reported project success and closure do not by themselves establish operational readiness or verified security effectiveness.                                                                                    |
| Operational discovery     | Operational teams take up to 12 months to really get hold of the service and begin raising risks and finding errors; by then these are incidents and urgent. | Problems become visible downstream of project closure, when response is urgent. It is not established that every later issue was foreseeable, caused by ignored advice or attributable to the same handover gap. |

Sources and outputs: published security guidance, questions and answers, shared advice, an operating model, and later operational risk/error reports and incidents. Recipient roles: project participants and operational teams; specific recipients, systems, formal approvers and records are unknown.

### Project Interpretation To Test

**Local hypothesis:** the advice-to-project-to-operations trail does not reliably preserve the scope and authority of guidance or demonstrate operational readiness before closure. This may allow advice to be treated as blanket approval and leave important uncertainties to surface after handover.

**Cheap discriminating check:** trace one project from its original security question through the advice given, any explicit approval or risk acceptance, the operating model and handover, then one later operational issue. Recover the scope and conditions of the advice, who could approve what, any agreed follow-up, the accepting service owner and readiness evidence. Check whether the later issue was known or discoverable before closure. If boundaries and readiness evidence were clear and accessible, revise the hypothesis towards enforcement, resourcing, changed conditions or another evidenced cause; missing tracking alone would not explain it.

Candidate needs to validate: preserve the question, applicable guidance, answer, scope, conditions and unresolved matters; distinguish advice, a recommendation, explicit authorised approval and risk acceptance; connect agreed project actions to operational ownership and a review point. Keep project delivery, handover acceptance, observed service behaviour and later incidents separate. Do not infer approval from an answer, closure from silence, or security effectiveness from project success.

## FL-004: Discussed Outcomes Do Not Become A Shared Delivery Plan

Recorded: 2026-10-05. Source: product owner's retrospective example in conversation, paraphrased below. Event dates, frequency, task types and handling time were not supplied. Waiting for days is reported, not a measured average.

### Team Delivery Workflow

| Stage                | Reported activity                                                                                                                                                          | Friction or visibility limit                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identify and discuss | The owner and a team member identify something that needs doing and discuss it. The owner leaves with a reasonably clear idea of what to do, how and the possible outcome. | The team member may not share some or all of that understanding. A discussion alone does not establish a mutually understood plan.                                           |
| Translate into steps | A team member may lack the skills to break an outcome into delivery steps, and may lack confidence to say they do not know how.                                            | This is the owner's possible explanation, not a confirmed assessment of any individual. Skill, confidence, unclear expectations and other constraints must not be conflated. |
| Work waits           | Work can sit for days without action and without the blocker or needed answer being raised.                                                                                | The missing next step or support need is not visible soon enough. Silence does not establish understanding, readiness or lack of effort.                                     |
| Manager follows up   | When the owner asks and finds no progress, the owner starts breaking the work down to unblock it.                                                                          | Decomposition and help arrive reactively, after the wait, and depend on the manager noticing and intervening.                                                                |
| Delivery             | The team gets things done, but the owner feels delivery depends heavily on a few individuals.                                                                              | Eventual completion can conceal waiting, repeated explanation and dependence on particular people. It is not evidence that the team cannot deliver.                          |

Sources and outputs: a discussion, subsequent follow-up and manager-assisted breakdown of work. Existing planning tools, agreed owners and checkpoints, available support, competing workload and the team member's own account were not supplied.

### Explicit Owner Need: A Simple Plan For Each Step

The owner asks for a simplified plan that makes what to do, what is expected and how to ask for help transparent. This is a stated need; the format below is a discovery proposal, not an accepted schema or an implementation decision.

| Part of the plan | Minimum useful content to agree together                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intended outcome | What the work is meant to achieve and why; distinguish the hoped-for effect from the immediate deliverable.                                                                                  |
| Next step        | Who will do what concrete action next, with enough starting information to attempt it. Break down further only where needed; the whole project need not be planned before starting.          |
| Expected result  | What this step should produce and how the team member and reviewer will recognise that it is ready for review.                                                                               |
| Help route       | The question, example, input or decision needed to proceed; who can help and how to contact them. Make "I do not know how to start" a legitimate support request, not a performance verdict. |
| Checkpoint       | An agreed point to check progress or seek help, and what happens next if an answer is still missing. Do not invent a deadline or assume a support person has agreed to respond.              |

Confirm the team member's understanding and ability to begin in their own words rather than treating the manager's explanation or a generated plan as agreement. Keep steps editable as understanding improves. A written plan cannot substitute for coaching, available help or a safe opportunity to raise uncertainty.

### Team Delivery Interpretation To Test

**Local hypothesis:** some waiting and repeated manager intervention arise because the discussed outcome is not translated into a mutually understood, startable next step with an accessible help route. A simple jointly confirmed plan may reduce that friction, but a checklist alone will not resolve workload, skills or confidence constraints.

**Cheap discriminating check:** on one suitable piece of work, agree the outcome, first step, expected result, help route and checkpoint with the team member using the existing tools. Ask what remains unclear and whether they can begin; at the checkpoint, record whether they started, what help was requested, time spent planning and any further manager breakdown required. Compare with a similar recent example if available. If the plan was understood but work still waited, investigate capacity, dependencies, support availability or another evidenced cause rather than adding more planning fields. One trial is not team-wide validation.

Candidate needs to validate: capture a discussion as draft steps, confirm them with the person doing the work, make unanswered questions visible without blame, and retain useful breakdowns for similar work without assuming they fit every person or task. Measure waiting and repeated intervention alongside completion; do not infer individual competence or rank people from inactivity.

## FL-005: Cyber Approval Expands Into Cross-Team Delivery Direction

Recorded: 2026-10-05. Source: product owner's qualitative account in conversation, paraphrased below. The owner reports that this happens often; event dates, counts, waiting time, formal mandates and specific disputed outcomes were not supplied.

### Cross-Team Dependency Account

- Other technical teams wait for instruction from Cyber before taking action.
- What began as a cyber/security approval role has, in some ways, become a security-led digital function. This describes the owner's experience of responsibility drift, not an established change to the organisation's formal mandate.
- The owner explicitly distinguishes this pattern from secure by design. Reliance on Cyber to direct delivery must not be presented as evidence that security is embedded in delivery teams' design and operating practices.
- There is emerging contention between security outcomes, compliance outcomes and getting work done for the business. No particular requirement, decision or resolution was supplied; the account does not establish that these outcomes are always incompatible.

Roles involved: Cyber, other technical teams and business stakeholders. Who owns delivery, which decisions require security approval, who interprets compliance obligations, and who has authority to accept residual risk or resolve competing demands are unknown. Do not infer that teams are deliberately avoiding responsibility or that every wait for Cyber is unnecessary.

### Cross-Team Responsibility Interpretation To Test

**Local hypothesis:** a security approval boundary may have become an implicit dependency on Cyber for general delivery instruction, concentrating decisions and making ownership unclear. Some waits may instead be legitimate approval gates, unresolved requirements, capability gaps or capacity constraints; a worklist alone cannot distinguish or fix these.

**Cheap discriminating check:** trace one item a technical team describes as waiting for Cyber. Ask the team and Cyber what exact advice, approval, decision or instruction is needed; recover the applicable gate or agreement, the delivery owner, what can proceed within existing authority, and who can resolve the outstanding question. Record waiting time if known and compare their understanding. If the required gate and ownership are already clear, investigate decision turnaround, workload or capability rather than assuming responsibility drift. Do not bypass a required approval to test the hypothesis.

For one contested item, separately record the business result sought, the security exposure and expected protective effect, the applicable compliance obligation and evidence, and the delivery impact of the available options. Recover who has authority to decide and the recorded rationale, conditions and review point, if any. Meeting a compliance requirement does not alone prove security effectiveness; delivery progress does not establish acceptable risk. Mandatory obligations are not optional trade-offs, and risk acceptance must not be inferred from urgency, silence or Cyber advice.

Candidate needs to validate: distinguish "awaiting Cyber advice", "awaiting required approval", "awaiting delivery direction" and "awaiting an authorised decision"; retain the exact question and its decision owner separately from the person doing the work. Make cross-team dependencies and competing outcomes explainable without making Cyber the default owner of every action. An agreed step plan from FL-004 should support the accountable team's execution, not automatically transfer its delivery responsibility to Cyber.

## Owner Clarification: Evidence For Shared Accountability

Recorded: 2026-10-05. Source: product owner's clarification in conversation. This is a statement of purpose, not another incident or evidence that the organisational issues have been resolved.

The product does not have to solve the issues in FL-001 to FL-005. Being able to show them using data and records is important to improving culture, driving accountability and ensuring shared goals are met. The intended contribution is a shared, evidence-backed account of work that people can review and act on; changing culture, assigning organisational authority and resolving competing priorities remain human responsibilities.

The earlier candidate needs and trials should be read in that light: clearer steps and help routes may support delivery, but resolving every underlying organisational cause is not a prerequisite for useful evidence. Equally, recording activity alone is not proof of accountability, cultural improvement or achievement of a shared goal.

### What The Records Should Make Visible

- The shared goal and how a request, discussion or piece of work relates to it; missing or disputed links remain visible rather than being invented.
- What was requested, advised, understood and explicitly agreed, with source, date, scope and confirmation where available. Keep one person's account distinct from a jointly confirmed agreement.
- Who agreed to deliver the next step, who owns an outstanding decision, what result is expected and which dependency or help request is unresolved.
- What changed, when reviews or responses occurred, what was delivered and what effect was actually observed. Preserve revisions and corrections rather than overwriting the earlier account.
- Where evidence stops: "no response recorded", "outcome unknown" and "no action taken" are different claims. A record gap must not become an accusation or an inferred approval.

Candidate summaries include time awaiting review or a decision, changes after review, unresolved help requests, repeated intervention and outcomes awaiting confirmation. Any summary must state its period, source coverage, counting rule and missing data; elapsed time requires recorded dates. These are prompts for inquiry, not individual performance scores or proof of causation. Evidence should be available to authorised participants for review and correction under the team boundary, not exposed indiscriminately.

### Evidence Usefulness Check

**Hypothesis to test:** records of the request, agreement, dependency and result can make one of these patterns discussable without relying solely on the manager's recollection, even if the underlying issue remains unresolved.

**Cheap discriminating check:** reconstruct one example with existing records and review the account with an involved colleague. Can both identify the goal, what was actually agreed, the outstanding question or decision, and the observed result, while recognising missing or disputed facts? Record lookup effort, corrections and whether the account supports an agreed next step. If it is misleading, too burdensome or no clearer than the source material, revise the capture or summary approach. One review does not establish cultural change or goal achievement, and it does not authorise publication of workplace material here.

## Owner Clarification: Personal Supplement For The First Trial

Recorded: 2026-10-05. Source: product owner's answers to the design questions in conversation. The [decision register](decision-register.md#personal-supplement-first-trial-scope-2026-10-05) records these as first-trial scope decisions.

1. The workbench is not authoritative: it supplements the owner's existing work and organisational records.
2. Shared understanding may not be recorded. The owner can try to establish and record it, but missing confirmation must not prevent capture or be treated as agreement.
3. The owner needs their own solution first. Updates from others continue by email, Teams and current channels, with relevant information captured or linked by the owner rather than entered by colleagues in the workbench.
4. Immediate value is the owner's situational awareness and ability to evidence their work, not proof that the organisational issues are solved.

This qualifies the earlier references to a shared account and jointly confirmed plans: they are useful when available, not mandatory team workflows or prerequisites for personal value. Record what the owner understood, did, requested or observed, and what the source actually supports. Capturing a colleague's message is not the same as that colleague confirming the workbench's interpretation.

**First-trial usefulness check:** using one representative example, can the owner recover the ask, their advice or delivery, subsequent changes, the next follow-up or outstanding decision, and the known outcome from dated sources rather than memory alone? Record retrieval effort and the effort to capture and maintain the account. Keep unknowns explicit; a second participant's review can strengthen the evidence but is not required to run this check. No claim of team adoption, improved culture or organisational authority follows from passing it.

## FL-006: Assessment Complete, Authorisation Waits On An Accountable Owner

Recorded: 2026-10-06. Source: product owner's anonymised, event-level example in conversation, paraphrased below. Event dates, waiting time and handling time were not supplied.

### Ownership-Before-Authorisation Workflow

| Stage                  | Reported activity                                                                                           | Friction or visibility limit                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assessment             | A security assessment and authorisation package for a business system is completed.                         | Technical delivery is complete; governance is not. Completing the package does not establish authorisation.                                                                                     |
| Ownership question     | The author asks whether a named stakeholder is the system owner and, if not, who holds that responsibility. | The blocker is not technical: it is who is accountable for the system. Progress depends on an answer from outside the assessment work.                                                          |
| Proposed next step     | Confirm the accountable owner and obtain the required approval or signature to finalise authorisation.      | The next step is clear, but who must act on it is the unknown being asked about.                                                                                                                |
| Owner's email handling | The email was later moved to the owner's Completed folder.                                                  | The move suggests the matter was resolved or needed no further action from the owner. It does not establish who became owner, when, whether authorisation was granted or where it was recorded. |

### Information Recovery Result

From the originating email alone, the owner cannot answer: who was identified as owner; when and where the decision was recorded; and whether authorisation was granted. The original ask and proposed next step are recoverable; the ownership determination and authorisation outcome are not.

### Ownership Interpretation To Test

**Local hypothesis:** the owner's own "done" marker records that their part ended, not the governance outcome; the decision and its record sit elsewhere, unlinked to the request.

**Cheap discriminating check:** starting from this email, spend a fixed short effort trying to recover the owner determination, decision date, authorisation status and record location from existing systems (later mail, meeting records, the GRC platform or authorisation register). Record lookup time, which source answered each question and which remain unknown. If the authorisation register answers all of them quickly, the need is a link from the request to that record, not a second register.

Candidate needs to validate: distinguish "my part complete", "owner identified", "approval requested", "authorisation granted" and "outcome unknown"; record the outstanding question with its decision owner; capture a pointer to the authoritative record rather than copying the decision. A Completed folder move must not be read as authorisation.

## FL-007: Cross-Team Participation Request Without A Return Trail

Recorded: 2026-10-06. Source: product owner's anonymised, event-level example in conversation, paraphrased below. Event dates, nominee, workshop dates and outcomes were not supplied.

### Participation Request Workflow

| Stage                 | Reported activity                                                                                                                                                                                                           | Friction or visibility limit                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Request               | A resilience and disaster recovery programme asks Cyber for support: recovery planning, identifying critical systems and dependencies, workshop participation, and validating recovery objectives and testing requirements. | The ask spans several activities and depends on multiple groups participating. Briefing material accompanies it.         |
| Proposed next step    | Nominate a Cyber representative for business impact analysis workshops and recovery planning; the work then runs through existing governance and an ADO board.                                                              | Tracking is delegated to the requesting programme's board; Cyber's own record of commitment is not described.            |
| Clarification offered | The sender invites further discussion if required.                                                                                                                                                                          | No record of whether that discussion happened.                                                                           |
| Afterwards            | Not recorded in the source email.                                                                                                                                                                                           | Unknown: who was nominated, whether workshops occurred, decisions made, resulting actions and current completion status. |

### Information Recovery Result

A later question such as "Who agreed to represent Cyber?" or "Where did we land on recovery priorities?" would likely require searching several places: later mail, Teams, meeting records and the programme's ADO board. Assignment, participation and outcomes appear disconnected from the originating request.

### Participation Interpretation To Test

**Local hypothesis:** when another programme owns the tracking, Cyber's commitment (the nominee, what they agreed to provide, by when) and the outcomes relevant to Cyber are not retained against the original request on the owner's side.

**Cheap discriminating check:** trace this request forward and recover the nominee, the workshops attended, any recovery objectives or priorities agreed, Cyber actions arising and their status. Record lookup time, the source for each answer and which facts are only in someone's memory. If the programme's board answers these quickly and the owner can reach it, the need is a link to that board item, not duplicate tracking.

Candidate needs to validate: record a nomination as an assignment with the person's agreement status kept distinct from the request; link the request to the external board item and meetings; capture decisions and Cyber actions arising with their source; keep "nominated", "participated", "decision made" and "outcome unknown" separate. The workbench supplements the programme's board; it does not become the programme's tracker.

## FL-008: Supplier Resource Change Resolved In One Thread (Counterexample)

Recorded: 2026-10-06. Source: product owner's anonymised, event-level example in conversation, paraphrased below. Included as a comparison case for good information flow, not as a friction incident.

### Resource Change Workflow

| Stage      | Reported activity                                                                                                                   | What made it recoverable                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Issue      | A supplier advises that an incoming resource has unexpectedly resigned and proposes an alternative with several transition options. | The problem and the options are stated explicitly in one message.          |
| Options    | Continue the original resource temporarily, arrange a handover, or start the replacement immediately.                               | Options are discrete and comparable.                                       |
| Discussion | A short exchange on timing and availability; a meeting with the proposed replacement is suggested for the following week.           | The exchange stays in the same thread.                                     |
| Next step  | A meeting invitation is arranged and sent.                                                                                          | The next step, its owner and its timing are explicit and visible in place. |

### Counterexample Reading

In the owner's assessment, the thread makes it easy to recover what happened, what decision was taken, the next action and who was responsible, because the options, ownership and next step were explicit and the outcome stayed in the same thread. Observable evidence stops at the invitation being sent: whether the meeting occurred and the eventual transition outcome are not part of this example.

Use this as the comparison case: a workbench record for FL-006 or FL-007 should be able to reach roughly this level of recoverability without the owner rereading every source, and capture should add little or nothing where the source thread already carries the trail.

## FL-009: Committee Papers Discuss Risk Topics Without A Reliable Risk-to-Decision Trail

Recorded: 2026-10-08. Source: product owner's account after a committee meeting, paraphrased below. Risk counts and links are the owner's current understanding; paper frequency, risk IDs, decision dates and elapsed time for the stale escalation were not independently checked.

### Risk Reporting And Committee Workflow

| Stage                      | Reported activity                                                                                                                                                                                                                                                        | Friction or visibility limit                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committee purpose          | The committee is described as a forum for discussion and decisions. In the owner's experience, decisions brought to the committee have often needed discussion beforehand; there are few alternative forums for formal decisions.                                        | The expected work before the meeting and the committee's actual decision role may not be clear. This account does not establish that the committee cannot make decisions or that prior discussion is always required.               |
| Paper request              | Papers are requested under a risk-and-oversight framing for a subject area, such as cyber. Risk representatives said they had not been consulted beforehand and wanted advance notice of risk topics.                                                                    | The requested framing does not necessarily identify the specific risks the paper addresses, and consultation may happen too late for risk specialists to shape it.                                                                  |
| Risk hierarchy             | The organisation has ten major enterprise risks, including one for information management and security. The owner understands that at least half a dozen digital risks link to it as child risks, with further child risks or issues beneath some digital risks.         | The hierarchy exists, but the owner does not see it providing reliable visibility from risks found in day-to-day operations up to the enterprise risk. Other risks also exist outside this described chain.                         |
| Cyber escalation           | A cyber risk was escalated about 12 months ago and, according to the owner, remains in the same state. Cyber risks are finding it difficult to gain escalation or visibility.                                                                                            | Stale or stalled risks are hard to draw attention to. The reason the escalation has not progressed, the current accountable decision-maker and the authoritative status record are not yet known.                                   |
| Risk practice across teams | Enterprise risk is seeking more consistent language and practice; digital risk has less appetite to adopt it. Cyber, digital and enterprise risk are managed by separate teams with different practices, tools and terminology.                                          | The same risk may be difficult to follow across teams, and a common parent link alone may not make status, treatment or escalation comparable. The account does not establish which team's practice is authoritative for each risk. |
| Paper preparation          | Papers are described as reactive and circular, with repeated reviews, messages, emails and conversations around updates. The owner would prefer papers anchored to identified risks, with risk IDs and links to relevant parent risks.                                   | It is not yet clear whether repeated work comes from missing risk anchors, shifting requests, review timing, decision rights or other causes.                                                                                       |
| Discussion and action      | The desired paper would report status and actions for particular treatments or plans, and make clear what the committee is being asked to change, approve or decide, including the intended security outcome and evidence.                                               | Without a risk-specific ask and recorded disposition, discussion can remain at subject level and the resulting change or security outcome may be difficult to trace.                                                                |
| Technical decision-making  | Papers also need enough explanation for non-specialists. The owner is unsure whether committee papers require every technical decision to be translated for a general audience, or whether security professionals should make some decisions on an assumed expert basis. | Accessibility and informed oversight may be in tension with the depth needed for expert decisions. The committee's remit, expertise, decision rights and expectations for technical material are not established by this account.   |

### Risk-to-Decision Interpretation To Test

**Local hypothesis:** committee papers framed around a topic rather than named risks may not connect operational cyber concerns to their digital and enterprise parents, prior risk-team consultation, treatment progress and a specific decision or action. Separate teams and inconsistent practices may make existing hierarchy links insufficient for reporting or escalation. This could contribute to ad hoc papers and stale risks remaining hard to surface, but the account does not establish causation or show that assigning risk IDs alone would solve it.

**Cheap discriminating check:** trace one recent cyber committee paper and the cyber risk reported as unchanged for about 12 months. Starting from the paper and the authoritative risk records, recover the paper's risk IDs and parent links, when risk teams were consulted, the risk owner, current treatment and actions, prior and current status with dates, the precise committee ask, any pre-meeting discussion, and the recorded decision, rationale and follow-up. Record lookup effort and every fact that remains unknown or differs between teams' tools. If the records and trail are already easy to recover, focus next on committee timing, decision rights or technical-content expectations rather than adding more risk fields.

Candidate needs to validate: link papers and discussion to existing risk IDs and parent relationships without creating duplicate risks; distinguish a subject-matter update, a new or changed risk, a treatment action, a request for advice and a formal decision request; make consultation, stale status, ownership, escalation and committee disposition visible with dates and sources. Preserve the level of technical detail needed by the people making the decision while making the decision sought, material implications and evidence legible to the committee. Whether that calls for one layered paper, separate expert discussion, or a different governance arrangement remains open. Do not infer approval from discussion, risk acceptance from silence, risk progression from a hierarchy link, or a security outcome from a paper being presented.

### Subsequent Meeting Update

Recorded: 2026-10-08. Source: product owner's account after a subsequent committee meeting. The owner reports that the meeting did not appear to close the risk discussion or set a concrete direction. The only assigned action was for the owner to add more information about the PSPF and requirements; no further information was requested about the risks or proposed actions. Formal minutes and any later clarification were not supplied.

This is an observed continuation, not proof that the committee made no formal decision or that the requested PSPF detail is unnecessary. It does show that, in the owner's account, the immediate follow-up was to expand requirements context rather than progress risk-specific actions. Record what additional information is requested, whether it changes the decision sought, and whether a later meeting assigns risk owners, actions or a disposition.

## Owner Positive Observation: Evidence-Led Work Plan And Follow-Through (Not A Friction Case)

Recorded: 2026-10-08. Source: product owner's account of a colleague's work, anonymised and paraphrased below. The colleague is leaving the work; the next group's meeting is planned but has not yet occurred. Acceptance of the content and resulting security or risk reduction are expectations, not observed outcomes.

### Evidence-to-Action Workflow

| Stage                      | Positive practice observed                                                                                                                                                                                                       | What it enabled or made visible                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and analysis        | The colleague used source material they understood well and supplied data-led analysis, including statistics, metrics, numbers and charts.                                                                                       | Recommendations could be considered alongside an account of the underlying evidence.                                                                                                                          |
| Narrative and consultation | Written narrative described the process and outcomes, and recommendations reflected substantial consultation with a stakeholder group.                                                                                           | Quantitative analysis was accompanied by context and input from people affected by the recommendations.                                                                                                       |
| Work plan                  | A plan identified seven PSPF-related items recommended for completion before the next reporting period to address non-compliance and gaps. Requirements, ownership, intended outcomes and related in-flight work were explained. | The reporting cycle, recommendations and proposed actions were easy to connect; readers could see both the expected result and work already under way.                                                        |
| Delivery guidance          | A companion brief explained how to deliver the plan or decide what should be delivered.                                                                                                                                          | The plan was supported by guidance for making implementation choices, not just a list of recommendations.                                                                                                     |
| Formal discussion          | The colleague presented the material to the group and followed up in writing with numbered actions, owners and due dates. Outcomes of the formal meeting were documented.                                                        | The discussion was converted into a dated, reviewable record of proposed and agreed follow-up.                                                                                                                |
| Between-meeting update     | Before the next planned meeting, a formal update reported action status, including completed, not-started and not-yet-ready or non-compliant items.                                                                              | Participants had a current status account to review before the next discussion; circulation and reminders make the history clearer, though they do not prove every recipient read or understood the material. |
| Next discussion            | The group is expected to review the material and decide whether to accept or change it, then consider delivery choices such as project or programme form and resourcing.                                                         | The owner's expectation is that discussion will focus mainly on how to act on the content, rather than re-establishing its analysis or message. This has not yet been confirmed by the meeting.               |

### Positive Practice To Preserve And Test

The owner's assessment is that this is a strong example of using analysis, narrative, consultation, a clear work plan, formal follow-up and careful record-keeping to build momentum and establish a documented baseline. The records make the sequence of evidence, recommendations, actions and updates easier to follow, and make later changes to the baseline visible. They support accountability and continuity, particularly as the colleague steps away; they do not alone establish that every participant was aware, that a decision was made, or that security outcomes were achieved.

**Practice hypothesis:** connecting source-backed findings to specific recommendations, owners, intended outcomes, existing work and dated status updates can help a group move from reviewing the content to deciding how to deliver it. This example supports preserving that method and the team's enthusiasm for outcomes, not treating it as a friction incident or proof that the method will work in every forum.

**Next check:** after the planned meeting, compare the documented baseline and status update with the meeting record. Note whether the content was accepted or changed, which delivery or resourcing decisions were made, the agreed owners and dates, and how those decisions were recorded. Later, check whether the planned security and risk outcomes were evidenced. If the meeting revisits the substance or leaves decisions and actions unclear, retain the positive elements already demonstrated but revise the hypothesis about what drove progress. Do not report an intended outcome as risk reduction until evidence supports it.

## Owner Synthesis: Which Information Is Hard To Recover

Recorded: 2026-10-06. Source: product owner's synthesis across FL-006 to FL-008. These ratings are the owner's qualitative judgement from three examples, not a measured frequency.

| Information type | Easy to find? | Owner's note                                |
| ---------------- | ------------- | ------------------------------------------- |
| Original ask     | Yes           | Usually in email or chat.                   |
| Proposed action  | Usually       | Often explicit.                             |
| Owner            | Sometimes     | Often inferred rather than recorded.        |
| Decision made    | Often hard    | Frequently occurs elsewhere.                |
| Current status   | Hard          | Sits in meetings, Planner, ADO or memory.   |
| Outcome          | Hard          | Rarely linked back to the original request. |
| Reason for delay | Very hard     | Usually exists only in conversations.       |

The owner proposes these as the fields an Inbox-and-Ask pilot should focus on capturing. The gradient matches FL-001 to FL-005: the ask is rarely the problem; ownership, decision, status, outcome and the reason for waiting are. "Reason for delay" is new relative to earlier entries and should be captured as the owner's stated or sourced reason, not inferred from silence.

**Proposed discovery use (owner's recommendation):** run FL-006 and FL-007 as the primary reconstruction exercises, because they expose the retrieval and tracking gaps, and use FL-008 as the comparison case for what good information flow looks like. For each, record lookup time per information type above, the source that answered it, and the facts that remain unknown. Under the personal-supplement scope these are exercises the owner can run alone; a colleague's review strengthens the evidence but is not required.

## Owner Observation: Copilot Over Existing Mail Does Not Recover The Trail

Recorded: 2026-10-06. Source: product owner's report in conversation of asking Microsoft 365 Copilot recovery questions over their mailbox and related Microsoft 365 content. Specific prompts, counts and answers were not supplied.

Copilot can make assumptions but does not find definitive information. Read with FL-006 and FL-007, the likely explanation is that ownership determinations, decisions and outcomes were never written where Copilot can reach them, rather than only a retrieval weakness; this is not established for every case.

Consequences to carry forward: retrospective AI search does not substitute for recording the fact when the owner learns it; an AI inference must be labelled as an inference with its source, never presented as a sourced fact or used to fill an unknown; and a workbench that publishes source-backed trails to the Rung 0 folder would give Copilot the definitive records it currently lacks. That last point is a hypothesis for the Rung 0 trial, not a demonstrated result.

## What These Examples Add To Discovery

FL-002 makes J2 a multi-person reporting and review job, not just a fast answer. FL-003 makes J1 capture depend on retaining the meaning and limits of advice, not just extracting action verbs. Both extend J3 beyond a personal worklist to dependencies and follow-up across organisational boundaries; who may see or confirm that information remains to be established.

FL-004 adds an explicit need for shared delivery steps and a usable route to help. J1 must preserve and confirm understanding, not merely assign an owner; J3 must help people start and unblock work, not merely show overdue items. The aim is less repeated dependence on a few individuals, not surveillance or more reporting by the team.

FL-005 extends that dependency beyond the Cyber team: tracking and planning must preserve the distinction between advice, approval, decision authority and delivery ownership. It also calls for business, security and compliance outcomes to be explained separately rather than collapsed into one completion or approval status. Product support cannot itself settle the organisation's mandate, decision rights or competing priorities.

FL-006 and FL-007 show the trail breaking at the same point from the owner's side: the request is retained, but ownership determination, decisions and outcomes happen in other systems or conversations and are not linked back. FL-006 also shows that the owner's own "done" marker (a Completed folder) records the end of their part, not the governance result. FL-008 shows that where options, owner and next step are explicit in one thread, little extra capture is needed. A candidate Inbox should therefore favour links to authoritative records and explicit unknowns over copying decisions, and should not demand capture for threads that already carry their own trail.

The common candidate need is a retrievable trail from request or discussion to response, explicit agreement or decision, owned next step and observed outcome. This is not one universal completion status: a submitted paper can await a decision, and an answered security question need not approve a project. A candidate product would need to help recover that trail without duplicating collaborative documents, published guidance, calendars or existing authoritative approval and service-management records. No integration, schema change or resumption of a paused programme is authorised by these examples.

## Qualitative Discovery Round Closure

Recorded: 2026-10-08. The product owner closes this conversation-led round and sets the following design-priority order. This is a judgement about what to consider first, not a measured ranking by frequency or impact.

| Priority | Episode | Design focus                                                                           |
| -------- | ------- | -------------------------------------------------------------------------------------- |
| 1        | FL-009  | Risk-focused committee discussion, requirements follow-up and unresolved risk actions. |
| 2        | FL-002  | Committee paper request, review changes and recovery of the disposition.               |
| 3        | FL-001  | Everyday mixed requests from email and meetings, with follow-up.                       |
| 4        | FL-003  | Security advice, project interpretation and operational handover.                      |
| 5        | FL-004  | Turning a team discussion into a clear next step and help route.                       |

FL-008 remains a positive comparison case, and the evidence-led work-plan observation remains a positive practice example; neither is part of the friction priority ranking.

### Basis For The Next Design Round

- No artefacts from real workplace examples will be shared. Content and layouts used in design or prototypes will be synthetic, based on best practice, and labelled as assumptions rather than validated organisational formats.
- The passing test and app boundaries are not yet defined. They will be developed collaboratively from the prioritised scenarios; their absence does not prevent closing this qualitative round.
- This closure does not claim completion of the grand plan's P1 exit evidence. A measured two-week baseline, ranked inventory of real artefact and source types, Rung 0 answer-quality evidence and plausible deployment permission remain unverified or outstanding.
- The next design activity may use the five prioritised episodes to propose boundaries, synthetic examples and candidate acceptance tests for the owner's review. No architecture, integration, publication permission or implementation scope is accepted by this closure alone.

## Owner Feedback: Lists Behave Differently Across The Solution

Recorded: 2026-10-10. Source: product owner, after exercising the v1.77.0 workbench and the Explorer. Not a workplace episode; a usability observation about the product itself.

Different areas feel and behave differently. In the requirements list only the ID is clickable; risks and actions have an Open button instead; the workbench matter list opens on the whole item. The owner asks for one behaviour: in any suitable list, clicking the item opens its details. Recorded as decision W-D20 in the [decision register](decision-register.md#owner-feedback-interaction-consistency-2026-10-10) and as a W1 acceptance item in the grand plan. Further inconsistencies found during the independence cycle go in the trial entries below under "Friction or defect".

## Workbench Trial Entries (From 2026-10-10)

The v1.77.0 workbench first slice ([ADR 0103](../adr/0103-v1-77-workbench-first-slice-matter-capture-and-recovery.md)) is in the repository. Its owner trial is defined as [W0 in the grand plan](../pspf-grand-plan.md#w0-owner-trial-protocol-on-hold-becomes-the-d8iii-independence-cycle). On 2026-10-10 the owner performed the recovery drills against the deployed build: backup, restore and the other mechanics worked as intended. The fortnight of real use is **on hold** until the register prototype (proposed ADR 0104) removes the need for the extensions; it then runs over one tool as the ADR 0102 D8(iii) independence cycle. Entries made during that run are numbered **FL-010** onwards and follow the format below so that they can be compared with the P1 owner synthesis. Content stays anonymised and synthetic in wording; no workplace artefacts, names, risk IDs or minutes are placed here.

### Entry Format

| Field               | Record                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Trigger             | Meeting, email thread, chat, verbal request or scheduled follow-up.                                                              |
| Capture attempted   | Yes or no, and why not if no (thread already carries its trail, not worth it, workbench unavailable, forgot).                    |
| Parser result       | Items produced by type; how many accepted, retyped, merged or discarded; any text kept as a note because the format did not fit. |
| Match suggestions   | Whether a suggested matter or register record was right, wrong or absent; whether an exact ID was available.                     |
| Register references | Which snapshot the references were checked against and whether any showed changed or missing.                                    |
| Brief or answer     | Whether a dossier, profile view or issued edition was used to answer or brief; profile used; whether redaction removed anything. |
| Recovery            | Any tab close, restart or interruption and whether the draft and place came back.                                                |
| Effort              | The owner's estimate of time spent in the workbench and time saved or added, with the comparison the owner has in mind.          |
| Friction or defect  | Anything that blocked, confused or slowed the work; reference a repository issue if one is raised.                               |

### Trial Summary (To Be Completed At The Independence Cycle Exit)

- Recovery drills: **performed 2026-10-10 on v1.77.0** — backup, restore and related mechanics worked. To be repeated once on the register prototype (draft return after tab close, backup restore into a second profile, erasure tombstone visible, register counts matching after restore).
- Seven-type recovery check for three trial matters: lookup time and answering source per type, set beside the P1 owner synthesis ratings.
- Independence check: one real reporting cycle (assess, evidence, action, risk, snapshot, close period, brief, export) completed without opening VS Code for authoring.
- Rung 0 note: editions published to the synced folder, questions asked of Copilot, and which answers were correct, inferred or missing.
- Defect and friction list.
- Owner's keep/adjust/stop judgement against the criterion recorded under W-D11, with the document-and-list alternative stated.
