# 0058 - v1.22 Operator Input Assistance and Review Polish

- Status: accepted
- Date: 2026-05-19

## Context

By v1.21 the PSPF slice has a broad assurance spine: Workshop remains the system of record, Explorer provides portable review and local suggestions, Shop has Core-backed commercial planning, and Connected View makes assurance relationships easier to inspect.

The next high-value improvement is not another entity model. Operators need the existing surfaces to be more forgiving at the point of entry and more explicit at the point of review. Date entry is the clearest example: an operator naturally types `today` for an Action due date, but the system should store the resolved calendar date rather than a relative word that becomes ambiguous tomorrow.

## Decision

Use v1.22 as an operator-assistance polish slice over the existing model.

The v1.22 slice adds:

- bounded natural date entry for existing Workshop Action due-date fields, starting with `today` resolved against the operator's local calendar date;
- visible Action due-date prompts and placeholders that advertise the supported shortcut and existing AU date examples;
- storage of resolved due dates as the same canonical short AU date string already rendered by Workshop, brief, and Explorer surfaces;
- tests proving relative date input resolves deterministically without emitting raw relative terms into Core records, exports, or brief output;
- small review-surface copy and layout polish where current v1.21 surfaces expose useful data but leave the operator guessing what to do next; and
- no new product model, collection, link verb, import mode, or compatibility axis.

## Version and schema impact

- Product version: `PSPF_SLICE_VERSION = "1.22.0"`.
- Package versions: `1.22.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.8.0"`.
- No new schema directory, entity type, field, link verb, bundle file, or compatibility axis.

## Consequences

Positive:

- Date entry matches operator language while stored data stays stable and unambiguous.
- The change improves Workshop without creating downstream migration, Explorer, or Shop compatibility work.
- Review polish gives the existing v1.20/v1.21 surfaces more practical value before adding larger workflows.

Trade-offs:

- v1.22 keeps natural date parsing deliberately small. Free-form phrases such as `next Friday`, `end of month`, and `in 2 weeks` are deferred until the product has enough usage data to justify broader parsing rules.
- The canonical stored value remains the existing short AU date string rather than a new ISO-only field, because changing date storage semantics would require a separate schema decision.
- This slice improves prompts and review cues; it does not add reminders, notifications, calendars, recurring actions, approvals, Pub assignment workflows, or a separate planning model.