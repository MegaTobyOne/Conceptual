import type {
  QuestionnaireAnswerRecord,
  QuestionnaireAnswerValue,
  QuestionnairePack,
  QuestionnaireQuestion,
  QuestionnaireRunMode,
  QuestionnaireRunRecord
} from "@pspf/contracts";

/**
 * Deterministic answer-to-records policy for the v1.33 questionnaire slice.
 * Pure functions: identical inputs always produce identical planned writes.
 * No vscode, no I/O, no Date.now(). All "today" is injected.
 */

export type PlannedRequirementWrite = {
  readonly kind: "requirement-upsert";
  readonly requirementRef: string;
  readonly assessmentStatus: "met" | "partially-met" | "not-met" | "not-applicable";
  readonly naRationale?: string;
  readonly questionId: string;
  readonly publicationPolicy: "internal" | "restricted" | "public";
};

export type PlannedEvidenceWrite = {
  readonly kind: "evidence-create";
  readonly questionId: string;
  readonly requirementRef: string;
  readonly title: string;
  readonly evidenceType: string;
  readonly url?: string;
  readonly note?: string;
  readonly nextReviewDate: string;
  readonly reviewCycleDays: number;
  readonly publicationPolicy: "internal" | "restricted" | "public";
};

export type PlannedActionWrite = {
  readonly kind: "action-create";
  readonly questionId: string;
  readonly requirementRef: string;
  readonly title: string;
  readonly priority: "low" | "medium" | "high" | "critical";
  readonly dueDate: string;
  readonly purpose: "attach-evidence" | "review-cycle" | "remediate" | "investigate";
  readonly publicationPolicy: "internal" | "restricted" | "public";
};

export type PlannedRiskWrite = {
  readonly kind: "risk-create";
  readonly questionId: string;
  readonly requirementRef: string;
  readonly title: string;
  readonly likelihood: "rare" | "unlikely" | "possible" | "likely" | "almost-certain";
  readonly consequence: "insignificant" | "minor" | "moderate" | "major" | "severe";
  readonly publicationPolicy: "internal" | "restricted" | "public";
};

export type PlannedActionClose = {
  readonly kind: "action-close";
  readonly questionId: string;
  readonly priorActionId: string;
  readonly reason: string;
};

export type PlannedWrite =
  | PlannedRequirementWrite
  | PlannedEvidenceWrite
  | PlannedActionWrite
  | PlannedRiskWrite
  | PlannedActionClose;

export interface PriorAnswerState {
  readonly questionId: string;
  readonly value: QuestionnaireAnswerValue;
  readonly outstandingActionId?: string;
}

