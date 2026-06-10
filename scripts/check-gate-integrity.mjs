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

console.log(`ok gate integrity checked ${gateFiles.length} gate scripts`);
