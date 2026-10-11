export const INFORMATION_TYPES = Object.freeze([
  "ask",
  "proposedAction",
  "owner",
  "decision",
  "status",
  "outcome",
  "reasonForDelay"
]);
export const PROFILE_IDS = Object.freeze(["CISO", "Ops", "DIDC"]);

const scope = "P2 synthetic internal evaluation only";
const scenarios = [
  "before",
  "reviewed",
  "after",
  "revision-only",
  "content-only",
  "reordered",
  "missing-evidence",
  "missing-recovery",
  "missing-linked-record"
];
const profiles = {
  CISO: {
    emphasis: "Exposure, assurance basis, evidence freshness, limitations and escalation.",
    questions: ["What exposure remains?", "Which claims are contradicted or unverified?"]
  },
  Ops: {
    emphasis: "Instructions, prerequisites, expected result, completion evidence and help route.",
    questions: ["What can proceed now?", "What evidence will establish completion?"]
  },
  DIDC: {
    emphasis: "Risk oversight and treatment; DIDC candidate; authority unknown.",
    questions: ["What exact decision is sought?", "What remit and formal disposition are evidenced?"]
  }
};

const known = (value) => ({ state: "known", value });
const unknown = (value) => ({ state: "unknown", value });
const sortIds = (values) =>
  [...values].sort((left, right) => left.localeCompare(right, "en-AU", { sensitivity: "base" }));
const question = (text, resolverRole, nextStep, evidenceNeeded) => ({
  state: "unanswered",
  question: text,
  resolverRole,
  nextStep,
  checkpoint: "2026-10-12",
  evidenceNeeded,
  canProceed: "Collate dated evidence and draft context without implying treatment approval."
});

