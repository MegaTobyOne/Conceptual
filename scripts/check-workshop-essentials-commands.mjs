// E7 gate (ADR 0096, v1.69.0): asserts docs/workshop-essentials-commands.md stays complete and
// accurate against packages/workshop/package.json, that the three retired panel commands stay gone,
// and that no two commands across Core, Assurance, Workshop, Shop, and Pub share an exact palette
// title (per the "documentation + gate only" decision — no palette visibility change).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const docPath = join(root, "docs/workshop-essentials-commands.md");
const doc = await readFile(docPath, "utf8");
const workshopPackage = JSON.parse(await readFile(join(root, "packages/workshop/package.json"), "utf8"));
const workshopCommandIds = workshopPackage.contributes.commands.map((entry) => entry.command);

const extractSection = (heading) => {
  const start = doc.indexOf(heading);
  assert.notEqual(start, -1, `${docPath} should contain a "${heading}" section`);
  const next = doc.indexOf("\n## ", start + heading.length);
  return doc.slice(start, next === -1 ? undefined : next);
};

const extractCommandIds = (section) => [...section.matchAll(/`(pspf\.workshop\.[a-zA-Z0-9.]+)`/g)].map((m) => m[1]);

const essentialsSection = extractSection("## Essentials");
const specialistSection = extractSection("## Specialist");
const retiredSection = extractSection("## Retired");

const essentialsIds = extractCommandIds(essentialsSection);
const specialistIds = extractCommandIds(specialistSection);
const retiredIds = extractCommandIds(retiredSection);

// No command should be classified twice.
const documentedIds = [...essentialsIds, ...specialistIds];
const duplicateDocumented = documentedIds.filter((id, index) => documentedIds.indexOf(id) !== index);
assert.deepEqual(
  duplicateDocumented,
  [],
  `commands listed in more than one section: ${duplicateDocumented.join(", ")}`
);

// Every currently-registered command must be documented exactly once (essentials or specialist).
const undocumented = workshopCommandIds.filter((id) => !documentedIds.includes(id));
assert.deepEqual(undocumented, [], `Workshop commands missing from ${docPath}: ${undocumented.join(", ")}`);

// The doc must not list commands that no longer exist.
const staleDocumented = documentedIds.filter((id) => !workshopCommandIds.includes(id));
assert.deepEqual(
  staleDocumented,
  [],
  `${docPath} lists commands that are no longer registered: ${staleDocumented.join(", ")}`
);

// Retired commands must stay retired.
for (const retiredId of retiredIds) {
  assert.equal(
    workshopCommandIds.includes(retiredId),
    false,
    `retired command ${retiredId} must not be re-registered (ADR 0096 E7)`
  );
}

// Palette dedupe: no two commands across the five extensions share an exact title.
const productPackages = ["core", "assurance", "workshop", "shop", "pub"];
const titleOwners = new Map();
for (const product of productPackages) {
  const pkg = JSON.parse(await readFile(join(root, `packages/${product}/package.json`), "utf8"));
  for (const entry of pkg.contributes?.commands ?? []) {
    const owners = titleOwners.get(entry.title) ?? [];
    owners.push(`${product}:${entry.command}`);
    titleOwners.set(entry.title, owners);
  }
}
const duplicateTitles = [...titleOwners.entries()].filter(([, owners]) => owners.length > 1);
assert.deepEqual(
  duplicateTitles,
  [],
  `duplicate command palette titles found: ${duplicateTitles.map(([title, owners]) => `"${title}" (${owners.join(", ")})`).join("; ")}`
);

console.log(
  `ok Workshop essentials/specialist command documentation is complete (${essentialsIds.length} essentials, ` +
    `${specialistIds.length} specialist, ${workshopCommandIds.length} total) and no palette title collides across ` +
    `${productPackages.length} extensions`
);
