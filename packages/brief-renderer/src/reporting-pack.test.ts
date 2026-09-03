import assert from "node:assert/strict";
import test from "node:test";
import type {
  ActionEntity,
  DirectionEntity,
  EvidenceEntity,
  LinkEntity,
  NarrativeEntity,
  RequirementControlMappingEntity,
  RequirementEntity,
  RiskEntity
} from "@pspf/contracts";
import { PSPF_DOMAINS, VERSION_AXES } from "@pspf/contracts";
import {
  buildReportingPackModel,
  renderExecutiveBriefMarkdown,
  renderExecutiveBriefPlainText,
  renderReportingPackMarkdown,
  renderReportingPackPlainText,
  renderTeamCardPlainText,
  renderTeamReportCardMarkdown,
  renderTeamReportCardPlainText,
  type ReportingPackAnchor,
  type ReportingPackInput
} from "./reporting-pack.js";

const NOW = "2026-09-01T00:00:00.000Z";
const STAMP = "2026-08-01T00:00:00.000Z";
const GOV = PSPF_DOMAINS[0]!;
const INFO = PSPF_DOMAINS[2]!;
const TECH = PSPF_DOMAINS[3]!;

const SENSITIVE_SUMMARY = "Internal working note that must never leave the workspace.";
const SENSITIVE_EFFORT_BASIS = "Effort basis estimated from vendor quote.";

test("me scope keeps only the selected domains and their linked records", () => {
  const model = buildReportingPackModel(fixture());
  const markdown = renderReportingPackMarkdown(model);

  assert.deepEqual(
    model.domainPacks.map((pack) => pack.title),
    ["Information", "Technology"]
  );
  assert.equal(model.metadata.scopeLabel, "My domains: Information, Technology");
  assert.doesNotMatch(markdown, /Maintain governance committee/);
  assert.doesNotMatch(markdown, /Confirm governance committee charter/);
});

test("all scope includes every domain", () => {
  const model = buildReportingPackModel({ ...fixture(), scope: { kind: "all", domainIds: [] } });

  assert.equal(model.metadata.scopeLabel, "All domains");
  assert.deepEqual(
    model.domainPacks.map((pack) => pack.title),
    ["Governance", "Information", "Technology"]
  );
  assert.match(renderReportingPackMarkdown(model), /Maintain governance committee/);
});

test("executive brief sections follow the fixed order", () => {
  const model = buildReportingPackModel(fixture());

  assert.deepEqual(
    model.executiveBrief.sections.map((section) => section.heading),
    ["Where we stand", "What changed since Q3 checkpoint", "Top exposures", "Decisions needed"]
  );
});

test("verdict sentence precedes bullets in every rendered section", () => {
  const model = buildReportingPackModel(fixture());
  for (const rendered of [renderReportingPackMarkdown(model), renderReportingPackPlainText(model)]) {
    for (const section of model.executiveBrief.sections) {
      const verdictIndex = rendered.indexOf(section.verdict);
      assert.ok(verdictIndex >= 0, `verdict missing for ${section.heading}`);
      for (const bullet of section.bullets) {
        assert.ok(rendered.indexOf(bullet) > verdictIndex, `bullet before verdict in ${section.heading}`);
      }
    }
  }
});

test("where we stand states met count, evidence backing, and the anchor trend", () => {
  const section = buildReportingPackModel(fixture()).executiveBrief.sections[0]!;

  assert.equal(
    section.verdict,
    "Across Information and Technology, 3 of 6 applicable requirements are met; 1 is backed by current evidence."
  );
  assert.ok(section.paragraphs.some((line) => line.includes("up 17 points since Q3 checkpoint")));
  assert.deepEqual(section.bullets, [
    "Information: 2 of 3 applicable met; 1 backed by current evidence.",
    "Technology: 1 of 3 applicable met; 0 backed by current evidence."
  ]);
});

test("record-status anchor names improved and regressed requirements, risks, and completed actions", () => {
  const section = buildReportingPackModel(fixture()).executiveBrief.sections[1]!;

  assert.equal(section.verdict, "Compared with Q3 checkpoint, requirement status shows 2 improved, 1 regressed.");
  assert.ok(
    section.bullets.includes("Improved: Control changes to information classification moved from Partially met to Met.")
  );
  assert.ok(section.bullets.includes("Improved: Retire unsupported platforms moved from In progress to Met."));
  assert.ok(
    section.bullets.includes("Regressed: Sanitise information before release moved from Met to Partially met.")
  );
  assert.ok(section.bullets.includes("Risk opened: Unpatched systems exposed to the internet."));
  assert.ok(section.bullets.includes("Action completed: Decommission legacy file server."));
});