export interface PolicyInput {
  readonly question: QuestionnaireQuestion;
  readonly answer: QuestionnaireAnswerRecord;
  readonly today: Date;
  readonly priorAnswer?: PriorAnswerState;
  readonly runId: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function offsetDateIso(today: Date, days: number): string {
  const next = new Date(today.getTime() + days * MS_PER_DAY);
  return next.toISOString().slice(0, 10);
}

function assessmentForAnswer(value: QuestionnaireAnswerValue): PlannedRequirementWrite["assessmentStatus"] | undefined {
  switch (value) {
    case "yes-with-link":
      return "met";
    case "yes":
      return "partially-met";
    case "partial":
      return "partially-met";
    case "no":
      return "not-met";
    case "na":
      return "not-applicable";
    case "unknown":
    case "skipped":
      return undefined;
  }
}

export function planWritesForAnswer(input: PolicyInput): ReadonlyArray<PlannedWrite> {
  const { question, answer, today, priorAnswer, runId } = input;
  const writes: PlannedWrite[] = [];
  const publicationPolicy = question.publicationPolicy;

  if (answer.value === "skipped") {
    return writes;
  }

  // 1. Requirement assessment per Domain anchor.
  for (const requirementRef of question.requirementRefs) {
    const status = assessmentForAnswer(answer.value);
    if (status !== undefined) {
      writes.push({
        kind: "requirement-upsert",
        requirementRef,
        assessmentStatus: status,
        naRationale: answer.value === "na" ? answer.naRationale : undefined,
        questionId: question.id,
        publicationPolicy
      });
    }
  }

  const primaryRequirementRef = question.requirementRefs[0] ?? "";

  // 2. Evidence creation when the operator supplied a link or note for a "yes-with-link" answer.
  if (answer.value === "yes-with-link" && (answer.evidenceUrl || answer.note)) {
    const cycle = question.evidenceTemplate.defaultReviewCycleDays;
    writes.push({
      kind: "evidence-create",
      questionId: question.id,
      requirementRef: primaryRequirementRef,
      title: question.evidenceTemplate.title,
      evidenceType: question.evidenceTemplate.type,
      url: answer.evidenceUrl,
      note: answer.note,
      nextReviewDate: offsetDateIso(today, cycle),
      reviewCycleDays: cycle,
      publicationPolicy
    });
    // Review-cycle Action paired with the new Evidence.
    writes.push({
      kind: "action-create",
      questionId: question.id,
      requirementRef: primaryRequirementRef,
      title: `Review evidence: ${question.evidenceTemplate.title}`,
      priority: "low",
      dueDate: offsetDateIso(today, cycle),
      purpose: "review-cycle",
      publicationPolicy
    });
  }

  // 3. Action templates per answer (no Action emitted for na / yes-with-link beyond review-cycle).
  const actionTemplate = question.actionTemplates[answer.value];
  if (actionTemplate) {
    const purpose: PlannedActionWrite["purpose"] =
      answer.value === "yes"
        ? "attach-evidence"
        : answer.value === "no" || answer.value === "partial"
          ? "remediate"
          : "investigate";
    writes.push({
      kind: "action-create",
      questionId: question.id,
      requirementRef: primaryRequirementRef,
      title: actionTemplate.title,
      priority: actionTemplate.priority,
      dueDate: offsetDateIso(today, actionTemplate.dueOffsetDays),
      purpose,
      publicationPolicy
    });
  }

  // 4. Risk creation when the question's risk template matches the answer.
  if (question.riskTemplate && question.riskTemplate.applyOnAnswers.includes(answer.value)) {
    writes.push({
      kind: "risk-create",
      questionId: question.id,
      requirementRef: primaryRequirementRef,
      title: question.riskTemplate.title,
      likelihood: question.riskTemplate.likelihood,
      consequence: question.riskTemplate.consequence,
      publicationPolicy
    });
  }

  // 5. Supersede prior outstanding Action when answer flips towards better posture.
  if (priorAnswer && priorAnswer.outstandingActionId) {
    const previouslyOutstanding =
      priorAnswer.value === "no" || priorAnswer.value === "unknown" || priorAnswer.value === "partial";
    const nowResolved = answer.value === "yes-with-link" || answer.value === "yes" || answer.value === "na";
    if (previouslyOutstanding && nowResolved) {
      writes.push({
        kind: "action-close",
        questionId: question.id,
        priorActionId: priorAnswer.outstandingActionId,
        reason: `superseded-by-questionnaire-run/${runId}`
      });
    }
  }

  return writes;
}

export interface RunPlan {
  readonly runId: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly mode: QuestionnaireRunMode;
  readonly writes: ReadonlyArray<PlannedWrite>;
  readonly answers: ReadonlyArray<QuestionnaireAnswerRecord>;
}

export function planRunWrites(args: {
  readonly pack: QuestionnairePack;
  readonly run: Pick<QuestionnaireRunRecord, "runId" | "packId" | "packVersion" | "mode" | "answers">;
  readonly priorAnswers?: ReadonlyMap<string, PriorAnswerState>;
  readonly today: Date;
}): RunPlan {
  const writes: PlannedWrite[] = [];
  for (const answer of args.run.answers) {
    const question = args.pack.questions.find((candidate) => candidate.id === answer.questionId);
    if (!question) {
      continue;
    }
    const prior = args.priorAnswers?.get(answer.questionId);
    const subset = planWritesForAnswer({
      question,
      answer,
      today: args.today,
      priorAnswer: prior,
      runId: args.run.runId
    });
    writes.push(...subset);
  }
  return {
    runId: args.run.runId,
    packId: args.run.packId,
    packVersion: args.run.packVersion,
    mode: args.run.mode,
    writes,
    answers: args.run.answers
  };
}

/**
 * Decide which questions to present on an update run.
 * `update-stale-or-changed` filters; `update-all-questions` and
 * `answer-all-again` (first-run-style) return every question.
 */
export function filterQuestionsForMode(args: {
  readonly pack: QuestionnairePack;
  readonly mode: QuestionnaireRunMode;
  readonly priorAnswers: ReadonlyMap<string, PriorAnswerState>;
  readonly evidenceReviewDue: ReadonlySet<string>;
}): ReadonlyArray<QuestionnaireQuestion> {
  if (args.mode === "first-run" || args.mode === "update-all-questions" || args.mode === "answer-all-again") {
    return args.pack.questions;
  }
  // update-stale-or-changed: include if no prior answer, or prior answer was no/partial/unknown,
  // or evidence review is due.
  return args.pack.questions.filter((question) => {
    const prior = args.priorAnswers.get(question.id);
    if (!prior) {
      return true;
    }
    if (prior.value === "no" || prior.value === "partial" || prior.value === "unknown" || prior.value === "skipped") {
      return true;
    }
    if (args.evidenceReviewDue.has(question.id)) {
      return true;
    }
    return false;
  });
}
