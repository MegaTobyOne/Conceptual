import assert from "node:assert/strict";
import test from "node:test";
import type { ActionEntity, LinkEntity, RequirementEntity } from "./index.js";
import {
  TEAM_VERDICT_LABELS,
  TEAM_VERDICT_RULES,
  UNASSIGNED_TEAM_LABEL,
  buildTeamReportCard,
  describeTeamVerdict,
  type TeamReportCardInput,
  type TeamReportCardRow
} from "./index.js";

const NOW = "2026-09-01T00:00:00.000Z";
const STAMP = "2026-08-01T00:00:00.000Z";

test("no-open-work: a team with no open actions, even when it owns gaps", () => {
  const model = buildTeamReportCard(
    input({
      requirements: [requirement("REQ-1", "Patch systems", "not-met", "Platform")],
      actions: [action("ACT-1", "Old work", "done", { ownerTeam: "Platform", completedAt: "2026-01-01" })]
    })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.verdict, "no-open-work");
  assert.equal(row.verdictRule, TEAM_VERDICT_RULES["no-open-work"]);
  assert.equal(row.gapsOwned, 1);
  assert.deepEqual(row.gapRequirementTitles, ["Patch systems"]);
  assert.equal(
    describeTeamVerdict(row),
    "Platform has no open work, although it owns 1 requirement gap with no open action to move it."
  );
});

test("stalled: nothing closed and one overdue action", () => {
  const model = buildTeamReportCard(
    input({ actions: [action("ACT-1", "Late work", "todo", { ownerTeam: "Platform", dueDate: "2026-08-31" })] })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.overdue, 1);
  assert.equal(row.closedInPeriod, 0);
  assert.equal(row.verdict, "stalled");
  assert.equal(row.verdictRule, TEAM_VERDICT_RULES.stalled);
  assert.equal(
    describeTeamVerdict(row),
    "Platform is stalled: nothing was closed in the period while 1 action is overdue and 0 have slipped."
  );
});

test("stalled: nothing closed and one slipped action with no overdue", () => {
  const model = buildTeamReportCard(
    input({
      actions: [
        action("ACT-1", "Moved work", "in-progress", {
          ownerTeam: "Platform",
          dueDate: "2026-10-15",
          dueDateHistory: [
            { dueDate: "2026-10-01", changedAt: STAMP },
            { dueDate: "2026-10-15", changedAt: "2026-08-15T00:00:00.000Z" }
          ]
        })
      ]
    })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.overdue, 0);
  assert.equal(row.slipped, 1);
  assert.equal(row.slippedNetDays, 14);
  assert.equal(row.verdict, "stalled");
});

test("at-risk: overdue with a closure in the period is at risk, not stalled", () => {
  const model = buildTeamReportCard(
    input({
      actions: [
        action("ACT-1", "Late work", "todo", { ownerTeam: "Platform", dueDate: "2026-08-31" }),
        action("ACT-2", "Finished work", "done", { ownerTeam: "Platform", completedAt: "2026-08-20T00:00:00.000Z" })
      ]
    })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.closedInPeriod, 1);
  assert.equal(row.verdict, "at-risk");
  assert.equal(row.verdictRule, TEAM_VERDICT_RULES["at-risk"]);
  assert.equal(
    describeTeamVerdict(row),
    "Platform is at risk: 1 of 1 action is overdue, 0 have slipped against 1 closed in the period, and 0 have no due date."
  );
});

test("at-risk: slipped outnumbers closures; on-track once closures match slippage", () => {
  const slipped = action("ACT-1", "Moved work", "todo", {
    ownerTeam: "Platform",
    dueDate: "2026-09-20",
    dueDateHistory: [
      { dueDate: "2026-09-10", changedAt: STAMP },
      { dueDate: "2026-09-20", changedAt: "2026-08-10T00:00:00.000Z" }
    ]
  });
  const slippedAgain = { ...slipped, id: "ACT-4", title: "Moved work again" };
  const closedOne = action("ACT-2", "Done one", "done", { ownerTeam: "Platform", completedAt: "2026-08-20" });
  const closedTwo = action("ACT-3", "Done two", "done", { ownerTeam: "Platform", completedAt: "2026-08-21" });

  const atRisk = rowFor(buildTeamReportCard(input({ actions: [slipped, slippedAgain, closedOne] })).rows, "Platform");
  const onTrack = rowFor(buildTeamReportCard(input({ actions: [slipped, closedOne, closedTwo] })).rows, "Platform");

  assert.equal(atRisk.slipped, 2);
  assert.equal(atRisk.closedInPeriod, 1);
  assert.equal(atRisk.verdict, "at-risk");
  assert.equal(onTrack.slipped, 1);
  assert.equal(onTrack.closedInPeriod, 2);
  assert.equal(onTrack.verdict, "on-track");
});

