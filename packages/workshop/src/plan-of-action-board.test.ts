import test from "node:test";
import assert from "node:assert/strict";
import { VERSION_AXES, type ActionEntity, type LinkEntity } from "@pspf/contracts";
import {
  buildPlanOfActionBoardModel,
  fitPlanOfActionLabel,
  normalisePlanWorkstreamId,
  normaliseTaskLabelVisibility
} from "./plan-of-action-board.js";

test("plan of action uses live Action titles in the timeline model", () => {
  const action = actionEntity({ title: "Current source action title", dueDate: "2026-06-30T00:00:00.000Z" });
  const model = buildPlanOfActionBoardModel([action], { now: new Date("2026-05-20T00:00:00.000Z") });
  const tasks = model.phases.flatMap((phase) => phase.tasks);

  assert.equal(tasks[0]?.title, "Current source action title");
});

test("plan of action classifies risk treatment Actions into the reduce risk workstream", () => {
  const action = actionEntity({
    title: "Treat gateway residual risk",
    dueDate: "2026-06-15T00:00:00.000Z",
    riskReduction: 4
  });
  const model = buildPlanOfActionBoardModel([action], { now: new Date("2026-05-20T00:00:00.000Z") });
  const riskPhase = model.phases.find((phase) => phase.id === "reduce-risk");

  assert.equal(riskPhase?.tasks.length, 1);
  assert.equal(riskPhase?.tasks[0]?.title, "Treat gateway residual risk");
  assert.equal(riskPhase?.tasks[0]?.phaseSource, "inferred");
});

test("plan of action honours explicit Action workstream override", () => {
  const action = actionEntity({
    title: "Report a risk-heavy activity under reporting",
    dueDate: "2026-06-15T00:00:00.000Z",
    riskReduction: 5,
    planWorkstreamId: "prepare-reporting"
  });
  const model = buildPlanOfActionBoardModel([action], { now: new Date("2026-05-20T00:00:00.000Z") });
  const reportingPhase = model.phases.find((phase) => phase.id === "prepare-reporting");
  const riskPhase = model.phases.find((phase) => phase.id === "reduce-risk");

  assert.equal(reportingPhase?.tasks[0]?.title, "Report a risk-heavy activity under reporting");
  assert.equal(reportingPhase?.tasks[0]?.phaseSource, "override");
  assert.equal(riskPhase?.tasks.length, 0);
  assert.equal(normalisePlanWorkstreamId("reduce-risk"), "reduce-risk");
  assert.equal(normalisePlanWorkstreamId("unknown"), undefined);
});

test("plan of action counts linked Requirements and Risks once", () => {
  const action = actionEntity({ title: "Close linked control gap", dueDate: "2026-06-30T00:00:00.000Z" });
  const links: LinkEntity[] = [
    linkEntity({ id: "LNK-1", fromId: "REQ-1", fromType: "requirement", toId: action.id, toType: "action" }),
    linkEntity({ id: "LNK-2", fromId: "REQ-1", fromType: "requirement", toId: action.id, toType: "action" }),
    linkEntity({ id: "LNK-3", fromId: action.id, fromType: "action", toId: "RSK-1", toType: "risk" })
  ];
  const model = buildPlanOfActionBoardModel([action, ...links], { now: new Date("2026-05-20T00:00:00.000Z") });

  assert.equal(model.metrics.linkedRequirements, 1);
  assert.equal(model.metrics.linkedRisks, 1);
});

test("plan of action uses explicit Action start and end dates", () => {
  const action = actionEntity({
    title: "Schedule operating model idea",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-09-30T00:00:00.000Z",
    dueDate: "2026-10-15T00:00:00.000Z"
  });
  const model = buildPlanOfActionBoardModel([action], { now: new Date("2026-05-20T00:00:00.000Z") });
  const task = model.phases.flatMap((phase) => phase.tasks)[0];

  assert.equal(task?.startDate, "2026-07-01");
  assert.equal(task?.endDate, "2026-09-30");
  assert.equal(task?.dueDate, "2026-10-15T00:00:00.000Z");
});

