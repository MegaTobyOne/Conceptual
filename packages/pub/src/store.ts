import { randomUUID } from "node:crypto";

export const PUB_STORE_VERSION = "1.3.0";
export const PUB_STORE_BASELINE_VERSION = "1.1.0";
export const STAKEHOLDER_TYPES = ["staff", "service-provider", "customer", "partner", "other"] as const;
export const ASSIGNMENT_STATUSES = ["active", "planned", "rotating", "needs-backup"] as const;
export const ROLE_STATUSES = ["active", "archived"] as const;
export const PERSON_LIFECYCLE_STEPS = ["acceptable-use", "orientation", "probation", "separation"] as const;
export const PERFORMANCE_CYCLE_STATUSES = ["planned", "in-progress", "completed", "at-risk"] as const;

export type StakeholderType = (typeof STAKEHOLDER_TYPES)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type RoleStatus = (typeof ROLE_STATUSES)[number];
export type PersonLifecycleStepId = (typeof PERSON_LIFECYCLE_STEPS)[number];
export type PerformanceCycleStatus = (typeof PERFORMANCE_CYCLE_STATUSES)[number];
export type SuccessionReadiness = "ready-now" | "1-2-years" | "development-needed";

export interface PersonLifecycleRecord {
  readonly stepId: PersonLifecycleStepId;
  readonly completed: boolean;
  readonly completedAt: string;
  readonly notes: string;
}

export interface PerformanceCycleRecord {
  readonly id: string;
  readonly year: string;
  readonly status: PerformanceCycleStatus;
  readonly mandatoryBehaviours: string;
  readonly roleSpecificCapabilities: string;
  readonly personalGoals: string;
  readonly targets: string;
  readonly courses: string;
  readonly certifications: string;
  readonly reviewBy: string;
}

export interface PersonRecord {
  readonly id: string;
  readonly displayName: string;
  readonly stakeholderType: StakeholderType;
  readonly organisation: string;
  readonly currentRole: string;
  readonly resumeUrl: string;
  readonly resumeText: string;
  readonly nextMilestone: string;
  readonly nextAction: string;
  readonly lifecycle: readonly PersonLifecycleRecord[];
  readonly performanceCycles: readonly PerformanceCycleRecord[];
  readonly notes: string;
}

export interface RoleRecord {
  readonly id: string;
  readonly title: string;
  readonly teamId: string;
  readonly status: RoleStatus;
  readonly reportsToRoleId: string;
  readonly functionalOutcome: string;
  readonly contribution: string;
  readonly positionDescriptionUrl: string;
  readonly positionDescriptionText: string;
}

export interface TeamRecord {
  readonly id: string;
  readonly title: string;
  readonly parentTeamId: string;
  readonly ownedControlRefs: readonly string[];
  readonly ownedRequirementRefs: readonly string[];
  readonly controlSetRefs: readonly string[];
  readonly teamItems: readonly TeamItemRecord[];
  readonly responsibility: string;
  readonly notes: string;
}

export interface TeamItemRecord {
  readonly id: string;
  readonly title: string;
  readonly itemType: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly includeInPlan: boolean;
  readonly notes: string;
}

export interface AssignmentRecord {
  readonly id: string;
  readonly personId: string;
  readonly roleId: string;
  readonly status: AssignmentStatus;
  readonly allocation: string;
  readonly reviewBy: string;
  readonly badge: string;
}

export interface RelationshipNoteRecord {
  readonly id: string;
  readonly personId: string;
  readonly createdAt: string;
  readonly summary: string;
  readonly nextContactAt: string;
}

export interface LearningRequirementRecord {
  readonly id: string;
  readonly title: string;
  readonly scopeType: "all" | "team" | "role";
  readonly scopeId: string;
  readonly recurrence: "once" | "annual";
  readonly criticality: "mandatory" | "recommended";
  readonly dueDate: string;
  readonly status: "active" | "archived";
}

export interface PersonLearningRecord {
  readonly id: string;
  readonly personId: string;
  readonly learningRequirementId: string;
  readonly dueDate: string;
  readonly state: "not-started" | "in-progress" | "completed" | "overdue" | "exempt";
  readonly completedAt: string;
  readonly evidenceRef: string;
  readonly exemptionReason: string;
}

export interface CertificationRecord {
  readonly id: string;
  readonly personId: string;
  readonly credential: string;
  readonly issuer: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly evidenceRef: string;
  readonly notes: string;
}

export interface SkillRecord {
  readonly id: string;
  readonly title: string;
  readonly category: "cyber" | "leadership" | "ai-fluency" | "professional" | "other";
  readonly levelAnchors: readonly string[];
  readonly status: "active" | "archived";
}

export interface RoleSkillRequirementRecord {
  readonly id: string;
  readonly roleId: string;
  readonly skillId: string;
  readonly targetLevel: number;
  readonly importance: "required" | "desired";
}

