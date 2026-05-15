# PSPF Design Specification

## Overview

This specification defines the visual language, interface behaviour, information hierarchy, and user-facing content strategy for the PSPF product ecosystem. It covers the four VS Code extensions (PSPF Core, PSPF Workshop, PSPF Shop, PSPF Pub) published independently to the Marketplace, and the standalone Explorer web application. See ADR 0001 and ADR 0007.

The design direction should take inspiration from the strongest parts of Perplexity’s interaction model: low-friction entry, clean hierarchy, strong whitespace, progressive disclosure, and visible trust cues such as traceability and citations. Commentary on Perplexity’s UX repeatedly highlights its clarity, low distraction, efficient information seeking, and strong chunking of information into manageable units, which is highly relevant to a PSPF workflow product where confidence and scanability matter more than visual drama.

The desired tone is **calm, precise, confident, and non-bureaucratic**. The interface should feel serious enough for assurance work but not heavy or institutional. It should reduce cognitive load, help users move from question to evidence to action, and make trust visible through structure rather than through dense compliance language.

## Australian context

This product is built for Australian Government entities, and the design language reflects that. See [adr/0016-australian-context-amplified.md](adr/0016-australian-context-amplified.md) and [pspf-glossary.md](pspf-glossary.md).

- All user-facing copy uses **Australian English** (`organisation`, `colour`, `behaviour`, `optimise`, `recognise`, `centre`, `licence` as a noun, `defence`, `analyse`). Code identifiers and CSS tokens may remain US English; copy may not.
- Dates display as `DD MMM YYYY` (e.g. `10 May 2026`) by default; numeric `DD/MM/YYYY` only where space is constrained.
- Currency is **AUD** with the `$` glyph and a trailing ` AUD` suffix where ambiguity is possible. Financial year is `FY 2025–26` with an en-dash.
- The PSPF Domains (governance, information, personnel, physical) are the **primary navigation grouping** in Workshop and Explorer.
- **Essential Eight** strategies are surfaced on the Posture screen using the ASD names verbatim, as a peer to PSPF outcomes.
- **OFFICIAL: Sensitive** with **TLP:AMBER+STRICT** is the literal banner copy in Explorer; do not paraphrase.
- Citations to Home Affairs (protectivesecurity.gov.au), ASD/ACSC (cyber.gov.au), and the OAIC are visible in the footer and in About; in v0.1 they are text only, no live links, to preserve the zero-egress invariant.
- Reading level target is Year 9 plain Australian English.

## Design goals

The design system should optimise for five outcomes:

1. **Fast orientation** — users should understand where they are, what changed, and what requires attention within seconds.
2. **Trust and defensibility** — evidence, provenance, and status should be legible and hard to confuse.
3. **Low-friction authoring** — structured work should feel lightweight rather than form-heavy.
4. **Clear hierarchy across products** — Core, Workshop, Shop, Pub, and Explorer should feel related but not identical.
5. **Accessible calm** — light and dark mode should both be easy to read, with restrained colour and WCAG-compliant contrast.

## Product architecture and visual relationship

### Product family

The ecosystem has four visible product surfaces plus one internal platform role:

| Product | Role | Primary interaction style |
|---|---|---|
| Core | Shared platform administration | compact admin and integrity views |
| Workshop | Deep editing, analysis, and assurance | dense working views, diagnostics, structured detail |
| Shop | Supplier, contract, and spend workflows | operational list-detail workflows |
| Pub | People, role, and assignment workflows | operational list-detail workflows |
| Explorer | Public-facing or broadly shareable web app | narrative dashboards, summaries, and drill-in |

Core, Workshop, Shop and Pub should feel like the same product family because they share entity model, command palette conventions, and visual language. Each ships as its own VS Code extension with its own Activity Bar entry. Explorer should feel recognisably related, but lighter, more presentation-ready, and more narrative in its framing.

### Visual family traits

Across all products, the family should share:

- warm neutral surfaces,
- restrained teal as the primary accent,
- clear typography hierarchy,
- minimal icon usage,
- compact but calm spacing,
- and visible trust markers such as timestamps, provenance, and status chips.

## Visual direction

### Core aesthetic

The interface should be inspired by a blend of:

- Perplexity’s clean answer-first and source-visible interaction patterns,
- VS Code’s native navigation and extension surfaces for the extension-based products,
- and modern dark/light neutral systems that avoid pure black and pure white while maintaining accessible contrast.

