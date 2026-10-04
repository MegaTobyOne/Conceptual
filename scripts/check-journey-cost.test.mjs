import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { reduceJourneyCost, validateJourneyCost } from "./check-journey-cost.mjs";

const pack = JSON.parse(await readFile(new URL("../docs/ux-evidence/pack.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("../docs/ux-evidence/baseline.json", import.meta.url), "utf8"));
const cloneFixture = (fixture) => JSON.parse(JSON.stringify(fixture));

test("empty journey reduces to zero cost", () => {
  assert.deepEqual(reduceJourneyCost([]), {
    routeChanges: 0,
    surfacesOpened: 0,
    inputEvents: 0,
    answerStep: null
  });
});

test("typical journey counts distinct surfaces and first answer", () => {
  assert.deepEqual(
    reduceJourneyCost([
      { type: "route-change" },
      { type: "surface-open", surface: "requirements" },
      { type: "surface-open", surface: "requirements" },
      { type: "input" },
      { type: "answer-visible", step: 4 },
      { type: "answer-visible", step: 5 }
    ]),
    {
      routeChanges: 1,
      surfacesOpened: 1,
      inputEvents: 1,
      answerStep: 4
    }
  );
});

test("500-item journey remains deterministic", () => {
  const events = Array.from({ length: 500 }, (_, index) => ({ type: "input", index }));
  assert.deepEqual(reduceJourneyCost(events), {
    routeChanges: 0,
    surfacesOpened: 0,
    inputEvents: 500,
    answerStep: null
  });
});

test("regression fixture fails the baseline ratchet", () => {
  const regression = cloneFixture(pack);
  regression.jobs.find((job) => job.id === "FJ1").cost.inputEvents += 1;
  assert.throws(() => validateJourneyCost(regression, baseline, "1.76.0"), /FJ1 inputEvents/);
});

test("stale-version fixture fails freshness", () => {
  const stale = cloneFixture(pack);
  stale.productVersion = "1.74.0";
  assert.throws(() => validateJourneyCost(stale, baseline, "1.76.0"), /older than package.json/);
});

test("missing flagship record fails completeness", () => {
  const incomplete = cloneFixture(pack);
  incomplete.jobs = incomplete.jobs.filter((job) => job.id !== "FJ4");
  assert.throws(() => validateJourneyCost(incomplete, baseline, "1.75.0"), /FJ4/);
});
