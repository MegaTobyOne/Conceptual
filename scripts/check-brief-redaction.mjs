import assert from "node:assert/strict";
import vm from "node:vm";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { POSTURE_BRIEF_BROWSER_SCRIPT, renderPostureBriefMarkdown } from "../packages/brief-renderer/dist/index.js";
import { PSPF_DOMAINS, withEnvelope } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const reportDirectory = join(root, ".tmp", "brief-redaction");
await mkdir(reportDirectory, { recursive: true });

const fixture = createFixture();
const markdown = renderPostureBriefMarkdown(fixture);
const context = { globalThis: {} };
vm.runInNewContext(POSTURE_BRIEF_BROWSER_SCRIPT, context);
const browserMarkdown = context.globalThis.pspfBriefRenderer.renderPostureBriefMarkdown(fixture);

const checks = [
  check("Markdown includes classification", markdown.includes("OFFICIAL: Sensitive")),
  check("Markdown includes evidence basis", markdown.includes("## Evidence Basis")),
  check("Markdown includes linked action", markdown.includes("Confirm next governance review date")),
  check("Markdown excludes sensitive requirement summary", !markdown.includes("Internal assessment working note")),
  check("Markdown excludes sensitive tag description", !markdown.includes("Sensitive tag purpose note")),
  check("Markdown excludes restricted personal field names", !markdown.includes("person.name") && !markdown.includes("person.email") && !markdown.includes("assignment.personId")),
  check("Browser renderer matches package renderer", browserMarkdown === markdown),
  check("Plain text remains readable", stripMarkdown(markdown).includes("PSPF Posture Brief") && stripMarkdown(markdown).includes("Open Actions"))
];

const failed = checks.filter((item) => !item.ok);
await writeFile(join(reportDirectory, "posture-brief-redaction-report.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2)}\n`, "utf8");
await writeFile(join(reportDirectory, "posture-brief-sample.md"), `${markdown}\n`, "utf8");

assert.equal(failed.length, 0, failed.map((item) => item.name).join("\n"));
console.log("ok posture brief redaction/readability gate passed");
console.log("report: .tmp/brief-redaction/posture-brief-redaction-report.json");

function createFixture() {
  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: "Validate governance reporting workflow",
      domainId: PSPF_DOMAINS[0].id,
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
  const tag = withEnvelope(
    "tag",
    {
      entityType: "tag",
      title: "Security uplift",
      label: "security uplift",
      colour: "grey",
      description: "Sensitive tag purpose note that must not be exported.",
      emoji: ""
    },
    "workshop"
  );

  return {
    generatedAt: "2026-05-11T00:00:00.000Z",
    requirements: [requirement],
    evidence: [evidence],
    actions: [action],
    risks: [risk],
    tags: [tag],
    links: [
      withEnvelope("link", { entityType: "link", title: "supported", linkType: "supported-by", fromId: requirement.id, fromType: "requirement", toId: evidence.id, toType: "evidence" }, "workshop"),
      withEnvelope("link", { entityType: "link", title: "addressed", linkType: "addressed-by", fromId: requirement.id, fromType: "requirement", toId: action.id, toType: "action" }, "workshop"),
      withEnvelope("link", { entityType: "link", title: "exposed", linkType: "exposed-by", fromId: requirement.id, fromType: "requirement", toId: risk.id, toType: "risk" }, "workshop"),
      withEnvelope("link", { entityType: "link", title: "tagged", linkType: "tagged-with", fromId: requirement.id, fromType: "requirement", toId: tag.id, toType: "tag" }, "workshop")
    ],
    domains: PSPF_DOMAINS,
    sourceLabel: "Gate fixture",
    bundleVersion: "1.0.0",
    schemaVersion: "1.0.0"
  };
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function stripMarkdown(value) {
  return value.replace(/^#+\s+/gm, "").replace(/^[-*]\s+/gm, "").replace(/[*_`]/g, "");
}
