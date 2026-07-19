<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

Below is an implementation-ready UI refresh spec for the current app. It adopts a dark, VS Code-native shell with deliberately richer colour in content, so status, priority, evidence, and relationships are easier to scan without turning the interface into a rainbow dashboard.[^1][^2]

(see the generated image above)

## Purpose

Modernise the current PSPF Workshop UI into a calm, dense, executive-grade workspace for controls, requirements, evidence, and actions. Preserve the existing local-first model and functionality; this is a visual-system and component refresh, not a change to the data model or network posture.[^3]

The interface MUST remain recognisably native to VS Code, use theme-aware colours, support keyboard navigation, and work when placed in the primary sidebar, secondary sidebar, or panel.[^2][^4][^5]

## Design principles

- **Dark, quiet shell:** Let VS Code supply the primary canvas, foreground, border, focus, and editor-theme context through its webview CSS variables.[^6][^2]
- **Colour carries meaning:** Apply colour predominantly to information-bearing content: status, risk, evidence types, ownership, links, progress, and exceptions.
- **One dominant action:** Each screen or card group has one visually prominent primary action; other commands appear as secondary controls, toolbar actions, or context menus.[^7][^2]
- **Progressive disclosure:** Show summary, implication, and next action first; expose evidence, relationships, source detail, and operational metadata on demand.[^8]
- **Dense but breathable:** Use compact controls and tables, but preserve consistent spacing, strong group headings, and clear scan lines.[^1]
- **No decorative colour:** Do not use gradients, glowing effects, generic “cyber” artwork, or bright colour as background decoration.[^1]

## Component tokens

Use VS Code webview theme variables as the base. Define extension tokens as aliases or calculated semantic layers, not hard-coded page-specific colours; webviews are expected to be themeable and accessible across themes.[^2][^6]

```css
:root {
  /* VS Code foundation */
  --app-bg: var(--vscode-editor-background);
  --app-surface: var(--vscode-sideBar-background);
  --app-surface-raised: var(--vscode-editorWidget-background);
  --app-text: var(--vscode-foreground);
  --app-text-muted: var(--vscode-descriptionForeground);
  --app-border: var(--vscode-widget-border);
  --app-focus: var(--vscode-focusBorder);

  /* Layout */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  --radius-control: 4px;
  --radius-card: 8px;
  --border-subtle: 1px solid color-mix(in srgb, var(--app-border) 72%, transparent);

  /* Semantic colour: use for content, not chrome */
  --status-ready: #35b7a8;
  --status-review: #e7ad3e;
  --status-risk: #e06b62;
  --status-info: #6199df;
  --status-linked: #a980df;
  --status-complete: #8cab61;
}
```

Where `color-mix()` support is a concern, provide static fallbacks using VS Code token-based borders and background colours. The semantic tokens need a light-theme equivalent during implementation, even if dark mode is the primary target.[^6][^2]

## Colour semantics

Use a fixed semantic palette so colour retains meaning across every view. Do not use the same colour to communicate different states in different modules.

| Semantic role          |      Colour | Applies to                                                       | Example                           |
| :--------------------- | ----------: | :--------------------------------------------------------------- | :-------------------------------- |
| Primary action / ready |        Teal | Main CTA, active state, healthy progress                         | “Create action”, on-track control |
| Attention / review     |       Amber | Needs review, due soon, incomplete evidence                      | “Review evidence”                 |
| Risk / overdue         |   Coral-red | High priority, overdue, blocked, failed validation               | Overdue action                    |
| Information / evidence |        Blue | Evidence, source artefacts, reference material                   | Linked policy or artefact         |
| Connected / strategy   |      Violet | Related requirements, strategy links, cross-domain relationships | Linked strategy outcome           |
| Complete               | Olive green | Closed, verified, accepted, completed work                       | Accepted assurance statement      |

Use low-saturation tinted backgrounds for badges and cards, not full saturated panels. For example, an “At risk” card may use a neutral dark surface, a coral dot, a coral label, and a faint coral-tinted progress track—not a large red background.[^1]

## Typography and spacing

Use the VS Code font stack or inherit the workbench font where practical. Default body text should be 13–14px, small metadata 11–12px, card titles 13–14px semibold, and page or view titles 18–20px semibold.[^9][^2]

Apply a strict 4px spacing rhythm:

- 4px for icon-to-label gaps and dense internal alignment.
- 8px for related fields and stacked metadata.
- 12px for component padding and intra-card groups.
- 16px for standard card padding and major section breaks.
- 24px only between top-level screen sections.

## Buttons

Use three button levels only. Avoid a large button wall at the top of the dashboard; this directly supports your goal of making the interface more portal-like and less cluttered.[^10][^11]

| Type         | Visual treatment                                              | Intended use                                     |
| :----------- | :------------------------------------------------------------ | :----------------------------------------------- |
| Primary      | Solid teal fill, high-contrast text, 28–32px height           | One main action per view, e.g. **Create action** |
| Secondary    | Neutral/transparent surface, thin border, hover surface shift | Supporting action, e.g. **Review evidence**      |
| Quiet / icon | Text or icon only, no permanent container                     | Filters, refresh, copy, open in detail           |
| Destructive  | Coral-red only for consequential actions                      | Escalate, remove, archive, mark failed           |

