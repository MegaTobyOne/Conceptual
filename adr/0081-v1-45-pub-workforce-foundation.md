# 0081 — v1.45 Pub workforce foundation

Status: **accepted**

**Date**: 2026-07-18
**Deciders**: Product owner, engineering

## Context

ADR 0064 established Pub as a local-only Marketplace extension for people, teams,
roles, assignments, and stakeholder relationships. Operators now need to establish
and maintain that structure quickly, inspect it as an organisation chart, and share
role-and-team views without disclosing personal information. The existing Pub store
declared version `1.1.0`, but had no explicit migration chain, future-version rejection,
referential-integrity validation, or behavioural tests for those guarantees.

## Decision

Ship v1.45 as the first workforce-management foundation:

1. Keep Pub data in `.pspf/pub/pub.json`; no Pub collection is added to Core, Explorer,
   snapshots, master bundles, or public schemas.
2. Advance the local Pub store to `1.2.0`. Loading `1.0.0` or `1.1.0` migrates and
   normalises to `1.2.0`; an unsupported future version is rejected without rewriting
   the store. A pre-migration backup is created before a migrated store can later be
   saved.
3. Validate duplicate identifiers, dangling person/team/role references, self-links,
   team hierarchy cycles, and role reporting cycles before every write. Save through a
   temporary file and atomic rename.
4. Add Quick Add for one confirmed person/team/role/assignment write, and TSV bulk
   import with structured parsing, exact matching, preview, conflict reporting,
   complete-store validation, and one confirmed write. Cancellation and validation
   failure leave the store unchanged.
5. Render the organisation chart from a pure role/team read model. Show filled,
   vacant, acting, and rotating role states; support native branch collapse; and provide
   a synchronized hierarchy table as the keyboard and screen-reader equivalent.
6. The primary share action copies a plain-text role-and-team outline. A secondary HTML
   export requires confirmation. Both are generated from the same safe outline and
   exclude display names, person identifiers, assignment identifiers, relationship
   notes, free text, and evidence.
7. Add behavioural tests for migration, future-version rejection, integrity validation,
   TSV parsing/preview, reporting cycles, role-state derivation, and export redaction.
   The `e2e:v1.45` release chain runs the Pub test suite.

Product and package versions advance to `1.45.0`. `VERSION_AXES` remain `1.14.0`
because this slice changes only the local Pub store and introduces no published bundle,
Core API, or Explorer schema contract.

## Consequences

- Operators can create a small team interactively or preview spreadsheet data before a
  bulk write.
- Existing `1.1.0` Pub workspaces upgrade without a manual conversion step, while newer
  unknown stores fail closed.
- Organisation exports are intentionally less detailed than the local chart. They are
  suitable for role/team discussion, not person-level workforce administration.
- Pub continues to assume one trusted local workspace operator. Multi-user access
  control, concurrent editing, HRIS/LMS integration, and person-identifying exports are
  out of scope.
- Skills, mandatory learning, certifications, development plans, succession plans, and
  rotation opportunities/placements remain later Pub phases and require their own
  accepted data-model decision before implementation.

## Alternatives considered

- Add new fields directly to `extension.ts` without a migration framework. Rejected
  because normalisation could silently discard future or malformed data.
- Split tab-separated rows manually. Rejected because quoted tabs and newlines require a
  structured parser.
- Export the on-screen organisation chart including assignee names. Rejected because
  Pub personal and assignment mappings are restricted and must remain local-only.
- Move Pub records into Core in this slice. Rejected because it widens API, publication,
  migration, and writer-lock scope without improving the immediate workflow.