export interface PersonSkillAssessmentRecord {
  readonly id: string;
  readonly personId: string;
  readonly skillId: string;
  readonly level: number;
  readonly source: "self" | "manager" | "evidence-review";
  readonly assessedAt: string;
  readonly reviewBy: string;
  readonly evidenceNote: string;
}

export interface DevelopmentPlanRecord {
  readonly id: string;
  readonly personId: string;
  readonly targetRoleId: string;
  readonly status: "draft" | "active" | "completed" | "archived";
  readonly reviewBy: string;
}

export interface DevelopmentActivityRecord {
  readonly id: string;
  readonly developmentPlanId: string;
  readonly skillIds: readonly string[];
  readonly activityType: "learning" | "mentoring" | "stretch-assignment" | "rotation" | "certification" | "other";
  readonly title: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: "planned" | "in-progress" | "completed" | "cancelled";
  readonly outcome: string;
}

export interface SuccessionPlanRecord {
  readonly id: string;
  readonly roleId: string;
  readonly criticality: "critical" | "important" | "standard";
  readonly status: "draft" | "under-review" | "approved" | "archived";
  readonly reviewBy: string;
  readonly candidates: readonly {
    readonly personId: string;
    readonly readiness: SuccessionReadiness;
    readonly rationale: string;
    readonly developmentPlanId: string;
    readonly lastReviewedAt: string;
  }[];
  readonly reviewHistory: readonly {
    readonly id: string;
    readonly action: "submitted" | "approved" | "returned" | "archived";
    readonly at: string;
    readonly reviewerLabel: string;
    readonly note: string;
  }[];
}

export interface RotationOpportunityRecord {
  readonly id: string;
  readonly hostTeamId: string;
  readonly title: string;
  readonly purpose: string;
  readonly capacity: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: "draft" | "open" | "closed" | "completed" | "cancelled";
  readonly requiredSkillIds: readonly string[];
  readonly desiredSkillIds: readonly string[];
  readonly learningOutcomes: readonly string[];
  readonly transferExpectations: readonly string[];
  readonly hostMentorRoleId: string;
  readonly eligibility: string;
  readonly timeCommitment: string;
}

export interface RotationMilestoneRecord {
  readonly step: "pre-brief" | "cyber-artefact" | "home-team-session" | "30-day-review" | "90-day-review";
  readonly completedAt: string;
  readonly outcome: string;
}

export interface RotationPlacementRecord {
  readonly id: string;
  readonly opportunityId: string;
  readonly personId: string;
  readonly homeTeamId: string;
  readonly state: "nominated" | "accepted" | "active" | "completed" | "withdrawn";
  readonly startDate: string;
  readonly endDate: string;
  readonly objectives: string;
  readonly milestones: readonly RotationMilestoneRecord[];
  readonly assignmentId: string;
}

export interface WorkforceCollections {
  readonly learningRequirements: readonly LearningRequirementRecord[];
  readonly personLearningRecords: readonly PersonLearningRecord[];
  readonly certifications: readonly CertificationRecord[];
  readonly skills: readonly SkillRecord[];
  readonly roleSkillRequirements: readonly RoleSkillRequirementRecord[];
  readonly personSkillAssessments: readonly PersonSkillAssessmentRecord[];
  readonly developmentPlans: readonly DevelopmentPlanRecord[];
  readonly developmentActivities: readonly DevelopmentActivityRecord[];
  readonly successionPlans: readonly SuccessionPlanRecord[];
  readonly rotationOpportunities: readonly RotationOpportunityRecord[];
  readonly rotationPlacements: readonly RotationPlacementRecord[];
}

export interface PubStore extends WorkforceCollections {
  readonly pubStoreVersion: string;
  readonly updatedAt: string;
  readonly people: readonly PersonRecord[];
  readonly teams: readonly TeamRecord[];
  readonly roles: readonly RoleRecord[];
  readonly assignments: readonly AssignmentRecord[];
  readonly relationshipNotes: readonly RelationshipNoteRecord[];
}

export interface StoreValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class UnsupportedPubStoreVersionError extends Error {
  constructor(readonly storeVersion: string) {
    super(
      `Pub store version ${storeVersion} is newer than supported version ${PUB_STORE_VERSION}. Update PSPF Pub before opening this store.`
    );
    this.name = "UnsupportedPubStoreVersionError";
  }
}

export function emptyStore(now = new Date()): PubStore {
  return {
    pubStoreVersion: PUB_STORE_VERSION,
    updatedAt: now.toISOString(),
    people: [],
    teams: [],
    roles: [],
    assignments: [],
    relationshipNotes: [],
    ...emptyWorkforceCollections()
  };
}

export function emptyWorkforceCollections(): WorkforceCollections {
  return {
    learningRequirements: [],
    personLearningRecords: [],
    certifications: [],
    skills: [],
    roleSkillRequirements: [],
    personSkillAssessments: [],
    developmentPlans: [],
    developmentActivities: [],
    successionPlans: [],
    rotationOpportunities: [],
    rotationPlacements: []
  };
}

