import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const extension = readFileSync(join(root, "packages/workshop/src/extension.ts"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "packages/workshop/package.json"), "utf8"));
const taxonomy = readFileSync(join(root, "packages/workshop/src/continuous-compliance.ts"), "utf8");
const pentest = readFileSync(join(root, "packages/workshop/src/pentest-workbench.ts"), "utf8");

const outputs = [
  { id: "O4", command: "pspf.workshop.openPspfGridView", open: "openPspfGridView", render: "renderPspfGridView" },
  {
    id: "O1",
    command: "pspf.workshop.openHumanCentredRiskView",
    open: "openHumanCentredRiskView",
    render: "renderHumanCentredRiskView"
  },
  {
    id: "O6",
    command: "pspf.workshop.openContinuousComplianceMetro",
    open: "openContinuousComplianceMetro",
    render: "renderContinuousComplianceMetro"
  },
  {
    id: "O5",
    command: "pspf.workshop.openUnifiedSecurityOperatingModel",
    open: "openUnifiedSecurityOperatingModel",
    render: "renderUnifiedSecurityOperatingModel"
  },
  {
    id: "O3",
    command: "pspf.workshop.openCyberAwarenessChangeStrategy",
    open: "openCyberAwarenessChangeStrategy",
    render: "renderCyberAwarenessChangeStrategy"
  },
  {
    id: "O7",
    command: "pspf.workshop.openRequirementCardView",
    open: "openRequirementCardView",
    render: "renderRequirementCardView"
  }
];

const commandTitles = new Set(manifest.contributes.commands.map((entry) => entry.command));
const menuCommands = new Set(manifest.contributes.menus["view/title"].map((entry) => entry.command));

for (const output of outputs) {
  assert.equal(extension.includes(`function ${output.open}`), true, `${output.id}: ${output.open} should exist`);
  assert.equal(extension.includes(`function ${output.render}`), true, `${output.id}: ${output.render} should exist`);
  const registerPattern = new RegExp(`registerCommand\\(\\s*"${output.command.replace(/\./g, "\\.")}"`);
  assert.match(extension, registerPattern, `${output.id}: ${output.command} should be registered`);
  assert.equal(extension.includes(`"${output.command}"`), true, `${output.id}: ${output.command} should be wired`);
  assert.equal(
    commandTitles.has(output.command),
    true,
    `${output.id}: ${output.command} missing from contributes.commands`
  );
  assert.equal(menuCommands.has(output.command), true, `${output.id}: ${output.command} missing from view/title menu`);
}

assert.equal(extension.includes("function openPentestWorkbench"), true, "Pentest: openPentestWorkbench should exist");
assert.equal(
  extension.includes("function renderPentestWorkbench"),
  true,
  "Pentest: renderPentestWorkbench should exist"
);
assert.match(
  extension,
  /registerCommand\(\s*"pspf\.workshop\.openPentestWorkbench"/,
  "Pentest: openPentestWorkbench should be registered"
);
assert.equal(
  commandTitles.has("pspf.workshop.openPentestWorkbench"),
  true,
  "Pentest: openPentestWorkbench missing from contributes.commands"
);
assert.equal(
  menuCommands.has("pspf.workshop.openPentestWorkbench"),
  true,
  "Pentest: openPentestWorkbench missing from view/title menu"
);

// O2 enriches the existing Plan of Action board rather than adding a command.
assert.equal(
  extension.includes("function renderPlanOfActionSupportCallout"),
  true,
  "O2: Plan of Action support callout should exist"
);
assert.equal(
  extension.includes("${renderPlanOfActionSupportCallout(model)}"),
  true,
  "O2: support callout should render inside the Plan of Action board"
);

// Fixed taxonomy and controlled vocabulary must stay centralised.
for (const symbol of [
  "CONTINUOUS_COMPLIANCE_DOMAIN_ORDER",
  "CONTINUOUS_COMPLIANCE_ASSURANCE_BANDS",
  "CONTINUOUS_COMPLIANCE_RISK_SEVERITIES",
  "CONTINUOUS_COMPLIANCE_METRO_HUB",
  "CONTINUOUS_COMPLIANCE_SECURITY_FUNCTIONS",
  "CONTINUOUS_COMPLIANCE_CHANGE_THEMES",
  "CONTINUOUS_COMPLIANCE_TERM_TRANSLATIONS"
]) {
  assert.match(taxonomy, new RegExp(`export const ${symbol}`), `continuous-compliance should export ${symbol}`);
}

for (const symbol of ["PENTEST_ASSESSMENT_TAG_PREFIX", "PENTEST_FINDING_SEVERITIES"]) {
  assert.match(pentest, new RegExp(`export const ${symbol}`), `pentest-workbench should export ${symbol}`);
}

for (const sla of [
  'critical", label: "Critical", slaDays: 30',
  'high", label: "High", slaDays: 60',
  'medium", label: "Medium", slaDays: 90',
  'low", label: "Low", slaDays: 180'
]) {
  assert.equal(pentest.includes(sla), true, `pentest-workbench missing SLA limit ${sla}`);
}

for (const queue of ["overdue", "sla-at-risk", "pending-verification", "closed"]) {
  assert.equal(pentest.includes(queue), true, `pentest-workbench missing ${queue} queue`);
}

for (const commercialSignal of ["related-to", "supplier", "contract", "spend-item"]) {
  assert.equal(
    pentest.includes(commercialSignal),
    true,
    `pentest-workbench missing ${commercialSignal} commercial signal`
  );
}

// Restricted personal fields must never appear in the Continuous Compliance surfaces.
for (const forbidden of ["Person.name", "Person.email", "Assignment.personId", "personId", "personEmail"]) {
  assert.equal(taxonomy.includes(forbidden), false, `continuous-compliance must not reference ${forbidden}`);
  assert.equal(pentest.includes(forbidden), false, `pentest-workbench must not reference ${forbidden}`);
}

// Requirement Card View is a Workshop-only read model with grouping, filtering, and flip behaviour.
const cardView = readFileSync(join(root, "packages/workshop/src/requirement-card-view.ts"), "utf8");
for (const symbol of ["buildRequirementCardViewModel", "requirementCardRag", "requirementCardStatusLabel"]) {
  assert.match(cardView, new RegExp(`export function ${symbol}`), `requirement-card-view should export ${symbol}`);
}
for (const linkType of ["supported-by", "addressed-by", "exposed-by"]) {
  assert.equal(cardView.includes(linkType), true, `requirement-card-view missing ${linkType} link projection`);
}
for (const cardSignal of [
  "data-card-domain-section",
  "data-card-domain-filter",
  "data-card-rag-filter",
  "data-card-search-input",
  "is-flipped"
]) {
  assert.equal(extension.includes(cardSignal), true, `Requirement Card View missing ${cardSignal}`);
}
for (const forbidden of ["Person.name", "Person.email", "Assignment.personId", "personId", "personEmail"]) {
  assert.equal(cardView.includes(forbidden), false, `requirement-card-view must not reference ${forbidden}`);
}

console.log("ok Continuous Compliance outputs and Pentest Workbench registered and centralised");
