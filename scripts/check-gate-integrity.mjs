import assert from "node:assert/strict";
import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const gateScript = packageJson.scripts?.["check:gates:run"] ?? "";
const gateFiles = [...gateScript.matchAll(/node(?:\s+--test)?\s+(scripts\/[\w.-]+\.mjs)/g)]
  .map((match) => match[1])
  .filter((file, index, files) => files.indexOf(file) === index)
  .sort();

assert.ok(gateFiles.length > 0, "check:gates:run should reference at least one gate script");

const empty = [];
const unparseable = [];
const unenforced = [];

for (const gateFile of gateFiles) {
  const filePath = join(root, gateFile);
  const fileStat = await stat(filePath);
  if (fileStat.size === 0) {
    empty.push(gateFile);
    continue;
  }

  const check = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
  if (check.status !== 0) {
    unparseable.push(`${gateFile}: ${check.stderr || check.stdout}`.trim());
    continue;
  }

  const text = await readFile(filePath, "utf8");
  const hasEnforcement = /\bassert\s*\.|\bassert\(|throw new Error\(|process\.exitCode\s*=|process\.exit\(/.test(text);
  if (!hasEnforcement && !gateFile.endsWith(".test.mjs")) {
    unenforced.push(gateFile);
  }
}

assert.deepEqual(empty, [], `gate scripts must not be empty: ${empty.join(", ")}`);
assert.deepEqual(unparseable, [], `gate scripts must parse: ${unparseable.join("\n")}`);
assert.deepEqual(
  unenforced,
  [],
  `gate scripts should contain assertions or explicit failure paths: ${unenforced.join(", ")}`
);

// e2e release-chain continuity: every v1 minor between the first and latest
// release must exist, and each must invoke its immediate predecessor. This
// closes the defect class where a release chains past a missing link
// (historically e2e:v1.15 and e2e:v1.51).
const scriptEntries = packageJson.scripts ?? {};
const chainFailures = [];
for (const suffix of ["", ":run"]) {
  const namePattern = new RegExp(`^e2e:v1\\.(\\d+)${suffix}$`);
  const minors = Object.keys(scriptEntries)
    .map((name) => name.match(namePattern))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  if (minors.length === 0) {
    continue;
  }
  const base = minors[0];
  const latest = minors[minors.length - 1];
  for (let minor = base; minor <= latest; minor += 1) {
    const name = `e2e:v1.${minor}${suffix}`;
    if (!minors.includes(minor)) {
      chainFailures.push(`${name} is missing; the release chain must be contiguous from v1.${base} to v1.${latest}`);
      continue;
    }
    if (minor === base) {
      continue;
    }
    const predecessor = `e2e:v1.${minor - 1}${suffix}`;
    const referencePattern = new RegExp(`${predecessor.replace(/[.:]/g, "\\$&")}(?!\\d)`);
    if (!referencePattern.test(scriptEntries[name])) {
      chainFailures.push(`${name} must invoke its immediate predecessor ${predecessor}`);
    }
  }
}
assert.deepEqual(chainFailures, [], `e2e release chain issues:\n${chainFailures.join("\n")}`);

console.log(`ok gate integrity checked ${gateFiles.length} gate scripts and the e2e release chain`);
