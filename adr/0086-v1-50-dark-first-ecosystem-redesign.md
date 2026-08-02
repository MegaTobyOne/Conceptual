# 0086 — v1.50 dark-first ecosystem redesign

- Status: accepted
- Date: 2026-08-02

## Context

The PSPF products share data and workflow conventions but still present uneven visual hierarchy, density, and product identity. The v1.50 redesign must make the ecosystem calmer and easier to navigate without introducing a unified host, weakening VS Code conventions, changing publication policy, or turning audience-oriented presentation into an access-control mechanism.

Explorer already supports selectable themes and defaults to dark. Extension webviews run inside VS Code, where forcing an independent theme would conflict with the operator's editor and high-contrast settings. The approved concept also uses CISO, Auditor, and Solo IT views to demonstrate useful changes in emphasis and disclosure.

## Decision

1. Adopt a shared semantic visual foundation for Core, Assurance, Workshop, Shop, Pub, and Explorer. Common tokens govern surfaces, typography, spacing, focus, status, and responsive behaviour. Each product receives one restrained structural accent; product identity never replaces semantic success, warning, danger, classification, or severity colours.
2. Explorer supports `dark`, `light`, and `system` themes. A missing or invalid preference resolves to `dark`. The retired `colorful` preference migrates to `dark`. `system` follows operating-system changes; explicit Dark and Light selections remain stable.
3. Extension webviews inherit VS Code light, dark, and high-contrast theme variables. They are designed and reviewed dark-first but do not expose a separate theme picker or force a dark surface inside a light editor.
4. CISO, Auditor, and Solo IT are local presentation lenses only. A lens may change wording, ordering, density, and initial disclosure. It must not change permissions, source collections, calculations, record availability, commands, exports, bundles, redaction, or publication behaviour.
5. Lens preferences remain host-local. Explorer may use local browser storage and extensions may use VS Code workspace state. Lens values do not enter Core storage, snapshots, bundles, exported artefacts, logs, or telemetry.
6. Native VS Code Activity Bar and extension navigation remain authoritative. The concept product rail is not embedded in extension webviews and v1.50 does not add a unified multi-product host.
7. The redesign introduces no entity, link, bundle, schema, or Core API change. `schemaVersion`, `bundleVersion`, and `apiVersion` remain `1.14.0`.

## Consequences

- Shared visual primitives can be introduced and tested before individual product migrations.
- Explorer retains a deliberate dark default while Light and System remain accessible choices.
- Extension appearance remains coherent with the operator's VS Code environment, including high-contrast themes.
- Presentation lenses can reduce friction without becoming an implicit security boundary or fragmenting canonical data.
- Visual and responsive regression coverage becomes part of release readiness.

## Alternatives considered

- **Force dark mode in every extension webview**: rejected because it conflicts with VS Code theme and accessibility choices.
- **Treat audience views as roles or permissions**: rejected because it would require identity, policy, persistence, and publication decisions beyond a visual redesign.
- **Copy the concept product rail into every extension**: rejected because it duplicates the native Activity Bar and implies a unified host that does not exist.
- **Retain Explorer's Colorful theme**: rejected because it creates a competing visual language and expands the contrast and regression matrix without supporting the restrained v1.50 direction.
