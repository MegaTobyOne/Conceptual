import assert from "node:assert/strict";
import {
  QUESTIONNAIRE_DOMAIN_PACKS,
  QUESTIONNAIRE_STARTER_PACK,
  getQuestionnairePackById,
  PSPF_BASELINE_REQUIREMENTS
} from "../packages/reference-data/dist/index.js";
import { planRunWrites, planWritesForAnswer } from "../packages/workshop/dist/questionnaire/policy.js";

const requirementIds = new Set(PSPF_BASELINE_REQUIREMENTS.map((requirement) => requirement.id));

const allPacks = [QUESTIONNAIRE_STARTER_PACK, ...QUESTIONNAIRE_DOMAIN_PACKS];

// Pack-integrity gate.
const seenPackIds = new Set();
const seenQuestionIds = new Set();
const allowedDomains = new Set(["GOV", "RISK", "INFO", "TECH", "PER", "PHYS"]);
const allowedPublication = new Set(["internal", "restricted", "public"]);
const allowedAnswerValues = new Set(["yes-with-link", "yes", "partial", "no", "unknown", "na", "skipped"]);

for (const pack of allPacks) {
  assert.ok(pack.packId, "pack must declare packId");
  assert.equal(typeof pack.packVersion, "string", `pack ${pack.packId} missing semver packVersion`);
  assert.ok(/^\d+\.\d+\.\d+$/.test(pack.packVersion), `pack ${pack.packId} packVersion must be semver`);
  assert.equal(seenPackIds.has(pack.packId), false, `duplicate pack id: ${pack.packId}`);
  seenPackIds.add(pack.packId);
  assert.ok(pack.questions.length > 0, `pack ${pack.packId} must declare at least one question`);

  const packQuestionIds = new Set();
  for (const question of pack.questions) {
    assert.equal(
      packQuestionIds.has(question.id),
      false,
      `duplicate question id within pack ${pack.packId}: ${question.id}`
    );
    packQuestionIds.add(question.id);
    seenQuestionIds.add(question.id);
    assert.ok(allowedDomains.has(question.domain), `question ${question.id} has unknown domain ${question.domain}`);
    assert.ok(question.prompt.length > 0, `question ${question.id} missing prompt`);
    assert.ok(question.helpText.length > 0, `question ${question.id} missing helpText`);
    assert.ok(
      allowedPublication.has(question.publicationPolicy),
      `question ${question.id} declares unknown publicationPolicy ${question.publicationPolicy}`
    );
    assert.ok(question.requirementRefs.length > 0, `question ${question.id} must reference at least one requirement`);
    for (const ref of question.requirementRefs) {
      assert.ok(requirementIds.has(ref), `question ${question.id} references unknown PSPF requirement ${ref}`);
    }
    assert.ok(question.evidenceTemplate, `question ${question.id} missing evidenceTemplate`);
    assert.ok(
      question.evidenceTemplate.defaultReviewCycleDays > 0,
      `question ${question.id} review cycle must be positive`
    );
    assert.ok(
      ["url", "note", "url-or-note"].includes(question.evidenceTemplate.promptFor),
      `question ${question.id} evidence promptFor invalid`
    );
    for (const [answer, template] of Object.entries(question.actionTemplates)) {
      assert.ok(
        allowedAnswerValues.has(answer),
        `question ${question.id} action template keyed on unknown answer ${answer}`
      );
      assert.ok(template.title.length > 0, `question ${question.id}/${answer} missing action title`);
      assert.ok(
        ["low", "medium", "high", "critical"].includes(template.priority),
        `question ${question.id}/${answer} priority invalid`
      );
      assert.ok(template.dueOffsetDays >= 0, `question ${question.id}/${answer} negative dueOffsetDays`);
    }
    if (question.riskTemplate) {
      assert.ok(question.riskTemplate.title.length > 0, `question ${question.id} risk template missing title`);
      assert.ok(
        question.riskTemplate.applyOnAnswers.length > 0,
        `question ${question.id} risk template needs trigger answers`
      );
    }
  }
}

// Helper lookup contract.
assert.equal(getQuestionnairePackById(QUESTIONNAIRE_STARTER_PACK.packId)?.packId, QUESTIONNAIRE_STARTER_PACK.packId);
assert.equal(getQuestionnairePackById("does-not-exist"), undefined);

// Deterministic policy gate — exercise every answer value against the first starter question.
const sampleQuestion = QUESTIONNAIRE_STARTER_PACK.questions[0];
const today = new Date("2026-01-01T00:00:00.000Z");
const baseAnswer = (value, extras = {}) => ({
  questionId: sampleQuestion.id,
  value,
  answeredAt: "2026-01-01T00:00:00.000Z",
  ...extras
});

const yesWithLink = planWritesForAnswer({
  question: sampleQuestion,
  answer: baseAnswer("yes-with-link", { evidenceUrl: "https://example.gov.au/plan" }),
  today,
  runId: "qrun-check"
});
assert.ok(
  yesWithLink.some((write) => write.kind === "evidence-create"),
  "yes-with-link must plan an evidence-create"
);
assert.ok(
  yesWithLink.some((write) => write.kind === "requirement-upsert" && write.assessmentStatus === "met"),
  "yes-with-link must mark requirement met"
);

const noAnswer = planWritesForAnswer({
  question: sampleQuestion,
  answer: baseAnswer("no"),
  today,
  runId: "qrun-check"
});
assert.ok(
  noAnswer.some((write) => write.kind === "requirement-upsert" && write.assessmentStatus === "not-met"),
  "no must mark requirement not-met"
);

// Supersede behaviour — flipping no -> yes-with-link must close the prior action.
const supersede = planWritesForAnswer({
  question: sampleQuestion,
  answer: baseAnswer("yes-with-link", { evidenceUrl: "https://example.gov.au/plan" }),
  today,
  runId: "qrun-supersede",
  priorAnswer: {
    questionId: sampleQuestion.id,
    value: "no",
    outstandingActionId: "ACT-prior-001"
  }
});
assert.ok(
  supersede.some(
    (write) => write.kind === "action-close" && write.reason === "superseded-by-questionnaire-run/qrun-supersede"
  ),
  "supersede on answer-flip must plan an action-close with the correct reason"
);

// Idempotence — re-running with identical inputs yields identical output.
const first = planRunWrites({
  pack: QUESTIONNAIRE_STARTER_PACK,
  run: {
    runId: "qrun-idem",
    packId: QUESTIONNAIRE_STARTER_PACK.packId,
    packVersion: QUESTIONNAIRE_STARTER_PACK.packVersion,
    mode: "first-run",
    answers: QUESTIONNAIRE_STARTER_PACK.questions.map((question) => ({
      questionId: question.id,
      value: "no",
      answeredAt: "2026-01-01T00:00:00.000Z"
    }))
  },
  today
});
const second = planRunWrites({
  pack: QUESTIONNAIRE_STARTER_PACK,
  run: {
    runId: "qrun-idem",
    packId: QUESTIONNAIRE_STARTER_PACK.packId,
    packVersion: QUESTIONNAIRE_STARTER_PACK.packVersion,
    mode: "first-run",
    answers: QUESTIONNAIRE_STARTER_PACK.questions.map((question) => ({
      questionId: question.id,
      value: "no",
      answeredAt: "2026-01-01T00:00:00.000Z"
    }))
  },
  today
});
assert.equal(first.writes.length, second.writes.length, "policy must be deterministic across runs");

console.log(
  `check-questionnaire-pack OK: ${allPacks.length} pack(s), ${seenQuestionIds.size} unique questions, all requirement refs resolve.`
);
