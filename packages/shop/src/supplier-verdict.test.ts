import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sourcePath = new URL("../src/extension.ts", import.meta.url);

test("Shop composes a supplier verdict from criticality, open risk, contract expiry, and assurance coverage", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /function buildSupplierVerdict\(/);
  assert.match(source, /criticality\)} criticality supplier/);
  assert.match(source, /open linked risks|open risk\$\{openRiskCount === 1/);
  assert.match(source, /contract lapses in \$\{nearestContractExpiryDays}/);
  assert.match(source, /linked to assurance coverage/);
});

test("Shop supplier detail panel renders the verdict statement", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /async function buildSupplierVerdictFor\(/);
  assert.match(
    source,
    /verdict = current\.entityType === "supplier" \? await buildSupplierVerdictFor\(current, store\) : undefined/
  );
  assert.match(source, /data-testid="supplier-verdict"/);
});