export function migrateAndNormaliseStore(value: unknown, now = new Date()): PubStore {
  const source = isRecord(value) ? value : {};
  const version = typeof source.pubStoreVersion === "string" ? source.pubStoreVersion : PUB_STORE_BASELINE_VERSION;
  if (!isSupportedVersion(version)) {
    throw new UnsupportedPubStoreVersionError(version);
  }
  return normaliseStore({ ...source, pubStoreVersion: PUB_STORE_VERSION }, now);
}

export function normaliseStore(value: unknown, now = new Date()): PubStore {
  const store = isRecord(value) ? value : {};
  const teams = normaliseTeams(store);
  return {
    pubStoreVersion: PUB_STORE_VERSION,
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : now.toISOString(),
    people: normalisePeople(store.people),
    teams,
    roles: normaliseRoles(store.roles, teams),
    assignments: normaliseAssignments(store.assignments),
    relationshipNotes: normaliseRelationshipNotes(store.relationshipNotes),
    learningRequirements: records(store.learningRequirements).map(normaliseLearningRequirement),
    personLearningRecords: records(store.personLearningRecords).map(normalisePersonLearningRecord),
    certifications: records(store.certifications).map(normaliseCertification),
    skills: records(store.skills).map(normaliseSkill),
    roleSkillRequirements: records(store.roleSkillRequirements).map(normaliseRoleSkillRequirement),
    personSkillAssessments: records(store.personSkillAssessments).map(normalisePersonSkillAssessment),
    developmentPlans: records(store.developmentPlans).map(normaliseDevelopmentPlan),
    developmentActivities: records(store.developmentActivities).map(normaliseDevelopmentActivity),
    successionPlans: records(store.successionPlans).map(normaliseSuccessionPlan),
    rotationOpportunities: records(store.rotationOpportunities).map(normaliseRotationOpportunity),
    rotationPlacements: records(store.rotationPlacements).map(normaliseRotationPlacement)
  };
}

