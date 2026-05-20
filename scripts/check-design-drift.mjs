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
  },
  {
    name: "local generic spinner CSS",
    pattern: /(?<!pspf-)\.spinner(?:\s|[.{:#])/g,
    allowed: {}
  },
  {
    name: "local generic skeleton CSS",
    pattern: /(?<!pspf-)\.skeleton(?:\s|[.{:#])/g,
    allowed: {}
  },
  {
    name: "local generic save-indicator CSS",
    pattern: /(?<!pspf-)\.save-indicator(?:\s|[.{:#])/g,
    allowed: {}
  }
];

const scannedFiles = [
  "packages/connected-view/src/index.ts",
  "packages/core/src/extension.ts",
  "packages/explorer/scripts/build-static.mjs",
  "packages/shop/src/extension.ts",
  "packages/workshop/src/extension.ts",
  "packages/workshop/src/webview/shell.ts"
];

const requiredSnippets = [
  {
    file: "packages/webview-shell/src/tokens.ts",
    name: "responsive motion token",
    snippets: [
      "--pspf-motion-responsive: 180ms;",
      "--pspf-ease-responsive: cubic-bezier(0.16, 1, 0.3, 1);",
      "--pspf-button-active-scale: 0.97;",
      ".pspf-save-indicator",
      ".pspf-spinner",
      ".pspf-skeleton",
      "@media (prefers-reduced-motion: reduce)"
    ]
  },
  {
    file: "packages/explorer/scripts/build-static.mjs",
    name: "Explorer Local Changes save feedback",
    snippets: ["localSaveFeedback", "withLocalSaveFeedback", "bindRequiredFieldValidation", "data-local-save-target"]
  },
  {
    file: "packages/webview-shell/src/interactions.ts",
    name: "shared command acknowledgement helper",
    snippets: [
      "commandButtonAcknowledgementScript",
      "function pspfAcknowledgeCommandButton(button)",
      'button.setAttribute("aria-busy", "true")'
    ]
  },
  {
    file: "packages/core/src/extension.ts",
    name: "Core command acknowledgement",
    snippets: ["commandButtonAcknowledgementScript", "pspfAcknowledgeCommandButton(button)"]
  },
  {
    file: "packages/workshop/src/webview/shell.ts",
    name: "Workshop command acknowledgement",
    snippets: ["commandButtonAcknowledgementScript", "pspfAcknowledgeCommandButton(button)"]
  }
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

for (const required of requiredSnippets) {
  const text = readFileSync(join(root, required.file), "utf8");
  for (const snippet of required.snippets) {
    if (!text.includes(snippet)) {
      failures.push(`${required.file}: missing ${required.name} snippet: ${snippet}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("ok design drift check passed; no new local webview primitive drift detected");
