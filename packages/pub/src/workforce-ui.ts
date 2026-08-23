import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import * as vscode from "vscode";
import { tokensCss } from "@pspf/webview-shell";
import type {
  DevelopmentActivityRecord,
  DevelopmentPlanRecord,
  PersonLearningRecord,
  PubStore,
  RotationMilestoneRecord,
  RotationOpportunityRecord,
  RotationPlacementRecord,
  SkillRecord,
  SuccessionPlanRecord
} from "./store.js";
import {
  buildSafeWorkforceSummary,
  certificationWindow,
  deriveAttentionItems,
  deriveCapabilityCells,
  deriveContinuityRows,
  deriveLearningObligations,
  derivePathwayRows,
  deriveRotationCapacity,
  deriveSkillGaps,
  deriveSuccessionSummaries,
  effectiveLearningState,
  renderSafeWorkforceSummaryHtml,
  renderSafeWorkforceSummaryText
} from "./workforce-domain.js";

export const WORKFORCE_COMMANDS = [
  "pspf.pub.openWorkforcePlanning",
  "pspf.pub.manageLearning",
  "pspf.pub.manageSkills",
  "pspf.pub.manageSuccession",
  "pspf.pub.manageRotations",
  "pspf.pub.copyWorkforceSummary",
  "pspf.pub.exportWorkforceSummaryHtml"
] as const;

export interface WorkforceServices {
  readonly loadStore: () => Promise<PubStore>;
  readonly saveStore: (store: PubStore) => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly openPanel: (title: string, renderer: (store: PubStore) => string) => Promise<void>;
}

export function registerWorkforceCommands(services: WorkforceServices): readonly vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("pspf.pub.openWorkforcePlanning", () =>
      services.openPanel("Workforce planning", renderWorkforceCockpitHtml)
    ),
    vscode.commands.registerCommand("pspf.pub.manageLearning", () => manageLearning(services)),
    vscode.commands.registerCommand("pspf.pub.manageSkills", () => manageSkills(services)),
    vscode.commands.registerCommand("pspf.pub.manageSuccession", () => manageSuccession(services)),
    vscode.commands.registerCommand("pspf.pub.manageRotations", () => manageRotations(services)),
    vscode.commands.registerCommand("pspf.pub.copyWorkforceSummary", () => copyWorkforceSummary(services)),
    vscode.commands.registerCommand("pspf.pub.exportWorkforceSummaryHtml", () => exportWorkforceSummaryHtml(services))
  ];
}

async function manageLearning(services: WorkforceServices): Promise<void> {
  const action = await pickValue("Learning and certifications", [
    ["Create learning requirement", "requirement"],
    ["Record or update learning status", "record"],
    ["Add certification", "certification"]
  ]);
  if (!action) return;
  const store = await services.loadStore();
  if (action === "requirement") {
    const title = await requiredInput("Learning requirement", "Example: Annual security awareness");
    if (!title) return;
    const scopeType = await pickValue("Audience", [
      ["Everyone", "all"],
      ["Team", "team"],
      ["Role", "role"]
    ] as const);
    if (!scopeType) return;
    const selectedScopeId =
      scopeType === "team"
        ? await pickRecordId(store.teams, "Team", "title")
        : scopeType === "role"
          ? await pickRecordId(store.roles, "Role", "title")
          : "";
    if (scopeType !== "all" && !selectedScopeId) return;
    const scopeId = selectedScopeId ?? "";
    const dueDate = await dateInput("Default due date (YYYY-MM-DD)");
    if (dueDate === undefined) return;
    const criticality = await pickValue("Criticality", [
      ["Mandatory", "mandatory"],
      ["Recommended", "recommended"]
    ] as const);
    if (!criticality) return;
    await save(
      services,
      {
        ...store,
        learningRequirements: [
          ...store.learningRequirements,
          { id: id("LRN"), title, scopeType, scopeId, recurrence: "annual", criticality, dueDate, status: "active" }
        ]
      },
      "Created learning requirement."
    );
    return;
  }
  if (action === "record") {
    if (
      !requireCollections(
        store.people.length > 0 && store.learningRequirements.length > 0,
        "Add people and learning requirements first."
      )
    )
      return;
    const personId = await pickRecordId(store.people, "Person", "displayName");
    const requirementId = await pickRecordId(
      store.learningRequirements.filter((item) => item.status === "active"),
      "Requirement",
      "title"
    );
    if (!personId || !requirementId) return;
    const state = await pickValue("Learning state", [
      ["Not started", "not-started"],
      ["In progress", "in-progress"],
      ["Completed", "completed"],
      ["Exempt", "exempt"]
    ] as const);
    if (!state) return;
    const existing = store.personLearningRecords.find(
      (item) => item.personId === personId && item.learningRequirementId === requirementId
    );
    const requirement = store.learningRequirements.find((item) => item.id === requirementId)!;
    const dueDate = await dateInput("Due date (YYYY-MM-DD)", existing?.dueDate || requirement.dueDate);
    if (dueDate === undefined) return;
    const evidenceRef =
      state === "completed" ? await optionalInput("Evidence reference", "Local file or record reference") : "";
    const exemptionReason = state === "exempt" ? await requiredInput("Exemption reason", "Reason for exemption") : "";
    if (state === "exempt" && !exemptionReason) return;
    const record: PersonLearningRecord = {
      id: existing?.id ?? id("PLR"),
      personId,
      learningRequirementId: requirementId,
      dueDate,
      state,
      completedAt: state === "completed" ? today() : "",
      evidenceRef: evidenceRef ?? "",
      exemptionReason: exemptionReason ?? ""
    };
    await save(
      services,
      {
        ...store,
        personLearningRecords: existing
          ? store.personLearningRecords.map((item) => (item.id === existing.id ? record : item))
          : [...store.personLearningRecords, record]
      },
      "Saved learning status."
    );
    return;
  }
  if (!requireCollections(store.people.length > 0, "Add a person first.")) return;
  const personId = await pickRecordId(store.people, "Person", "displayName");
  const credential = await requiredInput("Certification", "Credential name");
  if (!personId || !credential) return;
  const issuer = await optionalInput("Issuer", "Issuing organisation");
  const issuedAt = await dateInput("Issued date (YYYY-MM-DD)");
  const expiresAt = await dateInput("Expiry date (YYYY-MM-DD, optional)");
  if (issuedAt === undefined || expiresAt === undefined) return;
  await save(
    services,
    {
      ...store,
      certifications: [
        ...store.certifications,
        { id: id("CER"), personId, credential, issuer: issuer ?? "", issuedAt, expiresAt, evidenceRef: "", notes: "" }
      ]
    },
    "Added certification."
  );
}