test("at-risk: more than half of open actions without a due date; exactly half is on track", () => {
  const dated = action("ACT-1", "Dated", "todo", { ownerTeam: "Platform", dueDate: "2026-09-10" });
  const undatedA = action("ACT-2", "Undated A", "todo", { ownerTeam: "Platform" });
  const undatedB = action("ACT-3", "Undated B", "todo", { ownerTeam: "Platform" });

  const half = rowFor(buildTeamReportCard(input({ actions: [dated, undatedA] })).rows, "Platform");
  const majority = rowFor(buildTeamReportCard(input({ actions: [dated, undatedA, undatedB] })).rows, "Platform");

  assert.equal(half.noDueDate, 1);
  assert.equal(half.verdict, "on-track");
  assert.equal(majority.noDueDate, 2);
  assert.equal(majority.verdict, "at-risk");
});

test("on-track: dated open work with a closure and no overdue or slippage", () => {
  const model = buildTeamReportCard(
    input({
      actions: [
        action("ACT-1", "Soon", "todo", { ownerTeam: "Platform", dueDate: "2026-09-10" }),
        action("ACT-2", "Later", "todo", { ownerTeam: "Platform", dueDate: "2026-12-01" }),
        action("ACT-3", "Done", "done", { ownerTeam: "Platform", completedAt: "2026-08-25T00:00:00.000Z" })
      ]
    })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.open, 2);
  assert.equal(row.dueInPeriod, 1);
  assert.equal(row.overdue, 0);
  assert.equal(row.verdict, "on-track");
  assert.equal(row.verdictRule, TEAM_VERDICT_RULES["on-track"]);
  assert.deepEqual(row.nextDue, { actionTitle: "Soon", dueDate: "2026-09-10" });
  assert.equal(row.velocityPerWeek, 0.2);
  assert.equal(
    describeTeamVerdict(row),
    "Platform is on track: 1 action closed in the period, 2 open, none overdue, and 0 without a due date."
  );
});

test("Unassigned row is always present and sorts last; totals count named teams", () => {
  const model = buildTeamReportCard(
    input({
      actions: [
        action("ACT-1", "Nobody's work", "todo"),
        action("ACT-2", "Late", "todo", { ownerTeam: "Zulu", dueDate: "2026-08-01" }),
        action("ACT-3", "Fine", "todo", { ownerTeam: "Alpha", dueDate: "2026-09-10" }),
        action("ACT-4", "Fine too", "todo", { ownerTeam: "Bravo", dueDate: "2026-09-10" })
      ]
    })
  );

  assert.deepEqual(
    model.rows.map((row) => row.team),
    ["Zulu", "Alpha", "Bravo", UNASSIGNED_TEAM_LABEL]
  );
  assert.equal(model.rows.at(-1)?.open, 1);
  assert.deepEqual(model.totals, { teams: 3, unassignedOpen: 1 });
  assert.equal(buildTeamReportCard(input({})).rows.length, 1);
  assert.equal(buildTeamReportCard(input({})).rows[0]?.team, UNASSIGNED_TEAM_LABEL);
});

test("unowned gaps are attributed to the only team whose open actions gate them, otherwise Unassigned", () => {
  const model = buildTeamReportCard(
    input({
      requirements: [
        requirement("REQ-1", "Gated by one team", "not-met"),
        requirement("REQ-2", "Gated by two teams", "partially-met"),
        requirement("REQ-3", "No open action", "not-started"),
        requirement("REQ-4", "Already met", "met"),
        requirement("REQ-5", "Not applicable", "not-applicable")
      ],
      actions: [
        action("ACT-1", "One", "todo", { ownerTeam: "Platform", dueDate: "2026-09-10" }),
        action("ACT-2", "Two", "todo", { ownerTeam: "Security", dueDate: "2026-09-10" }),
        action("ACT-3", "Closed", "done", { ownerTeam: "Platform" })
      ],
      links: [link("REQ-1", "ACT-1"), link("REQ-2", "ACT-1"), link("REQ-2", "ACT-2"), link("REQ-3", "ACT-3")]
    })
  );

  assert.deepEqual(rowFor(model.rows, "Platform").gapRequirementTitles, ["Gated by one team"]);
  assert.deepEqual(rowFor(model.rows, "Security").gapRequirementTitles, []);
  assert.deepEqual(rowFor(model.rows, UNASSIGNED_TEAM_LABEL).gapRequirementTitles, [
    "Gated by two teams",
    "No open action"
  ]);
});

test("closedInPeriod window includes both edges and excludes cancelled or older closures", () => {
  const model = buildTeamReportCard(
    input({
      periodDays: 30,
      actions: [
        action("ACT-1", "On start edge", "done", { ownerTeam: "Platform", completedAt: "2026-08-02T00:00:00.000Z" }),
        action("ACT-2", "On end edge", "done", { ownerTeam: "Platform", completedAt: NOW }),
        action("ACT-3", "Just before", "done", { ownerTeam: "Platform", completedAt: "2026-08-01T23:59:59.000Z" }),
        action("ACT-4", "Fallback to updatedAt", "done", {
          ownerTeam: "Platform",
          updatedAt: "2026-08-20T00:00:00.000Z"
        }),
        action("ACT-5", "Cancelled", "cancelled", { ownerTeam: "Platform", completedAt: "2026-08-20T00:00:00.000Z" })
      ]
    })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.closedInPeriod, 3);
  assert.equal(model.periodLabel, "Last 30 days");
  assert.equal(model.closureWindowDays, 30);
});

