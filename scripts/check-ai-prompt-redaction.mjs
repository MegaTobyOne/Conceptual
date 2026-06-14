import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sanitiseEntityForPublication, withEnvelope } from "../packages/contracts/dist/index.js";

const root = process.cwd();
const workshopExtension = await readFile(join(root, "packages/workshop/src/extension.ts"), "utf8");

const requirement = withEnvelope(
  "requirement",
  {
    entityType: "requirement",
    title: "Validate AI prompt boundary",
    domainId: "DOM-00000000-0000-7000-8000-000000000001",
    assessmentStatus: "in-progress",
    summary:
      "Sensitive operational detail must not enter AI prompts. Named person: Jane Example. Email: jane@example.gov.au"
  },
  "workshop"
);

const promptPayload = JSON.stringify(sanitiseEntityForPublication(requirement));
assert.ok(promptPayload.includes("Validate AI prompt boundary"), "AI prompt payload should retain public title");
assert.ok(
  !promptPayload.includes("Sensitive operational detail"),
  "AI prompt payload should exclude sensitive summary"
);
assert.ok(!promptPayload.includes("Jane Example"), "AI prompt payload should exclude names in sensitive fields");
assert.ok(
  !promptPayload.includes("jane@example.gov.au"),
  "AI prompt payload should exclude emails in sensitive fields"
);

assert.ok(
  workshopExtension.includes("const requirementPublic = sanitiseEntityForPublication(requirement)"),
  "AI mapping suggestions should sanitise the Requirement before prompt assembly"
);
assert.ok(
  workshopExtension.includes("JSON.stringify(requirementPublic)"),
  "AI mapping prompt should serialise only the sanitised Requirement"
);
assert.ok(
  !workshopExtension.includes("JSON.stringify(requirement)"),
  "AI mapping prompt must not serialise the raw Requirement"
);
for (const prompt of [
  "Public-safe outcome only",
  "Public-safe current state",
  "Public-safe primary gap",
  "Optional public-safe evidence cue"
]) {
  assert.ok(workshopExtension.includes(prompt), `Guided AI interview should warn operators: ${prompt}`);
}

console.log("ok AI prompt redaction parity and public-safe interview wording are covered");