async function manageSkills(services: WorkforceServices): Promise<void> {
  const action = await pickValue("Skills and development", [
    ["Create skill", "skill"],
    ["Set role requirement", "requirement"],
    ["Assess person skill", "assessment"],
    ["Add development activity", "development"]
  ] as const);
  if (!action) return;
  const store = await services.loadStore();
  if (action === "skill") {
    const title = await requiredInput("Skill", "Example: Cyber risk judgement");
    const category = await pickValue("Category", [
      ["Cyber", "cyber"],
      ["Leadership", "leadership"],
      ["AI fluency", "ai-fluency"],
      ["Professional", "professional"],
      ["Other", "other"]
    ] as const);
    if (!title || !category) return;
    const anchors: string[] = [];
    for (let level = 1; level <= 5; level += 1) {
      const anchor = await requiredInput(`Level ${level} behavioural anchor`, `Observable behaviour at level ${level}`);
      if (!anchor) return;
      anchors.push(anchor);
    }
    const skill: SkillRecord = { id: id("SKL"), title, category, levelAnchors: anchors, status: "active" };
    await save(
      services,
      { ...store, skills: [...store.skills, skill] },
      "Created skill with five behavioural anchors."
    );
    return;
  }
  if (!requireCollections(store.skills.length > 0, "Create at least one skill first.")) return;
  const skillId = await pickRecordId(
    store.skills.filter((item) => item.status === "active"),
    "Skill",
    "title"
  );
  if (!skillId) return;
  if (action === "requirement") {
    const roleId = await pickRecordId(
      store.roles.filter((role) => role.status === "active"),
      "Role",
      "title"
    );
    const targetLevel = await pickNumber("Target level", 1, 5);
    if (!roleId || !targetLevel) return;
    const existing = store.roleSkillRequirements.find((item) => item.roleId === roleId && item.skillId === skillId);
    const requirement = {
      id: existing?.id ?? id("RSR"),
      roleId,
      skillId,
      targetLevel,
      importance: "required" as const
    };
    await save(
      services,
      {
        ...store,
        roleSkillRequirements: existing
          ? store.roleSkillRequirements.map((item) => (item.id === existing.id ? requirement : item))
          : [...store.roleSkillRequirements, requirement]
      },
      "Saved role skill requirement."
    );
    return;
  }
  const personId = await pickRecordId(store.people, "Person", "displayName");
  if (!personId) return;
  if (action === "assessment") {
    const level = await pickNumber("Assessed level", 1, 5);
    const source = await pickValue("Assessment source", [
      ["Self", "self"],
      ["Manager", "manager"],
      ["Evidence review", "evidence-review"]
    ] as const);
    if (!level || !source) return;
    const evidenceNote = await optionalInput("Evidence note", "Local-only evidence summary");
    const existing = store.personSkillAssessments.find(
      (item) => item.personId === personId && item.skillId === skillId
    );
    const assessment = {
      id: existing?.id ?? id("PSA"),
      personId,
      skillId,
      level,
      source,
      assessedAt: today(),
      reviewBy: "",
      evidenceNote: evidenceNote ?? ""
    };
    await save(
      services,
      {
        ...store,
        personSkillAssessments: existing
          ? store.personSkillAssessments.map((item) => (item.id === existing.id ? assessment : item))
          : [...store.personSkillAssessments, assessment]
      },
      "Saved skill assessment."
    );
    return;
  }
  const targetRoleId = await pickRecordId(
    store.roles.filter((role) => role.status === "active"),
    "Target role",
    "title"
  );
  const title = await requiredInput("Development activity", "Concrete learning, mentoring or experience activity");
  const activityType = await pickValue("Activity type", [
    ["Learning", "learning"],
    ["Mentoring", "mentoring"],
    ["Stretch assignment", "stretch-assignment"],
    ["Rotation", "rotation"],
    ["Certification", "certification"],
    ["Other", "other"]
  ] as const);
  const dueDate = await dateInput("Due date (YYYY-MM-DD)");
  if (!targetRoleId || !title || !activityType || dueDate === undefined) return;
  const existingPlan = store.developmentPlans.find(
    (plan) => plan.personId === personId && plan.targetRoleId === targetRoleId && plan.status === "active"
  );
  const plan: DevelopmentPlanRecord = existingPlan ?? {
    id: id("DVP"),
    personId,
    targetRoleId,
    status: "active",
    reviewBy: ""
  };
  const activity: DevelopmentActivityRecord = {
    id: id("DVA"),
    developmentPlanId: plan.id,
    skillIds: [skillId],
    activityType,
    title,
    owner: "",
    dueDate,
    status: "planned",
    outcome: ""
  };
  await save(
    services,
    {
      ...store,
      developmentPlans: existingPlan ? store.developmentPlans : [...store.developmentPlans, plan],
      developmentActivities: [...store.developmentActivities, activity]
    },
    "Added development activity. Reassess the skill after completion."
  );
}

