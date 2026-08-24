// S7 (v1.60.0, ADR 0094): asserts the J6 supplier verdict is composed and
// rendered in Shop. Explorer supplier publication is explicitly deferred by
// ADR 0094 (default-deny pending a dedicated publication-policy ADR), so
// this gate does not check for an Explorer supplier surface.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const shopExtension = await readFile(join(root, "packages/shop/src/extension.ts"), "utf8");
for (const requiredText of [
  "interface SupplierVerdict",
  "function buildSupplierVerdict(",
  "async function buildSupplierVerdictFor("
]) {
  assert.equal(
    shopExtension.includes(requiredText),
    true,
    `packages/shop/src/extension.ts should define ${requiredText}`
  );
}
assert.equal(
  shopExtension.includes('data-testid="supplier-verdict"'),
  true,
  "Shop supplier detail panel should render the verdict statement"
);
assert.match(
  shopExtension,
  /verdict = current\.entityType === "supplier" \? await buildSupplierVerdictFor\(current, store\) : undefined/,
  "Shop detail command should only compose a verdict for supplier records"
);

const explorerPackageDir = join(root, "packages/explorer/src");
const supplierViewExists = await readFile(join(explorerPackageDir, "views/coverage-view.ts"), "utf8").then(
  (text) => text.includes("supplier"),
  () => false
);
assert.equal(
  supplierViewExists,
  false,
  "Explorer publication of Shop supplier data is deferred by ADR 0094; no Explorer view should reference suppliers yet"
);

console.log("ok J6 supplier verdict is composed in Shop; Explorer supplier publication remains deliberately deferred");
