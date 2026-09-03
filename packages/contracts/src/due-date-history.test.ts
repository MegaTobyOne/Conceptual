import assert from "node:assert/strict";
import test from "node:test";
import { type ActionEntity, appendDueDateHistory, summariseSlippage } from "./index.js";

const NOW = "2026-09-03T00:00:00.000Z";

function action(overrides: Partial<ActionEntity> = {}): ActionEntity {
  return {
    id: "ACT-00000000-0000-7000-8000-000000000001",
    entityType: "action",
    schemaVersion: "1.16.0",
    title: "Refresh the access review evidence",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    sourceProduct: "workshop",
    recordStatus: "active",
    status: "todo",
    ...overrides
  };
}

test("appendDueDateHistory: unchanged due date returns the same reference", () => {
  const previous = action({ dueDate: "2026-10-01", dueDateHistory: [{ dueDate: "2026-10-01", changedAt: NOW }] });
  const next = action({ dueDate: "2026-10-01", title: "Renamed" });
  assert.equal(appendDueDateHistory(previous, next, NOW), next);
});

test("appendDueDateHistory: both undefined counts as unchanged", () => {
  const previous = action();
  const next = action({ status: "in-progress" });
  assert.equal(appendDueDateHistory(previous, next, NOW), next);
});

test("appendDueDateHistory: changed due date appends an entry after the previous history", () => {
  const previous = action({
    dueDate: "2026-10-01",
    dueDateHistory: [{ dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" }]
  });
  const next = action({ dueDate: "2026-10-15" });
  const result = appendDueDateHistory(previous, next, NOW);
  assert.deepEqual(result.dueDateHistory, [
    { dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" },
    { dueDate: "2026-10-15", changedAt: NOW }
  ]);
  assert.equal(result.dueDate, "2026-10-15");
  assert.notEqual(result, next);
  assert.deepEqual(next.dueDateHistory, undefined, "input is not mutated");
});

test("appendDueDateHistory: clearing the due date records an entry without a dueDate", () => {
  const previous = action({
    dueDate: "2026-10-01",
    dueDateHistory: [{ dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" }]
  });
  const result = appendDueDateHistory(previous, action(), NOW);
  assert.deepEqual(result.dueDateHistory, [
    { dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" },
    { changedAt: NOW }
  ]);
  assert.equal("dueDate" in (result.dueDateHistory?.[1] ?? {}), false);
});

test("appendDueDateHistory: create with a due date seeds one entry", () => {
  const result = appendDueDateHistory(undefined, action({ dueDate: "2026-10-01" }), NOW);
  assert.deepEqual(result.dueDateHistory, [{ dueDate: "2026-10-01", changedAt: NOW }]);
});

test("appendDueDateHistory: create without a due date leaves history absent", () => {
  const next = action();
  assert.equal(appendDueDateHistory(undefined, next, NOW), next);
});

test("appendDueDateHistory: falls back to next's history when previous has none", () => {
  const previous = action({ dueDate: "2026-10-01" });
  const next = action({
    dueDate: "2026-11-01",
    dueDateHistory: [{ dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" }]
  });
  const result = appendDueDateHistory(previous, next, NOW);
  assert.equal(result.dueDateHistory?.length, 2);
  assert.deepEqual(result.dueDateHistory?.[1], { dueDate: "2026-11-01", changedAt: NOW });
});

test("summariseSlippage: no history and no due date", () => {
  assert.deepEqual(summariseSlippage(action(), NOW), { changes: 0, netDays: undefined });
});

test("summariseSlippage: single seeded entry is zero changes and zero net days", () => {
  const subject = action({ dueDate: "2026-10-01", dueDateHistory: [{ dueDate: "2026-10-01", changedAt: NOW }] });
  assert.deepEqual(summariseSlippage(subject, NOW), { changes: 0, netDays: 0, latestDueDate: "2026-10-01" });
});

test("summariseSlippage: net days spans first recorded to current, counting each move", () => {
  const subject = action({
    dueDate: "2026-11-15",
    dueDateHistory: [
      { dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" },
      { dueDate: "2026-10-20", changedAt: "2026-09-01T00:00:00.000Z" },
      { dueDate: "2026-11-15", changedAt: NOW }
    ]
  });
  assert.deepEqual(summariseSlippage(subject, NOW), { changes: 2, netDays: 45, latestDueDate: "2026-11-15" });
});

test("summariseSlippage: pulled-in date yields negative net days", () => {
  const subject = action({
    dueDate: "2026-09-20",
    dueDateHistory: [
      { dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" },
      { dueDate: "2026-09-20", changedAt: NOW }
    ]
  });
  assert.equal(summariseSlippage(subject, NOW).netDays, -11);
});

test("summariseSlippage: cleared current date has undefined net days", () => {
  const subject = action({
    dueDateHistory: [{ dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" }, { changedAt: NOW }]
  });
  assert.deepEqual(summariseSlippage(subject, NOW), { changes: 1, netDays: undefined });
});

test("summariseSlippage: history that starts with a cleared entry skips to the first real date", () => {
  const subject = action({
    dueDate: "2026-10-11",
    dueDateHistory: [
      { changedAt: "2026-07-01T00:00:00.000Z" },
      { dueDate: "2026-10-01", changedAt: "2026-08-01T00:00:00.000Z" },
      { dueDate: "2026-10-11", changedAt: NOW }
    ]
  });
  assert.equal(summariseSlippage(subject, NOW).netDays, 10);
});

test("due-date helpers are deterministic for identical input", () => {
  const previous = action({ dueDate: "2026-10-01", dueDateHistory: [{ dueDate: "2026-10-01", changedAt: NOW }] });
  const next = action({ dueDate: "2026-10-15" });
  const first = appendDueDateHistory(previous, next, NOW);
  const second = appendDueDateHistory(previous, next, NOW);
  assert.deepEqual(first, second);
  assert.deepEqual(summariseSlippage(first, NOW), summariseSlippage(second, NOW));
});