async function manageSuccession(services: WorkforceServices): Promise<void> {
  const store = await services.loadStore();
  if (!requireCollections(store.roles.length > 0 && store.people.length > 0, "Add roles and people first.")) return;
  const roleId = await pickRecordId(
    store.roles.filter((role) => role.status === "active"),
    "Role",
    "title"
  );
  const personId = await pickRecordId(store.people, "Candidate", "displayName");
  const readiness = await pickValue("Readiness", [
    ["Ready now", "ready-now"],
    ["Ready in 1-2 years", "1-2-years"],
    ["Development needed", "development-needed"]
  ] as const);
  const planStatus = await pickValue("Plan status", [
    ["Draft", "draft"],
    ["Under review", "under-review"],
    ["Approved", "approved"]
  ] as const);
  if (!roleId || !personId || !readiness || !planStatus) return;
  const rationale = await optionalInput("Evidence and rationale", "Restricted local-only rationale");
  const existing = store.successionPlans.find((plan) => plan.roleId === roleId && plan.status !== "archived");
  const candidates = existing?.candidates.filter((candidate) => candidate.personId !== personId) ?? [];
  const action = planStatus === "approved" ? ("approved" as const) : ("submitted" as const);
  const plan: SuccessionPlanRecord = {
    id: existing?.id ?? id("SCP"),
    roleId,
    criticality: existing?.criticality ?? "important",
    status: planStatus,
    reviewBy: addMonths(today(), 6),
    candidates: [
      ...candidates,
      {
        personId,
        readiness,
        rationale: rationale ?? "",
        developmentPlanId:
          store.developmentPlans.find((item) => item.personId === personId && item.targetRoleId === roleId)?.id ?? "",
        lastReviewedAt: today()
      }
    ],
    reviewHistory: [
      ...(existing?.reviewHistory ?? []),
      { id: id("SCR"), action, at: new Date().toISOString(), reviewerLabel: "Local operator", note: "" }
    ]
  };
  await save(
    services,
    {
      ...store,
      successionPlans: existing
        ? store.successionPlans.map((item) => (item.id === existing.id ? plan : item))
        : [...store.successionPlans, plan]
    },
    "Saved succession review. Candidate identity remains restricted to this workspace."
  );
}

async function manageRotations(services: WorkforceServices): Promise<void> {
  const action = await pickValue("Cyber rotations", [
    ["Create opportunity", "opportunity"],
    ["Start placement", "placement"],
    ["Advance transfer milestone", "milestone"]
  ] as const);
  if (!action) return;
  const store = await services.loadStore();
  if (action === "opportunity") {
    if (!requireCollections(store.teams.length > 0, "Add a host team first.")) return;
    const hostTeamId = await pickRecordId(store.teams, "Host team", "title");
    const title = await requiredInput("Rotation opportunity", "Opportunity title");
    const purpose = await requiredInput("Purpose", "What the secondment will achieve");
    const capacity = await pickNumber("Available places", 1, 20);
    const startDate = await dateInput("Start date (YYYY-MM-DD)");
    const endDate = await dateInput("End date (YYYY-MM-DD)");
    const learningOutcomes = await requiredInput("Learning outcomes", "Separate outcomes with semicolons");
    const transferExpectations = await requiredInput(
      "Return-to-team expectations",
      "Separate commitments with semicolons"
    );
    if (
      !hostTeamId ||
      !title ||
      !purpose ||
      !capacity ||
      startDate === undefined ||
      endDate === undefined ||
      !learningOutcomes ||
      !transferExpectations
    )
      return;
    const opportunity: RotationOpportunityRecord = {
      id: id("ROP"),
      hostTeamId,
      title,
      purpose,
      capacity,
      startDate,
      endDate,
      status: "open",
      requiredSkillIds: [],
      desiredSkillIds: [],
      learningOutcomes: splitList(learningOutcomes),
      transferExpectations: splitList(transferExpectations),
      hostMentorRoleId: "",
      eligibility: "",
      timeCommitment: ""
    };
    await save(
      services,
      { ...store, rotationOpportunities: [...store.rotationOpportunities, opportunity] },
      "Created open rotation opportunity."
    );
    return;
  }
  if (action === "placement") {
    const capacities = deriveRotationCapacity(store).filter((item) => item.available > 0);
    if (
      !requireCollections(
        capacities.length > 0 && store.people.length > 0 && store.teams.length > 0,
        "Add an open opportunity with capacity, people and teams first."
      )
    )
      return;
    const opportunityId = await pickRecordId(
      store.rotationOpportunities.filter((item) => capacities.some((capacity) => capacity.opportunityId === item.id)),
      "Opportunity",
      "title"
    );
    const personId = await pickRecordId(store.people, "Participant", "displayName");
    const homeTeamId = await pickRecordId(store.teams, "Home team", "title");
    if (!opportunityId || !personId || !homeTeamId) return;
    const opportunity = store.rotationOpportunities.find((item) => item.id === opportunityId)!;
    const placement: RotationPlacementRecord = {
      id: id("RPL"),
      opportunityId,
      personId,
      homeTeamId,
      state: "accepted",
      startDate: opportunity.startDate,
      endDate: opportunity.endDate,
      objectives: "",
      milestones: milestoneTemplate(),
      assignmentId: ""
    };
    await save(
      services,
      { ...store, rotationPlacements: [...store.rotationPlacements, placement] },
      "Started rotation placement and return-to-team milestones."
    );
    return;
  }
  const active = store.rotationPlacements.filter((item) => item.state === "accepted" || item.state === "active");
  if (!requireCollections(active.length > 0, "No active rotation placements need milestone updates.")) return;
  const placementId = await pickValue(
    "Placement",
    active.map((placement) => {
      const opportunity = store.rotationOpportunities.find((item) => item.id === placement.opportunityId);
      const person = store.people.find((item) => item.id === placement.personId);
      return [`${opportunity?.title ?? "Rotation"}: ${person?.displayName ?? "Participant"}`, placement.id] as const;
    })
  );
  if (!placementId) return;
  const placement = active.find((item) => item.id === placementId)!;
  const milestone = placement.milestones.find((item) => !item.completedAt);
  if (!milestone) return;
  const outcome = await optionalInput(`${label(milestone.step)} outcome`, "Local-only outcome or lesson");
  const milestones = placement.milestones.map((item) =>
    item.step === milestone.step ? { ...item, completedAt: today(), outcome: outcome ?? "" } : item
  );
  const updated: RotationPlacementRecord = {
    ...placement,
    state: milestone.step === "90-day-review" ? "completed" : "active",
    milestones
  };
  await save(
    services,
    { ...store, rotationPlacements: store.rotationPlacements.map((item) => (item.id === updated.id ? updated : item)) },
    `Completed ${label(milestone.step)} milestone.`
  );
}

