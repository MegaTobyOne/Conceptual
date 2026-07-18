import { PSPF_SLICE_VERSION } from "@pspf/contracts";
import type { PersonLearningRecord, PubStore, RotationOpportunityRecord, SuccessionReadiness } from "./store.js";

export type LearningDisplayState = PersonLearningRecord["state"];
export type LearningObligationState = LearningDisplayState | "record-missing";
export type CertificationWindow = "current" | "due-90-days" | "due-30-days" | "expired" | "no-expiry";

export interface LearningObligation {
  readonly requirementId: string;
  readonly personId: string;
  readonly dueDate: string;
  readonly state: LearningObligationState;
  readonly recordId: string | undefined;
}

export interface SkillGap {
  readonly personId: string;
  readonly roleId: string;
  readonly skillId: string;
  readonly targetLevel: number;
  readonly assessedLevel: number | undefined;
  readonly state: "not-assessed" | "meets-target" | "gap";
  readonly gap: number | undefined;
}

export interface SuccessionSummary {
  readonly roleId: string;
  readonly readiness: Readonly<Record<SuccessionReadiness, number>>;
  readonly candidateCount: number;
  readonly stale: boolean;
}

export interface RotationCapacity {
  readonly opportunityId: string;
  readonly hostTeamId: string;
  readonly capacity: number;
  readonly occupied: number;
  readonly available: number;
}

export interface CapabilityCell {
  readonly teamId: string;
  readonly skillId: string;
  readonly denominator: number;
  readonly meetingTarget: number;
  readonly belowTarget: number;
  readonly notAssessed: number;
}

export interface ContinuityRow {
  readonly roleId: string;
  readonly teamId: string;
  readonly roleState: "vacant" | "covered" | "needs-backup";
  readonly planState: "no-plan" | "draft" | "under-review" | "approved-current" | "approved-overdue";
  readonly readiness: Readonly<Record<SuccessionReadiness, number>>;
}

export interface PathwayRow {
  readonly developmentPlanId: string;
  readonly personId: string;
  readonly currentRoleIds: readonly string[];
  readonly targetRoleId: string;
  readonly skillGapCount: number;
  readonly notAssessedCount: number;
  readonly plannedActivityCount: number;
  readonly completedActivityCount: number;
  readonly rotationCount: number;
}

export type WorkforceAttentionReason =
  | "learning-record-missing"
  | "learning-overdue"
  | "certification-expired"
  | "certification-due-30-days"
  | "certification-due-90-days"
  | "skill-assessment-overdue"
  | "development-activity-overdue"
  | "role-vacant"
  | "role-needs-backup"
  | "succession-plan-missing"
  | "succession-review-overdue"
  | "rotation-milestone-overdue";

export interface WorkforceAttentionItem {
  readonly reason: WorkforceAttentionReason;
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly dueDate: string;
  readonly sourceId: string;
  readonly personId: string | undefined;
  readonly routeCommand:
    | "pspf.pub.manageLearning"
    | "pspf.pub.manageSkills"
    | "pspf.pub.manageSuccession"
    | "pspf.pub.manageRotations";
}

export interface SafeWorkforceSummary {
  readonly asAt: string;
  readonly learning: Readonly<Record<LearningDisplayState, number>>;
  readonly certifications: Readonly<Record<CertificationWindow, number>>;
  readonly skills: {
    readonly notAssessed: number;
    readonly gaps: number;
    readonly meetingTarget: number;
  };
  readonly succession: {
    readonly rolesWithApprovedPlans: number;
    readonly rolesWithoutCandidates: number;
    readonly readyNow: number;
    readonly oneToTwoYears: number;
    readonly developmentNeeded: number;
  };
  readonly rotations: {
    readonly openOpportunities: number;
    readonly totalCapacity: number;
    readonly availablePlaces: number;
    readonly activePlacements: number;
  };
}

export function effectiveLearningState(record: PersonLearningRecord, now = new Date()): LearningDisplayState {
  if (record.state === "completed" || record.state === "exempt") return record.state;
  if (record.dueDate && record.dueDate < isoDate(now)) return "overdue";
  return record.state === "overdue" ? "not-started" : record.state;
}