test("counts-only anchor compares totals and states the caveat", () => {
  const anchor: ReportingPackAnchor = {
    snapshotId: "SNP-counts",
    title: "Q2 baseline",
    capturedAt: "2026-04-01T00:00:00.000Z",
    counts: {
      requirements: { met: 2, "partially-met": 1, "not-met": 2, "not-started": 2 },
      risks: { open: 1, monitored: 1, closed: 1 },
      actions: { todo: 3, done: 0 }
    }
  };
  const model = buildReportingPackModel({ ...fixture(), anchor });
  const [standing, changed] = model.executiveBrief.sections;

  assert.equal(
    changed!.verdict,
    "Compared with Q2 baseline, met requirements moved from 2 to 3, open risks from 2 to 3, and completed actions from 0 to 1."
  );
  assert.deepEqual(changed!.paragraphs, [
    "Comparison uses summary counts only; this snapshot predates per-record history."
  ]);
  assert.deepEqual(changed!.bullets, []);
  assert.ok(standing!.paragraphs.some((line) => line.includes("the earlier figure is organisation-wide")));
});

test("no anchor states there is nothing to compare against", () => {
  const model = buildReportingPackModel({ ...fixture(), anchor: undefined });
  const [standing, changed] = model.executiveBrief.sections;

  assert.ok(standing!.paragraphs.includes("No earlier snapshot to compare against."));
  assert.equal(changed!.heading, "What changed");
  assert.equal(changed!.verdict, "No earlier snapshot recorded.");
  assert.equal(model.metadata.anchorLabel, "No earlier snapshot");
});

test("top exposures rank open risks by rating and explain why each matters", () => {
  const section = buildReportingPackModel(fixture()).executiveBrief.sections[2]!;

  assert.equal(section.verdict, "1 of 3 open risks are rated high or extreme.");
  assert.ok(section.paragraphs.includes("2 of 3 open risks have no met requirement covering them."));
  assert.equal(section.bullets.length, 3);
  assert.match(section.bullets[0]!, /^Sensitive data released without sanitisation \(rating 16, high or extreme\)/);
  assert.match(section.bullets[0]!, /Sanitise information before release is partially met; until it is addressed/);
  assert.match(section.bullets[1]!, /^Unpatched systems exposed to the internet \(rating 9, moderate\)/);
  assert.match(section.bullets[2]!, /Wrongly labelled information can be seen by people who should not see it/);
});

test("decisions needed groups blockers by class and names the owning role", () => {
  const section = buildReportingPackModel(fixture()).executiveBrief.sections[3]!;

  assert.equal(section.verdict, "1 decision needs an owner or a date.");
  assert.equal(section.bullets.length, 3);
  assert.match(
    section.bullets[0]!,
    /^Waiting on us: Apply critical patches - no due date - owner: Platform operations lead/
  );
  assert.match(section.bullets[0]!, /latest update: Vendor patch window confirmed/);
  assert.match(
    section.bullets[1]!,
    /^Waiting on us: Publish sanitisation procedure - due 01 Aug 2026 - owner: Information security manager/
  );
  assert.match(section.bullets[2]!, /^Waiting on supplier: Replace end-of-life firewall/);
});

test("readiness triggers every code and sorts high severity first", () => {
  const { readiness } = buildReportingPackModel(fixture());

  assert.deepEqual([...new Set(readiness.map((item) => item.code))].sort(), [
    "action-overdue",
    "action-without-due-date",
    "action-without-owner",
    "direction-unanswered",
    "gap-without-action",
    "gap-without-owner",
    "mapping-draft-unreviewed",
    "met-without-current-evidence"
  ]);
  const severities = readiness.map((item) => item.severity);
  assert.equal(severities.lastIndexOf("high") < severities.indexOf("medium"), true);
  assert.ok(
    readiness.some(
      (item) => item.code === "gap-without-action" && item.message.startsWith("Restrict administrative privileges")
    )
  );
  assert.ok(
    readiness.some(
      (item) =>
        item.code === "mapping-draft-unreviewed" && item.message.includes("review by Information security manager")
    )
  );
  assert.equal(readiness.filter((item) => item.code === "met-without-current-evidence").length, 2);
});

