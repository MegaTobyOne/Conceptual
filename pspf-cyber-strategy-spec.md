# PSPF-Aligned Cybersecurity Strategy Management Spec

## Overview
This specification describes a lightweight product design for creating, maintaining and sharing a cybersecurity strategy in a form that is distinct from operational plans, but still traceable to execution and reporting.[cite:1][cite:2] The design is intended for Australian Government or PSPF-aligned contexts where strategy needs to express risk posture, target state, priorities, measures and assurance, while remaining usable inside an application.[cite:1][cite:4]

The PSPF sets out Australian Government policy across six security domains and is intended to help entities protect people, information and resources while identifying and mitigating security risks and vulnerabilities.[cite:1][cite:2] PSPF Policy 10 was amended to mandate the Essential Eight, and non-corporate Commonwealth entities are required to implement Essential Eight Maturity Level Two mitigations to achieve a PSPF maturity rating of "Managing".[cite:4]

## Purpose
The product outcome is a strategy workspace that allows an organisation to:

- represent cybersecurity strategy as a set of enduring choices and target outcomes rather than as a task list
- connect each strategic choice to measurable posture, risks, capabilities and assurance evidence
- show progress without collapsing strategy into project management
- publish views suited to executives, cyber leaders and delivery teams
- retain enough structure to support future app features such as workflows, dashboards, heatmaps and status reporting

## Design Principles
The strategy model should separate **strategy** from plan. Strategy expresses choices about what the organisation is trying to protect, what risks matter most, what capabilities it will prioritise and what target posture it is aiming for; plans describe the initiatives, milestones and tasks used to move toward that posture.[cite:1][cite:7]

The ASD Essential Eight guidance recommends selecting a target maturity level suitable for the environment, using a risk-based approach, minimising exceptions, documenting and approving exceptions, and progressing each of the eight strategies to the same maturity level before moving higher.[cite:2] That makes target posture, current posture, exceptions and rationale core data elements for a cybersecurity strategy representation.[cite:2]

Measures should support decision-making rather than simply report activity. NIST describes cybersecurity measurement as improving the quality and utility of information for technical and high-level decision-making, and emphasises measuring organisational ability to identify, protect, detect, respond and recover from cyber risks and threats.[cite:7]

## Strategy Representation Model
The app should treat a cybersecurity strategy as a structured object with the following layers:

### 1. Strategic Context
This layer records why the strategy exists and what it responds to.

Suggested fields:
- Strategy title
- Scope, such as enterprise, division, platform or program
- Time horizon, such as 12 months, 3 years or rolling
- Business and mission drivers
- Threat assumptions
- Risk appetite or risk posture statement
- Relevant frameworks, such as PSPF and Essential Eight
- Version, effective date and owner

### 2. Strategic Choices
This layer captures the actual strategy. Each strategic choice should be a concise statement of intent that can remain valid even when projects change.

Examples:
- Prioritise identity as the primary control plane.
- Reduce exploitable attack surface across internet-facing services.
- Standardise endpoint resilience to reach Essential Eight target maturity.
- Improve detection and response for privileged misuse and phishing-led compromise.

For each strategic choice, store:
- Choice statement
- Rationale
- Risks addressed
- Security outcomes sought
- In-scope capability areas
- Target posture by date
- Trade-offs or constraints
- Executive owner

### 3. Strategic Outcomes
Each strategic choice should map to a small number of outcomes that express the changed security state the organisation wants to achieve.

Outcome examples:
- Internet-facing systems are remediated within defined patching windows.
- Privileged access is tightly governed and observable.
- Authentication to sensitive services is phishing-resistant.
- Recovery from disruptive incidents is reliable and tested.

For each outcome, store:
- Outcome statement
- Leading indicators
- Lagging indicators
- Baseline value
- Target value
- Confidence or data quality rating
- Review cadence

### 4. Posture Measures
This layer tracks whether the strategy is moving the organisation toward the target posture. For PSPF-aligned cyber strategy, the most natural measures include maturity targets, risk movement, coverage, exceptions and assurance.[cite:2][cite:4][cite:7]

Suggested measure classes:
- Control posture, for example Essential Eight maturity by strategy
- Coverage, for example proportion of in-scope assets under application control
- Exposure, for example unsupported systems or internet-facing critical vulnerabilities outside SLA
- Detection and response, for example mean time to detect or incident containment performance
- Resilience, for example restore test success rate or recovery assurance confidence
- Governance and assurance, for example exception age or assessment completion rate

### 5. Strategic Risks and Assumptions
The strategy should explicitly track the risks that could prevent the intended security posture from being achieved. This includes dependencies on funding, architecture, legacy technology, identity platforms, staffing, data quality and business adoption.

For each risk or assumption, store:
- Description
- Linked strategic choices and outcomes
- Impact on posture
- Owner
- Review date
- Current treatment approach

### 6. Delivery Linkages
This layer links strategy to delivery without making delivery the strategy itself.

Store references to:
- Programs and initiatives
- Major milestones
- Policy uplift work
- Architecture changes
- Procurements
- Assurance activities
- Incident learnings

The relationship should be many-to-many. A single strategic choice may need several initiatives, and one initiative may support several strategic choices.

## Recommended Screen Model
The main screen should be organised as a strategy map rather than a project dashboard.

### Executive View
Show:
- Strategy statement and scope
- 3 to 6 strategic choices
- Target posture summary
- Top strategic risks
- Overall confidence and trend
- Key exceptions needing decision