Buttons MUST have visible keyboard focus and an icon only where it reinforces the label. Keep global or reusable commands in the view toolbar and contextual actions in menus instead of duplicating them as page-level buttons.[^12][^7][^2]

```text
[ + Create action ]   [ Review evidence ]   [⟳] [•••]

Primary               Secondary               Quiet controls
```

## Fields and filters

Create a unified compact field style for search, selection, date, owner, and status. Field labels sit above inputs in forms; in dense filters, use placeholder-plus-icon only where the meaning remains unmistakable.[^13][^2]

```text
Filter controls                         Status
[⌕ Search by title, ID or owner     ]  [ Needs attention ▾ ]

Review by                              Owner
[ 30 Jul 2026                      ]  [ Security Governance ▾ ]
```

Field requirements:

- 28–32px height.
- 4px radius.
- Neutral background with a subtle border.
- Teal focus ring using `--vscode-focusBorder`.
- Use coloured status dots inside selects or result rows, not as a permanent coloured input background.
- Use inline validation below the affected field; do not rely only on a toast.

## Chips and badges

Use chips for compact state, category, and relationship markers. They are not action buttons unless they explicitly open a scoped filter or view.[^7][^2]

```text
● On track       ● Needs review       ● High risk
  teal             amber                coral

Evidence          Strategy link        Verified
blue              violet               olive
```

Chip anatomy:

- 4px colour dot or small leading icon.
- Faint tinted background, approximately 12–16% semantic colour opacity.
- 1px border at approximately 25–35% semantic colour opacity.
- 11–12px medium-weight text.
- No more than three status chips in one row before collapsing into “+n”.

## Cards and content blocks

Cards are used for summary, not for every container. Each card must answer a decision-oriented question: **what is it, what is its state, and what should happen next?**[^8]

```text
┌─────────────────────────────────────────┐
│ ● Controls                         32    │
│                                         │
│ 24 on track · 5 need review · 3 at risk │
│ ━━━━━━━━━━━━━━━━━━━━░░░░░░              │
│                                         │
│ Review the 3 control gaps         →     │
└─────────────────────────────────────────┘
```

Card requirements:

- Dark raised surface, thin neutral border, 8px radius.
- A semantic dot, icon, or small leading colour band—not a full coloured card.
- Optional compact metric aligned top-right.
- One short implication sentence maximum.
- One contextual text action at the bottom where appropriate.
- Do not use thick coloured side borders.

Recommended dashboard cards:

- **Controls:** status mix and highest-risk control group.
- **Requirements:** satisfied, partial, and unassessed counts.
- **Evidence:** freshness, missing artefacts, and review queue.
- **Actions:** overdue, due this week, awaiting approval.
- **Connections:** unlinked actions, orphaned evidence, or cross-domain gaps.

This supports your priority on showing cybersecurity and information governance separately while also surfacing their connections and gaps.

## Tables and worklists

Use tables for action worklists, evidence inventories, and requirement/control mappings. Preserve the density needed for operational work, but replace plain text status with coloured dots and concise chips.[^11]

```text
Action                         Owner          Due       State
────────────────────────────────────────────────────────────────
Update retention mapping       IM Lead        30 Jul    ● Review
Confirm privileged access     Cyber Ops       02 Aug    ● At risk
Archive assurance statement   Business Owner  Done      ● Verified
```

Rules:

- Use alternating hover only, not zebra striping by default.
- Use a 2px–3px semantic status dot in the state column.
- Keep row actions hidden until hover/focus or place them in an overflow menu.
- Default sort is operational relevance: overdue, at-risk, due next, then remaining.
- Support filter chips above the table: **All**, **Needs attention**, **Due soon**, **Mine**.

## Dashboard composition

The dashboard becomes a concise briefing surface. It is not a control catalogue or complete command menu.[^10][^11]

```text
┌──────────────────────────────────────────────────────────────┐
│ PSPF Workshop                                  [Refresh] [•••]│
│ Local governance workspace                                   │
│                                                              │
│ Attention: 3 control gaps require a decision this week       │
│ [Create action]                    [Review evidence]         │
├──────────────────────────────────────────────────────────────┤
│ [Overview] [Controls] [Requirements] [Evidence] [Actions]   │
├───────────────────────┬──────────────────────────────────────┤
│ Controls              │ Decision queue                       │
│ progress ring + state │ 3 items needing review               │
├───────────────────────┼──────────────────────────────────────┤
│ Requirements          │ Evidence freshness                   │
│ status distribution   │ stale / missing / verified           │
├───────────────────────┴──────────────────────────────────────┤
│ Action worklist preview                                      │
└──────────────────────────────────────────────────────────────┘
```

