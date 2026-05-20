# 0061 - v1.25 Workshop operational dashboards

- Status: accepted
- Date: 2026-05-20

## Context

The v1.24 Strategy slice gives the ecosystem a canonical strategic frame, but the operator workflow also needs a practical management surface that answers whether the tool helps with day-to-day assurance work. The paper Master Dashboard and workshop planning flow need to translate workspace data into decisions, PSPF artefacts, and measurable uplift without introducing a separate project-management system.

The recent Workshop work adds user-facing dashboards and editing improvements over existing entities: Master Dashboard, Plan of Action, Essential Eight tracking, Strategy editing, Connected View filtering, and openable Evidence references. These changes improve how operators work with existing data, but they do not require new entity types, link verbs, schema directories, or compatibility axes.

## Decision

Adopt v1.25 as the Workshop operational dashboards release.

The slice includes:

1. A Master Dashboard organised around Data -> Decisions -> PSPF Artefacts -> Measurable Uplift, with N/A-aware completion and evidence metrics.
2. A Plan of Action board that uses Action start/end dates, status filtering, impact context, and a Today marker to ground timeline decisions.
3. A dedicated Essential Eight dashboard and uplift plan using existing Requirements, mappings, Evidence, Risks, and Actions.
4. A full-size Strategy Editor for the canonical Strategy entity, while retaining the sanitised Explorer executive strategy view.
5. Connected View filtering that can hide Requirements marked not applicable and redraw linked context without changing link semantics.
6. Evidence browse, list, review, and editor affordances that can open supported evidence references while preserving explicit save/discard/cancel protection for dirty editors.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.25.0"`.
- Package version target: `1.25.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.10.0"`.
- No `schemas/explorer-bundle/1.11.0/` directory is introduced.

## Consequences

- Operators get one coherent Workshop route from current assurance data to decisions, briefable artefacts, and uplift tracking.
- Essential Eight work is visible as a dedicated plan without becoming a separate data model.
- The Strategy entity remains singular and canonical; the richer editor is a Workshop authoring surface, not a new Explorer editing mode.
- Connected View volume can be reduced for not applicable Requirements while preserving the existing graph model and publication semantics.
- The release remains a product/package bump over the existing v1.10 compatibility axes.

## Alternatives considered

- Add a separate PSPF Plan product. Rejected for v1.25 because the current need is a lightweight lens over existing Actions, Risks, Requirements, Evidence, and Strategy.
- Add PMO scheduling entities, approvals, reminders, calendars, or finance reconciliation. Deferred because they would widen the model and release risk beyond the operational dashboard slice.
- Bump schema, bundle, and API axes. Rejected because this release does not add schema-bearing fields, entity types, collections, or link verbs beyond the already-published v1.10 Strategy surface.