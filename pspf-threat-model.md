# PSPF Threat Model

## Purpose

This document records the threat model for the PSPF ecosystem in v1. Every security control claimed elsewhere in the specification set must map back to a threat enumerated here. If a control does not address a listed threat, it is either redundant or the threat list is incomplete; both outcomes are useful.

This is a living document. Revise it whenever the architecture, deployment model, data classes, or trust boundaries change.

## Scope

In scope:

- PSPF Core, Workshop, Shop, Pub VS Code extensions running locally.
- PSPF Explorer running as a static site (publication target) and as a local-data tool in the user's browser.
- JSON bundles produced by Core/Workshop and consumed by Explorer (and vice versa).
- The local SQLite datastore at `.pspf/core/pspf-core.db`.
- The CI/CD pipelines that build, test, package, and publish each product.

Out of scope for v1:

- Multi-user concurrent editing.
- Network-exposed Core APIs.
- Any deployment above `OFFICIAL` classification.
- Hosted, multi-tenant Explorer.

## Trust boundaries

1. **Workspace boundary** — a PSPF workspace on disk vs. the rest of the user's machine.
2. **Extension host boundary** — code running inside the VS Code extension host vs. code running outside it. This is a soft boundary: any extension in the host can in principle observe any other extension's exports.
3. **Marketplace boundary** — published extension artefacts vs. development source.
4. **Bundle boundary** — JSON bundles that cross between Core/Workshop and Explorer, possibly across organisations.
5. **Publication boundary** — the static Explorer site published to GitHub Pages vs. the authoring workspace it was generated from.
6. **Browser local-data boundary** — Explorer's `localStorage`/`IndexedDB` per origin vs. anything else on the user's machine.

## Assets

| Asset | Why it matters |
|---|---|
| Canonical entity records (requirements, evidence, actions, risks) | Reporting integrity and assurance defensibility |
| Personal data on Person/Assignment records | Privacy obligations under the Privacy Act 1988 (APPs) |
| Snapshots and report packs | Defensible point-in-time reporting |
| Marketplace publishing tokens | Supply-chain control |
| GitHub Pages deploy permissions | Publication integrity |
| Workspace config files (`workspace.json`, `products.json`, `policies.json`) | Platform behaviour and trust posture |
| User-entered Explorer data (browser local) | User's own working state |

## Attacker classes

### A1 — Curious peer extension
Another extension in the same VS Code extension host attempts to read PSPF data, call PSPF Core APIs, or impersonate a trusted product to mutate state.

### A2 — Hostile imported bundle
A JSON bundle from an untrusted source is opened in Core, Workshop, or Explorer. The bundle is malformed, oversized, contains hostile URLs, or attempts schema confusion.

### A3 — Hostile workspace
A workspace cloned from the internet contains crafted PSPF config files and seeds aiming to widen trust, exfiltrate data on activation, or trick the user into running migrations.

### A4 — Compromised contributor account
A maintainer account is compromised and used to merge PRs, push tags, or trigger Marketplace publishes.

### A5 — Compromised CI secret
A leaked publishing token or Pages deploy credential is used to publish a malicious release.

### A6 — Lost or stolen device
The user's laptop is lost. The local workspace, secrets, and any cached bundles are exposed.

### A7 — Network observer of Explorer publication
Anyone who can fetch the public Explorer site can read the bundle, including any data left in it. There is no "audience" control on a public static site.

### A8 — Replaced bundle
An attacker who can write to the Pages deployment replaces the bundle and the manifest checksum together. Any "integrity" claim that derives from the same publication channel is defeated.

### A9 — Browser-side XSS via bundle content
Hostile data inside a bundle (titles, summaries, URLs) is rendered into Explorer's DOM and executes script.

### A10 — Privacy request fulfilment
A subject (a Person record) requests access, correction, or destruction. The system must produce, correct, or destroy their data, including in published artefacts.

## Threat catalogue

