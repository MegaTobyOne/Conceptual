import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { PSPF_DOMAINS, withEnvelope } from "@pspf/contracts";
import { POSTURE_BRIEF_BROWSER_SCRIPT, renderPostureBriefMarkdown } from "./index.js";

test("posture brief includes evidence basis and excludes sensitive requirement summary", () => {
  const fixture = briefFixture();
  const brief = renderPostureBriefMarkdown(fixture);

  assert.match(brief, /OFFICIAL: Sensitive/);
  assert.match(brief, /## Evidence Basis/);
  assert.match(brief, /Requirements with current evidence: 1/);
  assert.match(brief, /Confirm next governance review date/);
  assert.doesNotMatch(brief, /Internal assessment working note/);
});

test("browser posture brief renderer matches the package renderer", () => {
  const context = { globalThis: {} };
  vm.runInNewContext(POSTURE_BRIEF_BROWSER_SCRIPT, context);
  const renderer = context.globalThis as { pspfBriefRenderer: { renderPostureBriefMarkdown(input: unknown): string } };

  assert.equal(renderer.pspfBriefRenderer.renderPostureBriefMarkdown(briefFixture()), renderPostureBriefMarkdown(briefFixture()));
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

  return {
    generatedAt: "2026-05-11T00:00:00.000Z",
    requirements: [requirement],
    evidence: [evidence],
    actions: [action],
    risks: [risk],
    links: [
      withEnvelope("link", { entityType: "link", title: "supported", linkType: "supported-by", fromId: requirement.id, fromType: "requirement", toId: evidence.id, toType: "evidence" }, "workshop"),
      withEnvelope("link", { entityType: "link", title: "addressed", linkType: "addressed-by", fromId: requirement.id, fromType: "requirement", toId: action.id, toType: "action" }, "workshop"),
      withEnvelope("link", { entityType: "link", title: "exposed", linkType: "exposed-by", fromId: requirement.id, fromType: "requirement", toId: risk.id, toType: "risk" }, "workshop")
    ],
    domains: PSPF_DOMAINS,
    sourceLabel: "Test"
  };
}