The interface must avoid generic “cyber” aesthetics such as neon glows, blue-purple gradients, glowing grids, or dashboard theatrics. This is a trust product, not a security marketing page.

### Mood words

Use these words as a design check:

- Grounded
- Clear
- Measured
- Warm
- Sharp
- Verifiable
- Quietly capable

If a screen feels flashy, dense, or ceremonial, it is probably off brief.

## Colour system

### Palette principles

The palette should use a neutral foundation with one disciplined accent. Teal is the primary accent because it communicates calm precision without defaulting into generic enterprise blue, while warm neutrals prevent the product from feeling cold or clinical.

### Primary colour roles

| Token | Intent | Suggested direction |
|---|---|---|
| Background | Main canvas | warm off-white / warm charcoal |
| Surface | Cards, panels, sidebars | slightly lifted neutral |
| Text primary | Main reading text | deep charcoal / soft off-white |
| Text muted | Supporting labels | medium neutral grey |
| Accent primary | Primary actions, active state | deep teal |
| Success | Positive state | moss / restrained green |
| Warning | Attention state | warm amber-brown |
| Error | Issue state | subdued berry-red |
| Link / citation | Navigational trust cue | teal or teal-blue |

### Contrast rules

Text under normal reading size must meet at least 4.5:1 contrast, and large text and important graphical components must meet at least 3:1 contrast, which is consistent with established accessibility guidance for light and dark UI.

### Dark mode approach

Dark mode should avoid pure black backgrounds and pure white text because extremely high contrast can increase visual fatigue and reduce legibility. Use softened dark neutrals with calm contrast rather than dramatic black-on-white inversion.

### Status colours

Status colour must be used sparingly and semantically:

- Teal for active/selected/primary.
- Green for effective/complete/healthy.
- Amber for needs attention or partial readiness.
- Red only for actual issues, not for general incompleteness.
- Grey for draft, inactive, or unknown.

Status should never rely on colour alone; it must always be paired with a label or icon.

## Typography

### Tone and use

Typography should carry most of the interface personality. The system should use one body font and one optional display/emphasis font family at most.

Recommended direction:

- **Body/UI font**: clean, high-legibility sans-serif.
- **Display/accent font**: optional, only for Explorer or high-level headings; not required in dense extension views.

### Hierarchy

The hierarchy should be narrow and consistent:

- Page title
- Section title
- Card title
- Body text
- Metadata/label text

There should not be many decorative type sizes. The product should feel editorially ordered, not presentation-heavy.

### Writing density

Long paragraphs should be rare in extension surfaces. Most working views should use short blocks, labels, tables, and structured summaries. Explorer can use longer explanatory text where necessary.

## Layout system

### Extension products

VS Code-based products should follow native UX guidance closely. The Activity Bar and Primary Sidebar should be used for navigation containers, views should be kept minimal, status bar use should be restrained, and custom webviews should be used only when native views cannot support the required interaction.

The main extension surfaces should follow a three-level model:

1. **Sidebar / navigator** — domain entry and object browsing.
2. **Main working view** — list, detail, editor, or diagnostic content.
3. **Context rail / metadata area** — provenance, links, health, changes, and related actions.

### Explorer

Explorer should use a web layout with:

- top header,
- left or collapsible navigation,
- main narrative content area,
- optional right-side context rail for filters, metadata, and export controls.

The Explorer layout should privilege summaries, evidence-backed status views, and drill-in over complex editing.

## Navigation model

### VS Code Product Surfaces

VS Code guidance recommends using Activity Bar items as view containers and keeping the number of views low. Tree views should be used for structured data, and webviews should be reserved for richer interactions that exceed native capabilities.

Recommended view containers (one Activity Bar entry per extension):

| Container | Owning extension | Purpose |
|---|---|---|
| Core | `pspf-core` | platform health, config, snapshots, imports/exports |
| Workshop | `pspf-workshop` | requirement, evidence, action, risk authoring; reporting preparation |
| Shop | `pspf-shop` | suppliers, contracts, spend |
| Pub | `pspf-pub` | people, roles, assignments |

Within each container, sub-views use direct nouns (`Requirements`, `Evidence`, `Actions`, `Risks`, `Reporting`, `Snapshots`, `Suppliers`, `Contracts`, `People`, `Roles`, `Assignments`). The earlier `Hearth`, `Trail`, `Lookout`, `Skylight` names are retired and MUST NOT appear in code, UI labels, settings, or product documentation outside historical ADRs and explicit retirement notes.

