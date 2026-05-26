import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import {
  QUESTIONNAIRE_RUN_DIRECTORY,
  PSPF_DOMAINS,
  withEnvelope,
  type ActionEntity,
  type EvidenceEntity,
  type LinkEntity,
  type QuestionnaireAnswerRecord,
  type QuestionnaireAnswerValue,
  type QuestionnairePack,
  type QuestionnaireQuestion,
  type QuestionnaireRunMode,
  type QuestionnaireRunRecord,
  type RequirementEntity,
  type RiskEntity,
  type V01Entity
} from "@pspf/contracts";
import { QUESTIONNAIRE_DOMAIN_PACKS, QUESTIONNAIRE_STARTER_PACK, getQuestionnairePackById } from "@pspf/reference-data";
import {
  filterQuestionsForMode,
  planRunWrites,
  type PlannedActionWrite,
  type PlannedEvidenceWrite,
  type PlannedRequirementWrite,
  type PlannedRiskWrite,
  type PriorAnswerState
} from "./policy.js";

const ANSWER_ALL_AGAIN_LABEL = "Answer all questions again";

interface AnswerPickItem extends vscode.QuickPickItem {
  readonly value: QuestionnaireAnswerValue;
}

const ANSWER_PICK_ITEMS: ReadonlyArray<AnswerPickItem> = [
  { label: "Yes — and I can provide a link or reference", value: "yes-with-link" },
  { label: "Yes — but I do not have a link to hand", value: "yes" },
  { label: "Partial — some elements are in place", value: "partial" },
  { label: "No", value: "no" },
  { label: "Unknown — needs investigation", value: "unknown" },
  { label: "Not applicable", value: "na" },
  { label: "Skip for now", value: "skipped" }
];

function workspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

function runDirectoryUri(folder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(folder.uri, ...QUESTIONNAIRE_RUN_DIRECTORY.split("/"));
}

async function ensureRunDirectory(folder: vscode.WorkspaceFolder): Promise<vscode.Uri> {
  const directoryUri = runDirectoryUri(folder);
  await vscode.workspace.fs.createDirectory(directoryUri);
  return directoryUri;
}

async function readRunFiles(folder: vscode.WorkspaceFolder): Promise<QuestionnaireRunRecord[]> {
  const directoryUri = runDirectoryUri(folder);
  let entries: ReadonlyArray<[string, vscode.FileType]> = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(directoryUri);
  } catch {
    return [];
  }
  const records: QuestionnaireRunRecord[] = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File || !name.endsWith(".json")) {
      continue;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(directoryUri, name));
      const record = JSON.parse(new TextDecoder().decode(bytes)) as QuestionnaireRunRecord;
      records.push(record);
    } catch {
      // Skip unreadable / malformed run files; do not block the flow.
    }
  }
  records.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return records;
}

async function latestRunForPack(
  folder: vscode.WorkspaceFolder,
  packId: string
): Promise<QuestionnaireRunRecord | undefined> {
  const runs = await readRunFiles(folder);
  return runs.find((run) => run.packId === packId);
}

async function writeRunRecord(folder: vscode.WorkspaceFolder, record: QuestionnaireRunRecord): Promise<void> {
  const directoryUri = await ensureRunDirectory(folder);
  const payload = new TextEncoder().encode(`${JSON.stringify(record, null, 2)}\n`);
  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(directoryUri, `${record.runId}.json`), payload);
}

function domainIdFromFamily(family: QuestionnaireQuestion["domain"]): string {
  const codeByFamily: Record<QuestionnaireQuestion["domain"], string> = {
    GOV: "governance",
    RISK: "security-risk",
    INFO: "information",
    TECH: "technology",
    PER: "personnel",
    PHYS: "physical"
  };
  const code = codeByFamily[family];
  const domain = PSPF_DOMAINS.find((candidate) => candidate.code === code) ?? PSPF_DOMAINS[0]!;
  return domain.id;
}

