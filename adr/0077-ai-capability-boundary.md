# 0077 — AI capability boundary

- Status: accepted
- Date: 2026-06-14

## Context

PSPF can benefit from optional AI assistance for drafting Requirement positions and suggesting Requirement to ISM mappings. The ecosystem is local-first and treats all data as sensitive by default, so AI must not become a dependency, hidden network path, or prompt-leakage channel.

## Decision

The first AI release is a Workshop-only, draft-and-confirm slice behind a three-level kill switch:

1. User setting: `pspf.ai.enabled` defaults to `false`.
2. Workspace policy: `.pspf/config/policies.json` must explicitly set `ai.disabled` to `false`; missing, malformed, or `true` policy disables AI.
3. Capability presence/provider: Release 1 uses only the VS Code Language Model API and hides AI affordances when the API is unavailable.

AI commands are hidden using the `pspf:aiEnabled` context key. Every AI command re-checks the shared gate before model invocation. AI output is draft-only and is never persisted without explicit operator acceptance.

Prompt assembly follows the publication boundary. Existing PSPF entities are passed through `sanitiseEntityForPublication` before prompt serialisation. Guided interview prompts instruct operators to provide only public-safe, non-sensitive abstractions.

Direct BYO remote endpoints, background AI runs, autonomous state-changing actions, and non-sanitised entity prompts are out of scope for Release 1.

## Consequences

- Non-AI environments show no AI affordances by default.
- Existing workspaces without an explicit AI policy remain disabled until policy is deliberately amended.
- The first provider avoids API keys and endpoint settings in PSPF code.
- AI can improve operator drafting speed while preserving human accountability.
- A future BYO provider requires a separate ADR covering data sovereignty, vendor assessment, logging, and endpoint policy.

## Alternatives considered

- **BYO remote endpoint in Release 1.** Rejected because it would require endpoint allowlists, credentials, sovereignty controls, and vendor due diligence before the value of AI assistance is proven.
- **Visible but disabled AI buttons.** Rejected because the product requirement is no visible AI affordance unless AI is enabled.
- **Allow sensitive local-only prompts.** Rejected for Release 1 to keep prompt handling equivalent to publication-safe projections.
