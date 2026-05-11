# 0003 — Link taxonomy

- Status: accepted
- Date: 2026-05-09

## Context

The earlier link taxonomy used compound names that encoded both endpoints and the verb, for example `requirement-supported-by-evidence`, `evidence-supports-action`, `action-blocked-by-risk`. This produced near-duplicates (`supported-by` vs `supports` for inverse directions of the same idea), required a new compound name for every new (from, to) pair, and made cross-bundle drift very easy: the bundle schema spec already used the short form `supported-by` while the entity spec used the long form. Two specs, two vocabularies, same idea.

## Decision

Links are described by:

- a short, **shared verb-phrase `linkType`** drawn from a closed vocabulary,
- the existing `fromType` and `toType` envelope fields, and
- a constraint table that defines which `(fromType, toType)` pairs are valid for each `linkType`.

The closed `linkType` vocabulary is:

`in`, `has`, `supported-by`, `addressed-by`, `exposed-by`, `owned-by`, `reviewed-by`, `cited-by`, `supports`, `treated-by`, `associated-with`, `sourced-from`, `included-in`, `assigned-via`, `blocked-by`, `related-to`, `funds`, `member-of`, `holds`, `targets`, `generates`, `includes`.

Direction is carried by `fromType`/`toType`. Inverse traversal is a query feature, not a separate `linkType`. Where a UI needs an "inverse label" (e.g. show `evidence supports requirement` from the requirement page), that is a presentation rule, not a stored value.

## Consequences

- The full set of valid `(fromType, linkType, toType)` triples lives in `pspf-entity-link-spec.md` as the authoritative table.
- A CI invariant rejects any `linkType` value not in the closed set, and rejects any `(fromType, linkType, toType)` triple not in the table.
- A migration on existing fixtures rewrites compound names to the new vocabulary one time at adoption.
- Any future link type addition is an ADR plus an invariants update.

## Alternatives considered

- **Keep the compound names.** Rejected for the reasons above.
- **Free-text `linkType`.** Rejected; the system depends on traversal predictability for reporting.
- **Encode direction in `linkType` ("forward"/"reverse").** Rejected; redundant with `fromType`/`toType`.
