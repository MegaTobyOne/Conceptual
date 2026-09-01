#!/usr/bin/env node
// Banned-jargon lint (ADR 0096 / E1, v1.63.0 plain-language gate).
// Scoped to the explainer content files where all essentials-path plain-language copy is
// authored — NOT the whole repo, since other (Advanced/specialist) screens are out of scope
// for this slice and would produce unrelated false positives.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "docs/lint/banned-jargon.json"), "utf8"));

const TARGETS = [
  "packages/reference-data/src/explainers/section-explainers.ts",
  "packages/reference-data/src/explainers/render-explainer.ts"
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractHumanStrings(text) {
  const extracted = [];
  const literalPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const match of text.matchAll(literalPattern)) {
    const raw = match[2] ?? "";
    const normalised = raw
      .replace(/\$\{[^}]+\}/g, " ")
      .replace(/\\[nrt]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalised.length >= 3 && /[A-Za-z]/.test(normalised)) {
      extracted.push(normalised);
    }
  }
  return extracted.join("\n");
}

const failures = [];
for (const target of TARGETS) {
  const text = extractHumanStrings(readFileSync(join(root, target), "utf8"));
  for (const pair of config.pairs) {
    const pattern = new RegExp(`\\b${escapeRegex(pair.avoid)}\\b`, "i");
    const match = pattern.exec(text);
    if (match) {
      const lineNumber = text.slice(0, match.index).split("\n").length;
      failures.push(
        `${target}:${lineNumber}: essentials-path copy uses specialist term "${pair.avoid}" — use "${pair.use}" instead`
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`ok banned-jargon lint checked ${TARGETS.length} essentials-path file(s)`);