export function deriveLearningObligations(store: PubStore, now = new Date()): readonly LearningObligation[] {
  const eligibleAssignments = store.assignments.filter((assignment) =>
    ["active", "rotating", "needs-backup"].includes(assignment.status)
  );
  const activeRoleById = new Map(store.roles.filter((role) => role.status === "active").map((role) => [role.id, role]));
  const obligations: LearningObligation[] = [];

  for (const requirement of store.learningRequirements.filter(
    (item) => item.status === "active" && item.criticality === "mandatory"
  )) {
    const personIds = new Set(
      eligibleAssignments
        .filter((assignment) => {
          const role = activeRoleById.get(assignment.roleId);
          if (!role) return false;
          if (requirement.scopeType === "role") return role.id === requirement.scopeId;
          if (requirement.scopeType === "team") return role.teamId === requirement.scopeId;
          return true;
        })
        .map((assignment) => assignment.personId)
    );
    for (const personId of personIds) {
      const record = store.personLearningRecords.find(
        (item) => item.personId === personId && item.learningRequirementId === requirement.id
      );
      obligations.push({
        requirementId: requirement.id,
        personId,
        dueDate: record?.dueDate || requirement.dueDate,
        state: record ? effectiveLearningState(record, now) : "record-missing",
        recordId: record?.id
      });
    }
  }

  return obligations.sort(
    (left, right) =>
      left.requirementId.localeCompare(right.requirementId) || left.personId.localeCompare(right.personId)
  );
}

export function certificationWindow(expiresAt: string, now = new Date()): CertificationWindow {
  if (!expiresAt) return "no-expiry";
  const today = isoDate(now);
  if (expiresAt < today) return "expired";
  const days = daysBetween(today, expiresAt);
  if (days <= 30) return "due-30-days";
  if (days <= 90) return "due-90-days";
  return "current";
}

export function deriveSkillGaps(store: PubStore, personId: string, roleId: string): readonly SkillGap[] {
  return store.roleSkillRequirements
    .filter((requirement) => requirement.roleId === roleId)
    .map((requirement) => {
      const assessment = [...store.personSkillAssessments]
        .filter((item) => item.personId === personId && item.skillId === requirement.skillId)
        .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt))[0];
      if (!assessment) {
        return {
          personId,
          roleId,
          skillId: requirement.skillId,
          targetLevel: requirement.targetLevel,
          assessedLevel: undefined,
          state: "not-assessed" as const,
          gap: undefined
        };
      }
      const gap = Math.max(0, requirement.targetLevel - assessment.level);
      return {
        personId,
        roleId,
        skillId: requirement.skillId,
        targetLevel: requirement.targetLevel,
        assessedLevel: assessment.level,
        state: gap > 0 ? ("gap" as const) : ("meets-target" as const),
        gap
      };
    });
}

export function deriveSuccessionSummaries(store: PubStore, now = new Date()): readonly SuccessionSummary[] {
  const today = isoDate(now);
  return store.successionPlans
    .filter((plan) => plan.status === "approved")
    .map((plan) => ({
      roleId: plan.roleId,
      readiness: {
        "ready-now": plan.candidates.filter((candidate) => candidate.readiness === "ready-now").length,
        "1-2-years": plan.candidates.filter((candidate) => candidate.readiness === "1-2-years").length,
        "development-needed": plan.candidates.filter((candidate) => candidate.readiness === "development-needed").length
      },
      candidateCount: plan.candidates.length,
      stale: Boolean(plan.reviewBy && plan.reviewBy < today)
    }));
}

export function deriveRotationCapacity(store: PubStore): readonly RotationCapacity[] {
  return store.rotationOpportunities
    .filter((opportunity) => opportunity.status === "open")
    .map((opportunity) => rotationCapacity(store, opportunity));
}

