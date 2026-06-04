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

test("Pub exposes Role detail and edit CRUD panels", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /"pspf\.pub\.openRoleDetail"/);
  assert.match(source, /"pspf\.pub\.editRole"/);
  assert.match(source, /registerCommand\("pspf\.pub\.openRoleDetail", openRoleDetail\)/);
  assert.match(source, /registerCommand\("pspf\.pub\.editRole", editRole\)/);
  assert.match(source, /function renderRoleDetailHtml\(store: PubStore, roleId: string\): string/);
  assert.match(source, /function renderRoleEditorHtml\(store: PubStore, role: RoleRecord \| undefined\): string/);
  assert.match(source, /function parseRoleFormFields\(/);
  assert.match(source, /data-role-id=/);
});

test("Pub roles support local archive lifecycle and team compliance status", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /const ROLE_STATUSES = \["active", "archived"\] as const/);
  assert.match(source, /registerCommand\("pspf\.pub\.archiveRole", archiveRole\)/);
  assert.match(source, /function archiveRole\(\): Promise<void>/);
  assert.match(source, /function activeRolesForTeam\(store: PubStore, teamId: string\): readonly RoleRecord\[\]/);
  assert.match(source, /function teamComplianceStatus\(store: PubStore, team: TeamRecord\): string/);
  assert.match(source, /Archive role/);
  assert.match(source, /Compliance status/);
});

test("Pub Role CRUD remains local-only", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /Role detail stays in Pub local storage/);
  assert.match(source, /Save writes to \.pspf\/pub\/pub\.json only/);
  assert.match(source, /no Explorer publication in v1\.29/);
});

test("Pub exposes Assignment detail and edit CRUD panels", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /"pspf\.pub\.openAssignmentDetail"/);
  assert.match(source, /"pspf\.pub\.editAssignment"/);
  assert.match(source, /registerCommand\("pspf\.pub\.openAssignmentDetail", openAssignmentDetail\)/);
  assert.match(source, /registerCommand\("pspf\.pub\.editAssignment", editAssignment\)/);
  assert.match(source, /function renderAssignmentDetailHtml\(store: PubStore, assignmentId: string\): string/);
  assert.match(
    source,
    /function renderAssignmentEditorHtml\(store: PubStore, assignment: AssignmentRecord \| undefined\): string/
  );
  assert.match(source, /function parseAssignmentFormFields\(/);
  assert.match(source, /data-assignment-id=/);
});

test("Pub Assignment CRUD remains local-only", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /Assignment detail stays in Pub local storage/);
  assert.match(source, /Save writes to \.pspf\/pub\/pub\.json only/);
  assert.match(source, /no Explorer publication in v1\.29/);
});

test("Pub exposes Relationship Note detail and edit CRUD panels", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /"pspf\.pub\.openRelationshipNoteDetail"/);
  assert.match(source, /"pspf\.pub\.editRelationshipNote"/);
  assert.match(source, /registerCommand\("pspf\.pub\.openRelationshipNoteDetail", openRelationshipNoteDetail\)/);
  assert.match(source, /registerCommand\("pspf\.pub\.editRelationshipNote", editRelationshipNote\)/);
  assert.match(
    source,
    /function renderRelationshipNoteDetailHtml\(store: PubStore, relationshipNoteId: string\): string/
  );
  assert.match(
    source,
    /function renderRelationshipNoteEditorHtml\(\s*store: PubStore,\s*relationshipNote: RelationshipNoteRecord \| undefined\s*\): string/
  );
  assert.match(source, /function parseRelationshipNoteFormFields\(/);
  assert.match(source, /data-relationship-note-id=/);
});

test("Pub Relationship Note CRUD remains local-only", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /Relationship note detail stays in Pub local storage/);
  assert.match(source, /Save writes to \.pspf\/pub\/pub\.json only/);
  assert.match(source, /no Explorer publication in v1\.29/);
});

test("Pub Organisation Chart renders a graphic team and role view", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /function renderOrgChartGraphic\(store: PubStore/);
  assert.match(source, /class="org-chart-graphic"/);
  assert.match(source, /class="org-team-node"/);
  assert.match(source, /class="org-role-card"/);
  assert.match(source, /class="org-assignment-chip"/);
  assert.match(source, /class="org-card-face org-card-face--front"/);
  assert.match(source, /class="org-card-face org-card-face--back"/);
  assert.match(source, /function renderOrgChartTeamBack\(team: TeamRecord\): string/);
  assert.match(source, /Organisation chart detail/);
});

test("Pub teams store local team news dates for optional planning", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /interface TeamItemRecord/);
  assert.match(source, /readonly teamItems: readonly TeamItemRecord\[\]/);
  assert.match(source, /function teamItemEditorFields\(item: TeamItemRecord/);
  assert.match(source, /name="teamItem\.\$\{escapeHtml\(item\.id\)\}\.includeInPlan"/);
  assert.match(source, /function parseTeamItemEditorFields/);
  assert.match(source, /function normaliseTeamItems/);
  assert.match(source, /formatTeamItemDateRange/);
  assert.match(source, /Access review evidence window/);
});

test("Pub Home exposes one upcoming-actions graphic", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /function renderPubUpcomingActionsGraphic/);
  assert.match(source, /class="pub-action-radar"/);
  assert.match(source, /homeSection\(\{[\s\S]*id: "signals",[\s\S]*eyebrow: "Now",[\s\S]*heading: "Upcoming actions"/);
  assert.match(source, /deriveUpcomingBadges\(store\)/);
});

test("Pub tree title menus link summaries to management panels", async () => {
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(manifest, /"command": "pspf\.pub\.openPeople"[\s\S]*"view == pspfPub\.peopleView"/);
  assert.match(manifest, /"command": "pspf\.pub\.openTeams"[\s\S]*"view == pspfPub\.teamsView"/);
  assert.match(manifest, /"command": "pspf\.pub\.openRoles"[\s\S]*"view == pspfPub\.rolesView"/);
  assert.match(manifest, /"command": "pspf\.pub\.openAssignments"[\s\S]*"view == pspfPub\.assignmentsView"/);
});

test("Pub Organisation Chart keeps the graphic focused on structure", async () => {
  const source = await readFile(sourcePath, "utf8");
  const orgChartMatch = source.match(
    /function renderOrgChartHtml\(store: PubStore\): string \{[\s\S]*?function renderOrgChartAssignmentChip/
  );
  assert.ok(orgChartMatch, "organisation chart renderer should be present");
  const orgChartSource = orgChartMatch[0];

  assert.match(orgChartSource, /tableHtml\(\["Team", "Parent", "Role", "Reports to", "Assigned"\], rows, 5\)/);
  assert.doesNotMatch(orgChartSource, /teamOrgTags/);
  assert.doesNotMatch(orgChartSource, /No functional outcome recorded/);
  assert.match(orgChartSource, /Team news and dates/);

  const chipMatch = source.match(/function renderOrgChartAssignmentChip\(store: PubStore[\s\S]*?\n}/);
  assert.ok(chipMatch, "assignment chip renderer should be present");
  assert.doesNotMatch(chipMatch[0], /<small>/);
});
