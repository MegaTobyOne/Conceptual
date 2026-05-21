import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { PSPF_DOMAINS, withEnvelope } from "@pspf/contracts";
import {
  POSTURE_BRIEF_BROWSER_SCRIPT,
  buildCisoMagazineModel,
  buildCisoMasterPlanModel,
  renderCisoMasterPlanMarkdown,
  renderCisoMagazineHtml,
  renderCisoMagazineMarkdown,
  renderPostureBriefMarkdown
} from "./index.js";

test("posture brief includes evidence basis and excludes sensitive requirement summary", () => {
  const fixture = briefFixture();
  const brief = renderPostureBriefMarkdown(fixture);

  assert.match(brief, /OFFICIAL: Sensitive/);
  assert.match(brief, /## Evidence Basis/);
  assert.match(brief, /## Strategy/);
  assert.match(brief, /Focus cyber uplift on governance assurance/);
  assert.match(brief, /Requirements with current evidence: 1/);
  assert.match(brief, /Confirm next governance review date/);
  assert.doesNotMatch(brief, /Internal assessment working note/);
});

test("browser posture brief renderer matches the package renderer", () => {
  const context = { globalThis: {} };
  vm.runInNewContext(POSTURE_BRIEF_BROWSER_SCRIPT, context);
  const renderer = context.globalThis as { pspfBriefRenderer: { renderPostureBriefMarkdown(input: unknown): string } };

  assert.equal(
    renderer.pspfBriefRenderer.renderPostureBriefMarkdown(briefFixture()),
    renderPostureBriefMarkdown(briefFixture())
  );
});

test("CISO magazine supports INFO scope and excludes sensitive working notes", () => {
  const fixture = magazineFixture();
  const model = buildCisoMagazineModel(fixture);
  const markdown = renderCisoMagazineMarkdown(fixture);
  const html = renderCisoMagazineHtml(fixture);
  const plan = renderCisoMasterPlanMarkdown(fixture);

  assert.equal(model.pspfDomainScope, "INFO");
  assert.equal(model.pspfDomainTitle, "Information");
  assert.equal(model.masterPlan.title, "CISO Master Plan");
  assert.match(markdown, /Digital CISO Magazine/);
  assert.match(markdown, /## CISO Master Plan/);
  assert.match(markdown, /Information has 1 requirement\(s\) and 1 action\(s\) needing attention/);
  assert.match(markdown, /Review portable media handling/);
  assert.match(plan, /# CISO Master Plan/);
  assert.match(plan, /## Streams/);
  assert.doesNotMatch(markdown, /Internal assessment working note/);
  assert.doesNotMatch(markdown, /Sensitive finance assumption/);
  assert.doesNotMatch(plan, /Sensitive finance assumption/);
  assert.doesNotMatch(html, /Internal assessment working note/);
  assert.doesNotMatch(html, /Sensitive finance assumption/);
  assert.match(html, /@media print/);
  assert.match(html, /OFFICIAL: Sensitive/);
});

test("CISO Master Plan includes staged idea and initiative plans", () => {
  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: "AI implementation case for action",
      evidenceType: "note",
      reference: "Use AI where design, verification, and monitoring controls are explicit.",
      freshness: "current"
    },
    "workshop"
  );
  const actions = ["Design", "Build", "Verify", "Monitor"].map((stage) =>
    withEnvelope(
      "action",
      {
        entityType: "action",
        title: `AI Implementation - ${stage}`,
        status: stage === "Design" ? "in-progress" : "todo",
        dueDate: "30 Sep 2026"
      },
      "workshop"
    )
  );
  const links = actions.map((action) =>
    withEnvelope(
      "link",
      {
        entityType: "link",
        title: `${action.title} supported by ${evidence.title}`,
        linkType: "supported-by",
        fromId: action.id,
        fromType: "action",
        toId: evidence.id,
        toType: "evidence"
      },
      "workshop"
    )
  );
  const model = buildCisoMasterPlanModel({
    generatedAt: "2026-05-21T00:00:00.000Z",
    requirements: [],
    evidence: [evidence],
    actions,
    risks: [],
    links,
    domains: PSPF_DOMAINS,
    sourceLabel: "Test"
  });
  const markdown = renderCisoMasterPlanMarkdown({
    generatedAt: "2026-05-21T00:00:00.000Z",
    requirements: [],
    evidence: [evidence],
    actions,
    risks: [],
    links,
    domains: PSPF_DOMAINS,
    sourceLabel: "Test"
  });

  assert.equal(model.initiativePlans.length, 1);
  assert.equal(model.initiativePlans[0]?.title, "AI Implementation");
  assert.deepEqual(
    model.initiativePlans[0]?.stages.map((stage) => stage.stage),
    ["Design", "Build", "Verify", "Monitor"]
  );
  assert.ok(model.initiativePlans[0]?.stages.every((stage) => stage.actionId));
  assert.equal(model.initiativePlans[0]?.evidence[0]?.title, "AI implementation case for action");
  assert.match(markdown, /## Initiative Plans/);
  assert.match(markdown, /AI Implementation: 4 stage\(s\), 1 evidence item\(s\)/);
});

function briefFixture() {
  const governanceDomain = PSPF_DOMAINS[0];
  assert.ok(governanceDomain);
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Validate governance reporting workflow",
      domainId: governanceDomain.id,
      assessmentStatus: "in-progress",
      summary: "Internal assessment working note that must not be exported."
    },
    "workshop"
  );
  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: "Governance committee terms of reference",
      evidenceType: "document",
      reference: "records/governance-committee-tor.pdf",
      freshness: "current"
    },
    "workshop"
  );
  const action = withEnvelope(
    "action",
    {
      entityType: "action",
      title: "Confirm next governance review date",
      status: "todo",
      dueDate: "30 Jun 2026"
    },
    "workshop"
  );
  const risk = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: "Governance review evidence may become stale",
      status: "open",
      likelihood: 3,
      impact: 3
    },
    "workshop"
  );
  const strategy = withEnvelope(
    "strategy",
    {
      entityType: "strategy",
      title: "Cybersecurity Strategy",
      scope: "Enterprise",
      timeHorizon: "2026-2028",
      owner: "CISO",
      strategyStatement: "Focus cyber uplift on governance assurance.",
      riskPostureStatement: "Reduce unmanaged governance risk while preserving delivery pace.",
      frameworks: ["PSPF", "ISM"],
      choices: [
        {
          id: "choice-governance-assurance",
          statement: "Prioritise governance assurance",
          summary: "Move assurance evidence into a regular review cadence.",
          capabilityArea: "Governance",
          targetPosture: "Quarterly review cadence operating.",
          trend: "improving",
          confidence: "medium",
          outcomes: [],
          references: []
        }
      ],
      reviewCadence: "quarterly",
      executiveSummary: "Governance assurance is the first uplift priority."
    },
    "workshop"
  );

  return {
    generatedAt: "2026-05-11T00:00:00.000Z",
    requirements: [requirement],
    evidence: [evidence],
    actions: [action],
    risks: [risk],
    strategies: [strategy],
    links: [
      withEnvelope(
        "link",
        {
          entityType: "link",
          title: "supported",
          linkType: "supported-by",
          fromId: requirement.id,
          fromType: "requirement",
          toId: evidence.id,
          toType: "evidence"
        },
        "workshop"
      ),
      withEnvelope(
        "link",
        {
          entityType: "link",
          title: "addressed",
          linkType: "addressed-by",
          fromId: requirement.id,
          fromType: "requirement",
          toId: action.id,
          toType: "action"
        },
        "workshop"
      ),
      withEnvelope(
        "link",
        {
          entityType: "link",
          title: "exposed",
          linkType: "exposed-by",
          fromId: requirement.id,
          fromType: "requirement",
          toId: risk.id,
          toType: "risk"
        },
        "workshop"
      )
    ],
    domains: PSPF_DOMAINS,
    sourceLabel: "Test"
  };
}

