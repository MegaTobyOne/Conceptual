import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const checks = [
  {
    name: "legacy version-pill CSS",
    pattern: /\.version-pill\s*\{/g,
    allowed: {
      "packages/explorer/scripts/build-static.mjs": 1,
      "packages/workshop/src/webview/shell.ts": 2
    }
  },
  {
    name: "legacy generic pill CSS",
    pattern: /\.pill(?:\s|[.{:#])/g,
    allowed: {
      "packages/core/src/extension.ts": 2,
      "packages/shop/src/extension.ts": 4
    }
  },
  {
    name: "legacy mode-step CSS",
    pattern: /\.mode-step(?:\s|[.{:#])/g,
    allowed: {
      "packages/core/src/extension.ts": 3,
      "packages/explorer/scripts/build-static.mjs": 4
    }
  },
  {
    name: "standalone --bg root palette",
    pattern: /:root\s*\{[^}]*--bg:/g,
    allowed: {
      "packages/core/src/extension.ts": 1,
      "packages/explorer/scripts/build-static.mjs": 1
    }
  },
  {
    name: "legacy banner CSS",
    pattern: /\.banner\s*\{/g,
    allowed: {
      "packages/core/src/extension.ts": 1,
      "packages/explorer/scripts/build-static.mjs": 1,
      "packages/workshop/src/webview/shell.ts": 3
    }
  }
];

const scannedFiles = [
  "packages/core/src/extension.ts",
  "packages/explorer/scripts/build-static.mjs",
  "packages/shop/src/extension.ts",
  "packages/workshop/src/extension.ts",
  "packages/workshop/src/webview/shell.ts"
];

const failures = [];

for (const file of scannedFiles) {
  const text = readFileSync(join(root, file), "utf8");
  for (const check of checks) {
    const count = [...text.matchAll(check.pattern)].length;
    const allowedCount = check.allowed[file] ?? 0;
    if (count > allowedCount) {
      failures.push(
        `${file}: ${check.name} appears ${count} time(s), allowed ${allowedCount}. Use @pspf/webview-shell tokens or document a new exception.`
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("ok design drift check passed; no new local webview primitive drift detected");
