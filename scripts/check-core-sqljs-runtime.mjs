import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const coreBundlePath = join(root, "packages/core/dist/extension.js");
const coreWasmPath = join(root, "packages/core/dist/sql-wasm.wasm");
const sourceWasmPath = join(root, "node_modules/sql.js/dist/sql-wasm.wasm");
const banner = 'import { createRequire as __pspfCreateRequire } from "node:module"; import { fileURLToPath as __pspfFileURLToPath } from "node:url"; import { dirname as __pspfDirname } from "node:path"; const require = __pspfCreateRequire(import.meta.url); const __filename = __pspfFileURLToPath(import.meta.url); const __dirname = __pspfDirname(__filename);';

assert.equal(existsSync(coreBundlePath), true, "Core extension bundle exists");
assert.equal(existsSync(coreWasmPath), true, "Core sql.js WASM asset is copied beside the extension bundle");
assert.equal(existsSync(sourceWasmPath), true, "sql.js source WASM asset exists in node_modules");

const coreBundle = readFileSync(coreBundlePath, "utf8");
assert.equal(coreBundle.includes("const require = __pspfCreateRequire(import.meta.url)"), true, "Core bundle defines CommonJS require for sql.js");
assert.equal(coreBundle.includes("const __filename = __pspfFileURLToPath(import.meta.url)"), true, "Core bundle defines __filename for sql.js");
assert.equal(coreBundle.includes("const __dirname = __pspfDirname(__filename)"), true, "Core bundle defines __dirname for sql.js");

const directory = mkdtempSync(join(root, ".tmp-pspf-sqljs-runtime-"));
try {
    const inputPath = join(directory, "sqljs-smoke-input.js");
    const outputPath = join(directory, "sqljs-smoke.mjs");
    const wasmPath = join(directory, "sql-wasm.wasm");
    writeFileSync(inputPath, `import initSqlJs from "sql.js";
const SQL = await initSqlJs({ locateFile: () => new URL("./sql-wasm.wasm", import.meta.url).pathname });
const db = new SQL.Database();
db.exec("CREATE TABLE t(value TEXT); INSERT INTO t(value) VALUES ('ok');");
const result = db.exec("SELECT value FROM t;");
console.log(result[0].values[0][0]);
db.close();
`, "utf8");
    writeFileSync(wasmPath, readFileSync(sourceWasmPath));

    execFileSync(
        process.execPath,
        [
            join(root, "node_modules/esbuild/bin/esbuild"),
            inputPath,
            "--bundle",
            "--platform=node",
            "--format=esm",
            "--target=node22",
            `--banner:js=${banner}`,
            `--outfile=${outputPath}`
        ],
        { cwd: root, stdio: "pipe" }
    );
    const output = execFileSync(process.execPath, [outputPath], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    assert.equal(output, "ok", "Bundled sql.js ESM smoke query returns ok");

    const extensionSmokePath = join(directory, "extension-smoke.mjs");
    const extensionBundlePath = join(directory, "extension-under-test.mjs");
    const vscodeMockPath = join(directory, "vscode-mock.mjs");
    const workspaceRoot = join(directory, "workspace");
    writeFileSync(join(directory, "sql-wasm.wasm"), readFileSync(coreWasmPath));
    writeFileSync(
        extensionBundlePath,
        coreBundle.replace('import * as vscode from "vscode";', 'import * as vscode from "./vscode-mock.mjs";'),
        "utf8"
    );
    writeFileSync(vscodeMockPath, `export const outputLines = [];
export const workspace = {
    workspaceFolders: [{ uri: { fsPath: ${JSON.stringify(workspaceRoot)} } }],
    isTrusted: true,
    getConfiguration: () => ({ get: () => true })
};
export const window = {
    createOutputChannel: () => ({ appendLine: (line) => outputLines.push(line), dispose: () => undefined }),
    showInformationMessage: async () => undefined,
    showWarningMessage: async (message) => { outputLines.push(String(message)); return undefined; },
    showOpenDialog: async () => [],
    showQuickPick: async () => undefined,
    withProgress: async (_options, task) => task({ report: () => undefined })
};
export const commands = { registerCommand: () => ({ dispose: () => undefined }) };
export const ProgressLocation = { Notification: 15 };
export const Uri = { file: (fsPath) => ({ fsPath }) };
`, "utf8");
    writeFileSync(extensionSmokePath, `import assert from "node:assert/strict";
import { outputLines } from "./vscode-mock.mjs";
import { activate } from "./extension-under-test.mjs";

activate({ subscriptions: [] });

const deadline = Date.now() + 30000;
while (!outputLines.some((line) => line.includes("PSPF workspace ready") || line.includes("Auto-initialise failed") || line.includes("PSPF auto-initialise failed"))) {
    if (Date.now() > deadline) {
        throw new Error("Core extension auto-initialise smoke timed out. Output: " + outputLines.join(" | "));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
}

const output = outputLines.join("\\n");
assert.equal(output.includes("Auto-initialise failed"), false, output);
assert.equal(output.includes("PSPF auto-initialise failed"), false, output);
assert.equal(output.includes("PSPF workspace ready"), true, output);
console.log("ok");
`, "utf8");
    const extensionSmokeOutput = execFileSync(process.execPath, [extensionSmokePath], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    assert.equal(extensionSmokeOutput, "ok", "Core extension bundle auto-initialise smoke completes");
} finally {
    rmSync(directory, { recursive: true, force: true });
}

console.log("ok Core sql.js runtime bundle smoke passes");