export function deriveCapabilityCells(store: PubStore): readonly CapabilityCell[] {
  const activeRoles = new Map(store.roles.filter((role) => role.status === "active").map((role) => [role.id, role]));
  const activeSkills = new Set(store.skills.filter((skill) => skill.status === "active").map((skill) => skill.id));
  const eligibleAssignments = store.assignments.filter(
    (assignment) =>
      (assignment.status === "active" || assignment.status === "rotating") && activeRoles.has(assignment.roleId)
  );
  const targets = new Map<string, Map<string, number>>();

  for (const assignment of eligibleAssignments) {
    const role = activeRoles.get(assignment.roleId)!;
    for (const requirement of store.roleSkillRequirements.filter(
      (item) => item.roleId === role.id && activeSkills.has(item.skillId)
    )) {
      const key = `${role.teamId}\u0000${requirement.skillId}`;
      const people = targets.get(key) ?? new Map<string, number>();
      people.set(assignment.personId, Math.max(people.get(assignment.personId) ?? 0, requirement.targetLevel));
      targets.set(key, people);
    }
  }

  return [...targets.entries()]
    .map(([key, people]) => {
      const [teamId, skillId] = key.split("\u0000") as [string, string];
      const states = [...people.entries()].map(([personId, targetLevel]) => {
        const assessment = latestAssessment(store, personId, skillId);
        if (!assessment) return "not-assessed" as const;
        return assessment.level >= targetLevel ? ("meeting-target" as const) : ("below-target" as const);
      });
      return {
        teamId,
        skillId,
        denominator: people.size,
        meetingTarget: states.filter((state) => state === "meeting-target").length,
        belowTarget: states.filter((state) => state === "below-target").length,
        notAssessed: states.filter((state) => state === "not-assessed").length
      };
    })
    .sort((left, right) => left.teamId.localeCompare(right.teamId) || left.skillId.localeCompare(right.skillId));
}

export function deriveContinuityRows(store: PubStore, now = new Date()): readonly ContinuityRow[] {
  const today = isoDate(now);
  return store.roles
    .filter((role) => role.status === "active")
    .map((role) => {
      const assignments = store.assignments.filter(
        (assignment) => assignment.roleId === role.id && assignment.status !== "planned"
      );
      const plan = store.successionPlans.find((item) => item.roleId === role.id && item.status !== "archived");
      const roleState =
        assignments.length === 0
          ? ("vacant" as const)
          : assignments.some((assignment) => assignment.status === "needs-backup")
            ? ("needs-backup" as const)
            : ("covered" as const);
      const planState = !plan
        ? ("no-plan" as const)
        : plan.status === "approved"
          ? plan.reviewBy && plan.reviewBy < today
            ? ("approved-overdue" as const)
            : ("approved-current" as const)
          : plan.status === "under-review"
            ? ("under-review" as const)
            : ("draft" as const);
      return {
        roleId: role.id,
        teamId: role.teamId,
        roleState,
        planState,
        readiness: {
          "ready-now": plan?.candidates.filter((candidate) => candidate.readiness === "ready-now").length ?? 0,
          "1-2-years": plan?.candidates.filter((candidate) => candidate.readiness === "1-2-years").length ?? 0,
          "development-needed":
            plan?.candidates.filter((candidate) => candidate.readiness === "development-needed").length ?? 0
        }
      };
    })
    .sort((left, right) => left.teamId.localeCompare(right.teamId) || left.roleId.localeCompare(right.roleId));
}

export function derivePathwayRows(store: PubStore): readonly PathwayRow[] {
  return store.developmentPlans
    .filter((plan) => plan.status === "draft" || plan.status === "active")
    .map((plan) => {
      const currentRoleIds = [
        ...new Set(
          store.assignments
            .filter(
              (assignment) =>
                assignment.personId === plan.personId &&
                (assignment.status === "active" ||
                  assignment.status === "rotating" ||
                  assignment.status === "needs-backup")
            )
            .map((assignment) => assignment.roleId)
        )
      ].sort();
      const gaps = deriveSkillGaps(store, plan.personId, plan.targetRoleId);
      const activities = store.developmentActivities.filter((activity) => activity.developmentPlanId === plan.id);
      return {
        developmentPlanId: plan.id,
        personId: plan.personId,
        currentRoleIds,
        targetRoleId: plan.targetRoleId,
        skillGapCount: gaps.filter((gap) => gap.state === "gap").length,
        notAssessedCount: gaps.filter((gap) => gap.state === "not-assessed").length,
        plannedActivityCount: activities.filter(
          (activity) => activity.status === "planned" || activity.status === "in-progress"
        ).length,
        completedActivityCount: activities.filter((activity) => activity.status === "completed").length,
        rotationCount: store.rotationPlacements.filter((placement) => placement.personId === plan.personId).length
      };
    })
    .sort(
      (left, right) =>
        left.personId.localeCompare(right.personId) || left.targetRoleId.localeCompare(right.targetRoleId)
    );
}

