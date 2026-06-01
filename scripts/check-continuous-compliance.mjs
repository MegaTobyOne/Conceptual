import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const extension = readFileSync(join(root, "packages/workshop/src/extension.ts"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "packages/workshop/package.json"), "utf8"));
const taxonomy = readFileSync(join(root, "packages/workshop/src/continuous-compliance.ts"), "utf8");

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

// Restricted personal fields must never appear in the Continuous Compliance surfaces.
for (const forbidden of ["Person.name", "Person.email", "Assignment.personId", "personId", "personEmail"]) {
  assert.equal(taxonomy.includes(forbidden), false, `continuous-compliance must not reference ${forbidden}`);
}

console.log("ok Continuous Compliance outputs registered and centralised");
