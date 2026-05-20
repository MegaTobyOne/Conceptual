import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const adrDirectory = join(root, "adr");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageScripts = packageJson.scripts ?? {};

const coverage = [
  adr("0001-product-set.md", "indirect", ["package:check", "check:release-candidate"]),
  adr("0002-id-format.md", "indirect", ["check:integrity-scan", "check:schema-coverage"]),
  adr("0003-link-taxonomy.md", "indirect", ["check:integrity-scan", "check:schema-policy"]),
  adr("0004-explorer-dual-mode.md", "automated", [
    "check:explorer-publication",
    "check:explorer-local-authoring",
    "check:explorer-to-workshop-import"
  ]),
  adr("0005-redaction-default-deny.md", "automated", [
    "check:schema-policy",
    "check:personal-data",
    "check:brief-redaction"
  ]),
  adr("0006-snapshot-and-erasure.md", "indirect", ["e2e:v1.23", "check:backup-restore", "check:integrity-scan"]),
  adr("0007-extension-packaging.md", "automated", ["check-package-shape", "package:check"]),
  adr("0008-version-axes.md", "automated", ["check:release-candidate", "check:schema-coverage"]),
  adr("0009-explorer-single-master-bundle.md", "automated", [
    "e2e:v1.23",
    "check:schema-coverage",
    "check:explorer-to-workshop-import"
  ]),
  adr("0010-explorer-relationships-board.md", "automated", ["check:explorer-publication"]),
  adr("0011-explorer-sensitive-labelling-only.md", "automated", [
    "check:schema-policy",
    "check:personal-data",
    "check:brief-redaction"
  ]),
  adr("0012-explorer-schema-publication.md", "automated", ["check:schema-coverage", "check:explorer-publication"]),
  adr("0013-monorepo-source-layout.md", "automated", ["check:release-candidate", "package:check"]),
  adr("0014-v0-1-thin-slice.md", "automated", ["e2e:v1.23", "check:gates", "check:release-candidate"]),
  adr("0015-item-detail-webview-panel.md", "indirect", ["package:check", "e2e:v1.23"]),
  adr("0016-australian-context-amplified.md", "automated", ["lint", "check:explorer-publication"]),
  adr("0017-ism-integration-roadmap.md", "automated", [
    "check:reference-data-baseline",
    "check:ism-drift",
    "check:schema-policy"
  ]),
  adr("0018-ism-source-library.md", "automated", ["check:reference-data-baseline", "check:ism-drift"]),
  adr("0019-requirement-control-mapping.md", "automated", [
    "check:schema-coverage",
    "check:schema-policy",
    "check:ism-drift"
  ]),
  adr("0020-ism-mapping-quality-and-drift.md", "automated", ["check:ism-drift", "check:schema-coverage"]),
  adr("0021-v0-4-readiness-and-ui-resilience.md", "automated", [
    "check:explorer-publication",
    "check:release-candidate"
  ]),
  adr("0022-v1-0-scope.md", "automated", ["e2e:v1.23", "check:gates", "check:release-candidate"]),
  adr("0023-v0-5-direction-and-action-impact.md", "automated", [
    "e2e:v1.23",
    "check:schema-coverage",
    "check:release-candidate"
  ]),
  adr("0024-v0-6-workshop-parity.md", "automated", ["e2e:v1.23", "check:release-candidate"]),
  adr("0025-v0-7-engine-hardening.md", "automated", [
    "check:integrity-scan",
    "check:writer-lock",
    "check:release-candidate"
  ]),
  adr("0026-v0-8-first-run-and-packaging-readiness.md", "automated", [
    "check:sample-workspace",
    "package:check",
    "check:release-candidate"
  ]),
  adr("0027-v0-9-release-candidate-freeze.md", "automated", ["check:release-candidate", "release:readiness"]),
  adr("0028-v1-0-initial-assurance-user-testing-release.md", "automated", [
    "e2e:v1.23",
    "check:release-candidate",
    "release:readiness"
  ]),
  adr("0029-v1-0-reference-data-baseline.md", "automated", [
    "check:reference-data-baseline",
    "check:release-candidate"
  ]),
  adr("0030-v1-0-1-validation-closure-and-explorer-local-authoring-phase-1.md", "automated", [
    "check:explorer-local-authoring",
    "check:release-candidate"
  ]),
  adr("0031-v1-1-explorer-local-authoring-phase-1.md", "automated", [
    "check:explorer-local-authoring",
    "check:release-candidate"
  ]),
  adr("0032-v1-2-explorer-local-evidence-references.md", "automated", [
    "check:explorer-local-authoring",
    "check:explorer-to-workshop-import",
    "check:release-candidate"
  ]),
  adr("0033-v1-3-explorer-local-actions.md", "automated", [
    "check:explorer-local-authoring",
    "check:explorer-to-workshop-import",
    "check:release-candidate"
  ]),
  adr("0034-v1-4-explorer-local-risks-and-conflicts.md", "automated", [
    "check:explorer-local-authoring",
    "check:explorer-to-workshop-import",
    "check:release-candidate"
  ]),
  adr("0035-v1-5-plan-apply-import-and-undo.md", "automated", [
    "check:explorer-to-workshop-import",
    "check:release-candidate"
  ]),
  adr("0036-v1-5-1-explorer-workshop-product-boundary-and-identity.md", "automated", [
    "check:explorer-publication",
    "check:explorer-local-authoring",
    "check:release-candidate"
  ]),
  adr("0037-v1-6-workshop-import-review-and-identity.md", "automated", [
    "check:explorer-to-workshop-import",
    "check:release-candidate"
  ]),
  adr("0038-v1-0-first-deployment-baseline.md", "automated", ["check:deployment-safety", "check:release-candidate"]),
  adr("0039-branching-and-release-promotion.md", "manual", ["release:readiness"]),
  adr("0040-dispatch-driven-release-workflows.md", "automated", ["check:deployment-safety", "check:release-candidate"]),
  adr("0041-v1-7-tags-and-filters-foundation.md", "automated", [
    "check:schema-policy",
    "check:explorer-publication",
    "check:release-candidate"
  ]),
  adr("0042-v1-8-saved-views.md", "automated", [
    "check:schema-coverage",
    "check:explorer-publication",
    "check:release-candidate"
  ]),
  adr("0043-v1-9-saved-view-expansion.md", "automated", ["check:explorer-local-authoring", "check:release-candidate"]),
  adr("0044-v1-10-change-records.md", "automated", [
    "check:schema-coverage",
    "check:schema-policy",
    "check:release-candidate"
  ]),
  adr("0045-v1-11-explorer-change-story.md", "automated", [
    "check:explorer-publication",
    "check:explorer-local-authoring",
    "check:release-candidate"
  ]),
  adr("0046-v1-12-planning-lens.md", "automated", ["check:explorer-publication", "check:release-candidate"]),
  adr("0047-v1-13-release-assurance.md", "automated", ["check:release-candidate", "release:readiness"]),
  adr("0048-v1-14-compliance-history-export-controls.md", "automated", [
    "check:explorer-local-authoring",
    "check:explorer-to-workshop-import",
    "check:release-candidate"
  ]),
  adr("0049-core-storage-engine-sqljs.md", "automated", ["check:core-storage-runtime", "package:check"]),
  adr("0050-v1-15-shop-commercial-planning-foundation.md", "automated", [
    "check:shop-coverage-dashboard",
    "package:check",
    "check:release-candidate"
  ]),
  adr("0051-v1-16-shop-canonical-commercial-entities.md", "automated", [
    "check:schema-coverage",
    "check:schema-policy",
    "check:shop-coverage-dashboard",
    "check:release-candidate"
  ]),
  adr("0052-v1-17-shop-core-backed-authoring.md", "automated", [
    "check:shop-coverage-dashboard",
    "package:check",
    "check:release-candidate"
  ]),
  adr("0053-v1-18-shop-assurance-linkage-and-identity.md", "automated", [
    "check:shop-coverage-dashboard",
    "check:release-candidate"
  ]),
  adr("0054-v1-19-shop-commercial-coverage-dashboard.md", "automated", [
    "check:shop-coverage-dashboard",
    "check:release-candidate"
  ]),
  adr("0055-v1-20-connected-view.md", "automated", [
    "check:explorer-publication",
    "check:shop-coverage-dashboard",
    "check:release-candidate"
  ]),
  adr("0056-v1-20-1-explorer-connected-view-hotfix.md", "automated", [
    "check:explorer-publication",
    "check:release-candidate"
  ]),
  adr("0057-v1-21-shop-forecast-management.md", "automated", [
    "check:shop-coverage-dashboard",
    "check:release-candidate"
  ]),
  adr("0058-v1-22-operator-input-assistance.md", "automated", [
    "e2e:v1.23",
    "check:explorer-publication",
    "check:release-candidate"
  ]),
  adr("0059-v1-23-connected-view-and-commercial-planning-polish.md", "automated", [
    "check:explorer-publication",
    "check:shop-coverage-dashboard",
    "check:schema-coverage",
    "check:schema-policy",
    "check:release-candidate"
  ]),
  adr("0060-v1-24-workshop-cyber-strategy-map.md", "automated", [
    "check:release-candidate",
    "check:schema-policy",
    "check:schema-coverage",
    "check:explorer-publication"
  ]),
  adr("0061-v1-25-workshop-operational-dashboards.md", "automated", [
    "e2e:v1.25",
    "check:release-candidate",
    "check:explorer-publication",
    "check:schema-policy",
    "check:schema-coverage"
  ])
];

