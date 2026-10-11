import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildDossierProjection,
  buildNoExtraCaptureComparison,
  captureBriefEdition,
  compareDossierChanges,
  createSyntheticFixture,
  evaluateP2MatterDossier,
  INFORMATION_TYPES,
  PROFILE_IDS,
  recoverSevenTypes
} from "./lib/p2-matter-dossier.mjs";

const sevenTypes = ["ask", "proposedAction", "owner", "decision", "status", "outcome", "reasonForDelay"];

test("fixtures are explicit, reference-only, dated and independent", () => {
  const fixture = createSyntheticFixture();
  const original = JSON.parse(JSON.stringify(fixture));
  assert.deepEqual(fixture, createSyntheticFixture());
  assert.equal(fixture.trail.referenceOnly, true);
  assert.deepEqual(Object.keys(fixture.trail.recovery), sevenTypes);
  assert.equal(new Set(fixture.sources.map((source) => source.id)).size, fixture.sources.length);
  for (const source of fixture.sources) {
    assert.ok(source.revision > 0);
    assert.match(source.recordedAt, /^2026-10-\d{2}$/);
  }
  fixture.sources[0].content.ask.value = "Changed local copy";
  assert.deepEqual(createSyntheticFixture(), original);
});

test("projection copies retain source identity without sharing mutable profile configuration", () => {
  const projection = buildDossierProjection("after");
  const baseline = JSON.parse(JSON.stringify(projection));
  for (const field of ["evidence", "questions", "externalReferences"]) {
    for (const source of projection[field]) {
      assert.equal(
        source,
        projection.sources.find((record) => record.id === source.id)
      );
    }
  }
  projection.profile.questions.push("Local draft question");
  projection.evidence[0].content.claim = "Local draft claim";
  assert.deepEqual(buildDossierProjection("after"), baseline);
});

test("exact seven-type recovery retains sourced unknowns and separates involvement from outcome", () => {
  assert.deepEqual(INFORMATION_TYPES, sevenTypes);
  assert.deepEqual(PROFILE_IDS, ["CISO", "Ops", "DIDC"]);
  for (const scenario of ["before", "reviewed", "after"]) {
    const recovery = recoverSevenTypes(scenario);
    assert.deepEqual(recovery, recoverSevenTypes(scenario));
    assert.deepEqual(Object.keys(recovery), sevenTypes);
    assert.equal(recovery.owner.state, "known");
    for (const key of ["decision", "outcome", "reasonForDelay"]) {
      assert.equal(recovery[key].state, "unknown");
      assert.ok(recovery[key].source.id);
      assert.ok(recovery[key].source.revision);
      assert.ok(recovery[key].source.recordedAt);
    }
  }
  const projection = buildDossierProjection("after");
  assert.equal(projection.involvement.value, "Brief submitted; the coordination role's paper preparation is complete.");
  assert.equal(projection.recovery.outcome.value, "Wider security outcome is not established.");
  assert.equal(projection.recovery.reasonForDelay.value, "No sourced reason for the escalation wait is recorded.");
});

test("profiles change questions and emphasis only, retaining contradictory evidence and all relevant unknowns", () => {
  const projections = PROFILE_IDS.map((profile) => buildDossierProjection("after", profile));
  for (const projection of projections) {
    assert.deepEqual(projection, buildDossierProjection("after", projection.profile.id));
    const { profile: _profile, ...facts } = projection;
    const { profile: _baselineProfile, ...baseline } = projections[0];
    assert.deepEqual(facts, baseline);
    assert.deepEqual(
      projection.evidence.map((source) => source.content.position),
      ["supports", "contradicts"]
    );
    assert.ok(projection.questions.some((source) => source.id === "QUESTION-AUTHORITY"));
    assert.ok(projection.questions.some((source) => source.id === "QUESTION-OWNER"));
    assert.deepEqual(projection.unknowns, ["decision", "outcome", "reasonForDelay"]);
    assert.equal(projection.boundary, "synthetic-internal-only; no publication or permissions functionality");
  }
  assert.notDeepEqual(projections[0].profile.questions, projections[1].profile.questions);
  assert.match(projections[2].profile.emphasis, /candidate; authority unknown/);
});