export function validateStore(store: PubStore): readonly StoreValidationIssue[] {
  const issues: StoreValidationIssue[] = [];
  const people = new Set(store.people.map((person) => person.id));
  const teams = new Set(store.teams.map((team) => team.id));
  const roles = new Set(store.roles.map((role) => role.id));
  const skills = new Set(store.skills.map((skill) => skill.id));
  const learningRequirements = new Set(store.learningRequirements.map((item) => item.id));
  const developmentPlans = new Set(store.developmentPlans.map((plan) => plan.id));
  const opportunities = new Set(store.rotationOpportunities.map((opportunity) => opportunity.id));
  addDuplicateIssues(
    issues,
    "people",
    store.people.map((person) => person.id)
  );
  addDuplicateIssues(
    issues,
    "teams",
    store.teams.map((team) => team.id)
  );
  addDuplicateIssues(
    issues,
    "roles",
    store.roles.map((role) => role.id)
  );
  addDuplicateIssues(
    issues,
    "assignments",
    store.assignments.map((assignment) => assignment.id)
  );
  addDuplicateIssues(
    issues,
    "relationshipNotes",
    store.relationshipNotes.map((note) => note.id)
  );
  for (const [collection, ids] of Object.entries({
    learningRequirements: store.learningRequirements.map((item) => item.id),
    personLearningRecords: store.personLearningRecords.map((item) => item.id),
    certifications: store.certifications.map((item) => item.id),
    skills: store.skills.map((item) => item.id),
    roleSkillRequirements: store.roleSkillRequirements.map((item) => item.id),
    personSkillAssessments: store.personSkillAssessments.map((item) => item.id),
    developmentPlans: store.developmentPlans.map((item) => item.id),
    developmentActivities: store.developmentActivities.map((item) => item.id),
    successionPlans: store.successionPlans.map((item) => item.id),
    rotationOpportunities: store.rotationOpportunities.map((item) => item.id),
    rotationPlacements: store.rotationPlacements.map((item) => item.id)
  })) {
    addDuplicateIssues(issues, collection, ids);
  }

  store.teams.forEach((team, index) => {
    if (team.parentTeamId && !teams.has(team.parentTeamId)) {
      issues.push({
        path: `teams[${index}].parentTeamId`,
        message: `Team ${team.id} references missing parent ${team.parentTeamId}.`
      });
    }
    if (team.parentTeamId === team.id) {
      issues.push({ path: `teams[${index}].parentTeamId`, message: `Team ${team.id} cannot be its own parent.` });
    }
  });
  addCycleIssues(
    issues,
    "teams",
    store.teams.map((team) => ({ id: team.id, parentId: team.parentTeamId }))
  );

  store.roles.forEach((role, index) => {
    if (role.teamId && !teams.has(role.teamId)) {
      issues.push({
        path: `roles[${index}].teamId`,
        message: `Role ${role.id} references missing team ${role.teamId}.`
      });
    }
    if (role.reportsToRoleId && !roles.has(role.reportsToRoleId)) {
      issues.push({
        path: `roles[${index}].reportsToRoleId`,
        message: `Role ${role.id} reports to missing role ${role.reportsToRoleId}.`
      });
    }
    if (role.reportsToRoleId === role.id) {
      issues.push({ path: `roles[${index}].reportsToRoleId`, message: `Role ${role.id} cannot report to itself.` });
    }
  });
  addCycleIssues(
    issues,
    "roles",
    store.roles.map((role) => ({ id: role.id, parentId: role.reportsToRoleId }))
  );

  store.assignments.forEach((assignment, index) => {
    if (!people.has(assignment.personId)) {
      issues.push({
        path: `assignments[${index}].personId`,
        message: `Assignment ${assignment.id} references missing person ${assignment.personId}.`
      });
    }
    if (!roles.has(assignment.roleId)) {
      issues.push({
        path: `assignments[${index}].roleId`,
        message: `Assignment ${assignment.id} references missing role ${assignment.roleId}.`
      });
    }
  });
  store.relationshipNotes.forEach((note, index) => {
    if (!people.has(note.personId)) {
      issues.push({
        path: `relationshipNotes[${index}].personId`,
        message: `Relationship note ${note.id} references missing person ${note.personId}.`
      });
    }
  });
  store.learningRequirements.forEach((requirement, index) => {
    if (requirement.scopeType === "team" && !teams.has(requirement.scopeId)) {
      issues.push({
        path: `learningRequirements[${index}].scopeId`,
        message: `Learning requirement ${requirement.id} references missing team ${requirement.scopeId}.`
      });
    }
    if (requirement.scopeType === "role" && !roles.has(requirement.scopeId)) {
      issues.push({
        path: `learningRequirements[${index}].scopeId`,
        message: `Learning requirement ${requirement.id} references missing role ${requirement.scopeId}.`
      });
    }
  });
  store.personLearningRecords.forEach((record, index) => {
    requireReference(
      issues,
      `personLearningRecords[${index}].personId`,
      record.personId,
      people,
      `Learning record ${record.id}`,
      "person"
    );
    requireReference(
      issues,
      `personLearningRecords[${index}].learningRequirementId`,
      record.learningRequirementId,
      learningRequirements,
      `Learning record ${record.id}`,
      "learning requirement"
    );
  });
  store.certifications.forEach((record, index) => {
    requireReference(
      issues,
      `certifications[${index}].personId`,
      record.personId,
      people,
      `Certification ${record.id}`,
      "person"
    );
    addDateOrderIssue(issues, `certifications[${index}]`, record.issuedAt, record.expiresAt);
  });
  store.skills.forEach((skill, index) => {
    if (skill.levelAnchors.length !== 5 || skill.levelAnchors.some((anchor) => !anchor.trim())) {
      issues.push({
        path: `skills[${index}].levelAnchors`,
        message: `Skill ${skill.id} requires five non-empty behavioural level anchors.`
      });
    }
  });
  store.roleSkillRequirements.forEach((requirement, index) => {
    requireReference(
      issues,
      `roleSkillRequirements[${index}].roleId`,
      requirement.roleId,
      roles,
      `Role skill requirement ${requirement.id}`,
      "role"
    );
    requireReference(
      issues,
      `roleSkillRequirements[${index}].skillId`,
      requirement.skillId,
      skills,
      `Role skill requirement ${requirement.id}`,
      "skill"
    );
    addLevelIssue(issues, `roleSkillRequirements[${index}].targetLevel`, requirement.targetLevel);
  });
  store.personSkillAssessments.forEach((assessment, index) => {
    requireReference(
      issues,
      `personSkillAssessments[${index}].personId`,
      assessment.personId,
      people,
      `Skill assessment ${assessment.id}`,
      "person"
    );
    requireReference(
      issues,
      `personSkillAssessments[${index}].skillId`,
      assessment.skillId,
      skills,
      `Skill assessment ${assessment.id}`,
      "skill"
    );
    addLevelIssue(issues, `personSkillAssessments[${index}].level`, assessment.level);
  });
  store.developmentPlans.forEach((plan, index) => {
    requireReference(
      issues,
      `developmentPlans[${index}].personId`,
      plan.personId,
      people,
      `Development plan ${plan.id}`,
      "person"
    );
    if (plan.targetRoleId)
      requireReference(
        issues,
        `developmentPlans[${index}].targetRoleId`,
        plan.targetRoleId,
        roles,
        `Development plan ${plan.id}`,
        "role"
      );
  });
  store.developmentActivities.forEach((activity, index) => {
    requireReference(
      issues,
      `developmentActivities[${index}].developmentPlanId`,
      activity.developmentPlanId,
      developmentPlans,
      `Development activity ${activity.id}`,
      "development plan"
    );
    activity.skillIds.forEach((skillId) =>
      requireReference(
        issues,
        `developmentActivities[${index}].skillIds`,
        skillId,
        skills,
        `Development activity ${activity.id}`,
        "skill"
      )
    );
  });
  store.successionPlans.forEach((plan, index) => {
    requireReference(
      issues,
      `successionPlans[${index}].roleId`,
      plan.roleId,
      roles,
      `Succession plan ${plan.id}`,
      "role"
    );
    plan.candidates.forEach((candidate, candidateIndex) => {
      requireReference(
        issues,
        `successionPlans[${index}].candidates[${candidateIndex}].personId`,
        candidate.personId,
        people,
        `Succession plan ${plan.id}`,
        "person"
      );
      if (candidate.developmentPlanId)
        requireReference(
          issues,
          `successionPlans[${index}].candidates[${candidateIndex}].developmentPlanId`,
          candidate.developmentPlanId,
          developmentPlans,
          `Succession plan ${plan.id}`,
          "development plan"
        );
    });
  });
  store.rotationOpportunities.forEach((opportunity, index) => {
    requireReference(
      issues,
      `rotationOpportunities[${index}].hostTeamId`,
      opportunity.hostTeamId,
      teams,
      `Rotation opportunity ${opportunity.id}`,
      "host team"
    );
    if (opportunity.hostMentorRoleId)
      requireReference(
        issues,
        `rotationOpportunities[${index}].hostMentorRoleId`,
        opportunity.hostMentorRoleId,
        roles,
        `Rotation opportunity ${opportunity.id}`,
        "mentor role"
      );
    [...opportunity.requiredSkillIds, ...opportunity.desiredSkillIds].forEach((skillId) =>
      requireReference(
        issues,
        `rotationOpportunities[${index}].skillIds`,
        skillId,
        skills,
        `Rotation opportunity ${opportunity.id}`,
        "skill"
      )
    );
    if (!Number.isInteger(opportunity.capacity) || opportunity.capacity < 1)
      issues.push({
        path: `rotationOpportunities[${index}].capacity`,
        message: `Rotation opportunity ${opportunity.id} capacity must be a positive whole number.`
      });
    addDateOrderIssue(issues, `rotationOpportunities[${index}]`, opportunity.startDate, opportunity.endDate);
  });
  store.rotationPlacements.forEach((placement, index) => {
    requireReference(
      issues,
      `rotationPlacements[${index}].opportunityId`,
      placement.opportunityId,
      opportunities,
      `Rotation placement ${placement.id}`,
      "opportunity"
    );
    requireReference(
      issues,
      `rotationPlacements[${index}].personId`,
      placement.personId,
      people,
      `Rotation placement ${placement.id}`,
      "person"
    );
    requireReference(
      issues,
      `rotationPlacements[${index}].homeTeamId`,
      placement.homeTeamId,
      teams,
      `Rotation placement ${placement.id}`,
      "home team"
    );
    if (placement.assignmentId && !store.assignments.some((assignment) => assignment.id === placement.assignmentId))
      issues.push({
        path: `rotationPlacements[${index}].assignmentId`,
        message: `Rotation placement ${placement.id} references missing assignment ${placement.assignmentId}.`
      });
    addDateOrderIssue(issues, `rotationPlacements[${index}]`, placement.startDate, placement.endDate);
  });
  store.rotationOpportunities.forEach((opportunity, index) => {
    const occupied = store.rotationPlacements.filter(
      (placement) =>
        placement.opportunityId === opportunity.id && (placement.state === "accepted" || placement.state === "active")
    ).length;
    if (occupied > opportunity.capacity)
      issues.push({
        path: `rotationOpportunities[${index}].capacity`,
        message: `Rotation opportunity ${opportunity.id} has ${occupied} occupied places for capacity ${opportunity.capacity}.`
      });
  });
  return issues;
}

