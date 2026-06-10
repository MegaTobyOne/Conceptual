import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const rootEntries = await readdir(root, { withFileTypes: true });
const rootMarkdown = rootEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .sort();

const allowedStatuses = new Set(["implemented", "partial", "aspirational", "active", "reference"]);
const implementedCodes = new Set();
const missingStatus = [];
const invalidStatus = [];

for (const file of rootMarkdown) {
  const text = await readFile(join(root, file), "utf8");
  const statusMatch = text.match(/^Status:\s+\*\*([^*]+)\*\*/m) ?? text.match(/^Status:\s+([^\n]+)/m);
  if (!statusMatch) {
    missingStatus.push(file);
    continue;
  }
  const status = statusMatch[1]?.trim().toLowerCase().split(/\s+/)[0];
  if (!status || !allowedStatuses.has(status)) {
    invalidStatus.push(`${file}: ${statusMatch[1] ?? "missing"}`);
    continue;
  }
  if (status === "implemented") {
    for (const match of text.matchAll(/\bPSPF_[A-Z0-9_]+\b/g)) {
      implementedCodes.add(match[0]);
    }
  }
}

assert.deepEqual(missingStatus, [], `root markdown files missing Status headers: ${missingStatus.join(", ")}`);
assert.deepEqual(invalidStatus, [], `root markdown files with invalid Status values: ${invalidStatus.join(", ")}`);

const sourceRoots = ["packages", "scripts"];
const sourceFiles = [];
async function collectSourceFiles(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (["dist", "node_modules", ".pspf"].includes(entry.name)) continue;
      await collectSourceFiles(relative);
    } else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
      sourceFiles.push(relative);
    }
  }
}

for (const sourceRoot of sourceRoots) {
  await collectSourceFiles(sourceRoot);
}

const sourceText = (await Promise.all(sourceFiles.map((file) => readFile(join(root, file), "utf8")))).join("\n");
const missingCodes = [...implementedCodes].filter((code) => !sourceText.includes(code)).sort();
assert.deepEqual(
  missingCodes,
  [],
  `implemented specs declare PSPF_* identifiers absent from packages/scripts source: ${missingCodes.join(", ")}`
);

console.log(
  `ok spec drift checked ${rootMarkdown.length} root markdown files, ${implementedCodes.size} implemented PSPF_* identifiers`
);