test("committee requests more information without approval and exposes the exact unresolved follow-up", () => {
  const before = buildDossierProjection("before", "DIDC");
  const after = buildDossierProjection("after", "DIDC");
  assert.equal(before.disposition.value, "no-decision-recorded");
  assert.equal(after.disposition.value, "more-info-requested");
  assert.equal(after.recovery.decision.state, "unknown");
  assert.equal(after.recovery.status.source.id, "MEETING-1");
  assert.equal(after.recovery.status.source.revision, 2);
  assert.equal(
    before.questions.some((source) => source.id === "QUESTION-PSPF"),
    false
  );
  const question = after.questions.find((source) => source.id === "QUESTION-PSPF");
  assert.equal(question.recordedAt, "2026-10-08");
  assert.equal(
    question.content.question,
    "Which PSPF requirement versions, applicability and gaps must the next paper explain?"
  );
  assert.equal(question.content.resolverRole, "DIDC secretariat role");
  for (const source of after.questions) {
    for (const key of ["question", "resolverRole", "nextStep", "checkpoint", "evidenceNeeded", "canProceed"]) {
      assert.ok(source.content[key], `${source.id}: ${key}`);
    }
    assert.equal(source.content.state, "unanswered");
  }
});

test("external references expose last-checked pointers, not remote-change claims", () => {
  const pointers = buildDossierProjection("after").externalReferences;
  assert.equal(pointers.length, 1);
  assert.equal(pointers[0].content.lastCheckedAt, "2026-10-06");
  assert.equal(pointers[0].content.remoteChangeStatus, "unknown; pointer only, no remote monitoring");
  assert.match(pointers[0].content.pointer, /^https:\/\/example\.invalid\//);
  assert.deepEqual(pointers, buildDossierProjection("before").externalReferences);
});

test("issued editions are dated frozen copies and survive mutable fixture and live updates", () => {
  const edition = captureBriefEdition("before", "DIDC", "2026-10-06", "2026-10-06");
  const original = JSON.parse(JSON.stringify(edition));
  assert.deepEqual(edition, captureBriefEdition("before", "DIDC", "2026-10-06", "2026-10-06"));
  const fixture = createSyntheticFixture("after");
  fixture.sources[0].content.ask.value = "Mutable fixture update";
  const live = buildDossierProjection("after", "DIDC");
  live.questions[0].content.question = "Mutable projection update";
  assert.deepEqual(edition, original);
  assert.equal(edition.projection.disposition.value, "no-decision-recorded");
  assert.throws(() => {
    edition.projection.questions[0].content.question = "Overwrite issued paper";
  }, TypeError);
  assert.throws(() => captureBriefEdition("after", "DIDC", "2026-10-07", "2026-10-08"), /Review predates/);
  assert.throws(() => captureBriefEdition("before", "DIDC", "2026-10-06", "2026-10-05"), /Issue predates/);
  assert.throws(() => captureBriefEdition("before", "DIDC", "2026-02-30", "2026-10-06"), /Invalid date/);
});

test("review and issued baselines flag different revisions and dependent narrative", () => {
  const flags = compareDossierChanges("after", "reviewed", "before");
  assert.deepEqual(flags, compareDossierChanges("after", "reviewed", "before"));
  assert.deepEqual(
    flags.sinceReview.changes.map((change) => change.id),
    ["MEETING-1", "QUESTION-PSPF"]
  );
  assert.deepEqual(
    flags.sinceIssued.changes.map((change) => change.id),
    ["EVIDENCE-2", "MEETING-1", "QUESTION-PSPF"]
  );
  assert.equal(flags.sinceIssued.changes[0].previousRevision, 1);
  assert.equal(flags.sinceIssued.changes[0].currentRevision, 2);
  assert.equal(flags.sinceReview.linksChanged, true);
  assert.equal(flags.sinceReview.narrativeNeedsReview, true);
  assert.equal(compareDossierChanges("after", "after", "before").sinceReview.narrativeNeedsReview, false);
});

test("change detection handles content without a revision bump, revision-only changes, removals and order", () => {
  assert.equal(compareDossierChanges("content-only", "before", "before").sinceReview.changes[0].kind, "content");
  assert.equal(compareDossierChanges("revision-only", "before", "before").sinceReview.changes[0].kind, "revision");
  assert.equal(
    compareDossierChanges("before", "after", "after").sinceReview.changes.find(
      (change) => change.id === "QUESTION-PSPF"
    ).kind,
    "removed"
  );
  assert.deepEqual(buildDossierProjection("reordered"), buildDossierProjection("before"));
  assert.equal(compareDossierChanges("reordered", "before", "before").sinceReview.narrativeNeedsReview, false);
});

test("missing evidence, recovery and transitive references fail visibly", () => {
  for (const scenario of ["missing-evidence", "missing-recovery", "missing-linked-record"]) {
    assert.throws(() => buildDossierProjection(scenario), /Missing source reference: /);
    assert.throws(() => recoverSevenTypes(scenario), /Missing source reference: /);
    assert.throws(
      () => captureBriefEdition(scenario, "CISO", "2026-10-06", "2026-10-06"),
      /Missing source reference: /
    );
  }
});

test("FL-008 comparison keeps the existing source trail with zero forced capture and no invented transition outcome", () => {
  const comparison = buildNoExtraCaptureComparison();
  assert.deepEqual(comparison, buildNoExtraCaptureComparison());
  assert.equal(comparison.requiresMatter, false);
  assert.equal(comparison.syntheticAdditionalCaptureOperations, 0);
  assert.deepEqual(comparison.sourceIds, ["THREAD-1"]);
  assert.deepEqual(Object.keys(comparison.recovery), sevenTypes);
  assert.equal(comparison.recovery.decision.value, "Arrange a meeting with the replacement resource.");
  assert.equal(comparison.recovery.outcome.state, "unknown");
  assert.equal(comparison.observedStep.value, "Meeting invitation sent; meeting attendance is not established.");
});

test("closed scenarios reject file paths, arbitrary records, unknown profiles and coercion", () => {
  for (const input of ["/tmp/real-work.json", {}, { scenario: "before" }, null, "constructor"]) {
    assert.throws(() => createSyntheticFixture(input), /Closed synthetic scenario/);
    assert.throws(() => buildDossierProjection(input), /Closed synthetic scenario/);
  }
  for (const input of ["public", "Board", "constructor", {}]) {
    assert.throws(() => buildDossierProjection("before", input), /Unknown candidate profile/);
  }
});

test("P2 report is deterministic synthetic evidence with manual comparison and remaining prerequisites OPEN", () => {
  const report = evaluateP2MatterDossier();
  assert.deepEqual(report, evaluateP2MatterDossier());
  assert.equal(report.status, "synthetic evaluation only; adoption not established");
  assert.equal(report.projections.length, 3);
  assert.equal(report.comparison.status, "OPEN: manual protocol pending; no timings or performance thresholds");
  for (const gap of [
    "P1 measured baseline",
    "Rung 0 trial",
    "deployment permission",
    "stack/parser/finder",
    "browser/drafts/storage",
    "publication/history/erasure",
    "P2 adoption and ADR/P3 approval",
    "independent review"
  ]) {
    assert.ok(report.openGaps.includes(gap), gap);
  }
  assert.equal(report.syntheticCounts.informationTypes, 7);
  assert.equal(report.syntheticCounts.extraCaptureForExistingThread, 0);
});

test("report runner resolves all provenance and regenerates deterministically without accepting input", () => {
  const runner = fileURLToPath(new URL("./evaluate-p2-matter-dossier.mjs", import.meta.url));
  const readReports = () =>
    Object.fromEntries(
      ["report.json", "report.md"].map((name) => [
        name,
        readFileSync(new URL(`../.tmp/p2-matter-dossier/${name}`, import.meta.url), "utf8")
      ])
    );
  execFileSync(process.execPath, [runner]);
  const initial = readReports();
  const report = JSON.parse(initial["report.json"]);
  for (const projection of [...Object.values(report.stages), report.noExtraCapture]) {
    for (const type of INFORMATION_TYPES) {
      const answer = projection.recovery[type];
      const reference = `${answer.source.id}@${answer.source.revision}`;
      const source = report.sources[reference];
      assert.ok(source, `Missing catalogue source: ${reference}`);
      assert.deepEqual(answer.source, {
        id: source.id,
        revision: source.revision,
        recordedAt: source.recordedAt
      });
    }
    for (const reference of projection.sourceRefs) {
      assert.ok(report.sources[reference], `Missing catalogue source: ${reference}`);
    }
  }
  assert.deepEqual(report.noExtraCapture.sourceRefs, ["THREAD-1@1"]);
  execFileSync(process.execPath, [runner]);
  assert.deepEqual(readReports(), initial);
  const rejected = spawnSync(process.execPath, [runner, "workplace.json"], { encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.deepEqual(readReports(), initial);
});
