// ADR 0096 legacy guard: retired views and commands must stay retired during the transition.
// E6 (v1.68.0) activates retired-view and navigation-classification checks.
// E7 (v1.69.0) activates the retired-command-reappearance check for the three removed Workshop panels.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const routesSource = await readFile(join(root, "packages/explorer/src/app/routes.ts"), "utf8");
const navRoutesMarker = "export const NAV_ROUTES";
const navRoutesStart = routesSource.indexOf(navRoutesMarker);
assert.notEqual(navRoutesStart, -1, "routes.ts should define NAV_ROUTES");
const navRoutesSection = routesSource.slice(navRoutesStart);

const workshopPackage = JSON.parse(await readFile(join(root, "packages/workshop/package.json"), "utf8"));
const workshopExtensionSource = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
// E6: retired routes must never reappear.
for (const retiredPath of ["/map-3d-concepts", "'/map'", "'/grc'"]) {
  assert.equal(
    routesSource.includes(retiredPath),
    false,
    `retired route ${retiredPath} must not reappear in routes.ts (ADR 0096 E6)`
  );
}

// E6: every essentials-path nav item must be classified essentials or advanced; essentials capped at 7.
const navGroupMatches = [...navRoutesSection.matchAll(/group:\s*'([^']+)'/g)].map((match) => match[1]);
const unknownGroups = navGroupMatches.filter((group) => group !== "essentials" && group !== "advanced");
assert.deepEqual(
  unknownGroups,
  [],
  `NAV_ROUTES entries must be classified 'essentials' or 'advanced' only (found: ${unknownGroups.join(", ")})`
);
// E7: retired Workshop panel commands must never reappear.
for (const retiredCommand of [
  "pspf.workshop.openHumanCentredRiskView",
  "pspf.workshop.openContinuousComplianceMetro",
  "pspf.workshop.openUnifiedSecurityOperatingModel"
]) {
  assert.equal(
    workshopExtensionSource.includes(retiredCommand),
    false,
    `retired command ${retiredCommand} must not reappear in extension.ts (ADR 0096 E7)`
  );
  assert.equal(
    workshopPackage.contributes.commands.some((entry) => entry.command === retiredCommand),
    false,
    `retired command ${retiredCommand} must not reappear in contributes.commands (ADR 0096 E7)`
  );
}

console.log("ok legacy retired-view and navigation guards passed");
