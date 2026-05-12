# PSPF Onboarding Specification

## Purpose

This specification pins the end-to-end first-run experience across every install permutation. It exists because the existing specs each describe their half — Core's bootstrap, Workshop's activation, Explorer's first load — but no single spec walks the user from "I have nothing installed" to "I have a master bundle published".

Onboarding is a v0.1 acceptance criterion (see [adr/0014-v0-1-thin-slice.md](adr/0014-v0-1-thin-slice.md)): a new operator must be able to complete the spine without reading the docs.

## Personas

1. **Australian Government assurance practitioner** (primary). Works in VS Code, on macOS or Windows. Wants to assess against PSPF and Essential Eight, attach evidence, share a brief.
2. **Reviewer / executive** (secondary). Receives an Explorer bundle (a folder, a zip, or a same-origin URL). Does not run VS Code.
3. **Developer / integrator** (tertiary). Maintains or extends the platform. Out of scope for this spec; covered by [pspf-developer-pipeline-spec.md](pspf-developer-pipeline-spec.md).

## Install permutations and behaviour

> **v0.1 implementation note.** v0.1 does not ship a unified Core Health view; the "First-run target" entries below that reference it are surfaced through the discrete commands `PSPF: Validate Workspace`, `PSPF: Verify Integrity`, and `PSPF: Show Writer Lock`. The unified view arrives in v0.2 (see [pspf-development-readiness-review.md](pspf-development-readiness-review.md) § Remaining readiness risks).

| Order | What the user installs | What VS Code prompts | First-run target |
|---|---|---|---|
| A | PSPF Core only | nothing | Core Health view with welcome state |
| B | PSPF Workshop only | "PSPF Workshop depends on PSPF Core. Install?" | After install of Core, Core Health welcome |
| C | Core + Workshop together | nothing | Core Health welcome |
| D | Workshop, Shop, Pub (no Core) | "These extensions depend on PSPF Core. Install?" | Core Health welcome |
| E | Explorer (web) only, given a bundle | n/a (browser) | Explorer publication-mode home |

Permutation B is enforced by **`extensionDependencies`**: each of Workshop, Shop, Pub declares `"extensionDependencies": ["your-org.pspf-core"]` in its `package.json`, so VS Code blocks activation until Core is present.

## Activation events

To avoid broad activation:

- **Core** activates on `onCommand:pspf.core.*`, `onView:pspfCore.*`, and `workspaceContains:.pspf/core/pspf-core.db`. It does **not** activate on `*` and does **not** use a wildcard `workspaceContains:**/*.pspf.json`.
- **Workshop** activates on `onCommand:pspf.workshop.*`, `onView:pspfWorkshop.*`, and `workspaceContains:.pspf/config/workspace.json`. The previously-suggested `workspaceContains:**/*.pspf.json` is retired.
- **Shop** and **Pub** mirror Workshop's pattern with their own command and view namespaces.

## First-run journey (permutation C)

1. User installs PSPF Core and PSPF Workshop from the Marketplace (or via VSIX).
2. User opens a folder in VS Code.
3. Workspace Trust dialog appears (this is VS Code's behaviour, not Core's). User grants trust.
4. Core's `workspaceContains` activator fires only if `.pspf/core/pspf-core.db` already exists. On a brand-new folder it does not.
5. User opens the **Command Palette** (Cmd+Shift+P on macOS) and runs `PSPF Core: Initialise PSPF Workspace`. This command is contributed by Core and is discoverable by typing `pspf`.
6. Core runs the bootstrap workflow (C1):
   1. Confirms Workspace Trust.
   2. Acquires the writer lock at `.pspf/core/locks/writer.lock`.
   3. Creates the `.pspf/` layout (see [pspf-core-architecture-spec.md](pspf-core-architecture-spec.md) § Workspace bootstrap).
   4. Initialises the SQLite database in WAL mode.
   5. Writes `workspace.json`, `products.json`, `policies.json` defaults.
   6. Records the active `schemaVersion`, `bundleVersion`, `apiVersion`.
7. Core opens the **Health** view in the sidebar with a welcome state: trust confirmed, layout created, no data yet, one prominent next action — **"Create your first Requirement in Workshop"**.
8. The Workshop Activity Bar entry now shows requirement/evidence/action/risk views in their empty state. Each empty state has a single primary action (`Create Requirement`, `Add Evidence`, etc.).
9. User invokes `PSPF Workshop: Create Requirement` (multi-step Quick Pick: Domain → title → initial assessment status → confirm).
10. Workshop opens the **Item Detail** WebviewPanel (per [adr/0015-item-detail-webview-panel.md](adr/0015-item-detail-webview-panel.md)) for the new Requirement.
11. User attaches Evidence (URL or note), saves.
12. User runs `PSPF Core: Create Snapshot` from the Command Palette (Quick Pick: type → title → confirm).
13. User runs `PSPF Core: Export Explorer Bundle`. Run Detail panel shows output path, manifest version, and checksum.
14. User opens the produced bundle in Explorer (drag-and-drop the bundle folder onto the Explorer URL, or open it from disk via the Explorer "Open bundle" button).
15. Explorer renders publication mode: Home, Requirements, Evidence, Actions, Risks, Posture brief. The OFFICIAL: Sensitive banner is visible on every screen.
16. User clicks **Copy posture brief** in Explorer; pastes into a Teams or email message.

That sequence is the v0.1 acceptance journey. Total target time on a populated standard-fixture workspace: under 5 minutes.