test("owner team satisfies owner readiness checks and is preferred over the reviewing role", () => {
  const base = fixture();
  const input: ReportingPackInput = {
    ...base,
    requirements: base.requirements.map((item) =>
      item.id === "REQ-INFO-3" ? { ...item, ownerTeam: "Information Governance" } : item
    ),
    actions: base.actions.map((item) => (item.id === "ACT-4" ? { ...item, ownerTeam: "Network Engineering" } : item))
  };
  const model = buildReportingPackModel(input);

  const ownerGaps = model.readiness.filter((item) => item.code === "gap-without-owner").map((item) => item.targetId);
  assert.equal(ownerGaps.includes("REQ-INFO-3"), false, "requirement with its own owner team");
  assert.equal(ownerGaps.includes("REQ-TECH-1"), false, "requirement covered by an owned open action");
  assert.equal(ownerGaps.includes("REQ-TECH-2"), true, "gap with no owner anywhere");

  const ownerlessActions = model.readiness
    .filter((item) => item.code === "action-without-owner")
    .map((item) => item.targetId)
    .sort();
  assert.deepEqual(ownerlessActions, ["ACT-1", "ACT-2"]);
  assert.ok(
    model.readiness.filter((item) => item.code === "action-without-owner").every((item) => item.severity === "medium")
  );

  const decisions = model.executiveBrief.sections[3]!;
  assert.match(
    decisions.bullets[2]!,
    /^Waiting on supplier: Replace end-of-life firewall - .* - owner: Network Engineering/
  );
  assert.match(decisions.bullets[0]!, /owner: Platform operations lead/);
});

test("domain pack carries responses, evidence, trend, narrative, and action plan", () => {
  const [info, tech] = buildReportingPackModel(fixture()).domainPacks;

  assert.deepEqual(info!.trend, { metNow: 2, metAtAnchor: 2, applicable: 3 });
  assert.equal(info!.responses.length, 3);
  assert.equal(info!.evidence.length, 2);
  assert.match(info!.narrative, /^Information has 2 of 3 applicable requirements met\./);
  assert.match(info!.narrative, /1 of the 2 met requirements are backed by current evidence/);
  assert.match(
    info!.narrative,
    /Completing the 1 open action linked to requirements not yet met could move up to 1 requirement\./
  );
  assert.ok(info!.actionPlan.some((item) => item.actionTitle === "Publish sanitisation procedure" && item.overdue));
  assert.ok(
    tech!.actionPlan.some((item) => item.actionTitle === "Apply critical patches" && item.dueDate === undefined)
  );
});

test("identical input produces identical model and renders", () => {
  const input = fixture();
  const first = buildReportingPackModel(input);
  const second = buildReportingPackModel(input);

  assert.deepEqual(first, second);
  assert.equal(renderReportingPackMarkdown(first), renderReportingPackMarkdown(second));
  assert.equal(renderReportingPackPlainText(first), renderReportingPackPlainText(second));
});