export function deriveAttentionItems(store: PubStore, now = new Date()): readonly WorkforceAttentionItem[] {
  const today = isoDate(now);
  const items: WorkforceAttentionItem[] = [];
  for (const obligation of deriveLearningObligations(store, now)) {
    if (obligation.state === "record-missing" || obligation.state === "overdue") {
      items.push(
        attention(
          obligation.state === "record-missing" ? "learning-record-missing" : "learning-overdue",
          obligation.state === "overdue" ? "critical" : "high",
          obligation.dueDate,
          obligation.recordId ?? obligation.requirementId,
          obligation.personId,
          "pspf.pub.manageLearning"
        )
      );
    }
  }
  for (const certification of store.certifications) {
    const window = certificationWindow(certification.expiresAt, now);
    if (window === "expired" || window === "due-30-days" || window === "due-90-days") {
      items.push(
        attention(
          window === "expired"
            ? "certification-expired"
            : window === "due-30-days"
              ? "certification-due-30-days"
              : "certification-due-90-days",
          window === "expired" ? "critical" : window === "due-30-days" ? "high" : "medium",
          certification.expiresAt,
          certification.id,
          certification.personId,
          "pspf.pub.manageLearning"
        )
      );
    }
  }
  for (const assessment of store.personSkillAssessments.filter((item) => item.reviewBy && item.reviewBy < today)) {
    items.push(
      attention(
        "skill-assessment-overdue",
        "medium",
        assessment.reviewBy,
        assessment.id,
        assessment.personId,
        "pspf.pub.manageSkills"
      )
    );
  }
  for (const activity of store.developmentActivities.filter(
    (item) => item.dueDate && item.dueDate < today && (item.status === "planned" || item.status === "in-progress")
  )) {
    const plan = store.developmentPlans.find((item) => item.id === activity.developmentPlanId);
    items.push(
      attention(
        "development-activity-overdue",
        "high",
        activity.dueDate,
        activity.id,
        plan?.personId,
        "pspf.pub.manageSkills"
      )
    );
  }
  for (const row of deriveContinuityRows(store, now)) {
    if (row.roleState === "vacant" || row.roleState === "needs-backup") {
      items.push(
        attention(
          row.roleState === "vacant" ? "role-vacant" : "role-needs-backup",
          "high",
          "",
          row.roleId,
          undefined,
          "pspf.pub.manageSuccession"
        )
      );
    }
    if (row.planState === "no-plan" || row.planState === "approved-overdue") {
      items.push(
        attention(
          row.planState === "no-plan" ? "succession-plan-missing" : "succession-review-overdue",
          row.planState === "no-plan" ? "medium" : "high",
          store.successionPlans.find((plan) => plan.roleId === row.roleId)?.reviewBy ?? "",
          row.roleId,
          undefined,
          "pspf.pub.manageSuccession"
        )
      );
    }
  }
  for (const placement of store.rotationPlacements.filter(
    (item) => (item.state === "accepted" && item.startDate < today) || (item.state === "active" && item.endDate < today)
  )) {
    if (placement.milestones.some((milestone) => !milestone.completedAt)) {
      items.push(
        attention(
          "rotation-milestone-overdue",
          "high",
          placement.state === "accepted" ? placement.startDate : placement.endDate,
          placement.id,
          placement.personId,
          "pspf.pub.manageRotations"
        )
      );
    }
  }
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return items.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31") ||
      left.reason.localeCompare(right.reason) ||
      left.sourceId.localeCompare(right.sourceId)
  );
}