async function copyWorkforceSummary(services: WorkforceServices): Promise<void> {
  const store = await services.loadStore();
  await vscode.env.clipboard.writeText(renderSafeWorkforceSummaryText(buildSafeWorkforceSummary(store)));
  vscode.window.showInformationMessage(
    "Copied safe aggregate workforce summary. Person identities and free text were excluded."
  );
}

async function exportWorkforceSummaryHtml(services: WorkforceServices): Promise<void> {
  const confirmation = await vscode.window.showWarningMessage(
    "Export a safe aggregate workforce summary? Person identities, identifiers, evidence, rationale, objectives, and notes are excluded.",
    { modal: true },
    "Export safe HTML"
  );
  if (confirmation !== "Export safe HTML") return;
  const destination = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`pspf-workforce-summary-${today()}.html`),
    filters: { "HTML files": ["html"] },
    saveLabel: "Export safe workforce summary"
  });
  if (!destination) return;
  const summary = buildSafeWorkforceSummary(await services.loadStore());
  await writeFile(destination.fsPath, renderSafeWorkforceSummaryHtml(summary), "utf8");
  vscode.window.showInformationMessage("Exported safe aggregate workforce summary.");
}

export function renderWorkforceCockpitHtml(store: PubStore): string {
  const now = new Date();
  const summary = buildSafeWorkforceSummary(store, now);
  const obligations = deriveLearningObligations(store, now);
  const capability = deriveCapabilityCells(store);
  const continuity = deriveContinuityRows(store, now);
  const pathways = derivePathwayRows(store);
  const attentionItems = deriveAttentionItems(store, now);
  const rotations = deriveRotationCapacity(store);
  const teamOptions = store.teams
    .map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.title)}</option>`)
    .join("");
  const attentionRows =
    attentionItems
      .map((item) => {
        const person = item.personId ? store.people.find((candidate) => candidate.id === item.personId) : undefined;
        const sourceRole = store.roles.find((role) => role.id === item.sourceId);
        const teamId = sourceRole?.teamId ?? personTeamId(store, item.personId);
        return `<tr data-team="${escapeHtml(teamId)}"><td><span class="severity severity-${item.severity}">${escapeHtml(label(item.severity))}</span></td><td>${escapeHtml(attentionReasonLabel(item.reason))}</td><td>${escapeHtml(person?.displayName ?? sourceRole?.title ?? "Organisation")}</td><td>${escapeHtml(item.dueDate || "No date")}</td><td><button class="route" data-command="${item.routeCommand}">Open workflow</button></td></tr>`;
      })
      .join("") || emptyRow(5, "No workforce attention items.");
  const obligationRows =
    obligations
      .map((item) => {
        const person = store.people.find((candidate) => candidate.id === item.personId);
        const requirement = store.learningRequirements.find((candidate) => candidate.id === item.requirementId);
        return `<tr data-team="${escapeHtml(personTeamId(store, item.personId))}"><td>${escapeHtml(person?.displayName ?? "Missing person")}</td><td>${escapeHtml(requirement?.title ?? "Missing requirement")}</td><td>${escapeHtml(item.dueDate || "Not set")}</td><td><span class="status">${escapeHtml(label(item.state))}</span></td></tr>`;
      })
      .join("") || emptyRow(4, "No mandatory learning obligations.");
  const certificationRows =
    store.certifications
      .map(
        (record) =>
          `<tr data-team="${escapeHtml(personTeamId(store, record.personId))}"><td>${escapeHtml(store.people.find((item) => item.id === record.personId)?.displayName ?? "Missing person")}</td><td>${escapeHtml(record.credential)}</td><td>${escapeHtml(record.expiresAt || "No expiry")}</td><td>${escapeHtml(label(certificationWindow(record.expiresAt, now)))}</td></tr>`
      )
      .join("") || emptyRow(4, "No certifications recorded.");
  const peopleCultureRows =
    store.people
      .flatMap((person) => [
        ...person.lifecycle
          .filter((step) => !step.completed)
          .map((step) => ({ person, item: label(step.stepId), reviewBy: "", state: "Incomplete" })),
        ...person.performanceCycles
          .filter((cycle) => cycle.status !== "completed")
          .map((cycle) => ({
            person,
            item: `${cycle.year} performance cycle`,
            reviewBy: cycle.reviewBy,
            state: label(cycle.status)
          }))
      ])
      .map(
        (item) =>
          `<tr data-team="${escapeHtml(personTeamId(store, item.person.id))}"><td>${escapeHtml(item.person.displayName)}</td><td>${escapeHtml(item.item)}</td><td>${escapeHtml(item.reviewBy || "No date")}</td><td>${escapeHtml(item.state)}</td></tr>`
      )
      .join("") || emptyRow(4, "No incomplete lifecycle or performance-cycle items.");
  const capabilityRows =
    capability
      .map((cell) => {
        const team = store.teams.find((item) => item.id === cell.teamId);
        const skill = store.skills.find((item) => item.id === cell.skillId);
        return `<tr data-team="${escapeHtml(cell.teamId)}" data-category="${escapeHtml(skill?.category ?? "other")}"><td>${escapeHtml(team?.title ?? "Missing team")}</td><td>${escapeHtml(skill?.title ?? "Missing skill")}</td><td>${cell.denominator}</td><td>${cell.meetingTarget}</td><td>${cell.belowTarget}</td><td>${cell.notAssessed}</td></tr>`;
      })
      .join("") || emptyRow(6, "No active role skill requirements.");
  const continuityRows =
    continuity
      .map(
        (row) =>
          `<tr data-team="${escapeHtml(row.teamId)}"><td>${escapeHtml(store.teams.find((team) => team.id === row.teamId)?.title ?? "Missing team")}</td><td>${escapeHtml(store.roles.find((role) => role.id === row.roleId)?.title ?? "Missing role")}</td><td>${escapeHtml(label(row.roleState))}</td><td>${escapeHtml(label(row.planState))}</td><td>${row.readiness["ready-now"]}</td><td>${row.readiness["1-2-years"]}</td><td>${row.readiness["development-needed"]}</td></tr>`
      )
      .join("") || emptyRow(7, "No active roles.");
  const rotationRows =
    rotations
      .map(
        (row) =>
          `<tr data-team="${escapeHtml(row.hostTeamId)}"><td>${escapeHtml(store.rotationOpportunities.find((item) => item.id === row.opportunityId)?.title ?? "Missing opportunity")}</td><td>${escapeHtml(store.teams.find((team) => team.id === row.hostTeamId)?.title ?? "Missing team")}</td><td>${row.capacity}</td><td>${row.occupied}</td><td>${row.available}</td></tr>`
      )
      .join("") || emptyRow(5, "No open rotation opportunities.");
  const pathwayRows =
    pathways
      .map((row) => {
        const person = store.people.find((item) => item.id === row.personId);
        const currentRoles = row.currentRoleIds
          .map((roleId) => store.roles.find((role) => role.id === roleId)?.title ?? "Missing role")
          .join(", ");
        const targetRole = store.roles.find((role) => role.id === row.targetRoleId);
        return `<tr data-team="${escapeHtml(targetRole?.teamId ?? "")}"><td>${escapeHtml(person?.displayName ?? "Missing person")}</td><td>${escapeHtml(currentRoles || "No active assignment")}</td><td>${escapeHtml(targetRole?.title ?? "Missing target role")}</td><td>${row.skillGapCount}</td><td>${row.notAssessedCount}</td><td>${row.plannedActivityCount}</td><td>${row.completedActivityCount}</td><td>${row.rotationCount}</td></tr>`;
      })
      .join("") || emptyRow(8, "No active or draft development pathways.");

  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workforce planning</title><style>${tokensCss("extension")}
body{margin:0;padding:20px;max-width:1280px;color:var(--vscode-foreground);background:var(--vscode-editor-background);font-family:var(--vscode-font-family)}
.hero{border-left:4px solid var(--pspf-product-pub);padding:14px 16px;background:color-mix(in srgb,var(--vscode-editor-background) 88%,var(--pspf-product-pub) 12%)}h1,h2,p{margin:0}.hero p{margin-top:6px;max-width:78ch}.toolbar,.filters,.tabs{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:14px}.toolbar button,.tabs button,.route{width:auto;min-height:36px}.filters{padding:12px 0;border-bottom:1px solid var(--vscode-panel-border)}.field{display:grid;gap:4px}.field select{min-width:190px;padding:7px}.check{display:flex;gap:6px;align-items:center;min-height:34px}.tabs{position:sticky;top:0;z-index:2;padding:10px 0;background:var(--vscode-editor-background)}.tabs button[aria-selected="true"]{border-bottom:3px solid var(--pspf-product-pub)}.view{margin-top:18px}.view[hidden]{display:none}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:16px 0}.metric{border-left:3px solid var(--pspf-product-pub);padding:10px 12px;background:var(--vscode-sideBar-background)}.metric strong{display:block;font-size:1.45rem}.table-wrap{overflow:auto;border:1px solid var(--vscode-panel-border);margin-top:10px}table{width:100%;table-layout:fixed;border-collapse:collapse}th,td{text-align:left;padding:var(--pspf-table-cell-pad-y) var(--pspf-table-cell-pad-x);overflow-wrap:anywhere;border-bottom:1px solid var(--vscode-panel-border)}th{background:var(--vscode-sideBar-background)}.status,.severity{white-space:nowrap;font-weight:600}.severity-critical{color:var(--vscode-testing-iconFailed)}.severity-high{color:var(--vscode-editorWarning-foreground)}.subsection{margin-top:24px}.muted{color:var(--vscode-descriptionForeground)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}@media(max-width:700px){body{padding:12px}.tabs{position:static}.tabs button{flex:1 1 140px}}
</style></head><body><header class="hero"><p class="muted">Local-only workforce decision support</p><h1>Workforce planning</h1><p>See what needs attention, where capability is evidenced or missing, which roles lack continuity, and which existing development work can close gaps.</p></header>
<div class="toolbar"><button data-command="pspf.pub.manageLearning">Learning & certifications</button><button data-command="pspf.pub.manageSkills">Skills & development</button><button data-command="pspf.pub.manageSuccession">Succession review</button><button data-command="pspf.pub.manageRotations">Cyber rotations</button><button data-command="pspf.pub.copyWorkforceSummary">Copy safe summary</button><button data-command="pspf.pub.exportWorkforceSummaryHtml">Export safe HTML</button></div>
<div class="filters" aria-label="Workforce filters"><label class="field">Team<select id="team-filter"><option value="">All teams</option>${teamOptions}</select></label><label class="check"><input id="ai-filter" type="checkbox"> AI fluency only</label><span class="muted">Filters stay in this panel and are never exported.</span></div>
<nav class="tabs" role="tablist" aria-label="Workforce planning views">${cockpitTab("overview", "Overview", true)}${cockpitTab("obligations", "Obligations")}${cockpitTab("capability", "Capability")}${cockpitTab("continuity", "Continuity")}${cockpitTab("mobility", "Mobility & career")}</nav>
<main><section class="view" id="view-overview" role="tabpanel" aria-labelledby="tab-overview"><div class="metrics"><div class="metric"><strong>${attentionItems.length}</strong>attention items</div><div class="metric"><strong>${obligations.filter((item) => item.state === "record-missing").length}</strong>missing learning records</div><div class="metric"><strong>${capability.reduce((total, item) => total + item.notAssessed, 0)}</strong>not assessed</div><div class="metric"><strong>${continuity.filter((item) => item.roleState !== "covered").length}</strong>roles needing continuity</div><div class="metric"><strong>${summary.rotations.availablePlaces}</strong>rotation places</div></div>${cockpitTable("Attention queue", ["Priority", "Reason", "Local context", "Due", "Route"], attentionRows)}</section>
<section class="view" id="view-obligations" role="tabpanel" aria-labelledby="tab-obligations" hidden>${cockpitTable("Mandatory learning", ["Person", "Requirement", "Due", "State"], obligationRows)}${cockpitTable("Certification currency", ["Person", "Credential", "Expiry", "Window"], certificationRows, true)}${cockpitTable("Lifecycle and performance review", ["Person", "Item", "Review by", "State"], peopleCultureRows, true)}</section>
<section class="view" id="view-capability" role="tabpanel" aria-labelledby="tab-capability" hidden><p class="muted">Counts represent distinct people in active or rotating assignments. Missing assessment is not zero capability.</p>${cockpitTable("Team capability", ["Team", "Skill", "People", "Meeting target", "Below target", "Not assessed"], capabilityRows)}</section>
<section class="view" id="view-continuity" role="tabpanel" aria-labelledby="tab-continuity" hidden><p class="muted">Role coverage and succession-plan state are separate. Readiness is shown as counts, not a score or ranking.</p>${cockpitTable("Role continuity", ["Team", "Role", "Coverage", "Plan", "Ready now", "1-2 years", "Development needed"], continuityRows)}</section>
<section class="view" id="view-mobility" role="tabpanel" aria-labelledby="tab-mobility" hidden>${cockpitTable("Open Cyber rotations", ["Opportunity", "Host team", "Capacity", "Occupied", "Available"], rotationRows)}<div class="subsection"><p class="muted">Pathway views explain existing records only. They are not recommendations, fit assessments, or promotion decisions.</p>${cockpitTable("Local pathway view", ["Person", "Current role", "Target role", "Skill gaps", "Not assessed", "Planned activities", "Completed activities", "Rotations"], pathwayRows)}</div></section></main>
<script>const vscode=acquireVsCodeApi();const tabs=[...document.querySelectorAll('[role="tab"]')];const panels=[...document.querySelectorAll('[role="tabpanel"]')];function showTab(tab){tabs.forEach(item=>{const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1});panels.forEach(panel=>panel.hidden=panel.id!==tab.getAttribute('aria-controls'));tab.focus()}tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>showTab(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;showTab(tabs[next])})});function applyFilters(){const team=document.getElementById('team-filter').value;const ai=document.getElementById('ai-filter').checked;document.querySelectorAll('tbody tr[data-team]').forEach(row=>{const teamMatch=!team||row.dataset.team===team;const aiMatch=!ai||row.dataset.category==='ai-fluency';row.hidden=!(teamMatch&&aiMatch)})}document.getElementById('team-filter').addEventListener('change',applyFilters);document.getElementById('ai-filter').addEventListener('change',applyFilters);document.addEventListener('click',event=>{const button=event.target.closest('[data-command]');if(button)vscode.postMessage({command:button.dataset.command})});</script></body></html>`;
}