function normalisePeople(value: unknown): readonly PersonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((person) => ({
    id: stringOr(person.id, localId("PER")),
    displayName: stringOr(person.displayName, "Unnamed person"),
    stakeholderType: isStakeholderType(person.stakeholderType) ? person.stakeholderType : "staff",
    organisation: stringOr(person.organisation),
    currentRole: stringOr(person.currentRole),
    resumeUrl: stringOr(person.resumeUrl),
    resumeText: stringOr(person.resumeText),
    nextMilestone: stringOr(person.nextMilestone),
    nextAction: stringOr(person.nextAction),
    lifecycle: normaliseLifecycle(person.lifecycle),
    performanceCycles: normalisePerformanceCycles(person.performanceCycles),
    notes: stringOr(person.notes)
  }));
}

function normaliseLifecycle(value: unknown): readonly PersonLifecycleRecord[] {
  const incoming = Array.isArray(value) ? value.filter(isRecord) : [];
  return PERSON_LIFECYCLE_STEPS.map((stepId) => {
    const existing = incoming.find((item) => item.stepId === stepId);
    return {
      stepId,
      completed: existing?.completed === true,
      completedAt: stringOr(existing?.completedAt),
      notes: stringOr(existing?.notes)
    };
  });
}

function normalisePerformanceCycles(value: unknown): readonly PerformanceCycleRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((cycle) => ({
      id: stringOr(cycle.id, localId("PFC")),
      year: stringOr(cycle.year),
      status: isPerformanceCycleStatus(cycle.status) ? cycle.status : "planned",
      mandatoryBehaviours: stringOr(cycle.mandatoryBehaviours),
      roleSpecificCapabilities: stringOr(cycle.roleSpecificCapabilities),
      personalGoals: stringOr(cycle.personalGoals),
      targets: stringOr(cycle.targets),
      courses: stringOr(cycle.courses),
      certifications: stringOr(cycle.certifications),
      reviewBy: stringOr(cycle.reviewBy)
    }))
    .filter((cycle) =>
      Object.entries(cycle).some(([key, item]) => key !== "id" && typeof item === "string" && item.length > 0)
    );
}