test("markdown renderers carry classification, headings, and exclusion note", () => {
  const model = buildReportingPackModel(fixture());
  const pack = renderReportingPackMarkdown(model);
  const brief = renderExecutiveBriefMarkdown(model);

  assert.ok(pack.startsWith("OFFICIAL: Sensitive\n\n# PSPF Reporting Pack\n"));
  assert.match(pack, /## Executive Brief/);
  assert.match(pack, /### Where we stand/);
  assert.match(pack, /## Domain packs/);
  assert.match(pack, /### Information/);
  assert.match(pack, /\| Requirement \| ID \| Status \| Basis \| Rationale \|/);
  assert.match(pack, /## Readiness before you send/);
  assert.match(
    pack,
    /Note: this pack is OFFICIAL: Sensitive and for internal use\. Restricted personal fields are excluded; assessment rationale, action commentary, and owner teams are included\.$/
  );
  assert.ok(brief.startsWith("OFFICIAL: Sensitive\n\n# PSPF Executive Brief\n"));
  assert.doesNotMatch(brief, /## Domain packs/);
});

test("plain text renderers contain no markdown syntax", () => {
  const model = buildReportingPackModel(fixture());
  for (const text of [renderReportingPackPlainText(model), renderExecutiveBriefPlainText(model)]) {
    assert.doesNotMatch(text, /#/);
    assert.doesNotMatch(text, /\|/);
    assert.doesNotMatch(text, /\*\*/);
    assert.match(text, /PSPF (REPORTING PACK|EXECUTIVE BRIEF)/);
  }
});

test("output excludes person data, record summaries, and effort basis from the executive brief", () => {
  const model = buildReportingPackModel(fixture());
  const brief = renderExecutiveBriefMarkdown(model);
  const pack = renderReportingPackMarkdown(model);

  for (const text of [brief, pack, renderReportingPackPlainText(model)]) {
    assert.doesNotMatch(text, /@/);
    assert.doesNotMatch(text, /personId/);
    assert.doesNotMatch(text, new RegExp(SENSITIVE_SUMMARY));
    assert.doesNotMatch(text, new RegExp(SENSITIVE_EFFORT_BASIS));
  }
  assert.doesNotMatch(brief, /REQ-|ACT-|RSK-|EVD-/);
});

// --- R3: narrative overrides ---------------------------------------------------------------

test("executive sections and domain packs carry slots and keep generated text when no narrative exists", () => {
  const model = buildReportingPackModel(fixture());

  assert.deepEqual(
    model.executiveBrief.sections.map((section) => section.slot),
    ["exec-brief.where-we-stand", "exec-brief.what-changed", "exec-brief.top-exposures", "exec-brief.decisions-needed"]
  );
  for (const section of model.executiveBrief.sections) {
    assert.equal(section.operatorNote, undefined);
    assert.deepEqual(section.paragraphs, section.generatedParagraphs);
  }
  const [info] = model.domainPacks;
  assert.equal(info!.slot, `domain.${INFO.id}.exec-note`);
  assert.equal(info!.operatorNote, undefined);
  assert.equal(info!.narrative, info!.generatedNarrative);
});

test("narrative override replaces paragraphs and sets operatorNote", () => {
  const standingNote = narrative("NAR-1", "exec-brief.where-we-stand", "Standing note from the operator.");
  const domainNote = narrative("NAR-2", `domain.${INFO.id}.exec-note`, "Information domain note.");
  const model = buildReportingPackModel({ ...fixture(), narratives: [standingNote, domainNote] });
  const [standing, changed] = model.executiveBrief.sections;
  const [info, tech] = model.domainPacks;

  assert.deepEqual(standing!.paragraphs, ["Standing note from the operator."]);
  assert.ok(standing!.generatedParagraphs.some((line) => line.includes("up 17 points since Q3 checkpoint")));
  assert.deepEqual(standing!.operatorNote, {
    narrativeId: "NAR-1",
    body: "Standing note from the operator.",
    updatedAt: STAMP
  });
  assert.equal(standing!.verdict.startsWith("Across Information and Technology"), true, "verdict is untouched");
  assert.equal(changed!.operatorNote, undefined);

  assert.equal(info!.narrative, "Information domain note.");
  assert.match(info!.generatedNarrative, /^Information has 2 of 3 applicable requirements met\./);
  assert.equal(info!.operatorNote?.narrativeId, "NAR-2");
  assert.equal(tech!.operatorNote, undefined);

  const markdown = renderReportingPackMarkdown(model);
  assert.match(markdown, /Standing note from the operator\./);
  assert.doesNotMatch(markdown, /up 17 points since Q3 checkpoint/);
  assert.match(markdown, /Information domain note\./);
  assert.doesNotMatch(markdown, /Information has 2 of 3 applicable requirements met\./);
  assert.match(renderExecutiveBriefPlainText(model), /Standing note from the operator\./);
});

test("superseded narrative is ignored and the latest active record wins", () => {
  const first = narrative("NAR-1", "exec-brief.top-exposures", "First draft.", {
    updatedAt: "2026-08-01T00:00:00.000Z"
  });
  const second = narrative("NAR-2", "exec-brief.top-exposures", "Second draft.", {
    updatedAt: "2026-08-05T00:00:00.000Z",
    supersedesId: "NAR-1"
  });
  const stray = narrative("NAR-3", "exec-brief.top-exposures", "Later stray edit.", {
    updatedAt: "2026-08-10T00:00:00.000Z"
  });
  const deleted = narrative("NAR-4", "exec-brief.top-exposures", "Deleted text.", {
    updatedAt: "2026-08-20T00:00:00.000Z",
    recordStatus: "deleted"
  });
  const blank = narrative("NAR-5", "exec-brief.decisions-needed", "   ");

  const model = buildReportingPackModel({ ...fixture(), narratives: [first, second, stray, deleted, blank] });
  const exposures = model.executiveBrief.sections[2]!;
  const decisions = model.executiveBrief.sections[3]!;

  assert.deepEqual(exposures.paragraphs, ["Later stray edit."]);
  assert.equal(exposures.operatorNote?.narrativeId, "NAR-3");
  assert.equal(decisions.operatorNote, undefined, "blank body does not override");

  const chainOnly = buildReportingPackModel({ ...fixture(), narratives: [first, second] });
  assert.deepEqual(chainOnly.executiveBrief.sections[2]!.operatorNote, {
    narrativeId: "NAR-2",
    body: "Second draft.",
    updatedAt: "2026-08-05T00:00:00.000Z",
    supersedesId: "NAR-1"
  });
});

// --- R3: team report card ------------------------------------------------------------------

test("team report card is built from scoped records and rendered after Domain packs", () => {
  const base = fixture();
  const model = buildReportingPackModel({
    ...base,
    requirements: base.requirements.map((item) =>
      item.id === "REQ-INFO-3" ? { ...item, ownerTeam: "Information Governance" } : item
    ),
    actions: base.actions.map((item) =>
      item.id === "ACT-1" || item.id === "ACT-2"
        ? { ...item, ownerTeam: "Platform Engineering" }
        : item.id === "ACT-5"
          ? { ...item, ownerTeam: "Governance Office" }
          : item
    )
  });
  const card = model.teamReportCard!;

  assert.equal(card.periodLabel, "Since 01 Jul 2026");
  assert.deepEqual(
    card.rows.map((row) => row.team),
    ["Platform Engineering", "Information Governance", "Unassigned"],
    "Governance Office is out of scope; Unassigned is last"
  );
  const platform = card.rows[0]!;
  assert.equal(platform.verdict, "stalled");
  assert.equal(platform.overdue, 1);
  assert.equal(platform.noDueDate, 1);
  assert.deepEqual(platform.gapRequirementTitles, [], "gap owned by Information Governance is not re-attributed");
  const infoGov = card.rows[1]!;
  assert.equal(infoGov.verdict, "no-open-work");
  assert.deepEqual(infoGov.gapRequirementTitles, ["Sanitise information before release"]);
  const unassigned = card.rows[2]!;
  assert.equal(unassigned.open, 1);
  assert.equal(unassigned.closedInPeriod, 1, "ACT-3 became done since the anchor");
  assert.deepEqual(card.totals, { teams: 2, unassignedOpen: 1 });

  const markdown = renderReportingPackMarkdown(model);
  const domainIndex = markdown.indexOf("## Domain packs");
  const cardIndex = markdown.indexOf("## Team report card");
  const readinessIndex = markdown.indexOf("## Readiness before you send");
  assert.ok(domainIndex < cardIndex && cardIndex < readinessIndex);
  assert.match(markdown, /\| Team \| Gaps \| Open \| Due in period \| Overdue \| Slipped \| Closed \| Verdict \|/);
  assert.match(markdown, /\| Platform Engineering \| 0 \| 2 \| 0 \| 1 \| 0 \| 0 \| Stalled \|/);
  assert.match(markdown, /Platform Engineering is stalled: nothing was closed in the period/);
  assert.match(markdown, new RegExp(`Rule: ${platform.verdictRule.replaceAll(".", "\\.")}`));

  const plain = renderReportingPackPlainText(model);
  assert.match(plain, /TEAM REPORT CARD/);
  assert.match(
    plain,
    /Platform Engineering: Gaps 0; Open 2; Due in period 0; Overdue 1; Slipped 0; Closed 0; Verdict Stalled/
  );
  assert.doesNotMatch(plain, /[#|]/);

  assert.equal(renderTeamReportCardMarkdown(card), renderTeamReportCardMarkdown(card));
  assert.match(
    renderTeamReportCardPlainText(card),
    /^Period: Since 01 Jul 2026\. 2 teams are named; 1 open action has no owner team\./
  );

  const note = renderTeamCardPlainText(platform, card.periodLabel);
  assert.ok(note.startsWith("Team report card: Platform Engineering (since 01 Jul 2026)\nVerdict: Stalled\n"));
  assert.match(note, /Open actions: 2 \(0 due in period, 1 overdue, 1 without a due date\)\./);
  assert.match(note, /Next due: nothing dated ahead\./);
  assert.doesNotMatch(note, /@|personId/);
  assert.doesNotMatch(note, new RegExp(SENSITIVE_SUMMARY));
});

test("executive brief renderers do not include the team report card", () => {
  const model = buildReportingPackModel(fixture());

  assert.doesNotMatch(renderExecutiveBriefMarkdown(model), /Team report card/);
  assert.doesNotMatch(renderExecutiveBriefPlainText(model), /TEAM REPORT CARD/);
});

// --- Fixture -------------------------------------------------------------------------------

function envelope<Type extends string>(entityType: Type, id: string) {
  return {
    id,
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: STAMP,
    updatedAt: STAMP,
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
}

function requirement(
  id: string,
  title: string,
  domainId: string,
  assessmentStatus: RequirementEntity["assessmentStatus"],
  rationale?: string
): RequirementEntity {
  return {
    ...envelope("requirement", id),
    title,
    domainId,
    assessmentStatus,
    summary: SENSITIVE_SUMMARY,
    assessmentRationale: rationale
  };
}

function evidence(
  id: string,
  title: string,
  freshness: EvidenceEntity["freshness"],
  updatedAt = STAMP
): EvidenceEntity {
  return {
    ...envelope("evidence", id),
    updatedAt,
    title,
    evidenceType: "document",
    reference: `records/${id.toLowerCase()}.pdf`,
    freshness
  };
}

function action(
  id: string,
  title: string,
  status: ActionEntity["status"],
  extra: Partial<ActionEntity> = {}
): ActionEntity {
  return { ...envelope("action", id), title, status, effortBasis: SENSITIVE_EFFORT_BASIS, ...extra };
}

function risk(id: string, title: string, status: RiskEntity["status"], likelihood: number, impact: number): RiskEntity {
  return { ...envelope("risk", id), title, status, likelihood, impact };
}

function narrative(id: string, slot: string, body: string, extra: Partial<NarrativeEntity> = {}): NarrativeEntity {
  return { ...envelope("narrative", id), title: slot, slot, body, audience: "executive", ...extra };
}

function link(
  fromId: string,
  linkType: LinkEntity["linkType"],
  toType: LinkEntity["toType"],
  toId: string
): LinkEntity {
  return {
    ...envelope("link", `LNK-${fromId}-${toId}`),
    title: linkType,
    linkType,
    fromId,
    fromType: "requirement",
    toId,
    toType
  };
}

function mapping(
  id: string,
  requirementId: string,
  reviewBy: string,
  confidence: RequirementControlMappingEntity["confidence"],
  lastReviewedAt?: string
): RequirementControlMappingEntity {
  return {
    ...envelope("requirement-control-mapping", id),
    requirementId,
    sourceControlId: "SRC-ISM-1401",
    coverageQualifier: "primary",
    applicabilityProfile: "Essential Eight",
    confidence,
    lastReviewedAt,
    reviewBy,
    provenance: { author: "Reference data", createdAt: STAMP, oscalRelease: "v2026.03.24" }
  };
}

function fixture(): ReportingPackInput {
  const reqClassification = requirement(
    "REQ-PSPF-2025-058",
    "Control changes to information classification",
    INFO.id,
    "met",
    "Originator approval workflow operating."
  );
  const reqLabelling = requirement("REQ-INFO-2", "Label information with sensitivity markings", INFO.id, "met");
  const reqSanitise = requirement("REQ-INFO-3", "Sanitise information before release", INFO.id, "partially-met");
  const reqPatch = requirement("REQ-TECH-1", "Patch internet-facing systems", TECH.id, "not-met");
  const reqPrivileges = requirement("REQ-TECH-2", "Restrict administrative privileges", TECH.id, "not-started");
  const reqRetire = requirement("REQ-TECH-3", "Retire unsupported platforms", TECH.id, "met");
  const reqGovernance = requirement("REQ-GOV-1", "Maintain governance committee", GOV.id, "not-met");

  const evidenceCurrent = evidence("EVD-1", "Classification change register", "current", "2026-08-15T00:00:00.000Z");
  const evidenceStale = evidence("EVD-2", "Labelling standard 2024", "stale", "2024-01-01T00:00:00.000Z");

  const actionOverdue = action("ACT-1", "Publish sanitisation procedure", "todo", { dueDate: "2026-08-01" });
  const actionNoDue = action("ACT-2", "Apply critical patches", "in-progress", {
    commentary: [
      { createdAt: "2026-07-01T00:00:00.000Z", text: "Awaiting change approval." },
      { createdAt: "2026-08-20T00:00:00.000Z", text: "Vendor patch window confirmed." }
    ]
  });
  const actionDone = action("ACT-3", "Decommission legacy file server", "done", { dueDate: "2026-06-30" });
  const actionOpen = action("ACT-4", "Replace end-of-life firewall", "todo", {
    dueDate: "2026-12-01",
    blockerClass: "supplier"
  });
  const actionGovernance = action("ACT-5", "Confirm governance committee charter", "todo");

  const riskSanitisation = risk("RSK-1", "Sensitive data released without sanitisation", "open", 4, 4);
  const riskPatching = risk("RSK-2", "Unpatched systems exposed to the internet", "open", 3, 3);
  const riskLabelling = risk("RSK-3", "Mislabelled records handled too loosely", "monitored", 2, 2);

  const direction: DirectionEntity = {
    ...envelope("direction", "DIR-1"),
    title: "Adopt the updated classification guidance",
    reference: "DIR-2026-04",
    responseState: "not-set",
    sourceAuthority: "Department of Home Affairs"
  };

  const anchor: ReportingPackAnchor = {
    snapshotId: "SNP-q3",
    title: "Q3 checkpoint",
    capturedAt: "2026-07-01T00:00:00.000Z",
    recordStatus: {
      requirements: {
        [reqClassification.id]: "partially-met",
        [reqLabelling.id]: "met",
        [reqSanitise.id]: "met",
        [reqPatch.id]: "not-met",
        [reqPrivileges.id]: "not-started",
        [reqRetire.id]: "in-progress",
        [reqGovernance.id]: "not-met"
      },
      risks: { [riskSanitisation.id]: "open", [riskPatching.id]: "closed", [riskLabelling.id]: "monitored" },
      actions: { [actionOverdue.id]: "todo", [actionNoDue.id]: "todo", [actionDone.id]: "in-progress" }
    }
  };

  return {
    generatedAt: NOW,
    now: NOW,
    scope: { kind: "me", domainIds: [INFO.id, TECH.id] },
    anchor,
    domains: [GOV, INFO, TECH].map((domain) => ({ id: domain.id, title: domain.title })),
    requirements: [reqClassification, reqLabelling, reqSanitise, reqPatch, reqPrivileges, reqRetire, reqGovernance],
    evidence: [evidenceCurrent, evidenceStale],
    actions: [actionOverdue, actionNoDue, actionDone, actionOpen, actionGovernance],
    risks: [riskSanitisation, riskPatching, riskLabelling],
    directions: [direction],
    requirementControlMappings: [
      mapping("MAP-1", reqSanitise.id, "Information security manager", "medium"),
      mapping("MAP-2", reqPatch.id, "Platform operations lead", "high")
    ],
    links: [
      link(reqClassification.id, "supported-by", "evidence", evidenceCurrent.id),
      link(reqLabelling.id, "supported-by", "evidence", evidenceStale.id),
      link(reqSanitise.id, "addressed-by", "action", actionOverdue.id),
      link(reqSanitise.id, "exposed-by", "risk", riskSanitisation.id),
      link(reqPatch.id, "addressed-by", "action", actionNoDue.id),
      link(reqPatch.id, "addressed-by", "action", actionOpen.id),
      link(reqPatch.id, "exposed-by", "risk", riskPatching.id),
      link(reqRetire.id, "addressed-by", "action", actionDone.id),
      link(reqClassification.id, "exposed-by", "risk", riskLabelling.id),
      link(reqGovernance.id, "addressed-by", "action", actionGovernance.id)
    ],
    sourceLabel: "Workshop workspace",
    bundleVersion: VERSION_AXES.bundleVersion,
    schemaVersion: VERSION_AXES.schemaVersion
  };
}