const adrFiles = (await readdir(adrDirectory)).filter((file) => /^\d{4}-.*\.md$/.test(file)).sort();
const coverageByAdr = new Map(coverage.map((entry) => [entry.file, entry]));
const knownCoverageTypes = new Set(["automated", "indirect", "manual"]);
const failures = [];

for (const file of adrFiles) {
  if (!coverageByAdr.has(file)) {
    failures.push(`${file} has no ADR coverage entry`);
  }
}

for (const entry of coverage) {
  if (!adrFiles.includes(entry.file)) {
    failures.push(`${entry.file} coverage entry has no matching ADR file`);
  }
  if (!knownCoverageTypes.has(entry.coverage)) {
    failures.push(`${entry.file} has invalid coverage type ${entry.coverage}`);
  }
  if (entry.gates.length === 0) {
    failures.push(`${entry.file} must name at least one validation gate`);
  }
  for (const gate of entry.gates) {
    if (!isKnownGate(gate)) {
      failures.push(`${entry.file} references unknown gate ${gate}`);
    }
  }
}

assert.equal(failures.length, 0, failures.join("\n"));

const automatedCount = coverage.filter((entry) => entry.coverage === "automated").length;
const indirectCount = coverage.filter((entry) => entry.coverage === "indirect").length;
const manualCount = coverage.filter((entry) => entry.coverage === "manual").length;
console.log(
  `ok ADR coverage map covers ${adrFiles.length} ADRs (${automatedCount} automated, ${indirectCount} indirect, ${manualCount} manual)`
);

function adr(file, coverageType, gates) {
  return { file, coverage: coverageType, gates };
}

function isKnownGate(gate) {
  return gate in packageScripts || ["check-package-shape", "backup-restore-dry-run", "check:gates"].includes(gate);
}
