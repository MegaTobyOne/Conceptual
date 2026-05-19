import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const checks = [];

function check(name, run) {
  try {
    const detail = run();
    checks.push({ name, ok: true, detail });
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message });
  }
}

function commandVersion(command, args = ["--version"]) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

check("Node.js", () => commandVersion("node"));
check("pnpm", () => commandVersion("pnpm"));
check("GitHub CLI", () => commandVersion("gh"));

check("workspace files", () => {
  const required = ["package.json", "pnpm-workspace.yaml", ".node-version", "tsconfig.json"];
  const missing = required.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`missing ${missing.join(", ")}`);
  }
  return "required root files present";
});

check("temporary PSPF workspace", () => {
  const directory = mkdtempSync(join(tmpdir(), "pspf-doctor-"));
  const pspfRoot = join(directory, ".pspf");
  const dbPath = join(pspfRoot, "core", "pspf-core.db");
  try {
    execFileSync("mkdir", [
      "-p",
      join(pspfRoot, "core"),
      join(pspfRoot, "config"),
      join(pspfRoot, "exchange", "exports")
    ]);
    writeFileSync(dbPath, "");
    return "sample .pspf layout can be created";
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const result of checks) {
  const marker = result.ok ? "ok" : "fail";
  console.log(`${marker} ${result.name}: ${result.detail}`);
}

if (checks.some((result) => !result.ok)) {
  process.exitCode = 1;
}
