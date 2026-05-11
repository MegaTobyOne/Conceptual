import { rm } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const pspfPath = join(root, "debug-workspace", ".pspf");

await rm(pspfPath, { recursive: true, force: true });

console.log(`ok removed ${relative(root, pspfPath)}`);
console.log("Relaunch the debug Extension Host or run a PSPF command to initialise a fresh debug workspace.");