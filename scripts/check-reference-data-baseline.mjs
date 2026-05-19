import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const adr = await readFile(join(root, "adr/0029-v1-0-reference-data-baseline.md"), "utf8");
const spec = await readFile(join(root, "pspf-reference-data-baseline-spec.md"), "utf8");
const agent = await readFile(join(root, ".github/agents/pspf-reference-data-curator.agent.md"), "utf8");
const contracts = await readFile(join(root, "packages/contracts/src/index.ts"), "utf8");
const ismLibrary = await readFile(join(root, "packages/ism-source-library/src/index.ts"), "utf8");
const referencePackage = await readFile(join(root, "packages/reference-data/package.json"), "utf8");
const generated = await readFile(join(root, "packages/reference-data/src/generated/reference-data.ts"), "utf8");
const report = JSON.parse(
  await readFile(join(root, "packages/reference-data/data/reference-data-report.json"), "utf8")
);
const pspfSource = await readFile(
  join(root, "packages/reference-data/data/sources/pspf-release-2025/pspf-release-2025-list-requirements.pdf")
);
const ismSource = await readFile(
  join(root, "packages/reference-data/data/sources/ism-oscal/v2026.03.24/ISM_catalog.json")
);

for (const requiredText of [
  "https://www.protectivesecurity.gov.au/publications-library/pspf-release-2025-list-requirements",
  "https://www.protectivesecurity.gov.au/system/files/2026-04/pspf-release-2025-list-requirements.pdf",
  "https://github.com/AustralianCyberSecurityCentre/ism-oscal",
  "v2026.03.24",
  "Creative Commons Attribution 3.0 Australia",
  "Creative Commons Attribution 4.0 International",
  "218",
  "113",
  "GOV",
  "RISK",
  "INFO",
  "TECH",
  "PER",
  "PHYS"
]) {
  assert.equal(
    adr.includes(requiredText) || spec.includes(requiredText) || agent.includes(requiredText),
    true,
    `reference-data baseline docs should mention ${requiredText}`
  );
}

assert.equal(JSON.parse(referencePackage).name, "@pspf/reference-data", "reference-data package should exist");
assert.equal(
  report.pspf.displayedRequirementCount,
  217,
  "PSPF source extraction should account for the 217 displayed requirements in the published PDF"
);
assert.deepEqual(
  report.pspf.missingRequirementNumbers,
  [113],
  "PSPF source extraction should record the published missing requirement number 113 anomaly"
);
assert.deepEqual(
  report.pspf.duplicateRequirementNumbers,
  [],
  "PSPF source extraction should have no duplicate displayed requirement numbers"
);
assert.deepEqual(
  report.pspf.domainFamilies.toSorted(),
  ["GOV", "INFO", "PER", "PHYS", "RISK", "TECH"],
  "PSPF source extraction should cover the six Release 2025 domain families"
);
assert.equal(
  report.pspf.publishedDirectionCount,
  9,
  "PSPF source curation should record the current published Direction count"
);
assert.equal(
  report.pspf.directionsReflectedInRequirements,
  5,
  "PSPF source curation should record Directions reflected in Release 2025 requirements"
);
assert.equal(
  report.ism.oscalRelease,
  "v2026.03.24",
  "ISM source extraction should use the selected March 2026 OSCAL release"
);
assert.equal(report.ism.sourceControlCount, 1130, "ISM source extraction should include the full OSCAL control set");
assert.equal(
  sha256(pspfSource),
  "b62e4980fa62c9bc602cc59001eae34695eccd3c67b9db60f6c069a4bed1506c",
  "PSPF source PDF hash should match the curated baseline"
);
assert.equal(
  sha256(ismSource),
  "54629fa7f6d1be9bee887250091a2c47ee4816d7f758e16bd605091a98e28695",
  "ISM OSCAL source hash should match the curated baseline"
);

assert.match(
  generated,
  /PSPF_BASELINE_REQUIREMENTS/,
  "generated reference data should export PSPF baseline requirements"
);
assert.match(generated, /PSPF_BASELINE_DIRECTIONS/, "generated reference data should export PSPF baseline Directions");
assert.match(
  generated,
  /PSPF_BASELINE_DIRECTION_LINKS/,
  "generated reference data should export PSPF Direction-to-requirement links"
);
assert.match(generated, /ISM_SOURCE_CONTROLS/, "generated reference data should export ISM source controls");
assert.match(
  ismLibrary,
  /from "@pspf\/reference-data"/,
  "ISM source library should wrap the generated reference-data package"
);

const usesRelease2025Domains =
  /readonly code: "governance" \| "security-risk" \| "information" \| "technology" \| "personnel" \| "physical"/.test(
    contracts
  );
assert.equal(usesRelease2025Domains, true, "contracts should expose the six-domain PSPF Release 2025 model");

console.log("ok generated reference-data package, source hashes, PSPF anomaly report, and ISM baseline are recorded");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
