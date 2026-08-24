# 0094 — v1.60 supplier verdict (J6) and deferral of Explorer supplier publication

- Status: accepted
- Date: 2026-08-24

## Context

J6 in `docs/ux-improvement-ideas.md` is "is this supplier a risk I am carrying" — scored 1/2 at the v1.59.0 baseline: Shop already derives `supplierRisks`, `contractRisks`, contract-expiry proximity, and criticality, but never composes them into a stated verdict, and the review found "Explorer has no supplier surface, so it's absent from the review/publication layer." This ADR closes the composition gap in Shop and makes an explicit, considered decision on the second half of that finding: whether Shop supplier data enters Explorer's publication surface.

## Decision

1. Shop composes a per-supplier verdict, `buildSupplierVerdict()`, from data it already derives: criticality, open linked risks (with highest severity), nearest active-contract expiry within Shop's existing near-term review window, and whether the supplier has any assurance-coverage link. `buildSupplierVerdictFor()` loads the entities needed (mirroring the existing `deriveCoverageDashboard` pattern) and the supplier detail webview renders the composed statement — e.g. "High criticality supplier; 2 open risks (highest severity 16); contract lapses in 45 days; linked to assurance coverage." — immediately under the masthead, ahead of the raw field grid.
2. **Explorer publication of Shop supplier data is explicitly deferred, not delivered, in this slice.** No Explorer view references suppliers, contracts, or the verdict. This is a default-deny decision, consistent with `pspf-security-redaction-controls.md`: commercial data (money fields, contract terms, supplier contact details) has never had a field-by-field publication policy defined for Explorer, and defining one safely — deciding what a published Explorer artefact may show about an organisation's suppliers and contracts — is a distinct piece of work from composing the verdict itself. Shipping it inside this slice would mean making that policy decision under the time pressure of closing out a six-slice programme, which this ADR declines to do.
3. A follow-on ADR is required before any Shop entity, field, or the verdict statement enters an Explorer view, a published bundle, or an exported artefact. That ADR must specify, field by field, which commercial data is `public`, `sensitive`, or `restricted`, and must extend `check:explorer-publication` accordingly.
4. This slice introduces no entity, link, bundle, API, or Explorer schema change; the verdict is derived entirely from existing Shop data. `VERSION_AXES` remain `1.15.0`.

## Consequences

- An operator in Shop can now read a stated supplier verdict rather than assembling one from separately-derived criticality, risk, and contract-expiry signals — this is a real, complete answer to "is this supplier a risk" inside Shop.
- The judgement remains local-only: the ecosystem's review/publication layer (Explorer) still cannot answer J6, and this ADR records that as a deliberate, reasoned gap rather than an oversight, with an explicit trigger (a dedicated publication-policy ADR) for closing it.
- J6 is rescored from 1 to 1.5, not 2, reflecting that the Shop half of the judgement is complete while the Explorer half remains open by design.
- `scripts/check-supplier-verdict.mjs` gates both halves of this decision: it asserts the verdict is composed and rendered in Shop, and asserts no Explorer view yet references suppliers, so a future change cannot silently introduce Explorer supplier publication without triggering this gate for review.

## Alternatives considered

- **Ship Explorer supplier publication in this slice with a hastily-scoped policy**: rejected; the security-redaction-controls default is "sensitive" for undeclared fields, and commercial contract/money data specifically warrants a considered, dedicated decision rather than an end-of-programme addition.
- **Drop J6 to defer the whole judgement to a future release**: rejected; the Shop-side composition is real, valuable, and low-risk (no publication surface touched), and delivering it now is consistent with the plan's own incremental philosophy.
- **Publish only the verdict sentence, not the underlying supplier record**: rejected as still requiring a policy decision (the sentence itself reveals risk/contract signals) without the benefit of solving the underlying field-by-field policy gap; better to decide the policy properly in a follow-on ADR.
