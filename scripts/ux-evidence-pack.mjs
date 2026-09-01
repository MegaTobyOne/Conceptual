import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = packageJson.version;
const packRoot = join(root, ".tmp", "ux-evidence", `v${version}`);

await rm(packRoot, { recursive: true, force: true });
await mkdir(packRoot, { recursive: true });

const run = spawnSync("pnpm --filter pspf-explorer exec playwright test tests/e2e/ux-evidence-pack.spec.ts", {
  cwd: root,
  shell: true,
  stdio: "inherit"
});
assert.equal(run.status, 0, "ux evidence pack Playwright run must pass");

const EXPECTED_STATES = ["empty", "typical", "volume"];
const EXPECTED_THEMES = ["dark", "light"];
const EXPECTED_JOURNEYS = 3;

const chunkFiles = (await readdir(join(packRoot, "chunks"))).filter((file) => file.endsWith(".json")).sort();
const screenshots = [];
const journeys = [];
for (const file of chunkFiles) {
  const chunk = JSON.parse(await readFile(join(packRoot, "chunks", file), "utf8"));
  if (file.startsWith("screens-")) {
    screenshots.push(chunk);
  } else if (file.startsWith("journey-")) {
    journeys.push(chunk);
  }
}

assert.equal(
  screenshots.length,
  EXPECTED_STATES.length * EXPECTED_THEMES.length,
  `evidence pack should capture every state x theme combination, found ${screenshots.length}`
);
for (const state of EXPECTED_STATES) {
  for (const theme of EXPECTED_THEMES) {
    const capture = screenshots.find((entry) => entry.state === state && entry.theme === theme);
    assert.ok(capture, `missing capture for ${state} state in ${theme} theme`);
    assert.ok(capture.screenshots.length > 0, `capture for ${state}/${theme} recorded no screenshots`);
  }
}

const screenFiles = (await readdir(join(packRoot, "screens"))).filter((file) => file.endsWith(".png"));
const declaredScreens = screenshots.flatMap((entry) => entry.screenshots);
for (const declared of declaredScreens) {
  assert.ok(screenFiles.includes(declared), `declared screenshot ${declared} is missing on disk`);
}

assert.equal(
  journeys.length,
  EXPECTED_JOURNEYS,
  `expected ${EXPECTED_JOURNEYS} journey records, found ${journeys.length}`
);
for (const journey of journeys) {
  assert.ok(journey.steps > 0, `journey ${journey.id} recorded no interaction steps`);
  assert.equal(journey.stepList.length, journey.steps, `journey ${journey.id} step list should match its count`);
}

const summary = {
  version,
  generatedAt: new Date().toISOString(),
  screenshotCount: declaredScreens.length,
  captures: screenshots.map((entry) => ({ state: entry.state, theme: entry.theme, count: entry.screenshots.length })),
  journeys: journeys.map((journey) => ({ id: journey.id, title: journey.title, steps: journey.steps }))
};
await writeFile(join(packRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(
  `ok ux evidence pack v${version}: ${declaredScreens.length} screenshots, ` +
    `${journeys.map((journey) => `${journey.id}=${journey.steps} steps`).join(", ")}`
);