export function createSyntheticFixture(scenario = "before") {
  if (!scenarios.includes(scenario))
    throw new Error("Closed synthetic scenario required; files and caller records are not accepted.");
  const contents = {
    "ASK-1": {
      ask: known("Should restoration treatment for RISK-CYBER-1 proceed and reach the enterprise risk role?")
    },
    "RISK-ENTERPRISE-1": {
      concern: "Information management and security exposure; read-only synthetic register context."
    },
    "RISK-DIGITAL-1": { concern: "Service recovery exposure; hierarchy alone does not prove comparable status." },
    "RISK-CYBER-1": {
      concern: "Restoration may fail for a critical service.",
      intendedOutcome: "Reliable restoration shown by dated tests."
    },
    "ACTION-1": {
      proposedAction: known("Run scoped restoration treatment and repeat the failed service test; proposal only."),
      prerequisite: "Confirm accountable risk role and treatment authority.",
      expectedResult: "Reproducible restoration result, not assumed risk reduction.",
      completionEvidence: "Dated service test log and reviewed residual exposure.",
      helpRoute: "Service operations role"
    },
    "OWNER-1": {
      owner: known("Security coordination role owns paper preparation and follow-up, not risk approval.")
    },
    "MEETING-1": {
      disposition: "no-decision-recorded",
      decision: unknown("No formal risk or treatment decision is recorded."),
      status: known("Brief submitted; discussion pending."),
      outcome: unknown("Wider security outcome is not established."),
      reasonForDelay: unknown("No sourced reason for the escalation wait is recorded."),
      involvement: "Brief submitted; the coordination role's paper preparation is complete.",
      limitations: "Synthetic operator account, not authoritative minutes or evidence of committee remit."
    },
    "EVIDENCE-1": {
      position: "supports",
      claim: "Operations report says recovery checks passed.",
      limitation: "Reported result; scope does not establish all service coverage."
    },
    "EVIDENCE-2": {
      position: "contradicts",
      claim: "Test log records one failed restoration.",
      limitation: "One service result; does not establish enterprise-wide exposure."
    },
    "EXTERNAL-1": {
      pointer: "https://example.invalid/register/RISK-CYBER-1",
      lastCheckedAt: "2026-10-06",
      remoteChangeStatus: "unknown; pointer only, no remote monitoring"
    },
    "QUESTION-AUTHORITY": question(
      "What authority and formal disposition apply to this treatment request?",
      "DIDC secretariat role",
      "Obtain terms of reference and formal minutes.",
      "Dated committee remit and recorded disposition."
    ),
    "QUESTION-OWNER": question(
      "Which role is accountable for the cyber risk and treatment?",
      "Enterprise risk coordination role",
      "Seek a recorded role assignment linked to the risk.",
      "Dated authoritative ownership record."
    ),
    "QUESTION-OUTCOME": question(
      "Has the failed service restoration been demonstrated successfully?",
      "Service operations role",
      "Request a reproducible test and residual-exposure review.",
      "Dated test log with scope and reviewed result."
    ),
    "QUESTION-DELAY": question(
      "What sourced reason explains the wait on escalation?",
      "Enterprise risk coordination role",
      "Ask for the dated explanation; retain unknown until supplied.",
      "Source-backed explanation, not silence or elapsed time."
    ),
    "THREAD-1": {
      ask: known("Consider transition options after the incoming supplier resource resigns."),
      proposedAction: known("Meet the replacement resource next week."),
      owner: known("Supplier coordination role arranges the meeting."),
      decision: known("Arrange a meeting with the replacement resource."),
      status: known("Invitation sent."),
      outcome: unknown("Whether the meeting occurred or the transition succeeded is unknown."),
      reasonForDelay: unknown("No delay reason is recorded; a delay is not established."),
      observedStep: "Meeting invitation sent; meeting attendance is not established."
    }
  };
  const links = {
    "ASK-1": ["RISK-CYBER-1", "ACTION-1"],
    "RISK-DIGITAL-1": ["RISK-ENTERPRISE-1"],
    "RISK-CYBER-1": ["RISK-DIGITAL-1", "EVIDENCE-1", "EVIDENCE-2", "EXTERNAL-1"],
    "ACTION-1": ["RISK-CYBER-1", "QUESTION-OWNER", "QUESTION-AUTHORITY"],
    "MEETING-1": ["ASK-1", "OWNER-1"],
    "EVIDENCE-1": ["RISK-CYBER-1"],
    "EVIDENCE-2": ["RISK-CYBER-1"]
  };
  const sources = Object.entries(contents).map(([id, content]) => ({
    id,
    revision: 1,
    recordedAt: id === "EXTERNAL-1" ? "2026-10-06" : "2026-10-05",
    content,
    links: links[id] ?? (id.startsWith("QUESTION-") ? ["RISK-CYBER-1"] : [])
  }));
  const trail = {
    referenceOnly: true,
    recovery: {
      ask: ["ASK-1", "ask"],
      proposedAction: ["ACTION-1", "proposedAction"],
      owner: ["OWNER-1", "owner"],
      decision: ["MEETING-1", "decision"],
      status: ["MEETING-1", "status"],
      outcome: ["MEETING-1", "outcome"],
      reasonForDelay: ["MEETING-1", "reasonForDelay"]
    },
    evidence: ["EVIDENCE-1", "EVIDENCE-2"],
    questions: ["QUESTION-AUTHORITY", "QUESTION-OWNER", "QUESTION-OUTCOME", "QUESTION-DELAY"],
    externalReferences: ["EXTERNAL-1"]
  };
  const evidence = sources.find((source) => source.id === "EVIDENCE-2");
  if (["reviewed", "after"].includes(scenario)) {
    evidence.revision = 2;
    evidence.recordedAt = "2026-10-07";
    evidence.content.claim = "Expanded test log still records a failed restoration; success remains contradicted.";
  }
  if (scenario === "after") {
    const meeting = sources.find((source) => source.id === "MEETING-1");
    meeting.revision = 2;
    meeting.recordedAt = "2026-10-08";
    meeting.content.disposition = "more-info-requested";
    meeting.content.status = known("More PSPF and requirements context requested; no treatment approval established.");
    meeting.links.push("QUESTION-PSPF");
    const content = question(
      "Which PSPF requirement versions, applicability and gaps must the next paper explain?",
      "DIDC secretariat role",
      "Clarify the request and prepare a sourced requirements annex; keep the original treatment ask open.",
      "Recorded request or minutes and versioned PSPF requirements with applicability evidence."
    );
    sources.push({ id: "QUESTION-PSPF", revision: 1, recordedAt: "2026-10-08", content, links: ["RISK-CYBER-1"] });
    trail.questions.push("QUESTION-PSPF");
  }
  if (scenario === "revision-only") evidence.revision = 2;
  if (scenario === "content-only")
    evidence.content.claim = "Corrected log: restoration failed for two services; revision was not bumped.";
  if (scenario === "missing-evidence") sources.splice(sources.indexOf(evidence), 1);
  if (scenario === "missing-recovery") trail.recovery.owner[0] = "MISSING-OWNER";
  if (scenario === "missing-linked-record")
    sources.find((source) => source.id === "RISK-DIGITAL-1").links.push("MISSING-PARENT");
  if (scenario === "reordered") {
    sources.reverse();
    trail.questions.reverse();
  }
  return { scope, scenario, sources, trail, existingTrail: { requiresMatter: false, sourceIds: ["THREAD-1"] } };
}

