import test from "node:test";
import assert from "node:assert/strict";
import type { QuestionnaireAnswerRecord, QuestionnaireAnswerValue, QuestionnaireQuestion } from "@pspf/contracts";
import { filterQuestionsForMode, planRunWrites, planWritesForAnswer } from "./policy.js";

function makeQuestion(overrides: Partial<QuestionnaireQuestion> = {}): QuestionnaireQuestion {
  return {
    id: "q.test.security-plan",
    domain: "GOV",
    requirementRefs: ["REQ-PSPF-2025-002"],
    prompt: "Does your entity have a current protective security plan?",
    helpText: "PSPF Domain GOV requires it.",
    evidenceTemplate: {
      title: "Protective security plan",
      type: "policy-document",
      defaultReviewCycleDays: 365,
      promptFor: "url-or-note"
    },
    actionTemplates: {
      yes: { title: "Attach evidence", priority: "medium", dueOffsetDays: 30 },
      partial: { title: "Update the plan", priority: "medium", dueOffsetDays: 60 },
      no: { title: "Establish a plan", priority: "high", dueOffsetDays: 30 },
      unknown: { title: "Investigate", priority: "high", dueOffsetDays: 14 }
    },
    riskTemplate: {
      applyOnAnswers: ["no"],
      title: "No plan",
      likelihood: "possible",
      consequence: "major"
    },
    publicationPolicy: "internal",
    ...overrides
  } as QuestionnaireQuestion;
}

function makeAnswer(
  value: QuestionnaireAnswerValue,
  extras: Partial<QuestionnaireAnswerRecord> = {}
): QuestionnaireAnswerRecord {
  return {
    questionId: "q.test.security-plan",
    value,
    answeredAt: "2026-01-01T00:00:00.000Z",
    ...extras
  };
}

const TODAY = new Date("2026-01-01T00:00:00.000Z");
const RUN_ID = "run-test-001";

test("yes-with-link creates met requirement, evidence with reviewCycle, and review-cycle action", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("yes-with-link", { evidenceUrl: "https://example.gov.au/plan.pdf" }),
    today: TODAY,
    runId: RUN_ID
  });
  const requirement = writes.find((write) => write.kind === "requirement-upsert");
  assert.equal(requirement?.kind, "requirement-upsert");
  assert.equal(requirement && "assessmentStatus" in requirement && requirement.assessmentStatus, "met");

  const evidence = writes.find((write) => write.kind === "evidence-create");
  assert.equal(evidence?.kind, "evidence-create");
  assert.equal(evidence && "url" in evidence && evidence.url, "https://example.gov.au/plan.pdf");
  assert.equal(evidence && "nextReviewDate" in evidence && evidence.nextReviewDate, "2027-01-01");
  assert.equal(evidence && "reviewCycleDays" in evidence && evidence.reviewCycleDays, 365);

  const reviewAction = writes.find(
    (write) => write.kind === "action-create" && "purpose" in write && write.purpose === "review-cycle"
  );
  assert.ok(reviewAction, "review-cycle action should be planned");

  const risk = writes.find((write) => write.kind === "risk-create");
  assert.equal(risk, undefined, "no risk on yes-with-link");
});

test("yes without link marks requirement partial and creates attach-evidence action", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("yes"),
    today: TODAY,
    runId: RUN_ID
  });
  const requirement = writes.find((write) => write.kind === "requirement-upsert");
  assert.equal(requirement && "assessmentStatus" in requirement && requirement.assessmentStatus, "partially-met");
  const action = writes.find((write) => write.kind === "action-create");
  assert.equal(action && "purpose" in action && action.purpose, "attach-evidence");
  assert.equal(action && "dueDate" in action && action.dueDate, "2026-01-31");
  assert.equal(
    writes.find((write) => write.kind === "evidence-create"),
    undefined
  );
});

test("no creates not-met requirement, remediation action, and risk", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("no"),
    today: TODAY,
    runId: RUN_ID
  });
  const requirement = writes.find((write) => write.kind === "requirement-upsert");
  assert.equal(requirement && "assessmentStatus" in requirement && requirement.assessmentStatus, "not-met");
  const action = writes.find((write) => write.kind === "action-create");
  assert.equal(action && "purpose" in action && action.purpose, "remediate");
  assert.equal(action && "priority" in action && action.priority, "high");
  const risk = writes.find((write) => write.kind === "risk-create");
  assert.ok(risk, "no answer should create a risk");
});

test("partial marks requirement partial and creates remediation action without risk by default", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("partial"),
    today: TODAY,
    runId: RUN_ID
  });
  const requirement = writes.find((write) => write.kind === "requirement-upsert");
  assert.equal(requirement && "assessmentStatus" in requirement && requirement.assessmentStatus, "partially-met");
  const action = writes.find((write) => write.kind === "action-create");
  assert.equal(action && "purpose" in action && action.purpose, "remediate");
  assert.equal(
    writes.find((write) => write.kind === "risk-create"),
    undefined
  );
});

