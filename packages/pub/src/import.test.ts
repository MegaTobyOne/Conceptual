import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parsePubImportTsv, previewPubImport } from "./import.js";
import { emptyStore } from "./store.js";

test("parses quoted TSV values and CRLF input", () => {
  const rows = parsePubImportTsv('Person\tTeam\tRole\tReports to\r\n"Nguyen, Alex"\tCyber\tAnalyst\tDirector\r\n');
  assert.deepEqual(rows[0], {
    rowNumber: 2,
    person: "Nguyen, Alex",
    team: "Cyber",
    role: "Analyst",
    reportsTo: "Director"
  });
});

test("previews a complete import without mutating the original store", () => {
  const original = emptyStore(new Date("2026-07-18T00:00:00Z"));
  const rows = parsePubImportTsv(
    "Person\tTeam\tRole\tReports to\nSam Lee\tCyber\tDirector\t\nAlex Nguyen\tCyber\tAnalyst\tDirector\n"
  );
  const preview = previewPubImport(original, rows);
  assert.deepEqual(preview.created, { people: 2, teams: 1, roles: 2, assignments: 2 });
  assert.equal(preview.issues.length, 0);
  assert.equal(
    preview.prospectiveStore.roles.find((role) => role.title === "Analyst")?.reportsToRoleId,
    preview.prospectiveStore.roles.find((role) => role.title === "Director")?.id
  );
  assert.equal(original.people.length, 0);
});

test("reuses exact existing records without duplicate assignments", () => {
  const first = previewPubImport(
    emptyStore(),
    parsePubImportTsv("Person\tTeam\tRole\tReports to\nSam Lee\tCyber\tDirector\t\n")
  );
  const second = previewPubImport(first.prospectiveStore, first.rows);
  assert.deepEqual(second.created, { people: 0, teams: 0, roles: 0, assignments: 0 });
  assert.equal(second.prospectiveStore.assignments.length, 1);
});

test("blocks a reporting cycle before commit", () => {
  const rows = parsePubImportTsv(
    "Person\tTeam\tRole\tReports to\nOne\tCyber\tDirector\tAnalyst\nTwo\tCyber\tAnalyst\tDirector\n"
  );
  const preview = previewPubImport(emptyStore(), rows);
  assert.ok(preview.issues.some((issue) => issue.message.includes("Role reporting line")));
});
