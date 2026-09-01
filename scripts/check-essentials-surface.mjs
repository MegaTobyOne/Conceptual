// E0 gate (ADR 0096): records the Explorer/Workshop surface baseline and fails on further growth.
// E6 (v1.68.0) activates the retired-view-reappearance, demoted-view-outside-Advanced, and
// essentials-nav-item-count checks now that the surface reduction has shipped.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const baselinePath = join(root, "scripts/lib/essentials-surface-baseline.json");
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));

const routesSource = await readFile(join(root, "packages/explorer/src/app/routes.ts"), "utf8");
const navRoutesMarker = "export const NAV_ROUTES";
const navRoutesStart = routesSource.indexOf(navRoutesMarker);
assert.notEqual(navRoutesStart, -1, "routes.ts should define NAV_ROUTES");
const routesSection = routesSource.slice(0, navRoutesStart);
const navRoutesSection = routesSource.slice(navRoutesStart);

const countMatches = (text, pattern) => (text.match(pattern) ?? []).length;
const explorerRoutes = countMatches(routesSection, /path:\s*['"]/g);
const explorerNavItems = countMatches(navRoutesSection, /path:\s*['"]/g);

const workshopPackage = JSON.parse(await readFile(join(root, "packages/workshop/package.json"), "utf8"));
const workshopCommands = workshopPackage.contributes?.commands?.length ?? 0;

const workshopExtensionSource = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");
const workshopWebviewPanels = countMatches(workshopExtensionSource, /createWebviewPanel\(/g);

const current = { explorerRoutes, explorerNavItems, workshopCommands, workshopWebviewPanels };

const overBudget = Object.entries(current).filter(([key, value]) => value > baseline[key]);
assert.deepEqual(
  overBudget,
  [],
  `essentials surface baseline (${baselinePath}) exceeded: ${overBudget
    .map(([key, value]) => `${key} ${value} > ${baseline[key]}`)
    .join(", ")}. The v1.70 Essentials programme (ADR 0096) reduces this surface; ` +
    "if this growth is deliberate, update the baseline together with an ADR-visible reason."
);

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
const essentialsNavCount = navGroupMatches.filter((group) => group === "essentials").length;
assert.ok(
  essentialsNavCount <= 7,
  `essentials nav items (${essentialsNavCount}) must be \u2264 7 per ADR 0096 E6; demote the rest behind 'advanced'`
);

console.log(
  `ok essentials surface within baseline: routes ${explorerRoutes}/${baseline.explorerRoutes}, ` +
    `nav ${explorerNavItems}/${baseline.explorerNavItems} (essentials ${essentialsNavCount}/7), ` +
    `commands ${workshopCommands}/${baseline.workshopCommands}, panels ${workshopWebviewPanels}/${baseline.workshopWebviewPanels}`
);