test("anchor record status counts closures as done-since-anchor and widens the closure window", () => {
  const model = buildTeamReportCard(
    input({
      anchor: {
        capturedAt: "2026-07-01T00:00:00.000Z",
        recordStatus: { actions: { "ACT-1": "in-progress", "ACT-2": "done" }, requirements: {} }
      },
      actions: [
        action("ACT-1", "Became done", "done", { ownerTeam: "Platform", completedAt: "2026-07-05T00:00:00.000Z" }),
        action("ACT-2", "Already done", "done", { ownerTeam: "Platform", completedAt: "2026-08-20T00:00:00.000Z" }),
        action("ACT-3", "New and done", "done", { ownerTeam: "Platform" })
      ]
    })
  );
  const row = rowFor(model.rows, "Platform");

  assert.equal(row.closedInPeriod, 2);
  assert.equal(model.periodLabel, "Since 01 Jul 2026");
  assert.equal(model.closureWindowDays, 62);
  assert.equal(row.velocityPerWeek, 0.2);
});

test("velocityPerWeek is undefined when the period is empty", () => {
  const model = buildTeamReportCard(
    input({
      periodDays: 0,
      actions: [action("ACT-1", "Open", "todo", { ownerTeam: "Platform", dueDate: "2026-09-10" })]
    })
  );

  assert.equal(rowFor(model.rows, "Platform").velocityPerWeek, undefined);
});

test("team names merge case-insensitively after trimming and keep first-seen casing", () => {
  const model = buildTeamReportCard(
    input({
      requirements: [requirement("REQ-1", "Gap", "not-met", "  platform Ops ")],
      actions: [
        action("ACT-1", "One", "todo", { ownerTeam: "Platform ops", dueDate: "2026-09-10" }),
        action("ACT-2", "Two", "todo", { ownerTeam: "PLATFORM OPS", dueDate: "2026-09-12" })
      ]
    })
  );

  assert.equal(model.rows.length, 2);
  const row = rowFor(model.rows, "platform Ops");
  assert.equal(row.open, 2);
  assert.equal(row.gapsOwned, 1);
  assert.deepEqual(row.nextDue, { actionTitle: "One", dueDate: "2026-09-10" });
});

test("deleted records are ignored", () => {
  const model = buildTeamReportCard(
    input({
      actions: [
        {
          ...action("ACT-1", "Gone", "todo", { ownerTeam: "Platform", dueDate: "2026-08-01" }),
          recordStatus: "deleted"
        }
      ]
    })
  );

  assert.equal(model.rows.length, 1);
});

test("labels and rules cover every verdict", () => {
  for (const verdict of ["stalled", "at-risk", "on-track", "no-open-work"] as const) {
    assert.ok(TEAM_VERDICT_RULES[verdict].length > 0);
    assert.ok(TEAM_VERDICT_LABELS[verdict].length > 0);
  }
});

test("identical input produces identical output and does not mutate inputs", () => {
  const first = input({
    requirements: [requirement("REQ-1", "Gap", "not-met", "Platform")],
    actions: [
      action("ACT-1", "Late", "todo", { ownerTeam: "Platform", dueDate: "2026-08-01" }),
      action("ACT-2", "Loose", "todo")
    ],
    links: [link("REQ-1", "ACT-1")]
  });
  const snapshot = JSON.stringify(first);

  assert.deepEqual(buildTeamReportCard(first), buildTeamReportCard(first));
  assert.equal(JSON.stringify(first), snapshot);
});

// --- Fixture -------------------------------------------------------------------------------

function envelope<Type extends string>(entityType: Type, id: string) {
  return {
    id,
    entityType,
    schemaVersion: "1.16.0",
    createdAt: STAMP,
    updatedAt: STAMP,
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
}

function requirement(
  id: string,
  title: string,
  assessmentStatus: RequirementEntity["assessmentStatus"],
  ownerTeam?: string
): RequirementEntity {
  return { ...envelope("requirement", id), title, domainId: "DOM-1", assessmentStatus, ownerTeam };
}

function action(
  id: string,
  title: string,
  status: ActionEntity["status"],
  extra: Partial<ActionEntity> = {}
): ActionEntity {
  return { ...envelope("action", id), title, status, ...extra };
}

function link(requirementId: string, actionId: string): LinkEntity {
  return {
    ...envelope("link", `LNK-${requirementId}-${actionId}`),
    title: "addressed-by",
    linkType: "addressed-by",
    fromId: requirementId,
    fromType: "requirement",
    toId: actionId,
    toType: "action"
  };
}

function input(overrides: Partial<TeamReportCardInput>): TeamReportCardInput {
  return { requirements: [], actions: [], links: [], now: NOW, ...overrides };
}

function rowFor(rows: readonly TeamReportCardRow[], team: string): TeamReportCardRow {
  const row = rows.find((candidate) => candidate.team === team);
  assert.ok(row, `row for ${team}`);
  return row;
}
