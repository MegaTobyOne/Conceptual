import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { validateExportBundle } from "./lib/export-validation.mjs";

const root = process.cwd();
const input = process.argv.slice(2).find((argument) => argument !== "--");

if (!input) {
  console.error("Usage: node scripts/validate-export.mjs <export-directory|bundle.json>");
  process.exit(1);
}

const target = resolve(root, input);
if (!existsSync(target)) {
  console.error(`${input} does not exist`);
  process.exit(1);
}

const targetStats = await stat(target);
const bundlePath = targetStats.isDirectory() ? join(target, "bundle.json") : target;
const report = await validateExportBundle(bundlePath, { root });

if (!report.ok) {
  console.error(report.failures.join("\n"));
  process.exit(1);
}

console.log(`ok export integrity passed for ${relative(root, bundlePath)}`);
console.log(
  `counts requirements=${report.counts.requirements} evidence=${report.counts.evidence} actions=${report.counts.actions} risks=${report.counts.risks} links=${report.counts.links}`
);