## v0.8 first-run test path

For initial assurance-user testing, v0.8 adds a shorter sample-driven path without changing the v0.1 operator spine:

1. Open a trusted folder in VS Code with PSPF Core and PSPF Workshop installed.
2. Run `PSPF: Open Workshop Welcome` to confirm the workspace count strip renders.
3. Run `PSPF: Load Sample Workspace`; Workshop writes the shared privacy-safe fixture through Core APIs.
4. Open `PSPF: Open Assessment Dashboard`, `PSPF: Open Evidence Review Queue`, `PSPF: Open Item Detail`, and `PSPF: Open Direction Detail` to inspect the loaded scenario.
5. Run `PSPF: Run Integrity Scan`, then `PSPF: Export Master Bundle` and open the bundle in Explorer.

The same sample path is enforced by `pnpm run check:sample-workspace`.

## v1.0 release test path

v1.0 uses [validation-scenario-1-operator-workflow.md](validation-scenario-1-operator-workflow.md) as the manual assurance-user validation script. Automated readiness uses:

```sh
npx pnpm@10.10.0 run release:readiness
```

The report is written under `.tmp/release-readiness/` with the active slice version in the filename.

## Welcome states (per surface)

### Core Health — empty

> **PSPF Core is ready.**
> No PSPF data found in this workspace yet.
>
> [ Initialise PSPF Workspace ]
> [ Restore from backup… ]
> [ Open documentation ]

### Workshop Requirements — empty

> **No Requirements yet.**
> Create your first Requirement to begin a PSPF assessment.
>
> [ Create Requirement ]
> [ Import an existing bundle… ]

(Equivalent welcome states for Evidence, Actions, Risks. Each has exactly one primary action and at most two secondary actions.)

### Explorer publication-mode — first load with no bundle

> **No bundle loaded.**
> Drop a PSPF master bundle here, or [ Open bundle… ].
>
> Need a bundle? Ask your assessor; they can export one from PSPF Workshop.

### Explorer publication-mode — after loading a bundle

> **OFFICIAL: Sensitive · TLP:AMBER+STRICT** *(banner)*
> Posture summary, generated *<time>* from snapshot *<id>*.
> *<headline number>* PSPF requirements assessed across *<n>* domains.

## Trust prompts

Workspace Trust is a VS Code mechanism, not a PSPF mechanism. PSPF respects it absolutely:

- In an **untrusted** workspace, Core does not load the API. Workshop, Shop, Pub show a banner explaining why and offering "Trust this workspace" via VS Code's standard affordance.
- In a **trusted** workspace, Core's writer lock is acquired before any privileged work begins.
- **Restricted Mode** in VS Code: PSPF surfaces are visible but every mutating command is disabled with a tooltip pointing to the Trust action.

## Concurrent-window behaviour

If a second VS Code window opens the same workspace folder while the first holds the writer lock:

1. Core's activation in the second window detects the lock file owned by another PID.
2. The second window opens in **read-only mode**: queries work, mutations are rejected with `PSPF_WRITER_LOCK_HELD` and a clear health-view banner naming the holding window.
3. When the first window closes (or releases the lock), the second window's banner offers a single action **"Take over as writer"**, which re-validates Workspace Trust, re-acquires the lock, and re-enables mutations.

This is the v0.1 design. Concurrent multi-writer is not in scope.

## Onboarding for non-VS-Code reviewers (Explorer)

A reviewer never installs an extension. They receive an Explorer bundle in one of three ways:

1. **Same-origin URL** — the assessor publishes the bundle to a GitHub Pages site (or any same-origin static host). The reviewer opens the URL and Explorer loads the bundle automatically.
2. **Bundle folder** — the assessor sends a zip; the reviewer extracts it and drops the folder onto the Explorer URL.
3. **Single bundle file** — Explorer accepts a single-file bundle through the file picker.

In all cases the OFFICIAL: Sensitive banner and the freshness/source caveat are visible immediately.

## Failure paths

| Failure | What the user sees |
|---|---|
| Core not installed when Workshop activates | VS Code's standard "extensionDependencies" prompt to install Core. |
| Workspace not trusted | Banner: "Workspace Trust is required for PSPF". One action: "Trust this workspace". |
| Writer lock held by another window | Banner naming the other window; read-only mode; "Take over as writer". |
| Schema version newer than installed Core | Health-view error `PSPF_SCHEMA_INCOMPATIBLE`; remediation: "Update PSPF Core". No automatic migration. |
| Bundle import fails validation | Plan-and-review pane stays in the validate stage; reasons listed per row; nothing is written. |
| Personal data found in export attempt | Export fails closed with `PSPF_PUBLICATION_POLICY_VIOLATION`; offending field paths listed; export blocked. |

## Acceptance signals

A user has been "successfully onboarded" when, in the past 24 hours from their first install, they have:

1. Initialised a workspace (one Core event).
2. Created at least one Requirement and one Evidence record.
3. Created at least one Snapshot.
4. Exported at least one Explorer bundle.
5. Copied at least one shareable posture brief.

These signals are recorded locally in the Work-log (no telemetry leaves the device).

## Specification summary

Onboarding is one short journey, ridden on Workspace Trust, `extensionDependencies`, narrow activation events, and a single Initialise command. Welcome states are honest, banners are explicit about Australian classification, and concurrent windows degrade visibly rather than corrupt silently. The journey is the v0.1 acceptance criterion and is exercised by an end-to-end Playwright test on every release tag.