function cockpitTab(idValue: string, text: string, selected = false): string {
  return `<button id="tab-${idValue}" role="tab" aria-selected="${selected}" aria-controls="view-${idValue}" tabindex="${selected ? 0 : -1}">${escapeHtml(text)}</button>`;
}

function cockpitTable(title: string, headings: readonly string[], rows: string, subsection = false): string {
  return `<section class="${subsection ? "subsection" : ""}"><h2>${escapeHtml(title)}</h2><div class="table-wrap"><table><thead><tr>${headings.map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function personTeamId(store: PubStore, personId: string | undefined): string {
  if (!personId) return "";
  const assignment = store.assignments.find(
    (item) =>
      item.personId === personId &&
      (item.status === "active" || item.status === "rotating" || item.status === "needs-backup")
  );
  return store.roles.find((role) => role.id === assignment?.roleId)?.teamId ?? "";
}

function attentionReasonLabel(reason: string): string {
  const labels: Readonly<Record<string, string>> = {
    "learning-record-missing": "Mandatory learning record missing",
    "learning-overdue": "Mandatory learning overdue",
    "certification-expired": "Certification expired",
    "certification-due-30-days": "Certification due within 30 days",
    "certification-due-90-days": "Certification due within 90 days",
    "skill-assessment-overdue": "Skill assessment review overdue",
    "development-activity-overdue": "Development activity overdue",
    "role-vacant": "Role vacant",
    "role-needs-backup": "Role needs backup",
    "succession-plan-missing": "Succession plan missing",
    "succession-review-overdue": "Succession review overdue",
    "rotation-milestone-overdue": "Rotation milestone overdue"
  };
  return labels[reason] ?? label(reason);
}

export function renderWorkforcePlanningHtml(store: PubStore): string {
  const now = new Date();
  const summary = buildSafeWorkforceSummary(store, now);
  const learningRows =
    store.personLearningRecords
      .map((record) => {
        const person = store.people.find((item) => item.id === record.personId);
        const requirement = store.learningRequirements.find((item) => item.id === record.learningRequirementId);
        return `<tr><td>${escapeHtml(person?.displayName ?? "Missing person")}</td><td>${escapeHtml(requirement?.title ?? "Missing requirement")}</td><td>${escapeHtml(record.dueDate || "Not set")}</td><td><span class="status">${escapeHtml(label(effectiveLearningState(record, now)))}</span></td></tr>`;
      })
      .join("") || emptyRow(4, "No learning records yet.");
  const certificationRows =
    store.certifications
      .map(
        (record) =>
          `<tr><td>${escapeHtml(store.people.find((item) => item.id === record.personId)?.displayName ?? "Missing person")}</td><td>${escapeHtml(record.credential)}</td><td>${escapeHtml(record.expiresAt || "No expiry")}</td><td><span class="status">${escapeHtml(label(certificationWindow(record.expiresAt, now)))}</span></td></tr>`
      )
      .join("") || emptyRow(4, "No certifications yet.");
  const gapRows =
    store.assignments
      .flatMap((assignment) => deriveSkillGaps(store, assignment.personId, assignment.roleId))
      .filter((gap) => gap.state !== "meets-target")
      .map(
        (gap) =>
          `<tr><td>${escapeHtml(store.people.find((item) => item.id === gap.personId)?.displayName ?? "Missing person")}</td><td>${escapeHtml(store.skills.find((item) => item.id === gap.skillId)?.title ?? "Missing skill")}</td><td>${gap.targetLevel}</td><td>${gap.assessedLevel ?? "Not assessed"}</td><td>${escapeHtml(label(gap.state))}</td></tr>`
      )
      .join("") || emptyRow(5, "No skill gaps or unassessed requirements.");
  const successionRows =
    deriveSuccessionSummaries(store, now)
      .map(
        (item) =>
          `<tr><td>${escapeHtml(store.roles.find((role) => role.id === item.roleId)?.title ?? "Missing role")}</td><td>${item.readiness["ready-now"]}</td><td>${item.readiness["1-2-years"]}</td><td>${item.readiness["development-needed"]}</td><td>${item.stale ? "Review overdue" : "Current"}</td></tr>`
      )
      .join("") || emptyRow(5, "No approved succession plans.");
  const rotationRows =
    deriveRotationCapacity(store)
      .map(
        (item) =>
          `<tr><td>${escapeHtml(store.rotationOpportunities.find((opportunity) => opportunity.id === item.opportunityId)?.title ?? "Missing opportunity")}</td><td>${escapeHtml(store.teams.find((team) => team.id === item.hostTeamId)?.title ?? "Missing team")}</td><td>${item.capacity}</td><td>${item.occupied}</td><td>${item.available}</td></tr>`
      )
      .join("") || emptyRow(5, "No open rotation opportunities.");
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${tokensCss("extension")}body{padding:24px;max-width:1200px;margin:auto}.hero{border-bottom:3px solid var(--pspf-accent);padding-bottom:16px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.actions button{min-height:36px}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:16px 0}.metric{border:1px solid var(--pspf-border);padding:12px}.metric strong{display:block;font-size:22px}.section{margin-top:28px}.table-wrap{overflow:auto;border:1px solid var(--pspf-border)}table{width:100%;border-collapse:collapse;min-width:680px}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--pspf-border)}th{position:sticky;top:0;background:var(--vscode-editor-background)}.status{white-space:nowrap;font-weight:600}</style></head><body><header class="hero"><p class="eyebrow">Local-only workforce management</p><h1>Workforce planning</h1><p>Manage obligations, capability, succession and Cyber rotations. Person-level information stays in this workspace.</p></header><div class="actions"><button data-command="pspf.pub.manageLearning">Learning & certifications</button><button data-command="pspf.pub.manageSkills">Skills & development</button><button data-command="pspf.pub.manageSuccession">Succession review</button><button data-command="pspf.pub.manageRotations">Cyber rotations</button><button data-command="pspf.pub.copyWorkforceSummary">Copy safe summary</button><button data-command="pspf.pub.exportWorkforceSummaryHtml">Export safe HTML</button></div><div class="metrics"><div class="metric"><strong>${summary.learning.overdue}</strong>overdue learning</div><div class="metric"><strong>${summary.certifications.expired}</strong>expired certifications</div><div class="metric"><strong>${summary.skills.gaps}</strong>skill gaps</div><div class="metric"><strong>${summary.succession.readyNow}</strong>ready-now candidates</div><div class="metric"><strong>${summary.rotations.availablePlaces}</strong>rotation places</div></div>${section("Mandatory learning", ["Person", "Requirement", "Due", "State"], learningRows)}${section("Certifications", ["Person", "Credential", "Expiry", "Window"], certificationRows)}${section("Skills requiring action", ["Person", "Skill", "Target", "Assessed", "State"], gapRows)}${section("Approved succession", ["Role", "Ready now", "1-2 years", "Development needed", "Review"], successionRows)}${section("Open Cyber rotations", ["Opportunity", "Host team", "Capacity", "Occupied", "Available"], rotationRows)}<script>const vscode=acquireVsCodeApi();document.addEventListener('click',event=>{const button=event.target.closest('[data-command]');if(button)vscode.postMessage({command:button.dataset.command});});</script></body></html>`;
}

