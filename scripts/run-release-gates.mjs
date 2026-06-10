import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(root, "release-gates.json"), "utf8"));
const versionMatch = packageJson.version.match(/^(\d+)\.(\d+)\.\d+$/);
assert.ok(versionMatch, `package version should be semver, got ${packageJson.version}`);
const releaseKey = `${versionMatch[1]}.${versionMatch[2]}`;
const groups = manifest.releases?.[releaseKey];
assert.ok(Array.isArray(groups), `release-gates.json should define release ${releaseKey}`);

const requiredScriptName = process.argv[2];
if (requiredScriptName) {
  assert.equal(
    typeof packageJson.scripts?.[requiredScriptName],
    "string",
    `package.json should define compatibility script ${requiredScriptName}`
  );
}

async function runCommand(command) {
  const started = Date.now();
  console.log(`release-gate start: ${command}`);
  const result = await new Promise((resolve) => {
    const child = spawn(command, { cwd: root, shell: true, stdio: "inherit" });
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  const elapsedSeconds = ((Date.now() - started) / 1000).toFixed(1);
  assert.equal(result.signal, null, `${command} terminated by signal ${result.signal}`);
  assert.equal(result.code, 0, `${command} failed with exit code ${result.code}`);
  console.log(`release-gate ok: ${command} (${elapsedSeconds}s)`);
}

for (const group of groups) {
  assert.equal(typeof group.name, "string", "release gate group should have a name");
  assert.ok(Array.isArray(group.commands), `release gate group ${group.name} should have commands`);
  console.log(`release-gate group: ${group.name}`);
  if (group.parallel) {
    await Promise.all(group.commands.map((command) => runCommand(command)));
  } else {
    for (const command of group.commands) {
      await runCommand(command);
    }
  }
}

console.log(`ok release gates completed for ${releaseKey}`);