function resolveFixture(scenario) {
  const fixture = createSyntheticFixture(scenario);
  const index = new Map(fixture.sources.map((source) => [source.id, source]));
  const resolve = (id) => {
    if (!index.has(id)) throw new Error(`Missing source reference: ${id}`);
    return index.get(id);
  };
  const pending = [
    ...Object.values(fixture.trail.recovery).map(([id]) => id),
    ...fixture.trail.evidence,
    ...fixture.trail.questions,
    ...fixture.trail.externalReferences
  ];
  const visited = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    const source = resolve(id);
    visited.add(id);
    pending.push(...source.links);
  }
  return { fixture, resolve, sourceIds: sortIds(visited) };
}

function answer(source, field) {
  const fact = source.content[field];
  if (!fact || !["known", "unknown"].includes(fact.state))
    throw new Error(`Missing recovery field: ${source.id}.${field}`);
  return { ...fact, source: { id: source.id, revision: source.revision, recordedAt: source.recordedAt } };
}

function recoveryFrom(trail, resolve) {
  return Object.fromEntries(
    INFORMATION_TYPES.map((key) => {
      const [id, field] = trail.recovery[key];
      return [key, answer(resolve(id), field)];
    })
  );
}

export function recoverSevenTypes(scenario = "before") {
  const { fixture, resolve } = resolveFixture(scenario);
  return recoveryFrom(fixture.trail, resolve);
}

export function buildDossierProjection(scenario = "before", profile = "CISO") {
  if (!PROFILE_IDS.includes(profile)) throw new Error("Unknown candidate profile; profiles do not grant permissions.");
  const { fixture, resolve, sourceIds } = resolveFixture(scenario);
  const meeting = resolve("MEETING-1");
  const recovery = recoveryFrom(fixture.trail, resolve);
  return {
    scope,
    boundary: "synthetic-internal-only; no publication or permissions functionality",
    profile: { id: profile, ...profiles[profile], questions: [...profiles[profile].questions] },
    referenceOnly: true,
    sourceIds,
    recovery,
    sources: sourceIds.map(resolve),
    evidence: sortIds(fixture.trail.evidence).map(resolve),
    questions: sortIds(fixture.trail.questions).map(resolve),
    externalReferences: sortIds(fixture.trail.externalReferences).map(resolve),
    unknowns: INFORMATION_TYPES.filter((key) => recovery[key].state === "unknown"),
    disposition: { value: meeting.content.disposition, source: recovery.status.source },
    involvement: { value: meeting.content.involvement, source: recovery.status.source }
  };
}

function freezeTree(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function checkDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid date; inject an ISO calendar date.");
}

export function captureBriefEdition(scenario, profile, reviewedAt, issuedAt) {
  const projection = buildDossierProjection(scenario, profile);
  checkDate(reviewedAt);
  checkDate(issuedAt);
  if (projection.sources.some((source) => source.recordedAt > reviewedAt))
    throw new Error("Review predates linked source records.");
  if (issuedAt < reviewedAt) throw new Error("Issue predates review.");
  return freezeTree({ scope, kind: "synthetic-issued-edition-not-publication", reviewedAt, issuedAt, projection });
}