function section(title: string, headings: readonly string[], rows: string): string {
  return `<section class="section"><h2>${escapeHtml(title)}</h2><div class="table-wrap"><table><thead><tr>${headings.map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function emptyRow(columns: number, message: string): string {
  return `<tr><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}
async function save(services: WorkforceServices, store: PubStore, message: string): Promise<void> {
  await services.saveStore(store);
  await services.refresh();
  vscode.window.showInformationMessage(message);
}
async function requiredInput(title: string, prompt: string): Promise<string | undefined> {
  return vscode.window
    .showInputBox({
      title,
      prompt,
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim() ? undefined : "A value is required.")
    })
    .then((value) => value?.trim());
}
async function optionalInput(title: string, prompt: string): Promise<string | undefined> {
  return vscode.window.showInputBox({ title, prompt, ignoreFocusOut: true }).then((value) => value?.trim());
}
async function dateInput(title: string, value = ""): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title,
    value,
    prompt: "Use YYYY-MM-DD, or leave blank when optional.",
    ignoreFocusOut: true,
    validateInput: (input) => (!input || /^\d{4}-\d{2}-\d{2}$/.test(input) ? undefined : "Use YYYY-MM-DD.")
  });
}
async function pickValue<const T extends string>(
  placeHolder: string,
  values: readonly (readonly [string, T])[]
): Promise<T | undefined> {
  return vscode.window
    .showQuickPick(
      values.map(([labelText, value]) => ({ label: labelText, value })),
      { placeHolder, ignoreFocusOut: true }
    )
    .then((item) => item?.value);
}
async function pickRecordId<T extends { readonly id: string }>(
  records: readonly T[],
  labelText: string,
  key: keyof T
): Promise<string | undefined> {
  return pickValue(
    labelText,
    records.map((record) => [String(record[key]), record.id] as const)
  );
}
async function pickNumber(placeHolder: string, minimum: number, maximum: number): Promise<number | undefined> {
  const value = await pickValue(
    placeHolder,
    Array.from({ length: maximum - minimum + 1 }, (_, index) => String(index + minimum)).map(
      (item) => [item, item] as const
    )
  );
  return value ? Number(value) : undefined;
}
function requireCollections(condition: boolean, message: string): boolean {
  if (!condition) vscode.window.showWarningMessage(message);
  return condition;
}
function id(prefix: string): string {
  return `PUB-${prefix}-${randomUUID()}`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function addMonths(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}
function splitList(value: string): readonly string[] {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}
function milestoneTemplate(): readonly RotationMilestoneRecord[] {
  return ["pre-brief", "cyber-artefact", "home-team-session", "30-day-review", "90-day-review"].map((step) => ({
    step: step as RotationMilestoneRecord["step"],
    completedAt: "",
    outcome: ""
  }));
}
function label(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character
  );
}
