#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateP2MatterDossier, INFORMATION_TYPES } from "./lib/p2-matter-dossier.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = join(root, ".tmp/p2-matter-dossier");
const label = "P2 synthetic design probe";
const limitation =
  "NOT product RC, release readiness or P1 completion; adoption and architecture approval remain OPEN.";
const sourceRef = (source) => `${source.id}@${source.revision}`;
const provenance = (source) => `${sourceRef(source)} (${source.recordedAt})`;
const fact = (projection, type) => {
  const answer = projection.recovery[type];
  return `${answer.state}: ${answer.value} [${provenance(answer.source)}]`;
};

function brief(projection, profile) {
  const source = (id) => projection.sources.find((record) => record.id === id);
  const action = source("ACTION-1");
  const risk = source("RISK-CYBER-1");
  const evidence = projection.evidence.find((record) => record.content.position === "contradicts");
  const content = {
    CISO: [
      `${risk.content.concern} Intended outcome: ${risk.content.intendedOutcome} [${provenance(risk)}]`,
      `${evidence.content.claim} Limitation: ${evidence.content.limitation} [${provenance(evidence)}]`,
      `Escalation status: ${fact(projection, "status")}`
    ],
    Ops: [
      fact(projection, "proposedAction"),
      `Prerequisite: ${action.content.prerequisite} Expected result: ${action.content.expectedResult} [${provenance(action)}]`,
      `Completion evidence: ${action.content.completionEvidence} Help route: ${action.content.helpRoute} [${provenance(action)}]`,
      `Preparation owner: ${fact(projection, "owner")}`
    ],
    DIDC: [
      `Exact ask: ${fact(projection, "ask")}`,
      `Disposition: ${projection.disposition.value} [${provenance(projection.disposition.source)}]`,
      `Status: ${fact(projection, "status")}`,
      `Authority remains unanswered: ${source("QUESTION-AUTHORITY").content.question} [${provenance(source("QUESTION-AUTHORITY"))}]`
    ]
  };
  return [
    ...content[profile],
    `Decision: ${fact(projection, "decision")}`,
    `Outcome: ${fact(projection, "outcome")}`,
    `Reason for delay: ${fact(projection, "reasonForDelay")}`,
    `Involvement, not outcome: ${projection.involvement.value} [${provenance(projection.involvement.source)}]`
  ];
}

function buildReport(evaluation) {
  const sources = {};
  const register = (source) => {
    const reference = sourceRef(source);
    if (sources[reference] && JSON.stringify(sources[reference]) !== JSON.stringify(source)) {
      throw new Error(`Conflicting synthetic source version: ${reference}`);
    }
    sources[reference] = source;
    return reference;
  };
  const project = (projection) => ({
    boundary: projection.boundary,
    referenceOnly: projection.referenceOnly,
    recovery: projection.recovery,
    unknowns: projection.unknowns,
    disposition: projection.disposition,
    involvement: projection.involvement,
    sourceRefs: projection.sources.map(register),
    evidenceRefs: projection.evidence.map(sourceRef),
    questionRefs: projection.questions.map(sourceRef),
    externalReferenceRefs: projection.externalReferences.map(sourceRef)
  });
  const stages = {
    before: project(evaluation.before),
    reviewed: project(evaluation.reviewed),
    after: project(evaluation.projections[0])
  };
  const issued = evaluation.issuedEdition;
  if (JSON.stringify(project(issued.projection)) !== JSON.stringify(stages.before)) {
    throw new Error("Synthetic issued edition does not match the preserved before baseline.");
  }
  const { sources: threadSources, ...noExtraCapture } = evaluation.noExtraCapture;
  noExtraCapture.sourceRefs = threadSources.map(register);
  return {
    label,
    limitation,
    scope: evaluation.scope,
    status: evaluation.status,
    boundary: {
      input: "Fixed synthetic evaluator only; no arguments, workplace files, stdin or remote reads.",
      use: "Local owner inspection only; no production publication, permissions or release-gate registration.",
      approval:
        "P2 must confirm or amend ADR 0102 and P3 scope before product implementation; extensions remain frozen.",
      history:
        "The evaluator freezes the issued edition recursively. These replaceable generated reports are not production immutable history or an erasure/publication implementation."
    },
    informationTypes: INFORMATION_TYPES,
    stages,
    profiles: evaluation.projections.map((projection) => ({
      ...projection.profile,
      before: { projectionRef: "before", brief: brief(evaluation.before, projection.profile.id) },
      after: { projectionRef: "after", brief: brief(projection, projection.profile.id) }
    })),
    sources,
    issuedEdition: {
      kind: issued.kind,
      reviewedAt: issued.reviewedAt,
      issuedAt: issued.issuedAt,
      profile: issued.projection.profile.id,
      projectionRef: "before",
      immutableInEvaluator: Object.isFrozen(issued) && Object.isFrozen(issued.projection),
      interpretation: "The submitted synthetic account stays at before; live changes do not rewrite it."
    },
    changeBaselines: {
      sinceReview: { baselineRef: "reviewed", liveRef: "after", ...evaluation.flags.sinceReview },
      sinceIssued: { baselineRef: "before", liveRef: "after", ...evaluation.flags.sinceIssued }
    },
    responseDistinction: {
      beforeDisposition: stages.before.disposition,
      afterDisposition: stages.after.disposition,
      decision: stages.after.recovery.decision,
      followUpSourceRef: stages.after.questionRefs.find((reference) => reference.startsWith("QUESTION-PSPF@")),
      interpretation:
        "More information requested is not a treatment decision or approval. The original treatment ask remains open; paper preparation is not verified restoration or risk reduction."
    },
    noExtraCapture,
    syntheticCounts: {
      interpretation: "Fixture structure only, not measured human effort or workplace counts.",
      ...evaluation.syntheticCounts
    },
    comparison: {
      ...evaluation.comparison,
      results: evaluation.comparison.alternatives.map((alternative) => ({
        alternative,
        status: "UNMEASURED: pending human protocol",
        sevenTypeRecovery: null,
        effort: { capture: null, maintenance: null, retrieval: null, briefing: null }
      })),
      interpretation:
        "Null means unmeasured, not zero. No observed timings, counts, savings, thresholds or adoption claims."
    },
    openPrerequisites: evaluation.openGaps.map((prerequisite) => ({ status: "OPEN", prerequisite }))
  };
}