Keep “Overview”, “Controls”, “Requirements”, “Evidence”, and “Actions” as a single segmented navigation system within the webview. Place detailed navigation and object hierarchy in Tree Views rather than reproducing it in the dashboard.[^8][^7]

## Surface allocation

Use the existing VS Code surfaces deliberately:

- **Primary webview/dashboard:** briefing, summary, prioritised queues, visual status, and gateway actions.
- **Tree Views:** structured navigation, object hierarchy, lists, and relationships; VS Code recommends Tree Views for data display.[^7]
- **Panel webview:** wider analysis, evidence comparison, relationship mapping, report preparation, and tables requiring horizontal space.[^5]
- **View toolbar:** refresh, compact filtering, export, and overflow actions; avoid excessive icon buttons.[^5][^7]
- **Welcome view:** only for empty/unconfigured states, with one primary action and clear destination labels.[^7]

## Empty, loading, and feedback states

Give every non-happy path an intentional design:

- **Empty state:** small themed line illustration or product icon, a plain-language explanation, one primary action, and optionally one help link.[^14][^7]
- **Loading state:** skeleton cards matching final structure; avoid blank webviews or indefinite spinners.
- **Inline success:** update the affected row/card with a short confirmation state.
- **Toast:** reserve for non-blocking completion or background refresh; do not use it as the only validation/error mechanism.
- **Error state:** show what failed, what data was affected, and the recovery action.

Example:

```text
No evidence linked yet

Attach an artefact or create an evidence request to begin
assessing this requirement.

[Link evidence]      View evidence guidance
```

## Accessibility and quality gates

All webview UI MUST be keyboard usable, screen-reader labelled, and maintain sufficient contrast. VS Code requires themeable webview elements and specifically calls out contrast, ARIA labels, and keyboard navigation.[^2]

Acceptance criteria:

- Every interactive control has a visible focus state.
- Colour is never the only indicator of priority or status; retain text and/or an icon.
- Body-size text meets WCAG AA contrast against each surface.
- Semantic colours are tested in dark, light, and high-contrast VS Code themes.
- Components reflow cleanly from panel width to narrow sidebar width; the Panel guidance explicitly warns against webviews that fail to resize across containers.[^5]
- No more than one primary button is visible in a given view section.
- View toolbars contain only contextual, high-frequency actions.[^5][^7]
- The app has no hard-coded theme-dependent background, foreground, or border values where a VS Code token is available.[^6][^2]

## Delivery plan

1. **Foundation:** introduce semantic tokens, base typography, spacing, form, button, chip, card, table, and focus styles.
2. **Dashboard:** replace the current top-level button collection with the briefing header, one primary action, and segmented navigation.[^11][^10]
3. **Worklists:** standardise action, evidence, requirement, and control tables around the new state markers and filter patterns.
4. **Detail views:** apply the card, evidence-link, status, and decision patterns to object detail screens.
5. **States:** add empty, loading, inline validation, error, and completion patterns.
6. **QA:** test in narrow sidebar, wide panel, dark/light/high-contrast themes, keyboard-only navigation, and the extension’s local-only data flows.[^2][^5]

The resulting app should feel like a serious VS Code-native operational tool, but with enough purposeful colour and visual hierarchy that high-risk work, evidence quality, and required decisions are immediately legible.
<span style="display:none">[^15][^16][^17][^18]</span>

<div align="center">⁂</div>

[^1]: https://www.perplexity.ai/search/a60f9350-dc51-4407-8733-ac2f7e9db9e3

[^2]: https://code.visualstudio.com/api/ux-guidelines/webviews

[^3]: https://www.perplexity.ai/search/4c686a96-6722-40e5-915c-667a56b59695

[^4]: https://code.visualstudio.com/api/ux-guidelines/overview

[^5]: https://code.visualstudio.com/api/ux-guidelines/panel

[^6]: https://code.visualstudio.com/api/extension-guides/webview

[^7]: https://code.visualstudio.com/api/ux-guidelines/views

[^8]: https://www.perplexity.ai/search/9249ad9f-f4b9-4433-98b8-0811676f5de0

[^9]: https://www.perplexity.ai/search/10090fba-afe9-4c50-ad45-703554786e4e

[^10]: https://www.perplexity.ai/search/c3f41406-9b84-4ae3-ae77-5f884f53c1ac

[^11]: https://www.perplexity.ai/search/1508692a-5ab7-4c81-850a-a476dffe0bfd

[^12]: https://code.visualstudio.com/api/ux-guidelines/context-menus

[^13]: https://www.perplexity.ai/search/37807062-3d43-4470-a739-716cc442c43f

[^14]: https://code.visualstudio.com/api/ux-guidelines/walkthroughs

[^15]: https://code.visualstudio.com/api/ux-guidelines/status-bar

[^16]: https://code.visualstudio.com/api/ux-guidelines/activity-bar

[^17]: https://code.visualstudio.com/api/ux-guidelines/editor-actions

[^18]: https://code.visualstudio.com/api/ux-guidelines/sidebars
