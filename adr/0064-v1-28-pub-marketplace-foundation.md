# 0064 - v1.28 Pub Marketplace Foundation

- Status: proposed
- Date: 2026-05-21

## Context

Core, Workshop, Explorer, and Shop now cover the local system of record, assessment authoring, publication review, commercial planning, and narrative executive reporting. The remaining planned VS Code extension is PSPF Pub: the people, role, team, assignment, and stakeholder relationship surface.

Pub needs to help operators understand, monitor, and manage the people who have a stake or interest in protecting information. The desired direction includes an organisation chart with action, milestone, and anniversary badges; staff and stakeholder relationship history; development, performance-management, rotation, team-event, roster, and service-provider context; and role contribution signals that show where a functional outcome, requirement, direction, or action depends on people and teams.

This is a sensitive surface. Person identity, relationship notes, development context, performance context, and assignment-to-person mappings must not accidentally become part of a public Explorer bundle. The existing personal-data exclusion already treats `Person.name`, `Person.email`, and `Assignment.personId` as disallowed publication fields.

## Decision

Adopt v1.28 as the Pub Marketplace foundation release.

The slice includes:

1. A real `packages/pub` VS Code extension package published as `tobyharvey.pspf-pub`.
2. A Pub Activity Bar entry and foundation Home view that introduces people, roles, teams, assignments, organisation chart, action badge, and relationship-management intent.
3. A `pspf.pub.*` command namespace with foundation commands for Home, organisation chart, people, roles, assignments, and relationship log surfaces.
4. CI and package-shape coverage for Pub, so Core, Workshop, Shop, and Pub are all validated as Marketplace extensions.
5. Marketplace release workflow support for `target=pub`, including dry-run packaging, VSIX upload, publish, Marketplace verification, GitHub release, and receipt tag `pub/<version>`.
6. Public ecosystem-page links for the newly published Pub extension.
7. A documented hybrid storage direction for later slices: canonical role, team, and assignment records can become Core-backed, while sensitive person details and relationship notes remain local-only unless a future ADR defines stricter controls.

Publication boundary:

- v1.28 does not add Pub collections to Explorer publication bundles.
- v1.28 does not add Pub data to Explorer schemas, sample exports, or public Explorer rendering.
- no Pub data is added to Explorer publication bundles in this slice.
- Person and relationship context remains local-only by default.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.28.2"`.
- Package version target: `1.28.2`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.10.0"` because no new published schema-bearing Pub collection is introduced.

## Consequences

Positive:

- Pub becomes a visible, installable member of the PSPF extension set without waiting for the full staff-lifecycle workflow.
- Release and Marketplace automation can now prove the Pub package shape early.
- The local-only boundary is visible before operators start entering sensitive staff and stakeholder information.
- Later Pub slices can focus on the first real workflow rather than package and release plumbing.

Trade-offs:

- v1.28 is not a full people-management or CRM implementation.
- Pub commands beyond Home open the foundation surface rather than complete CRUD workflows.
- Explorer cannot yet show role/team contribution or roster sustainability views because Pub publication is deliberately deferred.
- The hybrid storage direction still needs a future ADR before full Pub persistence is implemented.

## Alternatives considered

- Build the full staff lifecycle immediately. Deferred because relationship notes, performance context, development records, and person identity need careful local-only storage and export tests before broad implementation.
- Publish Pub data into Explorer immediately. Rejected for v1.28 because the user-selected boundary is no Pub publication in this slice.
- Keep Pub deferred until the whole model is finished. Rejected because Marketplace, CI, and public ecosystem plumbing can be established safely now.
- Use a Pub-only JSON store only. Deferred because the preferred direction is hybrid: Core-backed canonical responsibility records plus local-only sensitive person and relationship context.