function rotationCapacity(store: PubStore, opportunity: RotationOpportunityRecord): RotationCapacity {
  const occupied = store.rotationPlacements.filter(
    (placement) =>
      placement.opportunityId === opportunity.id && (placement.state === "accepted" || placement.state === "active")
  ).length;
  return {
    opportunityId: opportunity.id,
    hostTeamId: opportunity.hostTeamId,
    capacity: opportunity.capacity,
    occupied,
    available: Math.max(0, opportunity.capacity - occupied)
  };
}

function latestAssessment(store: PubStore, personId: string, skillId: string) {
  return [...store.personSkillAssessments]
    .filter((item) => item.personId === personId && item.skillId === skillId)
    .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt))[0];
}

function attention(
  reason: WorkforceAttentionReason,
  severity: WorkforceAttentionItem["severity"],
  dueDate: string,
  sourceId: string,
  personId: string | undefined,
  routeCommand: WorkforceAttentionItem["routeCommand"]
): WorkforceAttentionItem {
  return { reason, severity, dueDate, sourceId, personId, routeCommand };
}

export function buildSafeWorkforceSummary(store: PubStore, now = new Date()): SafeWorkforceSummary {
  const learningStates = store.personLearningRecords.map((record) => effectiveLearningState(record, now));
  const certificationWindows = store.certifications.map((record) => certificationWindow(record.expiresAt, now));
  const gaps = store.assignments.flatMap((assignment) =>
    deriveSkillGaps(store, assignment.personId, assignment.roleId)
  );
  const succession = deriveSuccessionSummaries(store, now);
  const rotations = deriveRotationCapacity(store);
  return {
    asAt: isoDate(now),
    learning: countValues(learningStates, ["not-started", "in-progress", "completed", "overdue", "exempt"]),
    certifications: countValues(certificationWindows, [
      "current",
      "due-90-days",
      "due-30-days",
      "expired",
      "no-expiry"
    ]),
    skills: {
      notAssessed: gaps.filter((gap) => gap.state === "not-assessed").length,
      gaps: gaps.filter((gap) => gap.state === "gap").length,
      meetingTarget: gaps.filter((gap) => gap.state === "meets-target").length
    },
    succession: {
      rolesWithApprovedPlans: succession.length,
      rolesWithoutCandidates: succession.filter((summary) => summary.candidateCount === 0).length,
      readyNow: succession.reduce((total, summary) => total + (summary.readiness["ready-now"] ?? 0), 0),
      oneToTwoYears: succession.reduce((total, summary) => total + (summary.readiness["1-2-years"] ?? 0), 0),
      developmentNeeded: succession.reduce(
        (total, summary) => total + (summary.readiness["development-needed"] ?? 0),
        0
      )
    },
    rotations: {
      openOpportunities: rotations.length,
      totalCapacity: rotations.reduce((total, item) => total + item.capacity, 0),
      availablePlaces: rotations.reduce((total, item) => total + item.available, 0),
      activePlacements: store.rotationPlacements.filter((placement) => placement.state === "active").length
    }
  };
}

export function renderSafeWorkforceSummaryText(summary: SafeWorkforceSummary): string {
  return [
    "PSPF Pub workforce summary",
    "OFFICIAL: Sensitive",
    `Product version: ${PSPF_SLICE_VERSION}`,
    `As at: ${summary.asAt}`,
    "Counts from 1 to 4 are shown as <5 to reduce small-cohort disclosure risk.",
    "",
    "Mandatory learning",
    `Overdue: ${safeCount(summary.learning.overdue)}`,
    `Not started: ${safeCount(summary.learning["not-started"])}`,
    `In progress: ${safeCount(summary.learning["in-progress"])}`,
    `Completed: ${safeCount(summary.learning.completed)}`,
    `Exempt: ${safeCount(summary.learning.exempt)}`,
    "",
    "Certifications",
    `Expired: ${safeCount(summary.certifications.expired)}`,
    `Due within 30 days: ${safeCount(summary.certifications["due-30-days"])}`,
    `Due within 90 days: ${safeCount(summary.certifications["due-90-days"])}`,
    "",
    "Skills and development",
    `Not assessed: ${safeCount(summary.skills.notAssessed)}`,
    `Gaps: ${safeCount(summary.skills.gaps)}`,
    `Meeting target: ${safeCount(summary.skills.meetingTarget)}`,
    "",
    "Succession",
    `Approved role plans: ${summary.succession.rolesWithApprovedPlans}`,
    `Roles without candidates: ${summary.succession.rolesWithoutCandidates}`,
    `Ready now: ${safeCount(summary.succession.readyNow)}`,
    `Ready in 1-2 years: ${safeCount(summary.succession.oneToTwoYears)}`,
    `Development needed: ${safeCount(summary.succession.developmentNeeded)}`,
    "",
    "Rotations",
    `Open opportunities: ${summary.rotations.openOpportunities}`,
    `Available places: ${summary.rotations.availablePlaces}`,
    `Active placements: ${safeCount(summary.rotations.activePlacements)}`
  ].join("\n");
}