test("unknown leaves requirement unchanged and creates investigation action", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("unknown"),
    today: TODAY,
    runId: RUN_ID
  });
  assert.equal(
    writes.find((write) => write.kind === "requirement-upsert"),
    undefined
  );
  const action = writes.find((write) => write.kind === "action-create");
  assert.equal(action && "purpose" in action && action.purpose, "investigate");
});

test("na sets requirement not-applicable with rationale and emits no action", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("na", { naRationale: "Entity does not hold official information" }),
    today: TODAY,
    runId: RUN_ID
  });
  const requirement = writes.find((write) => write.kind === "requirement-upsert");
  assert.equal(requirement && "assessmentStatus" in requirement && requirement.assessmentStatus, "not-applicable");
  assert.equal(
    requirement && "naRationale" in requirement && requirement.naRationale,
    "Entity does not hold official information"
  );
  assert.equal(
    writes.find((write) => write.kind === "action-create"),
    undefined
  );
});

test("skipped produces no writes", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("skipped"),
    today: TODAY,
    runId: RUN_ID
  });
  assert.equal(writes.length, 0);
});

test("flipping no->yes-with-link supersedes the prior outstanding find-out action", () => {
  const writes = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("yes-with-link", { evidenceUrl: "https://example.gov.au/plan.pdf" }),
    today: TODAY,
    runId: RUN_ID,
    priorAnswer: { questionId: "q.test.security-plan", value: "no", outstandingActionId: "action-prev-001" }
  });
  const close = writes.find((write) => write.kind === "action-close");
  assert.ok(close, "supersede action close should be planned");
  assert.equal(close && "reason" in close && close.reason, "superseded-by-questionnaire-run/run-test-001");
});

test("determinism: same inputs produce same writes", () => {
  const a = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("no"),
    today: TODAY,
    runId: RUN_ID
  });
  const b = planWritesForAnswer({
    question: makeQuestion(),
    answer: makeAnswer("no"),
    today: TODAY,
    runId: RUN_ID
  });
  assert.deepEqual(a, b);
});

test("planRunWrites returns a stable RunPlan with answer ordering preserved", () => {
  const question1 = makeQuestion({ id: "q.a" });
  const question2 = makeQuestion({ id: "q.b" });
  const pack = {
    packId: "test-pack",
    packVersion: "1.0.0",
    title: "Test",
    description: "Test",
    scope: "starter" as const,
    questions: [question1, question2]
  };
  const plan = planRunWrites({
    pack,
    run: {
      runId: RUN_ID,
      packId: pack.packId,
      packVersion: pack.packVersion,
      mode: "first-run",
      answers: [
        { ...makeAnswer("no"), questionId: "q.a" },
        { ...makeAnswer("yes-with-link", { evidenceUrl: "https://e.gov.au" }), questionId: "q.b" }
      ]
    },
    today: TODAY
  });
  assert.equal(plan.answers.length, 2);
  assert.ok(plan.writes.length > 0);
});

test("answer-all-again mode returns every question even when prior answers exist", () => {
  const question1 = makeQuestion({ id: "q.a" });
  const question2 = makeQuestion({ id: "q.b" });
  const pack = {
    packId: "test-pack",
    packVersion: "1.0.0",
    title: "Test",
    description: "Test",
    scope: "starter" as const,
    questions: [question1, question2]
  };
  const filtered = filterQuestionsForMode({
    pack,
    mode: "answer-all-again",
    priorAnswers: new Map([
      ["q.a", { questionId: "q.a", value: "yes-with-link" as const }],
      ["q.b", { questionId: "q.b", value: "yes-with-link" as const }]
    ]),
    evidenceReviewDue: new Set()
  });
  assert.equal(filtered.length, 2, "answer-all-again must offer every question");
});

test("update-stale-or-changed mode skips questions previously answered yes-with-link unless review is due", () => {
  const question1 = makeQuestion({ id: "q.a" });
  const question2 = makeQuestion({ id: "q.b" });
  const pack = {
    packId: "test-pack",
    packVersion: "1.0.0",
    title: "Test",
    description: "Test",
    scope: "starter" as const,
    questions: [question1, question2]
  };
  const filtered = filterQuestionsForMode({
    pack,
    mode: "update-stale-or-changed",
    priorAnswers: new Map([
      ["q.a", { questionId: "q.a", value: "yes-with-link" as const }],
      ["q.b", { questionId: "q.b", value: "no" as const }]
    ]),
    evidenceReviewDue: new Set()
  });
  assert.deepEqual(
    filtered.map((question) => question.id),
    ["q.b"],
    "only q.b (previously no) should be re-prompted"
  );
});

test("update-stale-or-changed mode includes evidence-review-due questions even when previously yes-with-link", () => {
  const question1 = makeQuestion({ id: "q.a" });
  const pack = {
    packId: "test-pack",
    packVersion: "1.0.0",
    title: "Test",
    description: "Test",
    scope: "starter" as const,
    questions: [question1]
  };
  const filtered = filterQuestionsForMode({
    pack,
    mode: "update-stale-or-changed",
    priorAnswers: new Map([["q.a", { questionId: "q.a", value: "yes-with-link" as const }]]),
    evidenceReviewDue: new Set(["q.a"])
  });
  assert.equal(filtered.length, 1, "stale-review question must be re-prompted");
});
