import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  renderCisoMagazineHtml,
  renderCisoMagazineMarkdown,
  renderCisoMasterPlanMarkdown
} from "../packages/brief-renderer/dist/index.js";

const root = process.cwd();
const reportDirectory = join(root, ".tmp", "ciso-magazine");
await mkdir(reportDirectory, { recursive: true });

const bundle = JSON.parse(
  await readFile(join(root, "packages", "contracts", "test-fixtures", "standard", "bundle.json"), "utf8")
);
const fixture = buildMagazineFixture(bundle);
const markdown = renderCisoMagazineMarkdown(fixture);
const html = renderCisoMagazineHtml(fixture);
const planMarkdown = renderCisoMasterPlanMarkdown(fixture);
const infoMarkdown = renderCisoMagazineMarkdown({ ...fixture, domainScope: "INFO" });
const infoHtml = renderCisoMagazineHtml({ ...fixture, domainScope: "INFO" });
const workshopExtension = await readFile(join(root, "packages", "workshop", "src", "extension.ts"), "utf8");
const workshopManifest = await readFile(join(root, "packages", "workshop", "package.json"), "utf8");

const forbidden = [
  "person.name",
  "person.email",
  "assignment.personId",
  "Internal assessment working note",
  "Sensitive finance assumption",
  "<script",
  "http://",
  "https://"
];

const checks = [
  check("Markdown includes classification", markdown.includes("OFFICIAL: Sensitive")),
  check("Markdown includes magazine title", markdown.includes("Digital CISO Magazine")),
  check("Markdown includes attention section", markdown.includes("## Attention Required")),
  check("Markdown includes action strip", markdown.includes("## Action Strip")),
  check("Markdown includes commercial watch", markdown.includes("## Commercial Watch")),
  check("Markdown includes CISO Master Plan article", markdown.includes("## CISO Master Plan")),
  check("Master Plan markdown is generated", planMarkdown.includes("# CISO Master Plan")),
  check("Master Plan includes streams", planMarkdown.includes("## Streams")),
  check("HTML includes print stylesheet", html.includes("@media print")),
  check("HTML includes accessible main element", html.includes('<main class="issue">')),
  check("HTML includes CISO Master Plan article", html.includes("CISO Master Plan")),
  check("INFO Markdown is scoped to Information", infoMarkdown.includes("Information")),
  check("INFO HTML is generated", infoHtml.includes("Digital CISO Magazine")),
  check("Workshop registers magazine command", workshopExtension.includes("pspf.workshop.openCisoMagazine")),
  check(
    "Workshop registers CISO Master Plan panel command",
    workshopExtension.includes("pspf.workshop.openCisoMasterPlan")
  ),
  check("Workshop registers CISO Master Plan command", workshopExtension.includes("pspf.workshop.copyCisoMasterPlan")),
  check(
    "Workshop registers roadmap initiative command",
    workshopExtension.includes("pspf.workshop.createRoadmapInitiativePlan")
  ),
  check(
    "Workshop Home explains the CISO Master Plan button",
    workshopExtension.includes("Open the roadmap across strategy, action, risk and spend")
  ),
  check("Plan of Action explains action worklist purpose", workshopExtension.includes("Operational action worklist")),
  check(
    "CISO Master Plan explains roadmap purpose",
    workshopExtension.includes("Strategic roadmap and planning narrative")
  ),
  check(
    "CISO Master Plan explains initiative edit path",
    workshopExtension.includes("Open each initiative stage to edit its title")
  ),
  check(
    "Workshop manifest contributes magazine command",
    workshopManifest.includes("PSPF: Open Digital CISO Magazine")
  ),
  check(
    "Workshop manifest contributes CISO Master Plan command",
    workshopManifest.includes("PSPF: Open CISO Master Plan")
  ),
  check(
    "Workshop manifest contributes roadmap initiative command",
    workshopManifest.includes("PSPF: Create Roadmap Initiative Plan")
  ),
  ...forbidden.map((value) =>
    check(
      `Output excludes ${value}`,
      !markdown.includes(value) &&
        !html.includes(value) &&
        !planMarkdown.includes(value) &&
        !infoMarkdown.includes(value) &&
        !infoHtml.includes(value)
    )
  )
];

const failed = checks.filter((item) => !item.ok);
await writeFile(join(reportDirectory, "digital-ciso-magazine.md"), `${markdown}\n`, "utf8");
await writeFile(join(reportDirectory, "digital-ciso-magazine.html"), `${html}\n`, "utf8");
await writeFile(join(reportDirectory, "ciso-master-plan.md"), `${planMarkdown}\n`, "utf8");
await writeFile(join(reportDirectory, "digital-ciso-magazine-info.md"), `${infoMarkdown}\n`, "utf8");
await writeFile(
  join(reportDirectory, "digital-ciso-magazine-report.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2)}\n`,
  "utf8"
);

assert.equal(failed.length, 0, failed.map((item) => item.name).join("\n"));
console.log("ok Digital CISO Magazine gate passed");
console.log("report: .tmp/ciso-magazine/digital-ciso-magazine-report.json");

function buildMagazineFixture(bundle) {
  const collections = bundle.collections ?? {};
  return {
    generatedAt: bundle.manifest?.generatedAt ?? new Date().toISOString(),
    issueTitle: "Digital CISO Magazine",
    issueNumber: "Issue 27",
    periodLabel: "May 2026",
    audience: "internal",
    domainScope: "all",
    requirements: collections.requirements ?? [],
    evidence: collections.evidence ?? [],
    actions: collections.actions ?? [],
    risks: collections.risks ?? [],
    links: collections.links ?? [],
    domains: withInformationDomain(collections.domains ?? []),
    directions: collections.directions ?? [],
    strategies: collections.strategies ?? [],
    changeRecords: collections["change-records"] ?? [],
    spendItems: collections["spend-items"] ?? [],
    sourceLabel: "Standard Explorer sample bundle",
    bundleVersion: bundle.manifest?.bundleVersion,
    schemaVersion: bundle.manifest?.schemaVersion
  };
}

function withInformationDomain(domains) {
  if (domains.some((domain) => domain.code === "information")) {
    return domains;
  }
  return [
    ...domains,
    {
      id: "DOM-INFO-CISO-MAGAZINE-GATE",
      entityType: "domain",
      schemaVersion: "1.10.0",
      title: "Information",
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:00:00.000Z",
      sourceProduct: "core",
      recordStatus: "active",
      code: "information",
      sortOrder: 3
    }
  ];
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}
