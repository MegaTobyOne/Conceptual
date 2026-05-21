# 0063 - v1.27 Digital CISO Magazine

- Status: proposed
- Date: 2026-05-21

## Context

Workshop, Explorer, Shop, and the shared posture brief can now explain assurance state, action impact, strategy, change records, and assurance-linked spend. The next communication gap is not another dense dashboard; it is a shareable issue-style artefact that helps cyber leaders tell a clear story about what changed, what needs attention, what action is required, and what is coming next.

The desired format is inspired by comic and news-magazine mechanics: a strong cover hook, a short introduction, feature stories, recurring themes, action strips, and a next-issue teaser. The implementation must use original PSPF visual language and must not copy 2000AD, DC, Marvel, or any other comic branding, artwork, logos, fonts, characters, layouts, or trade dress.

Existing bundle data is enough for a first release: Requirements, Evidence, Actions, Risks, Directions, Change Records, Strategy, Shop Spend Items, and links already support a generated magazine and CISO Master Plan without adding a new schema-bearing entity.

## Decision

Adopt v1.27 as the Digital CISO Magazine generated-report release.

The slice includes:

1. A shared CISO Magazine renderer in `@pspf/brief-renderer` that produces a deterministic issue model, Markdown/email-copy output, and self-contained print-ready HTML.
2. Issue structure covering cover hook, editor's note, posture snapshot, feature stories, attention required, action strip, commercial watch, reader actions, and next issue.
3. PSPF Domain scoping for all domains or one selected PSPF Domain, with `INFO` explicitly covered by automated validation.
4. Attention extraction from existing non-met or in-progress Requirements, open Actions, open Risks, stale Evidence, Strategy, Change Records, and linked Shop Spend Items where available.
5. Publication-safe rendering that excludes restricted personal fields, sensitive assumptions, and non-public working notes.
6. A generated CISO Master Plan model and Workshop panel that combines Strategy, Plan of Action streams, risks, evidence work, and Shop dependencies into an active planning view with its own button.
7. A simplified CISO Master Plan article included in the Digital CISO Magazine as a standard recurring story.
8. A focused `check:ciso-magazine` gate that generates all-domain and `INFO` issue outputs from the standard sample bundle and checks redaction, print-readiness, source metadata, offline HTML, and Workshop access buttons.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.27.0"`.
- Package version target: `1.27.0`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.10.0"` because the first magazine slice is generated from existing published data and does not add a Report Pack entity, new collection, new link verb, or schema directory.
- `Report pack` remains the likely persisted model for a later issue-history release, but v1.27 does not implement persisted report packs.

## Consequences

Positive:

- Operators get a narrative, shareable issue they can post, print, or paste into email without inventing the story from scratch.
- Operators get a first-class CISO Master Plan button for active planning, plus copyable Markdown when they need to share or adapt the plan text.
- The output gives first-time and non-specialist readers a clearer path from posture to action.
- `INFO` and other PSPF Domain extracts can be generated from the same model.
- The first implementation avoids Pub, email delivery, native PDF generation, and schema churn while validating the communication workflow.

Trade-offs:

- The magazine is generated on demand in v1.27; it is not a persisted Report Pack and does not create issue history.
- Browser print is the supported PDF/post path; native PDF generation is deferred.
- Email sending, subscriber management, RSS/feed publication, notification schedules, and Pub people/assignment workflows remain deferred.
- The original comic-inspired visual treatment must stay professional and avoid any third-party intellectual property or recognisable trade dress.

## Alternatives considered

- Implement canonical `ReportPackEntity` first. Deferred because the first release can prove the narrative/report workflow without a schema-axis bump.
- Build the feature in Pub. Deferred because Pub remains defined around people, roles, capacity, and assignments, not newsletter distribution.
- Add native PDF export. Deferred because self-contained HTML plus print CSS is enough for email, browser review, and print/PDF workflows in v1.27.
- Add email sending and subscription management. Deferred to avoid network, secret, consent, and delivery risks in the first slice.