test("plan of action includes all Action statuses for graphical filtering", () => {
  const actions = [
    actionEntity({ title: "Idea", dueDate: "2026-06-01T00:00:00.000Z", status: "todo" }),
    actionEntity({ title: "Finished", dueDate: "2026-06-02T00:00:00.000Z", status: "done" }),
    actionEntity({ title: "Parked", dueDate: "2026-06-03T00:00:00.000Z", status: "cancelled" })
  ];
  const model = buildPlanOfActionBoardModel(actions, { now: new Date("2026-05-20T00:00:00.000Z") });
  const tasks = model.phases.flatMap((phase) => phase.tasks);

  assert.deepEqual(tasks.map((task) => task.status).sort(), ["cancelled", "done", "todo"]);
  assert.equal(model.metrics.actions, 1);
});

test("plan of action preserves completed Actions for master schedule slicing", () => {
  const actions = [
    actionEntity({ title: "Completed action", dueDate: "2026-06-02T00:00:00.000Z", status: "done" }),
    actionEntity({ title: "Cancelled action", dueDate: "2026-06-03T00:00:00.000Z", status: "cancelled" })
  ];
  const model = buildPlanOfActionBoardModel(actions, { now: new Date("2026-05-20T00:00:00.000Z") });
  const tasks = model.phases.flatMap((phase) => phase.tasks);

  assert.deepEqual(tasks.map((task) => task.title).sort(), ["Cancelled action", "Completed action"]);
  assert.equal(model.metrics.actions, 0);
});

test("plan of action caps long timeline width instead of using fixed day width", () => {
  const action = actionEntity({ title: "Long running uplift", dueDate: "2028-06-30T00:00:00.000Z" });
  const model = buildPlanOfActionBoardModel([action], {
    now: new Date("2026-05-20T00:00:00.000Z"),
    maxTimelineWidth: 900
  });

  assert.equal(model.timelineWidth <= 900, true);
  assert.equal(model.dayWidth < 18, true);
});

test("plan of action exposes today marker position on the timeline", () => {
  const action = actionEntity({
    title: "Ground the workplan",
    startDate: "2026-05-10T00:00:00.000Z",
    endDate: "2026-05-30T00:00:00.000Z",
    dueDate: "2026-05-30T00:00:00.000Z"
  });
  const model = buildPlanOfActionBoardModel([action], { now: new Date("2026-05-20T00:00:00.000Z") });

  assert.equal(model.today, "2026-05-20");
  assert.equal(model.todayX, 180);
});

test("task labels default visible and explicit false is preserved", () => {
  assert.equal(normaliseTaskLabelVisibility(), true);
  assert.equal(normaliseTaskLabelVisibility(true), true);
  assert.equal(normaliseTaskLabelVisibility(false), false);
});

test("task labels fit inside available bar width", () => {
  assert.equal(fitPlanOfActionLabel("Very long action title that should be shortened", 40), undefined);
  assert.equal(fitPlanOfActionLabel("Short", 80), "Short");
  assert.match(fitPlanOfActionLabel("Very long action title that should be shortened", 96) ?? "", /\.\.\.$/);
});

function actionEntity({
  title,
  status = "in-progress",
  startDate,
  endDate,
  dueDate,
  riskReduction = 0,
  planWorkstreamId
}: {
  readonly title: string;
  readonly status?: ActionEntity["status"];
  readonly startDate?: string;
  readonly endDate?: string;
  readonly dueDate: string;
  readonly riskReduction?: number;
  readonly planWorkstreamId?: string;
}): ActionEntity {
  const action = {
    id: `ACT-${title.replace(/[^A-Z0-9]/gi, "-").slice(0, 12)}`,
    entityType: "action",
    schemaVersion: VERSION_AXES.schemaVersion,
    title,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    sourceProduct: "workshop",
    recordStatus: "active",
    status,
    startDate,
    endDate,
    dueDate,
    impact: {
      postureUplift: 1,
      evidenceUplift: 1,
      riskReduction,
      directionUplift: 0,
      urgency: "normal",
      explanation: []
    }
  } satisfies ActionEntity;
  return planWorkstreamId ? ({ ...action, planWorkstreamId } as ActionEntity) : action;
}

function linkEntity(input: Pick<LinkEntity, "id" | "fromId" | "fromType" | "toId" | "toType">): LinkEntity {
  return {
    ...input,
    entityType: "link",
    schemaVersion: VERSION_AXES.schemaVersion,
    title: input.id,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    sourceProduct: "workshop",
    recordStatus: "active",
    linkType: "associated-with"
  } satisfies LinkEntity;
}