function magazineFixture() {
  const informationDomain = withEnvelope(
    "domain",
    {
      entityType: "domain",
      title: "Information",
      code: "information",
      sortOrder: 3
    },
    "core"
  );
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Portable media handling is reviewed",
      domainId: informationDomain.id,
      assessmentStatus: "partially-met",
      summary: "Internal assessment working note that must not be exported."
    },
    "workshop"
  );
  const action = withEnvelope(
    "action",
    {
      entityType: "action",
      title: "Review portable media handling",
      status: "blocked",
      dueDate: "30 Jun 2026"
    },
    "workshop"
  );
  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: "Portable media register",
      evidenceType: "document",
      reference: "records/portable-media-register.pdf",
      freshness: "stale"
    },
    "workshop"
  );
  const spendItem = withEnvelope(
    "spend-item",
    {
      entityType: "spend-item",
      title: "Secure media handling uplift",
      spendType: "uplift",
      status: "proposed",
      amount: { amount: 15000, currency: "AUD" },
      financialYear: "2026-27",
      assumptions: "Sensitive finance assumption that must not be exported."
    },
    "shop"
  );

  return {
    generatedAt: "2026-05-21T00:00:00.000Z",
    issueTitle: "Digital CISO Magazine",
    issueNumber: "Issue 27",
    periodLabel: "May 2026",
    domainScope: "INFO" as const,
    requirements: [requirement],
    evidence: [evidence],
    actions: [action],
    risks: [],
    links: [
      withEnvelope(
        "link",
        {
          entityType: "link",
          title: "addressed",
          linkType: "addressed-by",
          fromId: requirement.id,
          fromType: "requirement",
          toId: action.id,
          toType: "action"
        },
        "workshop"
      ),
      withEnvelope(
        "link",
        {
          entityType: "link",
          title: "supported",
          linkType: "supported-by",
          fromId: requirement.id,
          fromType: "requirement",
          toId: evidence.id,
          toType: "evidence"
        },
        "workshop"
      ),
      withEnvelope(
        "link",
        {
          entityType: "link",
          title: "funds",
          linkType: "funds",
          fromId: spendItem.id,
          fromType: "spend-item",
          toId: action.id,
          toType: "action"
        },
        "shop"
      )
    ],
    domains: [informationDomain],
    spendItems: [spendItem],
    sourceLabel: "Magazine test"
  };
}
