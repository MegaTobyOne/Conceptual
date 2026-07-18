import { strict as assert } from "node:assert";
import { test } from "node:test";
import { emptyStore, type PubStore } from "./store.js";
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
  effectiveLearningState,
  renderSafeWorkforceSummaryHtml,
  renderSafeWorkforceSummaryText
} from "./workforce-domain.js";

const now = new Date("2026-07-18T00:00:00.000Z");

function fixture(): PubStore {
  return {
    ...emptyStore(now),
    people: [
      {
        id: "PERSON-SECRET",
        displayName: "Distinctive Secret Name",
        stakeholderType: "staff",
        organisation: "",
        currentRole: "",
        resumeUrl: "",
        resumeText: "",
        nextMilestone: "",
        nextAction: "",
        lifecycle: [],
        performanceCycles: [],
        notes: "PRIVATE-NOTE"
      }
    ],
    teams: [
      {
        id: "TEAM-1",
        title: "Cyber",
        parentTeamId: "",
        ownedControlRefs: [],
        ownedRequirementRefs: [],
        controlSetRefs: [],
        teamItems: [],
        responsibility: "",
        notes: ""
      }
    ],
    roles: [
      {
        id: "ROLE-1",
        title: "Cyber Adviser",
        teamId: "TEAM-1",
        status: "active",
        reportsToRoleId: "",
        functionalOutcome: "",
        contribution: "",
        positionDescriptionUrl: "",
        positionDescriptionText: ""
      }
    ],
    assignments: [
      {
        id: "ASSIGNMENT-SECRET",
        personId: "PERSON-SECRET",
        roleId: "ROLE-1",
        status: "active",
        allocation: "",
        reviewBy: "",
        badge: ""
      }
    ],
    learningRequirements: [
      {
        id: "LRN-1",
        title: "Annual security learning",
        scopeType: "all",
        scopeId: "",
        recurrence: "annual",
        criticality: "mandatory",
        dueDate: "2026-07-01",
        status: "active"
      }
    ],
    personLearningRecords: [
      {
        id: "PLR-1",
        personId: "PERSON-SECRET",
        learningRequirementId: "LRN-1",
        dueDate: "2026-07-01",
        state: "not-started",
        completedAt: "",
        evidenceRef: "SECRET-EVIDENCE",
        exemptionReason: ""
      }
    ],
    certifications: [
      {
        id: "CER-1",
        personId: "PERSON-SECRET",
        credential: "Security credential",
        issuer: "Issuer",
        issuedAt: "2025-08-01",
        expiresAt: "2026-08-01",
        evidenceRef: "SECRET-EVIDENCE",
        notes: "PRIVATE-NOTE"
      }
    ],
    skills: [
      {
        id: "SKL-1",
        title: "Cyber judgement",
        category: "cyber",
        levelAnchors: ["Aware", "Assisted", "Independent", "Advanced", "Leads"],
        status: "active"
      }
    ],
    roleSkillRequirements: [
      { id: "RSR-1", roleId: "ROLE-1", skillId: "SKL-1", targetLevel: 3, importance: "required" }
    ],
    successionPlans: [
      {
        id: "SCP-1",
        roleId: "ROLE-1",
        criticality: "critical",
        status: "approved",
        reviewBy: "2026-07-01",
        candidates: [
          {
            personId: "PERSON-SECRET",
            readiness: "ready-now",
            rationale: "SECRET-RATIONALE",
            developmentPlanId: "",
            lastReviewedAt: "2026-06-01"
          }
        ],
        reviewHistory: []
      }
    ],
    rotationOpportunities: [
      {
        id: "ROP-1",
        hostTeamId: "TEAM-1",
        title: "Cyber rotation",
        purpose: "",
        capacity: 2,
        startDate: "2026-08-01",
        endDate: "2026-10-31",
        status: "open",
        requiredSkillIds: [],
        desiredSkillIds: [],
        learningOutcomes: [],
        transferExpectations: [],
        hostMentorRoleId: "",
        eligibility: "",
        timeCommitment: ""
      }
    ],
    rotationPlacements: [
      {
        id: "RPL-1",
        opportunityId: "ROP-1",
        personId: "PERSON-SECRET",
        homeTeamId: "TEAM-1",
        state: "active",
        startDate: "2026-08-01",
        endDate: "2026-10-31",
        objectives: "SECRET-OBJECTIVE",
        milestones: [],
        assignmentId: ""
      }
    ]
  };
}

test("derives overdue learning with an injected clock", () => {
  const record = fixture().personLearningRecords[0]!;
  assert.equal(effectiveLearningState(record, now), "overdue");
  assert.equal(effectiveLearningState({ ...record, state: "completed" }, now), "completed");
});

test("expands mandatory learning scope and exposes missing records", () => {
  const store = fixture();
  const secondPerson = {
    ...store.people[0]!,
    id: "PERSON-SECOND",
    displayName: "Second restricted person"
  };
  const obligations = deriveLearningObligations(
    {
      ...store,
      people: [...store.people, secondPerson],
      assignments: [
        ...store.assignments,
        { ...store.assignments[0]!, id: "ASSIGNMENT-SECOND", personId: secondPerson.id }
      ]
    },
    now
  );

  assert.deepEqual(
    obligations.map((item) => [item.personId, item.state]),
    [
      ["PERSON-SECOND", "record-missing"],
      ["PERSON-SECRET", "overdue"]
    ]
  );
});