function normaliseTeams(store: Record<string, unknown>): readonly TeamRecord[] {
  if (Array.isArray(store.teams)) {
    return store.teams.filter(isRecord).map((team) => ({
      id: stringOr(team.id, localId("TEM")),
      title: stringOr(team.title, "Untitled team"),
      parentTeamId: stringOr(team.parentTeamId),
      ownedControlRefs: stringArray(team.ownedControlRefs),
      ownedRequirementRefs: stringArray(team.ownedRequirementRefs),
      controlSetRefs: stringArray(team.controlSetRefs),
      teamItems: normaliseTeamItems(team.teamItems),
      responsibility: stringOr(team.responsibility),
      notes: stringOr(team.notes)
    }));
  }
  const legacyRoles = Array.isArray(store.roles) ? store.roles.filter(isRecord) : [];
  const names = [...new Set(legacyRoles.map((role) => role.team).filter(isNonEmptyString))];
  return names.map((title) => ({
    id: localId("TEM"),
    title,
    parentTeamId: "",
    ownedControlRefs: [],
    ownedRequirementRefs: [],
    controlSetRefs: [],
    teamItems: [],
    responsibility: "",
    notes: "Migrated from the previous role-level team field."
  }));
}

function normaliseTeamItems(value: unknown): readonly TeamItemRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    id: stringOr(item.id, localId("TMI")),
    title: stringOr(item.title, "Untitled team item"),
    itemType: stringOr(item.itemType, "date"),
    startDate: stringOr(item.startDate),
    endDate: stringOr(item.endDate),
    includeInPlan: item.includeInPlan === true,
    notes: stringOr(item.notes)
  }));
}

function normaliseRoles(value: unknown, teams: readonly TeamRecord[]): readonly RoleRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((role) => ({
    id: stringOr(role.id, localId("ROL")),
    title: stringOr(role.title, "Untitled role"),
    teamId:
      typeof role.teamId === "string"
        ? role.teamId
        : (teams.find((team) => team.title === role.team)?.id ?? teams[0]?.id ?? ""),
    status: isRoleStatus(role.status) ? role.status : "active",
    reportsToRoleId: stringOr(role.reportsToRoleId),
    functionalOutcome: stringOr(role.functionalOutcome),
    contribution: stringOr(role.contribution),
    positionDescriptionUrl: stringOr(role.positionDescriptionUrl),
    positionDescriptionText: stringOr(role.positionDescriptionText)
  }));
}

function normaliseAssignments(value: unknown): readonly AssignmentRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((assignment) => ({
    id: stringOr(assignment.id, localId("ASM")),
    personId: stringOr(assignment.personId),
    roleId: stringOr(assignment.roleId),
    status: isAssignmentStatus(assignment.status) ? assignment.status : "active",
    allocation: stringOr(assignment.allocation),
    reviewBy: stringOr(assignment.reviewBy),
    badge: stringOr(assignment.badge)
  }));
}

function normaliseRelationshipNotes(value: unknown): readonly RelationshipNoteRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((note) => ({
    id: stringOr(note.id, localId("REL")),
    personId: stringOr(note.personId),
    createdAt: stringOr(note.createdAt),
    summary: stringOr(note.summary),
    nextContactAt: stringOr(note.nextContactAt)
  }));
}

