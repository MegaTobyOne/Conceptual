import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "docs/lint/au-english.json"), "utf8"));

const SKIP_DIRECTORIES = new Set([
  ".git",
  ".tmp",
  "node_modules",
  "dist",
  "coverage",
  "debug-workspace",
  "schemas",
  "test-fixtures"
]);

const ROOT_FILES = ["README.md", ".github/copilot-instructions.md"];
const SCANNED_TREES = ["docs", "adr"];
const ROOT_MARKDOWN_GLOB = /^(?:pspf-.*\.md|validation-scenario-.*\.md|explorer-screen-workflow-spec\.md|extracted-spec-pspf-explorer\.md)$/;

const targets = new Set();
for (const file of ROOT_FILES) {
  targets.add(file);
}
for (const tree of SCANNED_TREES) {
  for (const path of findMarkdown(join(root, tree))) {
    targets.add(path);
  }
}
for (const entry of readdirSync(root)) {
  if (ROOT_MARKDOWN_GLOB.test(entry)) {
    targets.add(entry);
  }
}

const sortedTargets = [...targets].sort();
const failures = [];

for (const target of sortedTargets) {
  const text = stripCodeAndLinks(readFileSync(join(root, target), "utf8"));
  for (const pair of config.pairs) {
    const pattern = new RegExp(`\\b${escapeRegex(pair.avoid)}\\b`, "i");
    const match = pattern.exec(text);
    if (match) {
      const lineNumber = text.slice(0, match.index).split("\n").length;
      failures.push(`${target}:${lineNumber}: use "${pair.use}" instead of "${pair.avoid}"`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`ok AU-English lint checked ${sortedTargets.length} files`);

function findMarkdown(directory) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry)) {
      continue;
    }
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      results.push(...findMarkdown(path));
    } else if (entry.endsWith(".md")) {
      results.push(relative(root, path));
    }
  }
  return results;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mask fenced code blocks, inline code spans, link targets, URLs, and any
// region between `<!-- au-english-lint:disable -->` /
// `<!-- au-english-lint:enable -->` markers with whitespace so the AU-English
// check only sees prose. Whitespace replacement preserves byte and line
// offsets so failure line numbers remain meaningful.
function stripCodeAndLinks(text) {
  const lines = text.split("\n");
  let inFence = false;
  let inDisable = false;
  const out = [];
  for (const line of lines) {
    if (/<!--\s*au-english-lint:disable\s*-->/.test(line)) {
      inDisable = true;
      out.push(" ".repeat(line.length));
      continue;
    }
    if (/<!--\s*au-english-lint:enable\s*-->/.test(line)) {
      inDisable = false;
      out.push(" ".repeat(line.length));
      continue;
    }
    if (inDisable) {
      out.push(" ".repeat(line.length));
      continue;
    }
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(" ".repeat(line.length));
      continue;
    }
    if (inFence) {
      out.push(" ".repeat(line.length));
      continue;
    }
    let masked = line;
    masked = masked.replace(/`[^`]*`/g, (match) => " ".repeat(match.length));
    masked = masked.replace(/\]\(([^)]+)\)/g, (match) => " ".repeat(match.length));
    masked = masked.replace(/<https?:\/\/[^>]+>/g, (match) => " ".repeat(match.length));
    masked = masked.replace(/https?:\/\/\S+/g, (match) => " ".repeat(match.length));
    out.push(masked);
  }
  return out.join("\n");
}
