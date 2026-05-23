# 0066 - v1.29.2 Generated Slide and Document Export Direction

- Status: proposed
- Date: 2026-05-23

## Context

PSPF already has several useful ways to get information out of the local workspace:

- Core exports the manifest-led Explorer master bundle as JSON.
- Workshop can copy concise posture briefs and CISO Master Plan content as Markdown.
- The Digital CISO Magazine renders publication-safe Markdown and self-contained print-ready HTML that operators can print to PDF.
- Explorer consumes the bundle and presents portable review surfaces.

The next communication need is richer office artefacts: decent PowerPoint-style slide decks for executive and committee briefings, and document-style reports for assurance packs, board papers, and evidence review summaries.

These exports must not become a second system of record. They must be generated from existing data, respect the same redaction/publication rules as bundles and briefs, and remain deterministic enough for validation.

## Decision

Adopt generated slide and document exports as the next export direction, with Markdown and self-contained HTML remaining the canonical human-readable intermediates.

The intended export family is:

1. **Executive slide deck**: a short `.pptx` generated from existing dashboard, posture brief, Action Impact, risk, evidence, Direction, Essential Eight, and Shop commercial planning models.
2. **Assurance report document**: a `.docx` or structured HTML document generated from the same brief/report model, suitable for review packs and board/committee attachments.
3. **CSV extracts**: narrow tabular exports for Requirements, Evidence, Actions, Risks, ISM mappings, Spend Items, and Action Impact rankings where operators need spreadsheet analysis.
4. **Self-contained HTML report pack**: a browser-openable report with the same content model as the deck/document, useful when native Office generation is unavailable.

Implementation guidance:

- Use generated models from `@pspf/brief-renderer`, Workshop dashboards, Connected View, and Shop planning rather than screenshots as the primary source.
- Prefer libraries that create native Office Open XML outputs, such as `pptxgenjs` for `.pptx` and `docx` for `.docx`, only after dependency, bundle size, and VSIX packaging impact are checked.
- Keep export commands local-only and operator-initiated.
- Apply the existing default-deny publication/redaction posture to every generated export.
- Include source metadata: PSPF version, schema/bundle/API axes, generated timestamp, scope, and sensitivity marking.
- Include table alternatives for chart-like content so exports remain usable without visual-only interpretation.

Versioning:

- Product version target: `PSPF_SLICE_VERSION = "1.29.2"`.
- Package version target: `1.29.2`.
- `VERSION_AXES` remains `schemaVersion = bundleVersion = apiVersion = "1.10.0"` because this decision does not add a persisted entity, collection, link verb, or Explorer schema directory.

## Consequences

Positive:

- Operators get paths from live assurance data to executive-ready artefacts without hand-copying dashboard content.
- Slide and document outputs can reuse existing redaction and source-trace rules.
- Markdown and HTML stay available for email, Teams, browser review, and PDF printing.
- The implementation can start with deterministic report models and add native export writers later without schema churn.

Trade-offs:

- Native Office outputs add dependency and packaging risk, so the first implementation should be gated and measured.
- Generated slides need strong templates; a weak deck generator would be worse than the existing Markdown/HTML outputs.
- Binary output validation is harder than Markdown/HTML validation, so each native format needs focused smoke checks and content assertions.

## Alternatives considered

- Export screenshots of webviews. Rejected as the primary approach because screenshots are brittle, less accessible, harder to redact precisely, and poor for downstream editing.
- Build a free-form report designer first. Deferred because it would add complexity before the generated communication workflows are proven.
- Add persisted Report Pack entities immediately. Deferred because the current need can be served from generated artefacts over existing data and does not require schema churn.