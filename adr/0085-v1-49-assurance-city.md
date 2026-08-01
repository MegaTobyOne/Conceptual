# 0085 — v1.49 Assurance City

- Status: accepted
- Date: 2026-08-01

## Context

The unified Explorer has a dependable Cytoscape relationship map, but operators also need a more spatial way to read how direction, requirements, risks, and actions connect. A 3D view must remain optional, lazy, redaction-safe, accessible without canvas interaction, and subordinate to the existing 2D Map when WebGL is unavailable.

## Decision

1. Add **Assurance City** as a lazy Explorer route using Three.js. It consumes the existing redaction-safe `RelationshipMapGraph`; no bundle, schema, publication, persistence, network, or compatibility contract changes.
2. Use deterministic city districts and conventional building forms. Building height expresses operational value. A steady soft glow marks only explicit critical conditions and is repeated as inspector text.
3. Render links on the ground as local roads, arterials, and freeways. Width, markings, colour, congestion labels, and inspector text carry road meaning; bridges, tunnels, trees, and elevated links are excluded.
4. Place the local city grid on a grass plane extending beyond the fog horizon. Provide persisted Day/Night lighting without external visual assets or network access.
5. Keep an HTML focus selector and inspector as the keyboard and screen-reader alternative to canvas picking. WebGL initialisation failure or context loss links to the current 2D Map without mutating data.
6. Cap the lazy Assurance City chunk at 160 KB gzip while retaining the 130 KB gzip initial-JavaScript budget. Cover deterministic semantics with unit tests and rendering, preference, fallback, and mobile overlay bounds with Playwright.
7. Release as v1.49.0 with `VERSION_AXES` unchanged at `1.14.0` and no new Explorer schema directory.

## Consequences

- Explorer gains an expressive spatial review mode without replacing the dependable 2D Map or weakening local-first and publication boundaries.
- Three.js increases only the lazy route payload; explicit disposal and context-loss handling remain required.
- Colour and canvas geometry are supplementary. Operational meaning must remain available in text.

## Alternatives considered

- **Replace the 2D Map**: rejected because WebGL availability and dense graph inspection still require a conventional fallback.
- **Elevated bridges and tunnels**: rejected because they made assurance links read as spectacle rather than legible roads.
- **Remote textures or generated scenery**: rejected to preserve offline operation, predictable performance, and supply-chain simplicity.