async function pickMode(hasPriorRun: boolean): Promise<QuestionnaireRunMode | undefined> {
  if (!hasPriorRun) {
    return "first-run";
  }
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "Only the stale or unresolved questions",
        description:
          "Quickest update — re-asks questions whose previous answer was no/partial/unknown, plus any whose evidence review is due.",
        mode: "update-stale-or-changed" as const
      },
      {
        label: "Every question in this pack",
        description: "Walks every question; pre-fills with your previous answers so you can adjust.",
        mode: "update-all-questions" as const
      },
      {
        label: ANSWER_ALL_AGAIN_LABEL,
        description: "Treats this run as a fresh start — clears prefilled values and asks every question again.",
        mode: "answer-all-again" as const
      }
    ],
    { title: "How would you like to update this questionnaire?", ignoreFocusOut: true }
  );
  return choice?.mode;
}

async function askQuestion(
  question: QuestionnaireQuestion,
  index: number,
  total: number,
  previousAnswer?: QuestionnaireAnswerRecord
): Promise<QuestionnaireAnswerRecord | undefined> {
  const previousLabel = previousAnswer ? `  ·  previously: ${previousAnswer.value}` : "";
  const answerPick = await vscode.window.showQuickPick(ANSWER_PICK_ITEMS as AnswerPickItem[], {
    title: `Q${index + 1}/${total} · ${question.domain} · ${question.prompt}${previousLabel}`,
    placeHolder: question.helpText,
    ignoreFocusOut: true
  });
  if (!answerPick) {
    return undefined;
  }
  const record: {
    -readonly [K in keyof QuestionnaireAnswerRecord]: QuestionnaireAnswerRecord[K];
  } = {
    questionId: question.id,
    value: answerPick.value,
    answeredAt: new Date().toISOString()
  };
  if (answerPick.value === "yes-with-link") {
    const url = await vscode.window.showInputBox({
      title: `Evidence link for: ${question.evidenceTemplate.title}`,
      prompt: "Paste a URL or workspace reference. Leave blank to skip and create an attach-evidence action instead.",
      ignoreFocusOut: true
    });
    if (url && url.trim().length > 0) {
      record.evidenceUrl = url.trim();
    } else {
      const note = await vscode.window.showInputBox({
        title: `Note for: ${question.evidenceTemplate.title}`,
        prompt: "Optional internal note (defaults to publication: internal).",
        ignoreFocusOut: true
      });
      if (note && note.trim().length > 0) {
        record.note = note.trim();
      } else {
        // Downgrade to yes-without-link if no evidence supplied.
        record.value = "yes";
      }
    }
  }
  if (answerPick.value === "na") {
    const rationale = await vscode.window.showInputBox({
      title: `Why is this not applicable?`,
      prompt: "Brief rationale stored on the requirement (publication: internal).",
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim().length === 0 ? "Enter a short rationale" : undefined)
    });
    if (!rationale) {
      return undefined;
    }
    record.naRationale = rationale.trim();
  }
  return record;
}

function buildEntitiesForRequirement(write: PlannedRequirementWrite, runId: string): RequirementEntity {
  return withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: `Questionnaire: ${write.requirementRef}`,
      domainId: domainIdFromFamily(domainFromQuestionId(write.questionId)),
      assessmentStatus: write.assessmentStatus,
      summary: write.naRationale
        ? `Marked not applicable via questionnaire run ${runId}: ${write.naRationale}`
        : `Set via questionnaire run ${runId} (${write.requirementRef})`
    },
    "workshop"
  ) as RequirementEntity;
}

function buildEntitiesForEvidence(write: PlannedEvidenceWrite): EvidenceEntity {
  return withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: write.title,
      evidenceType: write.url ? "url" : "note",
      reference: write.url ?? write.note ?? "(internal note)",
      freshness: "current"
    },
    "workshop"
  ) as EvidenceEntity;
}

function buildEntitiesForAction(write: PlannedActionWrite): ActionEntity {
  return withEnvelope(
    "action",
    {
      entityType: "action",
      title: write.title,
      status: "todo",
      dueDate: write.dueDate
    },
    "workshop"
  ) as ActionEntity;
}