This view is for answering: what are the cyber priorities, why do they matter, and are they moving in the right direction.

### Leadership View
Show:
- Strategic choices as cards or lanes
- Outcomes under each choice
- Posture indicators and trend lines
- Linked risks, dependencies and exceptions
- Linked initiatives in a secondary panel

This view is for answering: what is changing in the security posture, what is blocked, and where leadership attention is required.

### Working View
Show:
- One strategic choice at a time
- Full outcome definitions
- Measure details and baselines
- Evidence links
- Initiative linkage panel
- Change history and commentary

This view is for editing and ongoing stewardship.

## Core Decision Points
To make the design buildable, the following product decisions need to be made.

### 1. What is the unit of strategy?
Choose whether the primary object is:
- one enterprise cyber strategy with nested choices, or
- multiple domain strategies, such as identity, resilience and secure operations

A single primary object is simpler for app design. Nested strategic choices usually provide enough flexibility for most organisations.

### 2. What posture model will be first-class?
Decide what the app treats as the principal representation of current and target state.

Good options are:
- Essential Eight maturity targets and current maturity by mitigation strategy, because PSPF Policy 10 explicitly mandates the Essential Eight and requires Maturity Level Two for a PSPF maturity rating of Managing in non-corporate Commonwealth entities.[cite:4]
- Broader cyber capability outcomes aligned to identify, protect, detect, respond and recover, because NIST frames meaningful cybersecurity measurement around these enterprise abilities.[cite:7]

A practical design is to use capability outcomes as the strategic frame and Essential Eight maturity as one of the posture evidence sets.

### 3. How many levels are allowed?
The design should cap hierarchy depth to keep the screen comprehensible.

Recommended maximum:
- Strategy
- Strategic choice
- Outcome
- Measure or linked initiative

Avoid deeper nesting unless the app supports drill-down panels.

### 4. How is status expressed?
Do not rely only on red-amber-green status. Use a combination of:
- trend, improving or deteriorating
- confidence, high/medium/low
- target posture gap
- exception count and age
- narrative commentary

This prevents strategy reporting from becoming a shallow status board.

### 5. What is review cadence?
Decide whether strategy objects are reviewed monthly, quarterly or event-driven. The PSPF is reviewed annually, and ASD guidance expects ongoing risk-based implementation, exception management and regular review of exceptions and compensating controls.[cite:1][cite:2]

A workable model is quarterly strategic review with monthly measure refresh.

### 6. What counts as evidence?
Decide which artefacts can justify posture claims, such as assessment results, vulnerability metrics, privileged access reviews, restore test outcomes, incident reports or architecture decisions. If the app will later support assurance workflows, define evidence type and confidence rules up front.

## Suggested Data Shape
A concise conceptual schema is below.

```json
{
  "strategy": {
    "id": "cyber-strategy-001",
    "title": "Cybersecurity Strategy",
    "scope": "Enterprise",
    "timeHorizon": "2026-2028",
    "owner": "CISO",
    "context": {
      "drivers": ["PSPF alignment", "risk reduction", "resilience"],
      "frameworks": ["PSPF", "Essential Eight"],
      "riskPostureStatement": "Reduce likelihood and impact of common and moderately sophisticated attacks"
    },
    "choices": [
      {
        "id": "choice-1",
        "statement": "Strengthen identity and privileged access as the primary control plane",
        "rationale": "Reduce compromise pathways and improve containment",
        "outcomes": [
          {
            "id": "outcome-1",
            "statement": "Phishing-resistant authentication protects sensitive services and privileged users",
            "measures": [
              {
                "name": "MFA coverage for privileged users",
                "baseline": 62,
                "target": 100,
                "unit": "percent",
                "trend": "up"
              }
            ]
          }
        ],
        "linkedRisks": ["risk-12"],
        "linkedInitiatives": ["init-4", "init-8"]
      }
    ]
  }
}
```

## Minimum Build Scope
A first release should support the following functions:

- Create and edit one strategy with version history.
- Add, order and archive strategic choices.
- Define outcomes under each strategic choice.
- Attach measures with baseline, target, trend and confidence.
- Record current posture and target posture.
- Link risks, exceptions, evidence and initiatives.
- Generate executive and leadership views from the same underlying structure.
- Export or share a read-only strategy snapshot.

## Non-Functional Expectations
The design should support traceability, because strategy claims need to be backed by evidence and remain reviewable over time.[cite:1][cite:2] It should also support consistent language and controlled hierarchy so the same structure can power screen layouts, reporting and future automation without the model drifting into unstructured narrative.

## Recommended Method
The simplest durable method is:

1. Define the strategy context and risk posture.
2. Write 3 to 6 strategic choices that express enduring cyber priorities.
3. Define 1 to 3 outcomes for each choice.
4. Assign posture measures and target states to each outcome.
5. Link risks, assumptions, exceptions and delivery initiatives.
6. Review on a fixed cadence and update only posture, evidence and rationale unless the strategy itself changes.

This method keeps strategy stable while allowing the plan and delivery activity around it to change.

## Build Outcome
If implemented this way, the app will not merely store a cyber plan. It will provide a structured strategy model that shows what security posture the organisation is trying to achieve, why that posture matters, how progress is measured, what risks are blocking it and which delivery activities are contributing to it.[cite:1][cite:2][cite:7]
