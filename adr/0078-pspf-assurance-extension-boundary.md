# 0078 - PSPF Assurance extension boundary

- Status: accepted
- Date: 2026-06-18
- Supersedes: ADR 0001 product count, ADR 0007 packaging count, and the Pentest Workbench placement in ADR 0073

## Context

The Penetration Testing Workbench started in Workshop as a no-schema read model over Actions, Evidence, Risks, Tags, Suppliers, Contracts, Spend Items, and Links. That was a pragmatic first slice: it reused the existing authoring entities, introduced no new link verbs, and kept the operator workflow close to remediation planning.

The next assurance programme is larger than penetration testing. It includes assurance findings, third-party assessments, evidence review, verification/retest queues, management responses, approval state, secure publication, and signed attestation. Those workflows are cross-cutting: they read Workshop evidence and remediation data, Shop supplier and contract context, and Pub role/accountability context, but they should not be owned by any one of those product surfaces.

Assurance records also contain sensitive data by default. Draft findings, affected systems, tester notes, management responses, reviewer identities, and publication decisions need a tighter surface boundary than a general Workshop dashboard. Core already supports multiple trusted satellite extensions through its command API and baked trusted-caller registry, so a separate local-first extension is compatible with the architecture.

## Decision

Create **PSPF Assurance** as a separate VS Code extension, package name `pspf-assurance`, command namespace `pspf.assurance.*`, and view container `pspfAssurance`.

PSPF Assurance owns the assurance lifecycle surface:

- penetration testing and third-party assessment workbenches;
- assessment engagement planning, scope, target, tester, method, reporting, and retest windows;
- finding triage, severity, SLA, verification, retest, and closure queues;
- first-class assurance findings, including recommendation, management response, review state, approval state, and publication readiness;
- assurance report assembly and secure publication preparation;
- signed assurance bundle attestation when the secure-publishing tranche lands.

PSPF Assurance reads and writes through Core's public command API only. It MUST NOT import runtime code from Workshop, Shop, or Pub. Shared pure model builders may live in a shared package when more than one surface needs the same derived view.

The existing Workshop Pentest Workbench is rehomed conceptually under PSPF Assurance. During migration, Workshop MAY keep a compatibility command or dashboard summary that opens `pspf.assurance.openPentestWorkbench` when the Assurance extension is installed. Workshop MUST NOT continue to grow pentest or assurance-specific authoring features after this ADR.

PSPF Assurance starts local-first and offline-capable. It has no network dependency. Optional delivery through PSPF Connect remains a later integration path, not an Assurance runtime dependency.

Sensitive-data controls are part of the boundary:

- every new assurance entity field defaults to `sensitive` until explicitly classified;
- reviewer identity and personal fields are `restricted` and never exported;
- status bar, notifications, logs, and diagnostics show counts, IDs, states, and diagnostic codes only, never sensitive values;
- generated assurance reports, bundles, prompts, and attestations use publication-sanitised projections or an explicit export profile that fails closed;
- a dedicated `check:assurance-redaction` gate is required before any assurance artefact can be exported or published.

## Consequences

Positive:

- Assurance becomes a first-class product boundary rather than a Workshop dashboard that keeps expanding.
- Pentest, audit, IRAP-style review, supplier assurance, and formal assurance findings can share one lifecycle and UI language.
- Workshop stays focused on requirements, evidence, actions, risks, strategy, and operational authoring.
- Shop and Pub data can be used as context without making either product own assurance outcomes.
- The sensitive nature of assurance data gets a narrower command, menu, logging, and publication surface.

Trade-offs:

- Core's trusted-caller registry, release gates, package-shape checks, Marketplace packaging, and compatibility metadata gain another VS Code extension.
- The current Workshop pentest implementation needs a migration path instead of direct feature expansion.
- Product documentation must now describe six products and five VS Code extensions plus Explorer.

## Scope lock

Initial PSPF Assurance scope includes:

- assessment register and Home surface;
- pentest assessment grouping and finding queues migrated from Workshop;
- engagement metadata and lifecycle state;
- assurance finding authoring, review, approval, and closure;
- links to existing Requirements, Evidence, Actions, Risks, Suppliers, Contracts, Spend Items, Roles, Teams, and Change Records;
- local assurance report preparation and publication-readiness checks;
- redaction, diagnostics, and audit gates for all assurance outputs.

Initial PSPF Assurance scope excludes:

- Microsoft Graph, email, Teams, or other network delivery;
- AI drafting or summarisation unless separately governed by the AI capability boundary;
- new link verbs unless the entity-link spec is amended by a later ADR;
- background synchronisation with scanners, ticketing tools, or assessment platforms;
- encryption or signing with classical cryptography;
- organisation-wide signing authority beyond the workspace assurance lead role recorded in the grand plan.

## Alternatives considered

- **Keep growing assurance inside Workshop.** Rejected because assurance is cross-cutting and sensitive enough to deserve its own lifecycle, packaging, and command surface.
- **Create a narrow `pspf-pentest` extension.** Rejected because pentest is one assessment pattern; the durable product is assurance management.
- **Put assurance publishing in PSPF Connect.** Rejected because Connect is a delivery integration boundary. Assurance must work offline and produce local artefacts before any optional delivery channel is involved.