export function renderSafeWorkforceSummaryHtml(summary: SafeWorkforceSummary): string {
  const sections: readonly [string, readonly [string, string][]][] = [
    [
      "Mandatory learning",
      [
        ["Overdue", safeCount(summary.learning.overdue)],
        ["Not started", safeCount(summary.learning["not-started"])],
        ["In progress", safeCount(summary.learning["in-progress"])],
        ["Completed", safeCount(summary.learning.completed)],
        ["Exempt", safeCount(summary.learning.exempt)]
      ]
    ],
    [
      "Certifications",
      [
        ["Expired", safeCount(summary.certifications.expired)],
        ["Due within 30 days", safeCount(summary.certifications["due-30-days"])],
        ["Due within 90 days", safeCount(summary.certifications["due-90-days"])],
        ["Current", safeCount(summary.certifications.current)]
      ]
    ],
    [
      "Skills and development",
      [
        ["Not assessed", safeCount(summary.skills.notAssessed)],
        ["Gaps", safeCount(summary.skills.gaps)],
        ["Meeting target", safeCount(summary.skills.meetingTarget)]
      ]
    ],
    [
      "Succession",
      [
        ["Approved role plans", String(summary.succession.rolesWithApprovedPlans)],
        ["Roles without candidates", String(summary.succession.rolesWithoutCandidates)],
        ["Ready now", safeCount(summary.succession.readyNow)],
        ["Ready in 1-2 years", safeCount(summary.succession.oneToTwoYears)],
        ["Development needed", safeCount(summary.succession.developmentNeeded)]
      ]
    ],
    [
      "Rotations",
      [
        ["Open opportunities", String(summary.rotations.openOpportunities)],
        ["Total capacity", String(summary.rotations.totalCapacity)],
        ["Available places", String(summary.rotations.availablePlaces)],
        ["Active placements", safeCount(summary.rotations.activePlacements)]
      ]
    ]
  ];
  const body = sections
    .map(
      ([heading, rows]) =>
        `<section><h2>${heading}</h2><table><tbody>${rows.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${value}</td></tr>`).join("")}</tbody></table></section>`
    )
    .join("");
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PSPF Pub workforce summary</title><style>body{max-width:900px;margin:40px auto;padding:0 20px;font:16px/1.5 sans-serif;color:#202124}header{border-bottom:3px solid #b5444d}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:24px}section{border:1px solid #c7c7c7;padding:16px}h1,h2{letter-spacing:0}h2{font-size:1.1rem}table{width:100%;border-collapse:collapse}th{text-align:left;font-weight:500}td{text-align:right;font-weight:700}th,td{padding:6px;border-bottom:1px solid #ddd}footer{margin-top:24px;color:#555}</style></head><body><header><p>OFFICIAL: Sensitive</p><h1>PSPF Pub workforce summary</h1><p>Aggregate planning view as at ${summary.asAt} · PSPF v${PSPF_SLICE_VERSION}</p><p>Counts from 1 to 4 are shown as &lt;5 to reduce small-cohort disclosure risk.</p></header><main>${body}</main><footer>Person identities, identifiers, evidence, rationale, objectives, notes, and filtered local detail are excluded.</footer></body></html>`;
}

function safeCount(value: number): string {
  return value > 0 && value < 5 ? "<5" : String(value);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function countValues<const T extends string>(values: readonly T[], keys: readonly T[]): Readonly<Record<T, number>> {
  return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length])) as Record<
    T,
    number
  >;
}