| ID | Threat | Attacker | Asset | Control(s) |
|---|---|---|---|---|
| T01 | Peer extension calls Core privileged commands | A1 | Entity records | API discipline allowlist (defence-in-depth, **not** a security boundary); Workspace Trust gate for sensitive ops |
| T02 | Workspace `products.json` widens trust | A3 | Trusted-caller registry | Registry is baked into Core; workspace config may only **subtract**, never grant |
| T03 | Imported bundle is oversized, deeply nested, or contains very long strings causing DoS or memory exhaustion | A2 | Core process, browser tab | Hard limits on bundle size, item counts, string lengths, nesting depth; structured rejection |
| T04 | Imported bundle contains hostile URLs that Explorer fetches or links | A2 | Browser, third-party trackers | URLs rendered as text by default; outbound link rendering uses `rel="noopener noreferrer"` and never auto-fetches; URL allowlist for any preview behaviour |
| T05 | Imported bundle includes `<script>` or HTML in title/summary fields | A2, A9 | Browser DOM | All bundle-derived strings rendered with `textContent`; strict CSP `<meta>` bans inline script and remote script; no `innerHTML` for bundle data |
| T06 | Migration reformats data destructively on open | A2 (crafted DB), A3 | SQLite store | Migrations require Workspace Trust; non-safe migrations require explicit operator approval; pre-migration backup mandatory |
| T07 | Marketplace token leaks via logs or PR | A4, A5 | Publishing pipeline | Tokens only in `SecretStorage` or GitHub Actions secrets; secret scanning in CI; rotation runbook |
| T08 | Compromised tag pushes a malicious release | A4 | Marketplace artefacts | Required PR review for protected branches; release tags require green contract tests; least-privilege publish workflow |
| T09 | Replaced bundle on Pages defeats checksum | A8 | Published Explorer | Manifest hash is documented as a **checksum** (transport/torn-publish detection), not an integrity guarantee; future option: signed release attestation |
| T10 | Lost device exposes SQLite store | A6 | Local entity records | OS disk encryption is the assumed control; secrets in `SecretStorage` (separately encrypted); no plaintext credentials in store, logs, or bundles |
| T11 | Person email or identifying field published in Explorer bundle | A7 | Personal data | Bundles **never** include Person, Assignment, or other identifying fields. Workforce assertions in Explorer reference roles or teams only |
| T12 | Subject requests erasure that affects historical snapshots | A10 | Snapshots | Defined erasure model: snapshots support a recorded **redaction event** that supersedes identifying fields with tombstones, preserving audit defensibility |
| T13 | Browser local-data in Explorer leaked to another origin | A1 (browser side) | User's Explorer data | Explorer hosted on a single origin; never embeds third-party scripts; CSP forbids cross-origin script |
| T14 | Hostile workspace activates Core and exfiltrates on open | A3 | Local data, network | Activation is narrow and gated by `.pspf/` markers; sensitive actions require Workspace Trust; no outbound network calls in v1 |
| T15 | ID format leaks creation timestamps for Person records | A7 | Personal data | UUIDv7 used internally; the time bits are stripped from any ID that appears in a bundle eligible for publication |
| T16 | User believes Explorer's data is authoritative | A — generic user error | Decision quality | Every Explorer page declares experimental status, source bundle, and "not for relied-upon decisions" notice |

## Residual risks accepted in v1

- **In-process extension isolation** is best-effort. Treat the trusted-caller policy as API discipline, not a security boundary. Anyone shipping a malicious VS Code extension to the same host already has higher-privilege options than calling our API.
- **Public Pages hosting is US-jurisdiction.** Sensitive Australian Government workloads should not publish Explorer to public Pages. The HTML page carries an experimental warning in v1.
- **Bundle "integrity" is checksum only.** Replacement attacks on the publication channel are not detected. A future signed-release attestation is recommended but not mandated.
- **Single-writer assumption** for SQLite. Concurrent VS Code windows on the same workspace are not a supported configuration in v1.

## Required reviews

- This document must be reviewed when:
  - a new product, repository, or distribution channel is added,
  - a new entity type or new data class is introduced,
  - the deployment model changes (e.g. private Pages, hosted Explorer),
  - any item in the residual risk list is challenged.

## Mapping to other specifications

| Spec | What it must satisfy from here |
|---|---|
| `pspf-trusted-caller-policy.md` | T01, T02, T14 |
| `pspf-security-redaction-controls.md` | T11, T15 |
| `pspf-explorer-json-bundle-schema-spec.md` | T03, T04, T05, T09, T11, T15 |
| `explorer-screen-workflow-spec.md` | T05, T13, T16 |
| `pspf-core-architecture-spec.md` | T06, T10, T14 |
| `pspf-core-api-contract-spec.md` | T03, T06, T12 |
| `pspf-migration-safety-runbook.md` | T06 |
| `pspf-secrets-rotation-and-incident-runbook.md` | T07, T08 |
| `pspf-developer-pipeline-spec.md` | T07, T08 |
| `pspf-backup-and-restore-runbook.md` | T06, T10 |
