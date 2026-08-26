import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildOrganisationTree, renderOrganisationOutlineHtml, renderOrganisationOutlineText } from "./org-chart.js";
import { migrateAndNormaliseStore } from "./store.js";

const store = migrateAndNormaliseStore({
  pubStoreVersion: "1.1.0",
  teams: [
    { id: "T1", title: "Cyber", parentTeamId: "" },
    { id: "T2", title: "Operations", parentTeamId: "T1" }
  ],
  roles: [
    { id: "R1", title: "Director", teamId: "T1" },
    { id: "R2", title: "Analyst", teamId: "T2", reportsToRoleId: "R1" }
  ],
  people: [{ id: "P1", displayName: "DISTINCTIVE SECRET NAME", stakeholderType: "staff", notes: "SECRET NOTE" }],
  assignments: [{ id: "A1", personId: "P1", roleId: "R1", status: "active" }],
  relationshipNotes: []
});

test("builds nested teams and vacancy status", () => {
  const tree = buildOrganisationTree(store);
  assert.equal(tree[0]?.title, "Cyber");
  assert.equal(tree[0]?.roles[0]?.status, "filled");
  assert.equal(tree[0]?.children[0]?.roles[0]?.status, "vacant");
});

test("plain-text outline contains useful structure and excludes restricted data", () => {
  const text = renderOrganisationOutlineText(store, new Date("2026-07-18T00:00:00Z"));
  assert.match(text, /Cyber[\s\S]*Director \[filled\][\s\S]*Operations[\s\S]*Analyst \[vacant\]/);
  assert.doesNotMatch(text, /DISTINCTIVE SECRET NAME|SECRET NOTE|\bP1\b|\bA1\b/);
});

test("HTML outline escapes structure and excludes restricted data", () => {
  const unsafeStore = {
    ...store,
    teams: [{ ...store.teams[0]!, title: "Cyber <script>alert(1)</script>" }, ...store.teams.slice(1)]
  };
  const html = renderOrganisationOutlineHtml(unsafeStore, new Date("2026-07-18T00:00:00Z"));
  assert.match(html, /Cyber &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>|DISTINCTIVE SECRET NAME|SECRET NOTE|\bP1\b|\bA1\b/);
});

test("organisation outline tolerates malformed legacy titles", () => {
  const malformedStore = {
    ...store,
    teams: [
      { ...store.teams[0]!, title: undefined },
      { ...store.teams[1]!, title: `<script>alert("team")</script>` }
    ],
    roles: [
      { ...store.roles[0]!, title: null },
      { ...store.roles[1]!, title: 17 }
    ]
  } as unknown as typeof store;

  assert.doesNotThrow(() => buildOrganisationTree(malformedStore));
  const html = renderOrganisationOutlineHtml(malformedStore, new Date("2026-07-18T00:00:00Z"));
  assert.match(html, /Untitled team/);
  assert.match(html, /Untitled role/);
  assert.match(html, /&lt;script&gt;alert\(&quot;team&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