### Navigation principles

- Keep labels short and plain.
- Favor noun-based navigation over abstract verbs.
- Limit top-level containers.
- Use subviews to separate lists, details, and diagnostics rather than multiplying major entry points.
- Preserve the user’s place and context when switching views.

## Screen patterns

### Pattern 1: Summary overview

Purpose: answer “what is the state of things?” at a glance.

Typical ingredients:
- status summary cards,
- trend chips,
- readiness indicators,
- top risks,
- recent changes,
- and next actions.

This pattern should appear in Explorer, the Workshop Reporting view, and the Core health surface.

### Pattern 2: List-detail working view

Purpose: browse and work through a set of records.

Typical layout:
- searchable/filterable list on the left,
- selected item detail in the main pane,
- related evidence/links/history in a right rail or collapsible section.

This pattern should dominate Workshop, Shop, and Pub.

### Pattern 3: Guided validation view

Purpose: help the user move from assertion to defensible structured record.

Typical elements:
- current claim or status,
- missing fields or warnings,
- required evidence checklist,
- provenance details,
- and recommended next actions.

This pattern is especially important for Workshop.

### Pattern 4: Snapshot/report view

Purpose: prepare material for executive or reporting consumption.

Typical elements:
- date and snapshot identity,
- status by domain,
- narrative summary,
- evidence coverage,
- top actions and top risks,
- export/download controls.

This pattern should be shared between the Workshop Reporting view, Explorer, and Core export history.

## Core design spec

### Core purpose in the interface

Core is the product surface for platform administration, not for day-to-day domain work. Its UI should feel compact, infrastructural, and trustworthy.

### Core views

Recommended Core views:

| View | Purpose | Interaction style |
|---|---|---|
| Workspace | bootstrap, workspace structure, trust state | summary + actions |
| Health | storage health, integrity, compatibility, product detection | summary + warnings |
| Config | shared settings and policies | form + validation |
| Snapshots | create, inspect, and manage snapshots | list-detail |
| Exchange | import/export bundles and history | list-detail |
| Diagnostics | migration, repair, and index tools | task-focused utility |

### Core content tone

Core should speak in direct operational language, for example:
- “Workspace initialised”
- “Snapshot created”
- “Schema upgrade required”
- “3 links need repair”
- “Explorer export ready”

It should avoid casual metaphors in functional labels even if the wider family uses playful names.

## Workshop design spec

### Workshop purpose

Workshop is the deep work surface for assurance, structured editing, diagnostics, and defensible record shaping. It should feel capable, focused, and dense without being cramped.

### Workshop content priorities

On any detail screen, the visual order should generally be:
1. Current object identity and state.
2. What is incomplete, risky, or stale.
3. Evidence and linked records.
4. Editing surface.
5. History and provenance.

### Workshop interaction cues

Workshop should make uncertainty visible. Good examples:
- “Status set, rationale missing”
- “Evidence attached but older than 12 months”
- “2 linked actions unresolved”
- “Snapshot impact: this change will affect reporting readiness”

This helps users reason about defensibility rather than simply filling fields.

## Shop and Pub design spec

### Shop

Shop should focus on supplier, contract, spend, and forecast workflows. The visual emphasis should be on commercial relationships, obligations, linked controls, action status, forecast cost, expected savings, and investment timing rather than on dense compliance framing.

Core Shop page types:
- supplier directory,
- supplier profile,
- contract detail,
- spend and uplift tracking,
- spend forecast,
- savings opportunities,
- linked requirements and risks.

Shop should answer practical commercial questions in plain language:
- “What are we already committed to spend?”
- “Which controls or actions depend on funding?”
- “Where can we invest now to save money later?”
- “Which savings assumptions are strong, weak, or unproven?”
- “What is the expected payback period?”

Recommended Shop graphics:
- forecast spend by financial year,
- expected savings by financial year,
- net benefit line or bar by period,
- invest-now-save-later opportunity ranking,
- payback-period distribution,
- contract renewal / savings window timeline,
- supplier concentration by spend and criticality.

### Pub

Pub should focus on people, roles, capacity, and assignments. The visual emphasis should be on who is responsible, where responsibility is missing, and how work or accountability is distributed.

