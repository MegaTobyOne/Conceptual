# PSPF VS Code Extension Surface Specification

## Overview

This specification defines the Visual Studio Code extension surface for the PSPF platform products, with emphasis on **PSPF Core** and **PSPF Workshop**, and supporting patterns for Shop and Pub. It covers extension manifests, contribution points, commands, views, menus, settings, status bar items, walkthroughs, activation events, and the division between Tree Views and Webviews.

Every VS Code extension requires a `package.json` manifest, and the extension surface is primarily declared through the manifest’s `contributes` and `activationEvents` fields.

In VS Code’s model, the key concepts are activation events, contribution points, and the runtime API. Commands declared in the manifest become part of the extension’s contribution surface, and commands can activate the extension when invoked.

## Design goals

The PSPF extension surfaces must:

1. feel native to VS Code,
2. keep persistent workspace operations discoverable but not noisy,
3. prefer Tree Views for structured data navigation,
4. use Webviews only where richer interaction is genuinely necessary,
5. separate Core platform operations from product workflows,
6. and keep activation tight and context-driven.

VS Code guidance explicitly prefers Tree Views for displaying data and advises limiting custom Webview Views to situations where the normal API is insufficient.

## Product surface model

### Core

Core is primarily a platform extension, not the user’s main day-to-day workspace experience. Its surface should stay compact and administrative.

Primary responsibilities:
- workspace/platform health,
- storage/bootstrap visibility,
- validation and integrity operations,
- snapshot/export/import operations,
- compatibility and trust diagnostics,
- and developer/platform tooling.

### Workshop

Workshop is the main operational authoring and evidence workspace. It should provide the richest human-facing surface in VS Code.

Primary responsibilities:
- requirement authoring,
- evidence linkage,
- action/remediation management,
- local validation feedback,
- and report/export preparation.

### Shop and Pub

Shop and Pub should follow the same surface rules but narrower domain-specific navigation. They should reuse shared command, menu, and view patterns wherever possible.

Shop's additional responsibility is commercial planning: supplier, contract, and spend workflows must be able to show forecast cost, expected savings, payback, and where investment now may reduce future cost, effort, or risk.

## Manifest model

### Required manifest fields

Each extension manifest must define at minimum:

- `name`
- `displayName`
- `description`
- `version`
- `publisher`
- `engines.vscode`
- `main`
- `activationEvents`
- `contributes`

This matches the VS Code extension manifest model, where `package.json` is the root declaration for both metadata and contribution points.

### Shared naming rules

Use a consistent command and setting namespace:

- Core: `pspf.core.*`
- Workshop: `pspf.workshop.*`
- Shop: `pspf.shop.*`
- Pub: `pspf.pub.*`
- Shared platform settings where needed: `pspf.*`

### Extension IDs

Suggested IDs:

| Product | Extension ID |
|---|---|
| Core | `your-org.pspf-core` |
| Workshop | `your-org.pspf-workshop` |
| Shop | `your-org.pspf-shop` |
| Pub | `your-org.pspf-pub` |

## Surface architecture

### Primary rule

Use **Tree Views for navigation and state inspection**, and use **Webviews only for complex editing or reporting surfaces** that cannot be expressed cleanly with native VS Code controls. This aligns with VS Code guidance: Tree Views are preferred for data views, while Webviews should be used only when absolutely necessary.

### Recommended surface split

| Surface type | Use for | Avoid for |
|---|---|---|
| Tree View | navigable hierarchies, queues, lists, grouped entities, health/status panels | rich forms, dashboards requiring custom layout |
| WebviewView | rich side-panel summary, evidence detail, relationship inspector | generic navigation trees |
| WebviewPanel | focused report preview, export review, complex compare/diff | routine CRUD lists |
| Commands | actions, creation flows, repair/maintenance, navigation shortcuts | deep multistep editing on their own |
| Settings | durable extension behaviour/configuration | transient workflow state |
| Status bar | compact workspace/platform signal | detailed health dashboards |

## View containers and views

VS Code views live in containers such as the Activity Bar sidebars or panels, and guidance recommends keeping the number of views small and providing icons because views may be moved by users.

### Core view container

Core should contribute a single compact view container in the secondary sidebar or activity bar only if necessary.

Suggested container:
- `pspfCore`
- title: `PSPF Core`
- icon: subtle platform glyph

Suggested views under Core:

| View ID | Type | Purpose |
|---|---|---|
| `pspfCore.healthView` | Tree View | platform health, trust, storage, schema, compatibility |
| `pspfCore.operationsView` | Tree View | snapshots, exports, imports, migrations |
| `pspfCore.welcomeView` | Welcome view | bootstrap/install guidance when empty |

### Workshop view container

Workshop should be the main operational container.

Suggested container:
- `pspfWorkshop`
- title: `PSPF Workshop`
- icon: workshop/tool glyph

Suggested views under Workshop:

| View ID | Type | Purpose |
|---|---|---|
| `pspfWorkshop.requirementsView` | Tree View | requirements grouped by domain/status |
| `pspfWorkshop.evidenceView` | Tree View | evidence items grouped by freshness/coverage |
| `pspfWorkshop.actionsView` | Tree View | actions grouped by owner/due state |
| `pspfWorkshop.risksView` | Tree View | risk items grouped by severity/domain |
| `pspfWorkshop.directionsView` | Tree View | Directions grouped by response state/domain |
| `pspfWorkshop.homeView` | WebviewView | compact Workshop Home for readiness counts, next actions, and command launch buttons |
| `pspfWorkshop.summaryView` | WebviewView | compact posture summary and readiness |
| `pspfWorkshop.welcomeView` | Welcome view | empty-state guidance |

### Why this split

Tree Views are better for entity navigation, count scanning, filtering, and reveal actions. A small WebviewView for Workshop Home or summary is justified because it can present richer rollups, progress blocks, and command launch buttons that would be awkward in a pure tree. Home must not become a duplicate navigator; it launches existing workflows and shows high-level readiness only.

### Shop view container

Suggested container:
- `pspfShop`
- title: `PSPF Shop`
- icon: commercial/procurement glyph

Suggested views under Shop:

| View ID | Type | Purpose |
|---|---|---|
| `pspfShop.suppliersView` | Tree View | suppliers grouped by criticality/status |
| `pspfShop.contractsView` | Tree View | contracts grouped by supplier/renewal/status |
| `pspfShop.spendView` | Tree View | spend items grouped by financial year/status |
| `pspfShop.forecastView` | WebviewView | spend forecast, savings opportunities, payback, and investment timeline |
| `pspfShop.welcomeView` | Welcome view | empty-state guidance |

## Commands

Commands are a core extension mechanism in VS Code and should map to meaningful actions users can discover through the Command Palette, view title actions, context menus, and internal flow triggers.

### Command design rules

- Use verb-first human titles.
- Use stable command IDs.
- Prefer commands that can work from context selections.
- Do not create dozens of micro-commands that clutter the palette.
- Reserve destructive/admin operations to Core and gate them with confirmation.

### Core commands

> **v0.1 implementation note.** v0.1 ships a subset of the command set below. The unified `pspf.core.openHealth` view is deferred to v0.2 — its information is surfaced through `pspf.core.validateWorkspace`, `pspf.core.verifyIntegrity`, and `pspf.core.showWriterLock` in v0.1 (see [pspf-development-readiness-review.md](pspf-development-readiness-review.md) § Remaining readiness risks). `pspf.core.exportExplorerBundle` is renamed to `pspf.core.exportBundle` per ADR 0009 (single master bundle); both rows below are retained for spec continuity but the implementation uses the master-bundle name. `pspf.core.runMigration`, `pspf.core.openLogs`, and `pspf.core.rebuildIndexes` are v0.2+.

| Command ID | Title | Placement |
|---|---|---|
| `pspf.core.openHealth` (v0.2+) | PSPF Core: Open Health | command palette, view title |
| `pspf.core.validateWorkspace` | PSPF Core: Validate Workspace | palette, view title |
| `pspf.core.verifyIntegrity` | PSPF Core: Verify Integrity | palette, view title |
| `pspf.core.showWriterLock` | PSPF Core: Show Writer Lock | palette |
| `pspf.core.createSnapshot` | PSPF Core: Create Snapshot | palette, view title |
| `pspf.core.exportBundle` (was `pspf.core.exportExplorerBundle` per ADR 0009) | PSPF Core: Export Master Bundle | palette, view title |
| `pspf.core.importBundle` | PSPF Core: Import Master Bundle | palette |
| `pspf.core.runMigration` (v0.2+) | PSPF Core: Run Migration | palette only |
| `pspf.core.openLogs` (v0.2+) | PSPF Core: Open Platform Logs | palette |
| `pspf.core.rebuildIndexes` (v0.2+) | PSPF Core: Rebuild Indexes | palette |

### Workshop commands

