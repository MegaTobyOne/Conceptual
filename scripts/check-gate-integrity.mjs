import assert from "node:assert/strict";
import { readdir, stat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Enforces the release-gate wiring and workflow timeout slice; failure means a
// referenced command, script file, release block, or job timeout is missing.
const root = fileURLToPath(new URL("..", import.meta.url));
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

const workflowDirectory = join(root, ".github", "workflows");
const workflowFiles = (await readdir(workflowDirectory)).filter((file) => file.endsWith(".yml")).sort();
const workflowCommandFailures = [];
const workflowScriptFailures = [];
const releaseCommandFailures = [];
const timeoutFailures = [];
const rootScriptNames = new Set(Object.keys(scriptEntries));
const validateReferences = async (source, origin, commandFailures, scriptFailures) => {
  for (const match of source.matchAll(/\bpnpm\s+run\s+([\w:.-]+)/g)) {
    if (!rootScriptNames.has(match[1])) {
      commandFailures.push(`${origin}: pnpm run ${match[1]} is missing from package.json scripts`);
    }
  }
  for (const match of source.matchAll(/\bpnpm\s+(build|lint|test|typecheck)\b/g)) {
    if (!rootScriptNames.has(match[1])) {
      commandFailures.push(`${origin}: pnpm ${match[1]} is missing from package.json scripts`);
    }
  }
  for (const match of source.matchAll(/\bnode\s+(scripts\/[\w.-]+\.mjs)\b/g)) {
    try {
      await stat(join(root, match[1]));
    } catch {
      scriptFailures.push(`${origin}: ${match[1]} is missing`);
    }
  }
};

for (const workflowFile of workflowFiles) {
  const workflowPath = join(workflowDirectory, workflowFile);
  const workflowText = await readFile(workflowPath, "utf8");
  await validateReferences(
    workflowText,
    `.github/workflows/${workflowFile}`,
    workflowCommandFailures,
    workflowScriptFailures
  );
  const jobsText = workflowText.match(/^jobs:\s*\n([\s\S]*)$/m)?.[1] ?? "";
  const jobs = [...`${jobsText}\n  __end__: \n`.matchAll(/^ {2}([\w-]+):\s*\n([\s\S]*?)(?=^ {2}[\w-]+:\s*$)/gm)];
  const runsOnCount = (jobsText.match(/^\s+runs-on:/gm) ?? []).length;
  const timeoutCount = (jobsText.match(/^\s+timeout-minutes:/gm) ?? []).length;
  if (runsOnCount !== timeoutCount) {
    timeoutFailures.push(
      `.github/workflows/${workflowFile}: ${runsOnCount} runs-on entries but ${timeoutCount} timeout-minutes entries`
    );
  }
  for (const [, jobName, jobText] of jobs) {
    if (/^\s+runs-on:/m.test(jobText) && !/^\s+timeout-minutes:/m.test(jobText)) {
      timeoutFailures.push(`.github/workflows/${workflowFile} job ${jobName} lacks timeout-minutes`);
    }
  }
}

const releaseGates = JSON.parse(await readFile(join(root, "release-gates.json"), "utf8"));
for (const [releaseVersion, releaseBlocks] of Object.entries(releaseGates.releases ?? {})) {
  for (const [index, block] of releaseBlocks.entries()) {
    for (const command of block.commands ?? []) {
      await validateReferences(
        command,
        `release-gates.json ${releaseVersion} block ${index + 1}`,
        releaseCommandFailures,
        releaseCommandFailures
      );
    }
  }
}
const currentVersion = packageJson.version.match(/^(\d+)\.(\d+)/);
const currentRelease = currentVersion ? `${currentVersion[1]}.${currentVersion[2]}` : "";
const releaseVersionFailures = [];
if (!currentVersion || !releaseGates.releases?.[currentRelease]) {
  releaseVersionFailures.push(`release-gates.json is missing release block ${currentRelease}`);
}
if (!scriptEntries[`e2e:v${currentRelease}:run`]) {
  releaseVersionFailures.push(`e2e:v${currentRelease}:run is missing from package.json scripts`);
}

assert.deepEqual(
  workflowCommandFailures,
  [],
  `workflow pnpm references must exist:\n${workflowCommandFailures.join("\n")}`
);
assert.deepEqual(
  workflowScriptFailures,
  [],
  `workflow script references must exist:\n${workflowScriptFailures.join("\n")}`
);
assert.deepEqual(
  releaseCommandFailures,
  [],
  `release-gates.json references must exist:\n${releaseCommandFailures.join("\n")}`
);
assert.deepEqual(
  releaseVersionFailures,
  [],
  `release-gates.json version wiring issues:\n${releaseVersionFailures.join("\n")}`
);
assert.deepEqual(timeoutFailures, [], `workflow jobs must define timeout-minutes:\n${timeoutFailures.join("\n")}`);

console.log(
  `ok gate integrity checked ${gateFiles.length} gate scripts, ${workflowFiles.length} workflows, and the e2e release chain`
);