function buildEntitiesForRisk(write: PlannedRiskWrite): RiskEntity {
  const likelihoodScore: Record<PlannedRiskWrite["likelihood"], number> = {
    rare: 1,
    unlikely: 2,
    possible: 3,
    likely: 4,
    "almost-certain": 5
  };
  const consequenceScore: Record<PlannedRiskWrite["consequence"], number> = {
    insignificant: 1,
    minor: 2,
    moderate: 3,
    major: 4,
    severe: 5
  };
  return withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: write.title,
      status: "open",
      likelihood: likelihoodScore[write.likelihood],
      impact: consequenceScore[write.consequence]
    },
    "workshop"
  ) as RiskEntity;
}

function _buildLink(
  fromId: string,
  fromType: V01Entity["entityType"],
  toId: string,
  toType: V01Entity["entityType"]
): LinkEntity {
  return withEnvelope(
    "link",
    {
      entityType: "link",
      linkType: "supports",
      fromId,
      fromType,
      toId,
      toType
    },
    "workshop"
  ) as LinkEntity;
}

const QUESTION_DOMAIN_CACHE = new Map<string, QuestionnaireQuestion["domain"]>();

function domainFromQuestionId(questionId: string): QuestionnaireQuestion["domain"] {
  const cached = QUESTION_DOMAIN_CACHE.get(questionId);
  if (cached) {
    return cached;
  }
  const allPacks = [QUESTIONNAIRE_STARTER_PACK, ...QUESTIONNAIRE_DOMAIN_PACKS];
  for (const pack of allPacks) {
    for (const question of pack.questions) {
      QUESTION_DOMAIN_CACHE.set(question.id, question.domain);
    }
  }
  return QUESTION_DOMAIN_CACHE.get(questionId) ?? "GOV";
}

