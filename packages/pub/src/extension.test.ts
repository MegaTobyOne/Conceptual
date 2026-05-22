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

test("Pub exposes Person detail and edit CRUD panels", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /"pspf\.pub\.openPersonDetail"/);
  assert.match(source, /"pspf\.pub\.editPerson"/);
  assert.match(source, /registerCommand\("pspf\.pub\.openPersonDetail", openPersonDetail\)/);
  assert.match(source, /registerCommand\("pspf\.pub\.editPerson", editPerson\)/);
  assert.match(source, /function renderPersonDetailHtml\(store: PubStore, personId: string\): string/);
  assert.match(source, /function renderPersonEditorHtml\(person: PersonRecord \| undefined\): string/);
  assert.match(source, /function parsePersonEditorFields\(/);
  assert.match(source, /data-person-id=/);
});

test("Pub Person CRUD remains local-only", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /Person detail stays in Pub local storage/);
  assert.match(source, /Save writes to \.pspf\/pub\/pub\.json only/);
  assert.match(source, /no Explorer publication in v1\.29/);
});