const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
const table = (headers, rows) => [
  `| ${headers.map(cell).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)
];

function renderMarkdown(report) {
  const lines = [
    `# ${report.label}`,
    "",
    report.limitation,
    "",
    `Scope: ${report.scope}. ${report.status}.`,
    "",
    ...Object.values(report.boundary).map((value) => `- ${value}`),
    "",
    "## Shared Before/After Projection",
    "",
    "Profiles change questions and emphasis only, not facts, permissions or authority. Shared facts and versioned sources are recorded once in JSON; brief extracts below refer to the same projections.",
    "",
    ...table(
      ["Exact information type", "Before", "After"],
      report.informationTypes.map((type) => [type, fact(report.stages.before, type), fact(report.stages.after, type)])
    ),
    "",
    `Unknowns before: ${report.stages.before.unknowns.join(", ")}. Unknowns after: ${report.stages.after.unknowns.join(", ")}.`,
    "",
    report.responseDistinction.interpretation,
    ""
  ];
  for (const profile of report.profiles) {
    lines.push(`## ${profile.id} Brief/Projection`, "", profile.emphasis, "");
    lines.push(...profile.questions.map((question) => `- ${question}`), "");
    for (const stage of ["before", "after"]) {
      lines.push(
        `### ${stage === "before" ? "Before" : "After"}`,
        "",
        ...profile[stage].brief.map((text) => `- ${text}`),
        ""
      );
    }
  }
  lines.push(
    "## Evidence And Follow-Through",
    "",
    "Supporting and contradicting evidence remain visible together.",
    ""
  );
  for (const reference of report.stages.after.evidenceRefs) {
    const source = report.sources[reference];
    lines.push(
      `- ${provenance(source)}; ${source.content.position}: ${source.content.claim} Limitation: ${source.content.limitation}`
    );
  }
  lines.push("", "Before question references: " + report.stages.before.questionRefs.join(", ") + ".", "");
  for (const reference of report.stages.after.questionRefs) {
    const source = report.sources[reference];
    const question = source.content;
    lines.push(
      `### ${provenance(source)}`,
      "",
      `State: ${question.state}. ${question.question}`,
      "",
      `Resolver role: ${question.resolverRole}. Next step: ${question.nextStep}`,
      "",
      `Checkpoint: ${question.checkpoint}. Evidence needed: ${question.evidenceNeeded}`,
      "",
      `Can proceed: ${question.canProceed}`,
      ""
    );
  }
  lines.push(
    "## Issued Edition And Change Baselines",
    "",
    `${report.issuedEdition.kind}; ${report.issuedEdition.profile}; reviewed ${report.issuedEdition.reviewedAt}; issued ${report.issuedEdition.issuedAt}; preserved projection: ${report.issuedEdition.projectionRef}. Frozen in evaluator: ${report.issuedEdition.immutableInEvaluator}.`,
    "",
    report.issuedEdition.interpretation,
    "",
    "The reviewed fixture includes EVIDENCE-2@2; the issued fixture keeps EVIDENCE-2@1. These are separate synthetic baselines, not claims that a real review or issue occurred.",
    ""
  );
  for (const [name, baseline] of Object.entries(report.changeBaselines)) {
    lines.push(
      `### ${name}: ${baseline.baselineRef} -> ${baseline.liveRef}`,
      "",
      `Linked-source set changed: ${baseline.linksChanged}. Dependent narrative needs review: ${baseline.narrativeNeedsReview}.`,
      "",
      ...table(
        ["Source", "Change", "Baseline revision", "Live revision"],
        baseline.changes.map((change) => [
          change.id,
          change.kind,
          change.previousRevision ?? "absent",
          change.currentRevision ?? "absent"
        ])
      ),
      ""
    );
  }
  lines.push("## External Pointer Caveat", "");
  for (const reference of report.stages.after.externalReferenceRefs) {
    const source = report.sources[reference];
    lines.push(
      `- ${provenance(source)}: ${source.content.pointer}; last checked ${source.content.lastCheckedAt}; ${source.content.remoteChangeStatus}.`
    );
  }
  lines.push(
    "",
    "Change flags cover linked local synthetic records only. An unchanged pointer does not establish an unchanged remote register; no URL is fetched.",
    "",
    "## Versioned Source Catalogue",
    "",
    ...table(
      ["Reference", "Source ID", "Revision", "Recorded date", "Links"],
      Object.entries(report.sources).map(([reference, source]) => [
        reference,
        source.id,
        source.revision,
        source.recordedAt,
        source.links.join(", ") || "none"
      ])
    ),
    "",
    "Full source contents are in the JSON catalogue, not duplicated for each profile. Each stage lists its exact source, evidence, question and external-reference versions.",
    "",
    "## Existing Thread: No Forced Matter Capture",
    "",
    `Requires Matter: ${report.noExtraCapture.requiresMatter}. Additional capture operations in the synthetic fixture: ${report.noExtraCapture.syntheticAdditionalCaptureOperations}, not an observed workplace-effort result.`,
    "",
    `${report.noExtraCapture.observedStep.value} [${provenance(report.noExtraCapture.observedStep.source)}]`,
    "",
    ...table(
      ["Exact information type", "Existing thread"],
      report.informationTypes.map((type) => [type, fact(report.noExtraCapture, type)])
    ),
    "",
    "## Workflow Comparison: Unmeasured",
    "",
    report.comparison.status,
    "",
    ...table(
      ["Alternative", "Seven-type recovery", "Capture / maintenance / retrieval / briefing effort"],
      report.comparison.results.map((result) => [result.alternative, result.status, result.status])
    ),
    "",
    report.comparison.protocol,
    "",
    report.comparison.interpretation,
    "",
    report.syntheticCounts.interpretation,
    "",
    "## OPEN Prerequisites",
    "",
    ...report.openPrerequisites.map((gap) => `- ${gap.status}: ${gap.prerequisite}`),
    "",
    "This probe closes none of these prerequisites and selects no stack or product architecture.",
    ""
  );
  return lines.join("\n");
}

try {
  if (process.argv.length !== 2) {
    throw new Error("No arguments accepted; this runner uses fixed synthetic data only, never workplace input.");
  }
  const report = buildReport(evaluateP2MatterDossier());
  const jsonPath = join(outputDirectory, "report.json");
  const markdownPath = join(outputDirectory, "report.md");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdown(report), "utf8")
  ]);
  console.log(
    `ok ${label}: CISO/Ops/DIDC before/after, seven sourced types, immutable issued fixture and separate change baselines.`
  );
  console.log(limitation);
  console.log(
    `Workflow/document-and-list comparison UNMEASURED; ${report.openPrerequisites.length} prerequisites OPEN.`
  );
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${markdownPath}`);
} catch (error) {
  console.error(`P2 synthetic design probe failed: ${error.message}`);
  process.exitCode = 1;
}
