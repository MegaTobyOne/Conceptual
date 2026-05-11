# PSPF Trusted Caller Policy

## Purpose

This policy defines how PSPF Core gates access to its in-process extension API. The intent is **API discipline and accidental-misuse prevention**, not a security boundary. Anything running inside the same VS Code window as Core can, in principle, reach Core's exports; the policy ensures that only intentionally-developed PSPF products call privileged commands, and that the surface the operator sees is predictable.

For the actual security boundary, see `pspf-threat-model.md` (Workspace Trust gate, default-deny redaction, CSP, in-process trust assumption).

## Scope

This policy applies to:

- Core API command calls with mutation effects,
- migration, repair, import/export, and snapshot commands,
- privileged platform operations.

Read-only queries may be exposed more broadly, but sensitive data handling rules still apply.

## v1 trust model

1. Trust is based on an allowlist of extension IDs **baked into Core's distribution** (see ADR 0007).
2. Write-capable operations are restricted to approved PSPF products.
3. Unknown callers receive a structured unauthorised response.
4. Trust checks are mandatory even in local-only mode.
5. Loading the Core API at all requires VS Code Workspace Trust to be granted for the workspace.

## Approved caller registry

### Registry source

The canonical caller allowlist ships **inside the Core extension distribution**. New trusted callers, scope changes, and status changes ship with a Core release.

A workspace MAY include `.pspf/config/products.json` to express **subtractive** changes only:

- mark an otherwise-trusted caller as `blocked` for this workspace, or
- downgrade an otherwise-granted scope to a narrower scope.

A workspace `products.json` MUST NOT add new entries, grant new scopes, or change `introducedIn` boundaries. Any such fields are ignored with a diagnostic. Loading workspace `products.json` requires Workspace Trust; in an untrusted workspace the file is ignored entirely.

### Required fields per caller (Core-distribution registry)

- `extensionId`: unique VS Code extension identifier
- `product`: `core`, `workshop`, `shop`, `pub`
- `allowedScopes`: list of capability scopes
- `status`: `active` or `blocked`
- `introducedIn`: minimum compatible Core API version

## Capability scopes

Minimum v1 scopes:

- `read`
- `write-entity`
- `write-link`
- `snapshot`
- `export`
- `import`
- `migration-admin`
- `repair-admin`

## Authorisation rules

1. Caller identity must be resolved before any privileged action.
2. Requested scope must be present in caller allowed scopes.
3. Caller status must be active.
4. API version compatibility must pass before command execution.
5. Failure returns `PSPF_API_UNAUTHORIZED_CALLER` or compatibility-specific code.

## Governance and change control

1. Add or remove caller entries only via a Core release; the workspace cannot add entries.
2. Changes to `migration-admin` and `repair-admin` scopes require explicit operator confirmation at runtime in addition to the Core-release change.
3. Any caller policy change requires contract test updates.
4. The audited change record is the Core release notes plus the contract-test diff.

## Audit requirements

Each denied or privileged request should log:

- caller extension ID,
- requested command and scope,
- decision outcome,
- diagnostic code,
- timestamp.

Sensitive payload data must not be logged.

## Testing requirements

At minimum:

1. Allowlisted caller with valid scope is authorized.
2. Allowlisted caller without valid scope is denied.
3. Non-allowlisted caller is denied.
4. Blocked caller is denied.
5. Version-incompatible caller is denied with compatibility diagnostic.
6. Workspace `products.json` cannot grant a scope absent from the Core-distribution registry.
7. Workspace `products.json` is ignored entirely in an untrusted workspace.
8. A workspace `products.json` block entry successfully blocks an otherwise-trusted caller.
