import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sourcePath = new URL("../src/extension.ts", import.meta.url);

test("Pub webviews use shared extension shell tokens", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /tokensCss\("extension"\)/);
  assert.doesNotMatch(source, /\$\{tokensCss\}/);
});

test("Pub webviews use shared button acknowledgement behaviour", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /commandButtonAcknowledgementScript/);
  assert.match(source, /pspfAcknowledgeCommandButton\(button\)/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => button\.removeAttribute\("aria-busy"\), 800\)/);
});