| Command ID | Title | Placement |
|---|---|---|
| `pspf.workshop.openRequirement` | Workshop: Open Requirement | tree item, context |
| `pspf.workshop.openHome` | Workshop: Open Home | activity bar, status bar, command palette |
| `pspf.workshop.newRequirement` | Workshop: New Requirement | palette, view title |
| `pspf.workshop.newEvidence` | Workshop: New Evidence | palette, view title |
| `pspf.workshop.linkEvidence` | Workshop: Link Evidence | item context, editor title |
| `pspf.workshop.newAction` | Workshop: New Action | palette, view title |
| `pspf.workshop.newDirection` | Workshop: New Direction | palette, view title |
| `pspf.workshop.reviewEvidence` | Workshop: Review Evidence | palette, view title |
| `pspf.workshop.openActionImpact` | Workshop: Open Action Impact | palette, summary view |
| `pspf.workshop.copyShareableBrief` | Workshop: Copy Shareable Brief | palette, summary/detail/report views |
| `pspf.workshop.openSummary` | Workshop: Open Summary | palette, view title |
| `pspf.workshop.validateCurrent` | Workshop: Validate Current Item | palette, editor title |
| `pspf.workshop.revealInTree` | Workshop: Reveal in Navigator | editor/title/context |
| `pspf.workshop.prepareReportPack` | Workshop: Prepare Report Pack | palette, view title |
| `pspf.workshop.exportBundle` | Workshop: Export Explorer Bundle | palette |
| `pspf.workshop.manageTags` | Workshop: Manage Tags | palette, Requirements view title |
| `pspf.workshop.manageSavedViews` | Workshop: Manage Saved Views | palette, Workshop Home view title |
| `pspf.workshop.applyTag` | Workshop: Apply Tag to Requirement | item context (Requirement), Requirement Detail tag rail |
| `pspf.workshop.removeTag` | Workshop: Remove Tag from Requirement | item context (Requirement tag chip) |
| `pspf.workshop.filterRequirementsByTag` | Workshop: Filter Requirements by Tag | palette, Requirements view title |

### Shop commands

| Command ID | Title | Placement |
|---|---|---|
| `pspf.shop.newSupplier` | Shop: New Supplier | palette, view title |
| `pspf.shop.newContract` | Shop: New Contract | palette, view title |
| `pspf.shop.newSpendItem` | Shop: New Spend Item | palette, view title |
| `pspf.shop.openForecast` | Shop: Open Spend Forecast | palette, view title |
| `pspf.shop.openSavingsOpportunities` | Shop: Open Savings Opportunities | palette, forecast view |
| `pspf.shop.linkSpendToAction` | Shop: Link Spend to Action | item context |

### Shared hidden/internal commands

You will likely need internal commands for:
- reveal/select synchronisation,
- refresh signals,
- open detail webview,
- and deep-link navigation from diagnostics.

These should not be broadly advertised in the Command Palette unless they are useful to users directly.

## Menus and context placement

Contribution points in the manifest decide where commands appear, including the command palette and menus.

### Command palette

Only user-meaningful commands should appear in the palette. Internal helper commands should be excluded.

### View title menus

Use view title actions sparingly for high-frequency actions.

Suggested Workshop title actions:
- New Requirement
- New Evidence
- Refresh
- Open Summary

Suggested Core title actions:
- Validate Workspace
- Create Snapshot
- Export Explorer Bundle

### Tree item context menus

Tree item context menus are essential for local actions.

Examples:
- Requirement item: Open, Validate, Link Evidence, New Action, Copy Shareable Brief, Copy ID
- Evidence item: Open, Link to Requirement, Mark Freshness Review, Review Impact, Copy ID
- Action item: Open, Update Status, Reveal Linked Requirement, Show Impact
- Risk item: Open, Reveal Supporting Actions
- Direction item: Open, Link Requirement, Link Evidence, New Action, Copy Shareable Brief, Copy ID

### Editor/title menus

If custom editors or rich document views are later added, editor/title actions should remain small and contextual.

## Activation events

Activation events determine when the extension becomes active, and VS Code supports a range of activation models through the manifest.

### General rule

Keep activation narrow. The extensions should not eagerly activate for every window.

### Important current behaviour

VS Code notes that commands declared in the manifest automatically activate the extension when invoked in current versions, reducing the need for explicit `onCommand` entries for every command.

### Core activation events

Suggested Core activation:

```json
"activationEvents": [
  "onStartupFinished",
  "onView:pspfCore.healthView",
  "onView:pspfCore.operationsView",
  "workspaceContains:.pspf/config/workspace.json",
  "workspaceContains:.pspf/core/pspf-core.db"
]
```

