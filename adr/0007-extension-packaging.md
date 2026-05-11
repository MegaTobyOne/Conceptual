# 0007 — Extension packaging and trust registry

- Status: accepted (source-layout aspect superseded by ADR 0013)
- Date: 2026-05-09
- Superseded by: 0013 (source layout only; the four-extension packaging decision below stands)

## Context

Earlier drafts left two questions ambiguous:

1. Are Core and Workshop bundled as one extension, or are they separate?
2. Where does the trusted-caller registry live, and can a workspace modify it?

Both questions affect the same security boundary: which code is allowed to call Core's privileged commands, and how is that decided.

## Decision

### Packaging

- Core, Workshop, Shop, and Pub are **four separate VS Code extensions**, each published independently to the Marketplace.
- Workshop, Shop, and Pub each declare a peer-extension dependency on Core via documented compatibility metadata; activation defers any privileged work until Core's API is reachable.
- Onboarding documentation recommends installing Core+Workshop together for the most common use case, but that is a UX recommendation, not a packaging fact.

### Trust registry

- The trusted-caller registry is **baked into Core's distribution**. New trusted callers, scope changes, or status changes ship with a Core release.
- Workspace `products.json` MAY express **subtractive** changes only:
  - mark an otherwise-trusted caller as `blocked` for this workspace,
  - downgrade an otherwise-granted scope to a narrower one.
- Workspace `products.json` MUST NOT add new entries, grant new scopes, or change `introducedIn` boundaries.
- Loading workspace `products.json` requires Workspace Trust. An untrusted workspace's `products.json` is ignored.

## Consequences

- Workshop releases independently of Core; the compatibility matrix gains a row.
- A hostile workspace cloned from the internet cannot widen trust by checking in a `products.json`. The worst it can do is block its own access.
- Adding a third-party PSPF-aligned extension to the trusted set is now a Core release decision, not a workspace decision. This is the intended security property and the cost is acceptable for v1.
- Documentation must update to reflect "install Core, install Workshop" rather than "install the bundle".

## Alternatives considered

- **Bundle Core + Workshop.** Rejected; conflates two release cadences and dissolves a useful API discipline boundary.
- **Allow workspace to grant trust with operator confirmation prompt.** Rejected for v1; prompt fatigue and click-through risk are real, and the legitimate use case (running an unknown extension as trusted) is uncommon enough to defer.
