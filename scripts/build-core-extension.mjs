import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const coreRoot = join(root, "packages", "core");
const distRoot = join(coreRoot, "dist");

await mkdir(distRoot, { recursive: true });
await build({
  entryPoints: [join(coreRoot, "src", "extension.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["vscode"],
  banner: {
    js: 'import { createRequire as __pspfCreateRequire } from "node:module"; import { fileURLToPath as __pspfFileURLToPath } from "node:url"; import { dirname as __pspfDirname } from "node:path"; const require = __pspfCreateRequire(import.meta.url); const __filename = __pspfFileURLToPath(import.meta.url); const __dirname = __pspfDirname(__filename);'
  },
  outfile: join(distRoot, "extension.js")
});

await copyFile(join(root, "node_modules", "sql.js", "dist", "sql-wasm.wasm"), join(distRoot, "sql-wasm.wasm"));
const schemaDestination = join(distRoot, "explorer-bundle");
await rm(schemaDestination, { recursive: true, force: true });
await cp(join(root, "schemas", "explorer-bundle"), schemaDestination, { recursive: true });
