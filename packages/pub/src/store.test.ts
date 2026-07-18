import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PUB_STORE_VERSION,
  UnsupportedPubStoreVersionError,
  emptyStore,
  migrateAndNormaliseStore,
  validateStore
} from "./store.js";

const now = new Date("2026-07-18T00:00:00.000Z");

test("migrates the current 1.1.0 store without losing records", () => {
  const migrated = migrateAndNormaliseStore(
    {
      pubStoreVersion: "1.1.0",
      updatedAt: "2026-01-01T00:00:00.000Z",
      people: [{ id: "PER-1", displayName: "Test Person", stakeholderType: "staff" }],
      teams: [],
      roles: [],
      assignments: [],
      relationshipNotes: []
    },
    now
  );
  assert.equal(migrated.pubStoreVersion, PUB_STORE_VERSION);
  assert.equal(migrated.people[0]?.displayName, "Test Person");
  assert.equal(migrated.updatedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(migrated.skills, []);
  assert.deepEqual(migrated.rotationOpportunities, []);
});

test("migrates 1.2.0 without transforming legacy certification text", () => {
  const migrated = migrateAndNormaliseStore(
    {
      pubStoreVersion: "1.2.0",
      people: [
        {
          id: "PER-1",
          displayName: "Test Person",
          performanceCycles: [{ id: "PFC-1", year: "2026", certifications: "Legacy free text" }]
        }
      ]
    },
    now
  );
  assert.equal(migrated.pubStoreVersion, "1.3.0");
  assert.equal(migrated.people[0]?.performanceCycles[0]?.certifications, "Legacy free text");
  assert.deepEqual(migrated.certifications, []);
});

test("migration is idempotent", () => {
  const once = migrateAndNormaliseStore(emptyStore(now), now);
  assert.deepEqual(migrateAndNormaliseStore(once, now), once);
});

test("rejects a store from a newer unsupported version", () => {
  assert.throws(() => migrateAndNormaliseStore({ pubStoreVersion: "99.0.0" }, now), UnsupportedPubStoreVersionError);
});

test("reports dangling assignment references", () => {
  const store = migrateAndNormaliseStore(
    {
      pubStoreVersion: "1.1.0",
      teams: [],
      roles: [],
      people: [],
      assignments: [{ id: "ASM-1", personId: "PER-MISSING", roleId: "ROL-MISSING" }],
      relationshipNotes: []
    },
    now
  );
  assert.deepEqual(
    validateStore(store).map((issue) => issue.path),
    ["assignments[0].personId", "assignments[0].roleId"]
  );
});

test("reports team and role hierarchy cycles", () => {
  const store = migrateAndNormaliseStore(
    {
      pubStoreVersion: "1.1.0",
      people: [],
      assignments: [],
      relationshipNotes: [],
      teams: [
        { id: "TEAM-A", title: "A", parentTeamId: "TEAM-B" },
        { id: "TEAM-B", title: "B", parentTeamId: "TEAM-A" }
      ],
      roles: [
        { id: "ROLE-A", title: "A", teamId: "TEAM-A", reportsToRoleId: "ROLE-B" },
        { id: "ROLE-B", title: "B", teamId: "TEAM-B", reportsToRoleId: "ROLE-A" }
      ]
    },
    now
  );
  const messages = validateStore(store).map((issue) => issue.message);
  assert.ok(messages.some((message) => message.includes("Team hierarchy")));
  assert.ok(messages.some((message) => message.includes("Role reporting line")));
});

test("reports invalid workforce references and rotation capacity", () => {
  const store = migrateAndNormaliseStore(
    {
      pubStoreVersion: "1.3.0",
      teams: [{ id: "TEAM-1", title: "Cyber" }],
      roles: [{ id: "ROLE-1", title: "Analyst", teamId: "TEAM-1" }],
      people: [{ id: "PER-1", displayName: "Test Person" }],
      skills: [{ id: "SKL-1", title: "Cyber judgement", levelAnchors: ["A", "B"] }],
      rotationOpportunities: [
        {
          id: "ROP-1",
          hostTeamId: "TEAM-1",
          title: "Cyber rotation",
          capacity: 1,
          startDate: "2026-09-01",
          endDate: "2026-08-01"
        }
      ],
      rotationPlacements: [
        { id: "RPL-1", opportunityId: "ROP-1", personId: "PER-1", homeTeamId: "TEAM-1", state: "active" },
        { id: "RPL-2", opportunityId: "ROP-1", personId: "PER-MISSING", homeTeamId: "TEAM-1", state: "accepted" }
      ]
    },
    now
  );
  const issues = validateStore(store);
  assert.ok(issues.some((issue) => issue.path === "skills[0].levelAnchors"));
  assert.ok(issues.some((issue) => issue.path === "rotationOpportunities[0]"));
  assert.ok(issues.some((issue) => issue.path === "rotationPlacements[1].personId"));
  assert.ok(issues.some((issue) => issue.message.includes("2 occupied places")));
});
