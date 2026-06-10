# PSPF Performance Profile and Benchmark Methodology

Status: **partial**

## Purpose

This document defines performance assumptions, benchmark method, and acceptance thresholds for PSPF v1.

## Performance principles

1. Measure with representative fixtures, not empty datasets.
2. Track median and p95 timings for key workflows.
3. Fail release gates on sustained regressions beyond agreed thresholds.
4. Pin a reference machine for headline thresholds; derive secondary thresholds for slower hardware.

## Reference machine

Headline thresholds in this document and in `pspf-acceptance-and-quality-gates.md` are measured against the **PSPF reference machine**:

| Property | Value |
|---|---|
| CPU | Apple Silicon, 8 performance cores (e.g. M2 or later) |
| RAM | 16 GB |
| Storage | NVMe SSD with at least 10 GB free |
| OS | macOS 14 or later |
| Runtime | Node.js LTS aligned with VS Code's bundled version |
| Foreground load | VS Code only; no concurrent builds, downloads, or video calls |
| Power | Mains power; not on battery saver |

Equivalent x86_64 reference: 8 physical cores at ~3.0 GHz base, 16 GB RAM, NVMe SSD, Linux or Windows 11.

A "secondary" reference profile representing low-spec hardware (4 cores, 8 GB RAM, SATA SSD) is benchmarked but allowed double the headline threshold; release gates use only the primary reference machine.

## Fixture profiles

Use these standard profiles:

1. `minimal`: onboarding-size workspace.
2. `standard`: normal operational workspace.
3. `large`: high-volume workspace near expected v1 upper range.
4. `migration`: schema upgrade scenario with pre-existing data.

## Baseline scale assumptions

### Standard profile

- 5,000 requirements
- 20,000 evidence records
- 10,000 actions
- 5,000 risks
- 60,000 links

### Large profile

- 20,000 requirements
- 80,000 evidence records
- 40,000 actions
- 20,000 risks
- 250,000 links

## Key benchmark scenarios

1. Core startup and health initialisation.
2. Requirement tree/list initial load.
3. Link creation and validation operation.
4. Snapshot export generation.
5. Explorer initial bundle load and first render.
6. Explorer filtered list interaction latency.
7. Evidence review queue calculation by domain.
8. Action Impact ranking calculation by scope.
9. Posture brief generation.
10. Shareable chart rendering and image export.
11. Shop spend forecast and savings-opportunity ranking.

## v1 thresholds

1. Core startup health visible: median < 3s, p95 < 5s on standard profile.
2. Requirement list initial load: median < 2s, p95 < 4s on standard profile.
3. Link create + validate action: median < 500ms, p95 < 1s on standard profile.
4. Snapshot export: median < 30s, p95 < 60s on standard profile.
5. Explorer initial render: median < 3s, p95 < 6s on standard profile.
6. Evidence review queue by domain: median < 1s, p95 < 2s on standard profile.
7. Action Impact ranking by domain or overall scope: median < 1s, p95 < 2s on standard profile.
8. Posture brief generation: median < 1s, p95 < 2s on standard profile.
9. Shareable chart render for compliance donut, action timeline, grouped checklist, and risk matrix: median < 500ms each, p95 < 1s each on standard profile.
10. Chart image export: median < 1s, p95 < 2s per chart on standard profile.
11. Shop spend forecast and savings-opportunity ranking: median < 1s, p95 < 2s on standard profile.

## Explorer interactive thresholds (inherited from prototype)

The standalone PSPF Explorer prototype shipped with the budgets below and met them on a comparable codebase (see `extracted-spec-pspf-explorer.md`). The rewrite inherits them as **non-regression** budgets: a measured release MUST NOT regress beyond these numbers, and CI gates are added once a baseline run exists.

| Scenario | Budget | Notes |
|---|---|---|
| First Contentful Paint, cold cache | < 1.0 s | Prototype-validated; reference machine. |
| Time To Interactive, cold cache | < 1.5 s | Prototype-validated. |
| View switch between primary screens, p95 | < 100 ms | Prototype-validated. |
| Search over 10,000 records, p95 | < 50 ms | Prototype-validated; client-side index. |
| Sustained interaction at 10,000 records | 60 fps target; no jank > 100 ms | Prototype-validated. |
| Relationships Board initial render at 10,000 records | < 150 ms | New for v1; the Board replaces the prototype's network graph (ADR 0010). |
| Plan-and-review render at a 1,000-row import | TBD at first measuring milestone (M1) | Spec-deferred; once baselined, regression gate at +15% per the standard rule above. |
| Integrity scan | Non-blocking; UI thread idle ≥ 95% during scan | Owned by invariant E15; runs in a worker. |

The prototype's "graph render < 200 ms" budget is **retired** with the network-graph view (ADR 0010) and MUST NOT be reintroduced unless a future ADR reopens the graph surface.

## Benchmark method

1. Run each scenario 5 times after warm-up.
2. Capture machine profile and environment metadata.
3. Report median and p95.
4. Compare against previous baseline and flag regressions over 15%.

## CI integration guidance

1. Run lightweight performance smoke checks on PR.
2. Run full benchmark suite nightly and before release tags.
3. Publish benchmark artefacts and trend summaries.

## Reporting format

Each benchmark report should include:

- fixture profile,
- scenario name,
- median and p95,
- pass/fail against threshold,
- delta from previous baseline,
- notes on anomalies.