#### Why Core may use `onStartupFinished`

Core is the platform layer and may need to perform lightweight health/bootstrap checks after startup when a PSPF workspace is present. Keep that startup work minimal and defer expensive work until commands or views are actually used.

### Workshop activation events

Suggested Workshop activation:

```json
"activationEvents": [
  "onView:pspfWorkshop.requirementsView",
  "onView:pspfWorkshop.evidenceView",
  "onView:pspfWorkshop.actionsView",
  "onView:pspfWorkshop.risksView",
  "onView:pspfWorkshop.summaryView",
  "workspaceContains:.pspf/config/workspace.json",
  "workspaceContains:**/*.pspf.json"
]
```

### Command-driven activation

For modern VS Code, manifest-declared commands activate on invocation, so explicit `onCommand:*` activation entries are only needed if you want precision for older compatibility scenarios.

### What to avoid

Avoid broad activation patterns that make the extensions load in unrelated workspaces. Activate only when the workspace or view context suggests a PSPF project.

## Views versus Webviews

VS Code guidance is explicit: use Webviews only when the normal API is insufficient, and prefer Tree Views for structured data navigation.

### Use Tree Views for

- requirement navigator,
- evidence navigator,
- action queues,
- risk queues,
- health and diagnostics lists,
- snapshot and export history lists.

### Use WebviewView for

- Workshop summary sidebar,
- evidence/requirement relationship preview,
- compact posture/readiness cards,
- bundle export summary panel.

### Use WebviewPanel for

- report pack preview,
- compare/diff between snapshots,
- rich export review,
- future Explorer-like embedded preview if required.

### Do not use Webviews for

- simple navigation trees,
- settings replacement,
- wizards for routine flows,
- or promotional/update splash surfaces.

## Welcome views and onboarding

VS Code supports Welcome views for empty or first-run contexts, and the UX guidance recommends using them only where necessary and keeping them concise.

### Core welcome content

Show only when `.pspf/` is missing or platform bootstrap is incomplete.

Suggested actions:
- Initialise PSPF Workspace
- Open Platform Health
- Review Storage Location

### Workshop welcome content

Show when the workspace is PSPF-capable but has no operational content.

Suggested actions:
- Create first requirement
- Import bundle
- Open summary
- Read workspace guide

## Settings surface

Extensions can contribute settings that appear in VS Code’s Settings UI under Extensions.

### Settings design rules

- Use settings only for durable behaviour and defaults.
- Do not use settings as a database.
- Prefer workspace settings for project behaviour, user settings for UI preferences.

### Core settings

| Setting | Type | Scope | Purpose |
|---|---|---|---|
| `pspf.core.logLevel` | string | user/workspace | logging verbosity |
| `pspf.core.strictIntegrity` | boolean | workspace | fail closed on integrity issues |
| `pspf.core.autoValidateOnOpen` | boolean | workspace | lightweight validation on open |
| `pspf.core.export.redactionProfile` | string | workspace | default Explorer export profile |
| `pspf.core.experimentalFeatures` | array | user | gated non-stable features |

### Workshop settings

| Setting | Type | Scope | Purpose |
|---|---|---|---|
| `pspf.workshop.groupRequirementsBy` | string | user/workspace | tree grouping mode |
| `pspf.workshop.showDerivedFields` | boolean | user | toggle derived metadata in UI |
| `pspf.workshop.defaultRequirementStatus` | string | workspace | default creation value |
| `pspf.workshop.summary.refreshMode` | string | user | auto/manual summary refresh |
| `pspf.workshop.showIDs` | boolean | user | show canonical IDs in trees and detail panels |

## Status bar items

VS Code advises limiting status bar items because many extensions share the same surface.

### Recommendation

Use at most one status bar item per extension, and ideally only one across the whole PSPF suite in a given workspace.

### Preferred status item

A single compact item from Core:
- label example: `PSPF: Healthy` / `PSPF: Needs Validation`
- click action: open Core health view
- visibility: only in PSPF workspaces

Workshop usually should not add its own persistent status bar item unless Core is absent.

## Walkthroughs

A lightweight walkthrough can help bootstrap the first-run experience, but it should not be a long tutorial trapped inside the extension UI.

### Suggested walkthroughs

#### Core walkthrough
- Initialise workspace
- Validate workspace
- Create snapshot
- Export Explorer bundle

#### Workshop walkthrough
- Create first requirement
- Add evidence
- Create remediation action
- Open summary
- Prepare report pack