function normaliseLearningRequirement(item: Record<string, unknown>): LearningRequirementRecord {
  return {
    id: stringOr(item.id, localId("LRN")),
    title: stringOr(item.title, "Untitled learning requirement"),
    scopeType: enumOr(item.scopeType, ["all", "team", "role"], "all"),
    scopeId: stringOr(item.scopeId),
    recurrence: enumOr(item.recurrence, ["once", "annual"], "once"),
    criticality: enumOr(item.criticality, ["mandatory", "recommended"], "mandatory"),
    dueDate: stringOr(item.dueDate),
    status: enumOr(item.status, ["active", "archived"], "active")
  };
}
function normalisePersonLearningRecord(item: Record<string, unknown>): PersonLearningRecord {
  return {
    id: stringOr(item.id, localId("PLR")),
    personId: stringOr(item.personId),
    learningRequirementId: stringOr(item.learningRequirementId),
    dueDate: stringOr(item.dueDate),
    state: enumOr(item.state, ["not-started", "in-progress", "completed", "overdue", "exempt"], "not-started"),
    completedAt: stringOr(item.completedAt),
    evidenceRef: stringOr(item.evidenceRef),
    exemptionReason: stringOr(item.exemptionReason)
  };
}
function normaliseCertification(item: Record<string, unknown>): CertificationRecord {
  return {
    id: stringOr(item.id, localId("CER")),
    personId: stringOr(item.personId),
    credential: stringOr(item.credential, "Untitled certification"),
    issuer: stringOr(item.issuer),
    issuedAt: stringOr(item.issuedAt),
    expiresAt: stringOr(item.expiresAt),
    evidenceRef: stringOr(item.evidenceRef),
    notes: stringOr(item.notes)
  };
}
function normaliseSkill(item: Record<string, unknown>): SkillRecord {
  return {
    id: stringOr(item.id, localId("SKL")),
    title: stringOr(item.title, "Untitled skill"),
    category: enumOr(item.category, ["cyber", "leadership", "ai-fluency", "professional", "other"], "other"),
    levelAnchors: stringArray(item.levelAnchors).slice(0, 5),
    status: enumOr(item.status, ["active", "archived"], "active")
  };
}
function normaliseRoleSkillRequirement(item: Record<string, unknown>): RoleSkillRequirementRecord {
  return {
    id: stringOr(item.id, localId("RSR")),
    roleId: stringOr(item.roleId),
    skillId: stringOr(item.skillId),
    targetLevel: levelOr(item.targetLevel),
    importance: enumOr(item.importance, ["required", "desired"], "required")
  };
}
function normalisePersonSkillAssessment(item: Record<string, unknown>): PersonSkillAssessmentRecord {
  return {
    id: stringOr(item.id, localId("PSA")),
    personId: stringOr(item.personId),
    skillId: stringOr(item.skillId),
    level: levelOr(item.level),
    source: enumOr(item.source, ["self", "manager", "evidence-review"], "self"),
    assessedAt: stringOr(item.assessedAt),
    reviewBy: stringOr(item.reviewBy),
    evidenceNote: stringOr(item.evidenceNote)
  };
}
function normaliseDevelopmentPlan(item: Record<string, unknown>): DevelopmentPlanRecord {
  return {
    id: stringOr(item.id, localId("DVP")),
    personId: stringOr(item.personId),
    targetRoleId: stringOr(item.targetRoleId),
    status: enumOr(item.status, ["draft", "active", "completed", "archived"], "draft"),
    reviewBy: stringOr(item.reviewBy)
  };
}
function normaliseDevelopmentActivity(item: Record<string, unknown>): DevelopmentActivityRecord {
  return {
    id: stringOr(item.id, localId("DVA")),
    developmentPlanId: stringOr(item.developmentPlanId),
    skillIds: stringArray(item.skillIds),
    activityType: enumOr(
      item.activityType,
      ["learning", "mentoring", "stretch-assignment", "rotation", "certification", "other"],
      "other"
    ),
    title: stringOr(item.title, "Untitled development activity"),
    owner: stringOr(item.owner),
    dueDate: stringOr(item.dueDate),
    status: enumOr(item.status, ["planned", "in-progress", "completed", "cancelled"], "planned"),
    outcome: stringOr(item.outcome)
  };
}
function normaliseSuccessionPlan(item: Record<string, unknown>): SuccessionPlanRecord {
  return {
    id: stringOr(item.id, localId("SCP")),
    roleId: stringOr(item.roleId),
    criticality: enumOr(item.criticality, ["critical", "important", "standard"], "standard"),
    status: enumOr(item.status, ["draft", "under-review", "approved", "archived"], "draft"),
    reviewBy: stringOr(item.reviewBy),
    candidates: records(item.candidates).map((candidate) => ({
      personId: stringOr(candidate.personId),
      readiness: enumOr(candidate.readiness, ["ready-now", "1-2-years", "development-needed"], "development-needed"),
      rationale: stringOr(candidate.rationale),
      developmentPlanId: stringOr(candidate.developmentPlanId),
      lastReviewedAt: stringOr(candidate.lastReviewedAt)
    })),
    reviewHistory: records(item.reviewHistory).map((review) => ({
      id: stringOr(review.id, localId("SCR")),
      action: enumOr(review.action, ["submitted", "approved", "returned", "archived"], "submitted"),
      at: stringOr(review.at),
      reviewerLabel: stringOr(review.reviewerLabel),
      note: stringOr(review.note)
    }))
  };
}
function normaliseRotationOpportunity(item: Record<string, unknown>): RotationOpportunityRecord {
  return {
    id: stringOr(item.id, localId("ROP")),
    hostTeamId: stringOr(item.hostTeamId),
    title: stringOr(item.title, "Untitled rotation opportunity"),
    purpose: stringOr(item.purpose),
    capacity: positiveIntegerOr(item.capacity, 1),
    startDate: stringOr(item.startDate),
    endDate: stringOr(item.endDate),
    status: enumOr(item.status, ["draft", "open", "closed", "completed", "cancelled"], "draft"),
    requiredSkillIds: stringArray(item.requiredSkillIds),
    desiredSkillIds: stringArray(item.desiredSkillIds),
    learningOutcomes: stringArray(item.learningOutcomes),
    transferExpectations: stringArray(item.transferExpectations),
    hostMentorRoleId: stringOr(item.hostMentorRoleId),
    eligibility: stringOr(item.eligibility),
    timeCommitment: stringOr(item.timeCommitment)
  };
}
function normaliseRotationPlacement(item: Record<string, unknown>): RotationPlacementRecord {
  return {
    id: stringOr(item.id, localId("RPL")),
    opportunityId: stringOr(item.opportunityId),
    personId: stringOr(item.personId),
    homeTeamId: stringOr(item.homeTeamId),
    state: enumOr(item.state, ["nominated", "accepted", "active", "completed", "withdrawn"], "nominated"),
    startDate: stringOr(item.startDate),
    endDate: stringOr(item.endDate),
    objectives: stringOr(item.objectives),
    milestones: records(item.milestones).map((milestone) => ({
      step: enumOr(
        milestone.step,
        ["pre-brief", "cyber-artefact", "home-team-session", "30-day-review", "90-day-review"],
        "pre-brief"
      ),
      completedAt: stringOr(milestone.completedAt),
      outcome: stringOr(milestone.outcome)
    })),
    assignmentId: stringOr(item.assignmentId)
  };
}