Core Pub page types:
- people directory,
- role detail,
- assignment board,
- responsibility gaps,
- linked actions and workload context.

## Explorer design spec

### Explorer role

Explorer is the most outward-facing product. It should be readable by users who are not living inside the authoring environment and should privilege understanding over editing.

Per ADR 0036, Explorer is the portable review, briefing, lightweight annotation, and round-trip suggestion surface. Workshop remains the system of record and decision surface for canonical authoring, validation, import review, merge/undo history, and audit-friendly decisions. Explorer local edits are browser-local proposed changes until Workshop accepts them through import.

### Explorer visual behaviour

Explorer should feel more editorial and more presentational than the extensions:
- larger headings,
- more generous spacing,
- clear story blocks,
- stronger summary cards,
- and obvious export/share affordances.

The Explorer identity variation should use a warmer, briefing-style expression of the PSPF family:

- warm charcoal and stone-neutral surfaces rather than VS Code-like grey panels;
- restrained teal for trust, navigation, active state, and local-change markers;
- amber only for sensitivity, TLP, and browser-local storage notices;
- a masthead that presents `PSPF Explorer` as a portable assurance view;
- a persistent mode strip showing `Bundle baseline`, `Local changes`, and `Export to Workshop`;
- visible trust markers such as `from bundle`, `local`, `remembered in this browser`, and `ready to export`.

The visible Explorer local-editing surface is named `Local Changes`. Internal code identifiers and bundle exchange mode may continue to use `local-authoring` where that is the stable contract term.

### Explorer page model

Recommended top-level pages:

| Page | Purpose |
|---|---|
| Home | overall posture and recent changes |
| Requirements | requirement status and drill-in |
| Domains | grouped policy or capability views |
| Evidence | evidence coverage and freshness |
| Actions | remediation and delivery view |
| Risks | linked risks and exposure summaries |
| Reports | snapshot summaries and downloadable outputs |

### Explorer content voice

Explorer should explain status in clear language. For example:
- “6 requirements need updated evidence”
- “Reporting readiness has improved since the last snapshot”
- “Two risks remain without agreed treatment”
- “This domain is mostly established, but several records need review before reporting”

It should avoid extension-oriented language such as “workspace state” or “schema migration” except in admin contexts.

### Shareable graphics

Explorer should provide simple, consumer-friendly graphics that can be copied or saved as images for email, Teams, and briefings. These graphics are not a substitute for the underlying table or detail view; they are quick communication artefacts.

Recommended simple graphics:

- compliance status donut, showing count of requirements by compliance state, with a centre label for met percentage and remaining requirements to reach 100% met;
- domain posture stacked bar;
- Essential Eight posture bar;
- evidence confidence/freshness distribution;
- action due-state distribution;
- grouped action checklist;
- Gantt-lite action timeline;
- risk impact/likelihood matrix;
- Direction response-state summary.

Each shareable graphic should include visible title, scope, generated-at time, active filters, and source/freshness cue. Any copied or saved image must respect the same redaction posture as the view it came from.

Detailed interactive analysis belongs in the dedicated module surfaces. Explorer graphics should stay legible when pasted into email or Teams, while Workshop/Shop/Pub module views may be denser, more interactive, and optimised for power users.

## Component system

### Core components

The ecosystem should rely on a small reusable component set:

- top navigation/header,
- side navigation,
- status chip,
- evidence badge,
- metric tile,
- section card,
- object header,
- list row,
- timeline/history block,
- warning panel,
- trust/provenance panel,
- and export action set.

### Status chips

Status chips are central to the design and should be consistent everywhere. Suggested states include:

- Draft
- In review
- Ready
- Effective
- Partial
- Needs update
- At risk
- Archived

### Evidence badges

Evidence badges should communicate both presence and quality, for example:
- Missing
- Attached
- Partial
- Stale
- Verified

## Trust markers

Trust is a product feature and should be visible.

Every major object view should surface, in a quiet but obvious way:
- last updated time,
- who or what changed it,
- source product,
- snapshot impact,
- link count,
- and evidence state.

Explorer should also surface source-aware trust markers such as snapshot date, export date, and scope of included data.

## Writing system

### Voice and tone

The writing style should be:
- plain,
- concise,
- factual,
- and specific.

It should avoid:
- bureaucratic padding,
- abstract transformation language,
- and overclaiming certainty.

