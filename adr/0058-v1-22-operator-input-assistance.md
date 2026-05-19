# 0058 - v1.22 Operator Input Assistance and Review Polish

- Status: accepted
- Date: 2026-05-19

## Context

By v1.21 the PSPF slice has a broad assurance spine: Workshop remains the system of record, Explorer provides portable review and local suggestions, Shop has Core-backed commercial planning, and Connected View makes assurance relationships easier to inspect.

The next high-value improvement is not another entity model. Operators need the existing surfaces to be more forgiving at the point of entry and more explicit at the point of review. Date entry is the clearest example: an operator naturally types `today` for an Action due date, but the system should store the resolved calendar date rather than a relative word that becomes ambiguous tomorrow.

## Decision

Use v1.22 as an operator-assistance and navigation-recovery polish slice over the existing model.

The v1.22 slice adds:

- bounded natural date entry for existing Workshop Action due-date fields, starting with `today` resolved against the operator's local calendar date;
- visible Action due-date prompts and placeholders that advertise the supported shortcut and existing AU date examples;
- storage of resolved due dates as the same canonical short AU date string already rendered by Workshop, brief, and Explorer surfaces;
- tests proving relative date input resolves deterministically without emitting raw relative terms into Core records, exports, or brief output;
- Explorer-specific Connected View recovery while reusing the shared Connected View model, card semantics, redaction rules, selection behaviour, and edge rendering;
- a webpage-oriented Explorer Connected View shell that opens to the board by default, shows clear failure/empty states, and gives the operator more room to inspect relationships;
- clearer Workshop Saved Views management, including explicit open/apply actions and immediate manager refresh after create, rename, or archive operations;
- Workshop browse/list entry points for Requirements, Evidence, Actions, and Risks so the left-hand/Home surface navigates to useful records instead of only creating new ones;
- master-bundle export/import copy that can be used as a restore-oriented JSON backup workflow while still using the existing validated import review and undo path;
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
- Explorer Connected View can be optimised for webpage users without forking the shared relationship model from Workshop.
- Operators can browse existing record lists from Workshop Home before deciding whether to create or edit a record.
- Review polish gives the existing v1.20/v1.21 surfaces more practical value before adding larger workflows.

Trade-offs:

- v1.22 keeps natural date parsing deliberately small. Free-form phrases such as `next Friday`, `end of month`, and `in 2 weeks` are deferred until the product has enough usage data to justify broader parsing rules.
- The canonical stored value remains the existing short AU date string rather than a new ISO-only field, because changing date storage semantics would require a separate schema decision.
- Connected View zoom/lane controls, Shop spend-linking cues, and office/cost-centre reporting move to v1.23. Office/cost-centre fields require a separate schema-axis decision and publication policy if accepted.
- This slice improves prompts, navigation, review cues, and backup copy; it does not add reminders, notifications, calendars, recurring actions, approvals, Pub assignment workflows, editable commercial views, or a separate planning model.