# PSPF Secrets Rotation and Incident Response Runbook

## Purpose

This runbook defines credential rotation and security incident response actions for the PSPF monorepo and release pipelines.

## Scope

Covers:

- Marketplace and deployment credentials,
- CI/CD secrets in GitHub Actions,
- suspected secret exposure incidents,
- post-incident verification and reporting.

This runbook implements the controls for threats **T08 (credential exposure in CI)** and **T09 (supply-chain compromise of release artefacts)** in `pspf-threat-model.md`.

## Storage rule

PSPF Core, Workshop, Shop, and Pub MUST NOT store any secret in `.pspf/config/`, `pspf-core.db`, environment files, or workspace settings. The only sanctioned secret store inside a VS Code extension is the VS Code **`SecretStorage` API**. Any code path that needs a secret at runtime reads it from `SecretStorage` on demand and never persists it elsewhere. This is enforced by the secret-scan CI check listed in `pspf-acceptance-and-quality-gates.md`.

## Secret classes

1. Marketplace publishing tokens.
2. Optional Open VSX publishing tokens.
3. Service credentials used by CI integrations.

## Rotation policy

1. Rotate high-impact publishing tokens at least every 90 days.
2. Rotate immediately after personnel access changes.
3. Rotate immediately on suspected exposure.
4. Confirm new secret validity before revoking old secret when possible.

## Standard rotation procedure

1. Create new credential/token in provider console.
2. Update repository or organisation secret in GitHub Actions.
3. Run dry-run workflow to verify access.
4. Revoke old credential.
5. Record rotation event in security log.

## Incident triggers

Treat as incident if:

1. Secret appears in commit history, logs, or issue comments.
2. Unknown publish or deployment activity is detected.
3. Secret scanning tool reports high-confidence leak.
4. Credentials are shared through unmanaged channels.

## Immediate incident response

1. Revoke suspected credential immediately.
2. Pause release workflows if publish path may be compromised.
3. Replace credential and validate clean workflow execution.
4. Review recent workflow runs and repository activity.
5. Remove leaked material from accessible docs/logs where possible.

## Containment and recovery

1. Verify no unauthorised releases were created.
2. Validate package provenance for latest artefacts.
3. Re-run security checks and secret scanning.
4. Resume release workflows only after controls pass.

## Post-incident actions

1. Document root cause and affected systems.
2. Record timeline of actions and outcomes.
3. Add preventive control updates to pipeline or process docs.
4. Confirm stakeholders are informed of impact and resolution.

## Verification checklist

After any rotation or incident:

- workflow auth succeeds with current secret,
- old secret is revoked,
- secret scanning reports no active leaks,
- release permissions are least-privilege and current.