### Preferred writing patterns

Use:
- “Needs updated evidence” instead of “non-compliant artefact posture”
- “Ready for reporting” instead of “assessment completeness condition achieved”
- “Linked action overdue” instead of “remediation dependency delinquent”

### Content layers

The product should support three content layers:

| Layer | Purpose | Style |
|---|---|---|
| Summary | quick orientation | short, plain, scannable |
| Working detail | operational decisions | structured, specific, linked |
| Reporting narrative | executive or outward-facing use | concise, polished, contextual |

## Empty, loading, and error states

### Empty states

Empty states should be helpful and specific. Good examples:
- “No snapshots yet. Create a snapshot to preserve a reporting view.”
- “No supplier links found. Add a supplier or import contract data.”
- “No evidence attached. Add at least one source before marking this ready.”

### Loading states

Loading should use skeletons or subtle progress indicators rather than blank screens. The UI should keep enough structure visible that users understand what kind of content is coming.

### Error states

Errors should be actionable and safe. Use messages like:
- “Export could not be completed”
- “Workspace trust is required to continue”
- “Schema version is not compatible with this product version”

Avoid dumping raw technical errors into the main workflow unless the user opens details.

## Notifications and status bar

VS Code guidance recommends restraint in the status bar and warns against excessive prominence. Status bar items should be short, global, and limited in number, while warnings or progress should be elevated only when necessary.

Design rules:
- Use at most one main platform status item.
- Do not place sensitive detailed information in the status bar.
- Use progress notifications for elevated tasks such as export or migration.
- Use warning/error emphasis only for significant conditions.

## Accessibility

### Baseline

The ecosystem should meet WCAG AA contrast requirements for normal text and UI components, use semantic structure in web surfaces, preserve keyboard navigation, and avoid relying solely on colour to communicate status.

### Accessibility specifics

- All status cues must include labels, not just colour.
- Focus states must be strong and consistent.
- Tables and lists must remain keyboard navigable.
- Dark and light themes must both be validated independently.
- Information-dense views must maintain readable spacing and label clarity.

## Design tokens

### Base tokens

Suggested token groups:
- colour/background/surface/text/accent/status
- type scale
- spacing scale
- radius scale
- border alpha scale
- shadow scale
- motion timing

### Character of motion

Motion should be minimal and informative rather than decorative. Use motion for:
- expanding details,
- switching list/detail state,
- confirming exports or snapshots,
- and surfacing validation results.

Avoid decorative motion or anything that makes the product feel theatrical.

## Brand and naming use

The family name and product names should be used clearly and consistently.

Recommended pattern:
- **Family name**: PSPF
- **Product names**: Core, Workshop, Shop, Pub, Explorer
- **Functional labels** where clarity matters most, especially in admin or setup surfaces

For example, the Activity Bar item might say **Workshop** while the page title says **Workshop — Requirements**.

This preserves recognisability without compromising usability.

## Initial screen inventory

### Core
- Workspace setup
- Workspace health
- Shared config
- Snapshot manager
- Exchange manager
- Diagnostics and repair

### Workshop
- Requirement browser
- Requirement detail
- Evidence editor
- Validation queue
- Change history
- Linked actions and risks

### Shop
- Supplier list
- Supplier detail
- Contract detail
- Spend/uplift tracking
- Linked requirement view

### Pub
- People list
- Role detail
- Assignment board
- Responsibility gap view

### Explorer
- Home posture view
- Requirement summary
- Domain summary
- Evidence freshness
- Action tracker
- Risk summary
- Reports and exports

## Implementation guidance

### Extension surfaces

Follow native VS Code conventions by default. Use Activity Bar items and views for primary navigation and keep custom webviews focused and necessary, because this produces a more coherent experience and reduces UX friction inside the editor.

### Web surfaces

Explorer should use a simple, responsive web layout with a clear primary question or summary at the top of each page, supporting metrics beneath, and drill-in below that. This mirrors the best answer-first behaviour associated with Perplexity-style interfaces while remaining grounded in PSPF reporting work.

## Specification summary

The PSPF design system should deliver a calm, trustworthy, source-aware interface family built on warm neutrals, restrained teal emphasis, strong hierarchy, and compact but readable structure. It should make confidence visible, keep friction low, and distinguish between operational authoring surfaces and outward-facing summary/reporting surfaces without fragmenting the product family.
