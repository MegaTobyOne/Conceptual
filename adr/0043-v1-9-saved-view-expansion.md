# 0043 — v1.9 saved-view expansion

- Status: accepted
- Date: 2026-05-16

## Context

v1.8 introduced `saved-view` records for Explorer Requirements. User validation made the underlying need clearer: saved views are user convenience artefacts, not canonical assessment facts. They should travel in bundles so users can keep their preferred working views, while consumers remain free to ignore scopes they do not support.

Explorer also intentionally refuses to restore a remembered browser-local bundle when the Explorer schema, bundle, API, or product version changes. The behaviour is correct, but a blank screen after deployment is surprising unless Explorer explains that the user needs to reload their JSON.

## Decision

v1.9 expands saved views without making them authoritative assessment data.

Saved-view scopes are expanded to:

- `requirements` — legacy v1.8 compatibility scope.
- `explorer-requirements` — Explorer Requirements filters.
- `explorer-relationships` — Explorer Relationships Board filters.
- `workshop-requirements` — Workshop-owned Requirement filters.
- `workshop-dashboard` and `workshop-evidence-review` — reserved Workshop scopes for follow-on UI support.

Saved-view names are unique within a scope, not globally. This allows a user to keep a `High priority` view in Explorer Requirements and another `High priority` view in Workshop Requirements without collision.

Explorer adds Relationship views for the Relationships Board. They capture the same low-risk filter subset as other saved views: search text, tag IDs, `tagsMode`, and presentation columns. They do not capture selected cards, scroll position, expanded sections, or other transient visual state.

Workshop adds a Saved Views manager. v1.9 supports creating, renaming, archiving, and applying Workshop-owned Requirement views. Workshop views are stored as `saved-view` records with `scope = "workshop-requirements"` and `sourceProduct = "workshop"`. Workshop may import saved views from bundles, but it only has to use supported Workshop scopes.

Explorer now shows a visible notice when a remembered browser-local bundle is incompatible with the current Explorer build. The notice says `Reload your PSPF JSON`, reports the remembered Schema/Bundle versions versus the expected `1.6.0` axes, and asks the user to select the latest `bundle.json` or manifest plus collections. The stale remembered bundle is still cleared; browser-local edits remain separately stored and reconnect when the matching bundle is loaded.

## Version and schema impact

- Product version: `1.9.0`
- `schemaVersion = 1.6.0`
- `bundleVersion = 1.6.0`
- `apiVersion = 1.6.0`
- Publish `schemas/explorer-bundle/1.6.0/` with the expanded `collections/saved-views.schema.json`.
- Earlier schema directories remain immutable.

## Deferred

v1.9 does not add private/team ownership, compliance-history export controls, tag hierarchies, tagging non-Requirement entities, default-start views, editable posture, Shop, Pub, or chart image export.

## Consequences

Saved views remain portable but optional. Core validates their scope, name, filters, and presentation shape; Explorer and Workshop can ignore unsupported scopes without losing canonical assessment data. The new reload notice preserves the current protective behaviour while making deployment-time schema changes understandable to users.