async function runPack(pack: QuestionnairePack): Promise<void> {
  const folder = workspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("PSPF Questionnaire requires an open workspace folder.");
    return;
  }

  const previousRun = await latestRunForPack(folder, pack.packId);
  const mode = await pickMode(Boolean(previousRun));
  if (!mode) {
    return;
  }

  const priorAnswerMap = new Map<string, PriorAnswerState>();
  if (previousRun) {
    for (const prior of previousRun.answers) {
      priorAnswerMap.set(prior.questionId, { questionId: prior.questionId, value: prior.value });
    }
  }

  const questions = filterQuestionsForMode({
    pack,
    mode,
    priorAnswers: priorAnswerMap,
    evidenceReviewDue: new Set()
  });

  if (questions.length === 0) {
    vscode.window.showInformationMessage(
      "No questions to ask in this mode — your posture is up to date for this pack."
    );
    return;
  }

  const answers: QuestionnaireAnswerRecord[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i]!;
    const previousAnswer =
      mode === "answer-all-again" ? undefined : previousRun?.answers.find((entry) => entry.questionId === question.id);
    const answer = await askQuestion(question, i, questions.length, previousAnswer);
    if (!answer) {
      const cancelChoice = await vscode.window.showWarningMessage(
        "Cancel this questionnaire run? Your draft answers will not be saved.",
        "Cancel run",
        "Continue"
      );
      if (cancelChoice !== "Continue") {
        return;
      }
      i -= 1;
      continue;
    }
    answers.push(answer);
  }

  const runId = `qrun-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const record: QuestionnaireRunRecord = {
    runId,
    packId: pack.packId,
    packVersion: pack.packVersion,
    mode,
    startedAt,
    completedAt: startedAt,
    previousRunId: previousRun?.runId,
    answers,
    publicationPolicy: "internal"
  };

  // Review screen.
  const plan = planRunWrites({
    pack,
    run: record,
    priorAnswers: priorAnswerMap,
    today: new Date()
  });

  const requirementCount = plan.writes.filter((write) => write.kind === "requirement-upsert").length;
  const evidenceCount = plan.writes.filter((write) => write.kind === "evidence-create").length;
  const actionCount = plan.writes.filter((write) => write.kind === "action-create").length;
  const riskCount = plan.writes.filter((write) => write.kind === "risk-create").length;
  const supersedeCount = plan.writes.filter((write) => write.kind === "action-close").length;

  const proceed = await vscode.window.showInformationMessage(
    `Apply questionnaire run? ${requirementCount} requirement(s), ${evidenceCount} evidence, ${actionCount} action(s), ${riskCount} risk(s)${
      supersedeCount > 0 ? `, ${supersedeCount} prior action(s) superseded` : ""
    }. A snapshot will be taken before any change.`,
    { modal: true },
    "Apply"
  );
  if (proceed !== "Apply") {
    return;
  }

  // Pre-apply snapshot for audit trail.
  await vscode.commands.executeCommand("pspf.core.createSnapshot", {
    snapshotType: "checkpoint",
    title: `Pre-questionnaire snapshot: ${pack.title} (${runId})`
  });

  // Build and apply entity writes.
  const entitiesToWrite: V01Entity[] = [];
  for (const write of plan.writes) {
    switch (write.kind) {
      case "requirement-upsert": {
        const requirement = buildEntitiesForRequirement(write, runId);
        entitiesToWrite.push(requirement);
        break;
      }
      case "evidence-create": {
        const evidence = buildEntitiesForEvidence(write);
        entitiesToWrite.push(evidence);
        break;
      }
      case "action-create": {
        const action = buildEntitiesForAction(write);
        entitiesToWrite.push(action);
        break;
      }
      case "risk-create": {
        const risk = buildEntitiesForRisk(write);
        entitiesToWrite.push(risk);
        break;
      }
      case "action-close": {
        // Close handled by listing prior actions and updating status.
        try {
          const allActions =
            (await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "action")) ?? [];
          const prior = allActions.find((candidate) => candidate.id === write.priorActionId) as
            | ActionEntity
            | undefined;
          if (prior) {
            entitiesToWrite.push({
              ...prior,
              status: "cancelled",
              commentary: [...(prior.commentary ?? []), { createdAt: new Date().toISOString(), text: write.reason }]
            } as ActionEntity);
          }
        } catch {
          // Ignore lookup failures; supersede is best-effort.
        }
        break;
      }
    }
  }

  if (entitiesToWrite.length > 0) {
    await vscode.commands.executeCommand("pspf.core.upsertEntities", entitiesToWrite);
  }

  await writeRunRecord(folder, record);

  vscode.window.showInformationMessage(
    `Questionnaire applied: ${requirementCount} requirement(s) assessed, ${actionCount} action(s) created. Run saved to ${QUESTIONNAIRE_RUN_DIRECTORY}/${runId}.json.`
  );
}

export async function runQuickstartQuestionnaire(): Promise<void> {
  await runPack(QUESTIONNAIRE_STARTER_PACK);
}

export async function runDomainDeepDive(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    QUESTIONNAIRE_DOMAIN_PACKS.map((pack) => ({
      label: pack.title,
      description: `${pack.questions.length} question(s)`,
      detail: pack.description,
      packId: pack.packId
    })),
    { title: "Choose a Domain deep-dive questionnaire", ignoreFocusOut: true }
  );
  if (!pick) {
    return;
  }
  const pack = getQuestionnairePackById(pick.packId);
  if (!pack) {
    vscode.window.showErrorMessage(`Unknown questionnaire pack: ${pick.packId}`);
    return;
  }
  await runPack(pack);
}

export async function openQuestionnaireHistory(): Promise<void> {
  const folder = workspaceFolder();
  if (!folder) {
    vscode.window.showErrorMessage("PSPF Questionnaire requires an open workspace folder.");
    return;
  }
  const runs = await readRunFiles(folder);
  if (runs.length === 0) {
    vscode.window.showInformationMessage("No questionnaire runs recorded yet. Try PSPF: Run Quickstart Questionnaire.");
    return;
  }
  const pick = await vscode.window.showQuickPick(
    runs.map((run) => ({
      label: `${run.packId} · ${run.mode}`,
      description: run.startedAt,
      detail: `${run.answers.length} answer(s) · runId ${run.runId}`,
      runId: run.runId
    })),
    { title: "Questionnaire history", ignoreFocusOut: true }
  );
  if (!pick) {
    return;
  }
  const uri = vscode.Uri.joinPath(runDirectoryUri(folder), `${pick.runId}.json`);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}
