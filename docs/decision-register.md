# Decision Register

Status: active

This register captures the working product decisions for the next compliance-uplift slice. It is intentionally short, practical, and focused on the immediate workflow we need to test over the next few days.

## Current decisions

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