function stableContent(value) {
  if (Array.isArray(value)) return value.map(stableContent);
  if (value && typeof value === "object")
    return Object.fromEntries(sortIds(Object.keys(value)).map((key) => [key, stableContent(value[key])]));
  return value;
}

function changeFlags(live, baseline) {
  const current = new Map(live.sources.map((source) => [source.id, source]));
  const previous = new Map(baseline.sources.map((source) => [source.id, source]));
  const changes = [];
  for (const id of sortIds(new Set([...current.keys(), ...previous.keys()]))) {
    const next = current.get(id);
    const prior = previous.get(id);
    const revisionChanged = next?.revision !== prior?.revision;
    const describe = (source) =>
      source &&
      JSON.stringify(
        stableContent({
          kind: source.kind,
          content: source.content,
          recordedAt: source.recordedAt,
          links: sortIds(source.links)
        })
      );
    const contentChanged = describe(next) !== describe(prior);
    if (!revisionChanged && !contentChanged) continue;
    const kind = !prior
      ? "added"
      : !next
        ? "removed"
        : revisionChanged && contentChanged
          ? "revision-and-content"
          : revisionChanged
            ? "revision"
            : "content";
    changes.push({ id, kind, previousRevision: prior?.revision ?? null, currentRevision: next?.revision ?? null });
  }
  const linksChanged = JSON.stringify(live.sourceIds) !== JSON.stringify(baseline.sourceIds);
  return { changes, linksChanged, narrativeNeedsReview: linksChanged || changes.length > 0 };
}

export function compareDossierChanges(
  liveScenario = "after",
  reviewedScenario = "reviewed",
  issuedScenario = "before"
) {
  const live = buildDossierProjection(liveScenario);
  return {
    sinceReview: changeFlags(live, buildDossierProjection(reviewedScenario)),
    sinceIssued: changeFlags(live, buildDossierProjection(issuedScenario))
  };
}

export function buildNoExtraCaptureComparison() {
  const { fixture, resolve } = resolveFixture("before");
  const thread = resolve("THREAD-1");
  return {
    scope,
    requiresMatter: false,
    syntheticAdditionalCaptureOperations: 0,
    sourceIds: [...fixture.existingTrail.sourceIds],
    sources: [thread],
    recovery: Object.fromEntries(INFORMATION_TYPES.map((key) => [key, answer(thread, key)])),
    observedStep: {
      value: thread.content.observedStep,
      source: { id: thread.id, revision: thread.revision, recordedAt: thread.recordedAt }
    }
  };
}

export function evaluateP2MatterDossier() {
  const projections = PROFILE_IDS.map((profile) => buildDossierProjection("after", profile));
  return {
    scope,
    status: "synthetic evaluation only; adoption not established",
    projections,
    before: buildDossierProjection("before", "DIDC"),
    reviewed: buildDossierProjection("reviewed", "DIDC"),
    issuedEdition: captureBriefEdition("before", "DIDC", "2026-10-06", "2026-10-06"),
    flags: compareDossierChanges(),
    noExtraCapture: buildNoExtraCaptureComparison(),
    syntheticCounts: {
      informationTypes: INFORMATION_TYPES.length,
      linkedSourcesAfter: projections[0].sourceIds.length,
      extraCaptureForExistingThread: 0
    },
    comparison: {
      status: "OPEN: manual protocol pending; no timings or performance thresholds",
      alternatives: ["current workflow", "document and list", "candidate reference projection"],
      protocol:
        "Use the same synthetic before/after sources for all alternatives. Recover each of the seven types with source dates, contradictions and unknowns; record capture, maintenance, retrieval and briefing effort separately. Keep the existing thread intact without forced matter capture. Real baseline and adoption remain unmeasured."
    },
    openGaps: [
      "P1 measured baseline",
      "Rung 0 trial",
      "deployment permission",
      "stack/parser/finder",
      "browser/drafts/storage",
      "publication/history/erasure",
      "P2 adoption and ADR/P3 approval",
      "independent review"
    ]
  };
}