test("classifies certification windows at date boundaries", () => {
  assert.equal(certificationWindow("", now), "no-expiry");
  assert.equal(certificationWindow("2026-07-17", now), "expired");
  assert.equal(certificationWindow("2026-08-17", now), "due-30-days");
  assert.equal(certificationWindow("2026-10-16", now), "due-90-days");
  assert.equal(certificationWindow("2026-10-17", now), "current");
});

test("distinguishes not assessed from a below-target skill gap", () => {
  const store = fixture();
  assert.equal(deriveSkillGaps(store, "PERSON-SECRET", "ROLE-1")[0]?.state, "not-assessed");
  const assessed = {
    ...store,
    personSkillAssessments: [
      {
        id: "PSA-1",
        personId: "PERSON-SECRET",
        skillId: "SKL-1",
        level: 2,
        source: "manager" as const,
        assessedAt: "2026-07-01",
        reviewBy: "",
        evidenceNote: ""
      }
    ]
  };
  assert.deepEqual(deriveSkillGaps(assessed, "PERSON-SECRET", "ROLE-1")[0], {
    personId: "PERSON-SECRET",
    roleId: "ROLE-1",
    skillId: "SKL-1",
    targetLevel: 3,
    assessedLevel: 2,
    state: "gap",
    gap: 1
  });
});

test("derives open rotation capacity", () => {
  assert.deepEqual(deriveRotationCapacity(fixture())[0], {
    opportunityId: "ROP-1",
    hostTeamId: "TEAM-1",
    capacity: 2,
    occupied: 1,
    available: 1
  });
});

test("capability cells count distinct eligible people without treating missing assessment as zero", () => {
  const store = fixture();
  const cells = deriveCapabilityCells({
    ...store,
    assignments: [
      ...store.assignments,
      { ...store.assignments[0]!, id: "ASSIGNMENT-DUPLICATE" },
      { ...store.assignments[0]!, id: "ASSIGNMENT-PLANNED", status: "planned" }
    ]
  });
  assert.deepEqual(cells, [
    { teamId: "TEAM-1", skillId: "SKL-1", denominator: 1, meetingTarget: 0, belowTarget: 0, notAssessed: 1 }
  ]);
});

test("continuity includes every active role and separates role state from plan state", () => {
  const store = fixture();
  const rows = deriveContinuityRows(
    {
      ...store,
      roles: [...store.roles, { ...store.roles[0]!, id: "ROLE-2", title: "Vacant role" }]
    },
    now
  );
  assert.deepEqual(
    rows.map((row) => [row.roleId, row.roleState, row.planState]),
    [
      ["ROLE-1", "covered", "approved-overdue"],
      ["ROLE-2", "vacant", "no-plan"]
    ]
  );
});

test("pathway rows use only existing role, gap, activity, and rotation records", () => {
  const store = fixture();
  const rows = derivePathwayRows({
    ...store,
    developmentPlans: [
      { id: "DVP-1", personId: "PERSON-SECRET", targetRoleId: "ROLE-1", status: "active", reviewBy: "" }
    ],
    developmentActivities: [
      {
        id: "DVA-1",
        developmentPlanId: "DVP-1",
        skillIds: ["SKL-1"],
        activityType: "mentoring",
        title: "Private activity",
        owner: "",
        dueDate: "2026-09-01",
        status: "planned",
        outcome: ""
      }
    ]
  });
  assert.deepEqual(rows[0], {
    developmentPlanId: "DVP-1",
    personId: "PERSON-SECRET",
    currentRoleIds: ["ROLE-1"],
    targetRoleId: "ROLE-1",
    skillGapCount: 0,
    notAssessedCount: 1,
    plannedActivityCount: 1,
    completedActivityCount: 0,
    rotationCount: 1
  });
});

test("attention queue is deterministic and routes each signal to a local workflow", () => {
  const store = fixture();
  const before = JSON.stringify(store);
  const first = deriveAttentionItems(store, now);
  const second = deriveAttentionItems(store, now);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(store), before);
  assert.equal(first[0]?.reason, "learning-overdue");
  assert.ok(first.every((item) => item.routeCommand.startsWith("pspf.pub.manage")));
  assert.ok(first.some((item) => item.reason === "succession-review-overdue"));
});

test("safe workforce summary excludes restricted identity and free text", () => {
  const summary = buildSafeWorkforceSummary(fixture(), now);
  const outputs = [renderSafeWorkforceSummaryText(summary), renderSafeWorkforceSummaryHtml(summary)];
  for (const restricted of [
    "Distinctive Secret Name",
    "PERSON-SECRET",
    "ASSIGNMENT-SECRET",
    "SECRET-EVIDENCE",
    "SECRET-RATIONALE",
    "PRIVATE-NOTE",
    "SECRET-OBJECTIVE"
  ]) {
    for (const output of outputs) assert.doesNotMatch(output, new RegExp(restricted));
  }
  const text = outputs[0]!;
  assert.match(text, /OFFICIAL: Sensitive/);
  assert.match(text, /Overdue: <5/);
  assert.match(text, /Available places: 1/);
  assert.match(text, /Ready now: <5/);
  assert.doesNotMatch(text, /Overdue: 1/);
});