function addDuplicateIssues(issues: StoreValidationIssue[], collection: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (!id || seen.has(id))
      issues.push({
        path: `${collection}[${index}].id`,
        message: id ? `Duplicate ${collection} ID ${id}.` : `${collection} ID is required.`
      });
    seen.add(id);
  });
}

function addCycleIssues(
  issues: StoreValidationIssue[],
  collection: string,
  nodes: readonly { id: string; parentId: string }[]
): void {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  for (const node of nodes) {
    const path = new Set<string>();
    let current = node.id;
    while (current && parents.has(current)) {
      if (path.has(current)) {
        issues.push({
          path: `${collection}.${node.id}`,
          message: `${collection === "teams" ? "Team hierarchy" : "Role reporting line"} contains a cycle involving ${current}.`
        });
        break;
      }
      path.add(current);
      current = parents.get(current) ?? "";
    }
  }
}

function requireReference(
  issues: StoreValidationIssue[],
  path: string,
  id: string,
  validIds: ReadonlySet<string>,
  owner: string,
  target: string
): void {
  if (!id || !validIds.has(id))
    issues.push({ path, message: `${owner} references missing ${target} ${id || "(blank)"}.` });
}
function addLevelIssue(issues: StoreValidationIssue[], path: string, level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > 5)
    issues.push({ path, message: `Skill level must be a whole number from 1 to 5.` });
}
function addDateOrderIssue(issues: StoreValidationIssue[], path: string, start: string, end: string): void {
  if (start && end && start > end)
    issues.push({ path, message: `Start date ${start} must not be after end date ${end}.` });
}

function isSupportedVersion(value: string): boolean {
  return value === "1.0.0" || value === PUB_STORE_BASELINE_VERSION || value === "1.2.0" || value === PUB_STORE_VERSION;
}
function records(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
function enumOr<const T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : fallback;
}
function levelOr(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : 1;
}
function positiveIntegerOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringOr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isStakeholderType(value: unknown): value is StakeholderType {
  return typeof value === "string" && STAKEHOLDER_TYPES.includes(value as StakeholderType);
}
function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && ASSIGNMENT_STATUSES.includes(value as AssignmentStatus);
}
function isRoleStatus(value: unknown): value is RoleStatus {
  return typeof value === "string" && ROLE_STATUSES.includes(value as RoleStatus);
}
function isPerformanceCycleStatus(value: unknown): value is PerformanceCycleStatus {
  return typeof value === "string" && PERFORMANCE_CYCLE_STATUSES.includes(value as PerformanceCycleStatus);
}
function localId(prefix: string): string {
  return `PUB-${prefix}-${randomUUID()}`;
}