## Context keys

Use context keys to make menus and views appear only where appropriate.

### Suggested keys

- `pspf.isWorkspace`
- `pspf.coreAvailable`
- `pspf.hasBootstrap`
- `pspf.hasRequirements`
- `pspf.hasEvidence`
- `pspf.canExportExplorer`
- `pspf.canRunMigrations`
- `view == pspfWorkshop.requirementsView`
- `viewItem == requirement`
- `viewItem == evidence`
- `viewItem == action`
- `viewItem == risk`

These keys should drive `when` clauses across menus, welcome content, and title actions.

## Example manifest fragments

### Core manifest fragment

```json
{
  "activationEvents": [
    "onStartupFinished",
    "onView:pspfCore.healthView",
    "onView:pspfCore.operationsView",
    "workspaceContains:.pspf/config/workspace.json",
    "workspaceContains:.pspf/core/pspf-core.db"
  ],
  "contributes": {
    "commands": [
      {
        "command": "pspf.core.validateWorkspace",
        "title": "PSPF Core: Validate Workspace"
      },
      {
        "command": "pspf.core.exportBundle",
        "title": "PSPF Core: Export Master Bundle"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "pspfCore",
          "title": "PSPF Core",
          "icon": "media/core.svg"
        }
      ]
    },
    "views": {
      "pspfCore": [
        {
          "id": "pspfCore.healthView",
          "name": "Health"
        },
        {
          "id": "pspfCore.operationsView",
          "name": "Operations"
        }
      ]
    }
  }
}
```

### Workshop manifest fragment

```json
{
  "activationEvents": [
    "onView:pspfWorkshop.requirementsView",
    "onView:pspfWorkshop.evidenceView",
    "onView:pspfWorkshop.actionsView",
    "onView:pspfWorkshop.risksView",
    "onView:pspfWorkshop.summaryView",
    "workspaceContains:.pspf/config/workspace.json",
    "workspaceContains:**/*.pspf.json"
  ],
  "contributes": {
    "commands": [
      {
        "command": "pspf.workshop.newRequirement",
        "title": "Workshop: New Requirement"
      },
      {
        "command": "pspf.workshop.openSummary",
        "title": "Workshop: Open Summary"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "pspfWorkshop",
          "title": "PSPF Workshop",
          "icon": "media/workshop.svg"
        }
      ]
    },
    "views": {
      "pspfWorkshop": [
        {
          "id": "pspfWorkshop.requirementsView",
          "name": "Requirements"
        },
        {
          "id": "pspfWorkshop.evidenceView",
          "name": "Evidence"
        },
        {
          "id": "pspfWorkshop.actionsView",
          "name": "Actions"
        },
        {
          "id": "pspfWorkshop.risksView",
          "name": "Risks"
        },
        {
          "id": "pspfWorkshop.summaryView",
          "name": "Summary",
          "type": "webview"
        }
      ]
    }
  }
}
```

## Recommended first implementation scope

### Core MVP surface

Implement first:
- one Core container,
- Health tree,
- Operations tree,
- Validate Workspace command,
- Create Snapshot command,
- Export Explorer Bundle command,
- single status bar item.

### Workshop MVP surface

Implement first:
- one Workshop container,
- Requirements tree,
- Evidence tree,
- Summary webview,
- New Requirement command,
- Link Evidence command,
- Prepare Report Pack command.

## Surface anti-patterns

Avoid:
- too many Activity Bar icons,
- Webviews for basic hierarchical data,
- command explosion in the palette,
- persistent startup activation in non-PSPF workspaces,
- duplicate commands across Core and Workshop without a clear owner,
- and status bar clutter.

## Conformance requirements

A conforming PSPF VS Code extension surface must:

- declare its primary contributions in `package.json`,
- keep activation contextual,
- prefer Tree Views for navigable data,
- use Webviews only where they add real value,
- expose user-meaningful commands with stable IDs,
- contribute only minimal status bar presence,
- and use settings for durable behaviour only.

## Specification summary

The PSPF VS Code extensions should follow a native VS Code surface model: manifests define contributions, activation stays narrow, Tree Views handle the bulk of structured navigation, and Webviews are reserved for the few places where richer interaction or reporting genuinely needs them. This matches VS Code’s guidance on contribution points, activation events, views, and restrained webview use.

The practical result is a compact administrative surface for Core and a richer operational authoring surface for Workshop, with stable commands, minimal noise, and enough structure to scale cleanly into Shop and Pub later.
