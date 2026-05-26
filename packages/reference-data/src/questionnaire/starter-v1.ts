import type { QuestionnairePack, QuestionnaireQuestion } from "@pspf/contracts";

function q(input: QuestionnaireQuestion): QuestionnaireQuestion {
  return input;
}

export const QUESTIONNAIRE_STARTER_PACK: QuestionnairePack = {
  packId: "starter-v1",
  packVersion: "1.0.0",
  title: "PSPF Starter Questionnaire",
  description:
    "Curated starter questionnaire that asks the highest-leverage protective security questions across the six PSPF Release 2025 Domain families. Populates a workspace with Requirements, Evidence, Actions, and review cycles based on your real answers.",
  scope: "starter",
  questions: [
    q({
      id: "q.gov.security-plan",
      domain: "GOV",
      requirementRefs: ["REQ-PSPF-2025-002"],
      prompt: "Does your entity have a current Accountable Authority-endorsed protective security plan?",
      helpText:
        "PSPF Domain GOV expects each entity to maintain a current protective security plan endorsed by the Accountable Authority and reviewed regularly.",
      evidenceTemplate: {
        title: "Protective security plan",
        type: "policy-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach evidence for the protective security plan", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Update the protective security plan to meet PSPF Domain GOV",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: { title: "Establish an endorsed protective security plan", priority: "high", dueOffsetDays: 30 },
        unknown: {
          title: "Investigate whether a current protective security plan exists",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "No endorsed protective security plan in place",
        likelihood: "possible",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.gov.cso-appointed",
      domain: "GOV",
      requirementRefs: ["REQ-PSPF-2025-003"],
      prompt: "Has your entity appointed a Chief Security Officer with documented authority?",
      helpText:
        "PSPF Domain GOV expects a Chief Security Officer appointed by the Accountable Authority with clear authority over protective security.",
      evidenceTemplate: {
        title: "Chief Security Officer appointment record",
        type: "appointment-record",
        defaultReviewCycleDays: 730,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the Chief Security Officer appointment record", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Clarify and document Chief Security Officer authority",
          priority: "medium",
          dueOffsetDays: 45
        },
        no: {
          title: "Appoint a Chief Security Officer with documented authority",
          priority: "high",
          dueOffsetDays: 30
        },
        unknown: {
          title: "Investigate whether a Chief Security Officer has been appointed",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "No appointed Chief Security Officer",
        likelihood: "possible",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.gov.annual-reporting",
      domain: "GOV",
      requirementRefs: ["REQ-PSPF-2025-004"],
      prompt: "Did your entity submit a protective security annual report in the last reporting cycle?",
      helpText: "PSPF Domain GOV requires entities to report their protective security posture annually.",
      evidenceTemplate: {
        title: "Most recent protective security annual report",
        type: "report",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: {
          title: "Attach the most recent protective security annual report",
          priority: "medium",
          dueOffsetDays: 30
        },
        partial: { title: "Complete outstanding sections of the annual report", priority: "high", dueOffsetDays: 45 },
        no: {
          title: "Prepare and submit the next protective security annual report",
          priority: "high",
          dueOffsetDays: 60
        },
        unknown: {
          title: "Investigate the status of the most recent annual report",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.risk-management-framework",
      domain: "RISK",
      requirementRefs: ["REQ-PSPF-2025-036"],
      prompt: "Does your entity maintain a current protective security risk management framework?",
      helpText:
        "PSPF Domain RISK expects entities to apply a documented protective security risk management framework.",
      evidenceTemplate: {
        title: "Protective security risk management framework",
        type: "policy-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: {
          title: "Attach the protective security risk management framework",
          priority: "medium",
          dueOffsetDays: 30
        },
        partial: {
          title: "Update the risk management framework to meet PSPF Domain RISK",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: { title: "Establish a protective security risk management framework", priority: "high", dueOffsetDays: 60 },
        unknown: {
          title: "Investigate the state of the protective security risk management framework",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "No documented protective security risk management framework",
        likelihood: "likely",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.risk-register-current",
      domain: "RISK",
      requirementRefs: ["REQ-PSPF-2025-037"],
      prompt: "Is your protective security risk register reviewed at least annually?",
      helpText: "PSPF Domain RISK expects the protective security risk register to be reviewed at planned intervals.",
      evidenceTemplate: {
        title: "Risk register review record",
        type: "review-record",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the most recent risk register review record", priority: "medium", dueOffsetDays: 30 },
        partial: { title: "Complete outstanding risk register reviews", priority: "medium", dueOffsetDays: 60 },
        no: { title: "Schedule and complete a risk register review", priority: "high", dueOffsetDays: 45 },
        unknown: { title: "Investigate the status of the risk register", priority: "high", dueOffsetDays: 14 }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.info.classification-scheme",
      domain: "INFO",
      requirementRefs: ["REQ-PSPF-2025-058"],
      prompt: "Does your entity apply the Australian Government information classification scheme?",
      helpText:
        "PSPF Domain INFO expects entities to apply the Australian Government information classification scheme to all official information.",
      evidenceTemplate: {
        title: "Information classification policy",
        type: "policy-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the information classification policy", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Extend the classification scheme to cover all official information",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: {
          title: "Adopt the Australian Government information classification scheme",
          priority: "high",
          dueOffsetDays: 60
        },
        unknown: {
          title: "Investigate whether an information classification policy exists",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "Information classification scheme not applied",
        likelihood: "likely",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.info.handling-procedures",
      domain: "INFO",
      requirementRefs: ["REQ-PSPF-2025-059"],
      prompt: "Are information handling procedures published for each classification?",
      helpText:
        "PSPF Domain INFO expects entities to publish handling procedures for each classification, including storage, transmission, and destruction.",
      evidenceTemplate: {
        title: "Information handling procedures",
        type: "procedure-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the information handling procedures", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Extend information handling procedures to all classifications",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: {
          title: "Publish information handling procedures for each classification",
          priority: "high",
          dueOffsetDays: 60
        },
        unknown: {
          title: "Investigate whether information handling procedures are published",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.tech.cyber-security-strategy",
      domain: "TECH",
      requirementRefs: ["REQ-PSPF-2025-084"],
      prompt: "Does your entity maintain a current cyber security strategy?",
      helpText:
        "PSPF Domain TECH expects entities to maintain a documented cyber security strategy aligned with PSPF and ISM.",
      evidenceTemplate: {
        title: "Cyber security strategy",
        type: "strategy-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the cyber security strategy", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Refresh the cyber security strategy to meet PSPF Domain TECH",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: { title: "Establish a documented cyber security strategy", priority: "high", dueOffsetDays: 60 },
        unknown: {
          title: "Investigate whether a current cyber security strategy exists",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "No documented cyber security strategy",
        likelihood: "likely",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.tech.essential-eight",
      domain: "TECH",
      requirementRefs: ["REQ-PSPF-2025-085"],
      prompt: "Has your entity assessed its Essential Eight maturity in the last twelve months?",
      helpText: "PSPF Domain TECH expects entities to assess and report Essential Eight maturity at planned intervals.",
      evidenceTemplate: {
        title: "Essential Eight maturity assessment",
        type: "assessment-report",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: {
          title: "Attach the most recent Essential Eight maturity assessment",
          priority: "medium",
          dueOffsetDays: 30
        },
        partial: { title: "Complete the Essential Eight maturity assessment", priority: "medium", dueOffsetDays: 60 },
        no: {
          title: "Schedule and complete an Essential Eight maturity assessment",
          priority: "high",
          dueOffsetDays: 45
        },
        unknown: {
          title: "Investigate Essential Eight maturity assessment status",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.per.eligibility-and-suitability",
      domain: "PER",
      requirementRefs: ["REQ-PSPF-2025-116"],
      prompt:
        "Does your entity verify the eligibility and suitability of all personnel with ongoing access to official resources?",
      helpText:
        "PSPF Domain PER expects entities to verify personnel eligibility and suitability before granting ongoing access.",
      evidenceTemplate: {
        title: "Personnel eligibility and suitability policy",
        type: "policy-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: {
          title: "Attach the personnel eligibility and suitability policy",
          priority: "medium",
          dueOffsetDays: 30
        },
        partial: {
          title: "Strengthen personnel eligibility and suitability checks",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: { title: "Establish personnel eligibility and suitability checks", priority: "high", dueOffsetDays: 60 },
        unknown: {
          title: "Investigate personnel eligibility and suitability arrangements",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "Personnel eligibility and suitability not verified",
        likelihood: "likely",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.per.security-awareness",
      domain: "PER",
      requirementRefs: ["REQ-PSPF-2025-117"],
      prompt: "Do all personnel complete protective security awareness training at least annually?",
      helpText:
        "PSPF Domain PER expects entities to provide and refresh protective security awareness training for all personnel.",
      evidenceTemplate: {
        title: "Security awareness training register",
        type: "training-register",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the security awareness training register", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Extend security awareness training to outstanding personnel",
          priority: "medium",
          dueOffsetDays: 60
        },
        no: {
          title: "Establish and deliver protective security awareness training",
          priority: "high",
          dueOffsetDays: 60
        },
        unknown: { title: "Investigate the status of security awareness training", priority: "high", dueOffsetDays: 14 }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.per.separation-procedure",
      domain: "PER",
      requirementRefs: ["REQ-PSPF-2025-118"],
      prompt:
        "Does your entity have a documented separation procedure that withdraws access on the day personnel leave?",
      helpText: "PSPF Domain PER expects timely withdrawal of access when personnel separate from the entity.",
      evidenceTemplate: {
        title: "Personnel separation procedure",
        type: "procedure-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the personnel separation procedure", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Tighten the separation procedure to remove access on day of separation",
          priority: "medium",
          dueOffsetDays: 45
        },
        no: { title: "Establish a documented personnel separation procedure", priority: "high", dueOffsetDays: 45 },
        unknown: { title: "Investigate the personnel separation procedure", priority: "high", dueOffsetDays: 14 }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.phys.security-zones",
      domain: "PHYS",
      requirementRefs: ["REQ-PSPF-2025-189"],
      prompt: "Does your entity classify and protect physical sites using PSPF security zones?",
      helpText:
        "PSPF Domain PHYS expects entities to apply the security zone scheme to physical sites that hold or process official information.",
      evidenceTemplate: {
        title: "Physical security zone schedule",
        type: "policy-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the physical security zone schedule", priority: "medium", dueOffsetDays: 30 },
        partial: { title: "Extend security zones to all in-scope sites", priority: "medium", dueOffsetDays: 60 },
        no: { title: "Classify physical sites using PSPF security zones", priority: "high", dueOffsetDays: 60 },
        unknown: { title: "Investigate physical security zone classification", priority: "high", dueOffsetDays: 14 }
      },
      riskTemplate: {
        applyOnAnswers: ["no"],
        title: "Physical sites not classified under PSPF security zones",
        likelihood: "possible",
        consequence: "major"
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.phys.access-control-review",
      domain: "PHYS",
      requirementRefs: ["REQ-PSPF-2025-190"],
      prompt: "Are physical access controls reviewed at least annually?",
      helpText:
        "PSPF Domain PHYS expects regular review of physical access controls, including issued passes and visitor management.",
      evidenceTemplate: {
        title: "Physical access control review record",
        type: "review-record",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the most recent physical access control review", priority: "medium", dueOffsetDays: 30 },
        partial: {
          title: "Complete outstanding physical access control reviews",
          priority: "medium",
          dueOffsetDays: 45
        },
        no: { title: "Schedule and complete a physical access control review", priority: "high", dueOffsetDays: 45 },
        unknown: {
          title: "Investigate the status of physical access control reviews",
          priority: "high",
          dueOffsetDays: 14
        }
      },
      publicationPolicy: "internal"
    }),
    q({
      id: "q.phys.security-incident-procedure",
      domain: "PHYS",
      requirementRefs: ["REQ-PSPF-2025-191"],
      prompt: "Does your entity have a documented physical security incident procedure?",
      helpText:
        "PSPF Domain PHYS expects entities to document and rehearse physical security incident response procedures.",
      evidenceTemplate: {
        title: "Physical security incident procedure",
        type: "procedure-document",
        defaultReviewCycleDays: 365,
        promptFor: "url-or-note"
      },
      actionTemplates: {
        yes: { title: "Attach the physical security incident procedure", priority: "medium", dueOffsetDays: 30 },
        partial: { title: "Update the physical security incident procedure", priority: "medium", dueOffsetDays: 60 },
        no: { title: "Document a physical security incident procedure", priority: "high", dueOffsetDays: 60 },
        unknown: { title: "Investigate the physical security incident procedure", priority: "high", dueOffsetDays: 14 }
      },
      publicationPolicy: "internal"
    })
  ]
};

export const QUESTIONNAIRE_DOMAIN_PACKS: ReadonlyArray<QuestionnairePack> = [
  {
    packId: "deep-dive-gov-v1",
    packVersion: "1.0.0",
    title: "PSPF Domain Deep Dive: Governance (GOV)",
    description: "Re-runnable governance questionnaire covering the PSPF Domain GOV anchor questions.",
    scope: "domain-deep-dive",
    domain: "GOV",
    questions: QUESTIONNAIRE_STARTER_PACK.questions.filter((question) => question.domain === "GOV")
  },
  {
    packId: "deep-dive-risk-v1",
    packVersion: "1.0.0",
    title: "PSPF Domain Deep Dive: Security risk management (RISK)",
    description: "Re-runnable security risk management questionnaire covering the PSPF Domain RISK anchor questions.",
    scope: "domain-deep-dive",
    domain: "RISK",
    questions: QUESTIONNAIRE_STARTER_PACK.questions.filter((question) => question.domain === "RISK")
  },
  {
    packId: "deep-dive-info-v1",
    packVersion: "1.0.0",
    title: "PSPF Domain Deep Dive: Information (INFO)",
    description: "Re-runnable information security questionnaire covering the PSPF Domain INFO anchor questions.",
    scope: "domain-deep-dive",
    domain: "INFO",
    questions: QUESTIONNAIRE_STARTER_PACK.questions.filter((question) => question.domain === "INFO")
  },
  {
    packId: "deep-dive-tech-v1",
    packVersion: "1.0.0",
    title: "PSPF Domain Deep Dive: Technology (TECH)",
    description: "Re-runnable technology security questionnaire covering the PSPF Domain TECH anchor questions.",
    scope: "domain-deep-dive",
    domain: "TECH",
    questions: QUESTIONNAIRE_STARTER_PACK.questions.filter((question) => question.domain === "TECH")
  },
  {
    packId: "deep-dive-per-v1",
    packVersion: "1.0.0",
    title: "PSPF Domain Deep Dive: Personnel (PER)",
    description: "Re-runnable personnel security questionnaire covering the PSPF Domain PER anchor questions.",
    scope: "domain-deep-dive",
    domain: "PER",
    questions: QUESTIONNAIRE_STARTER_PACK.questions.filter((question) => question.domain === "PER")
  },
  {
    packId: "deep-dive-phys-v1",
    packVersion: "1.0.0",
    title: "PSPF Domain Deep Dive: Physical (PHYS)",
    description: "Re-runnable physical security questionnaire covering the PSPF Domain PHYS anchor questions.",
    scope: "domain-deep-dive",
    domain: "PHYS",
    questions: QUESTIONNAIRE_STARTER_PACK.questions.filter((question) => question.domain === "PHYS")
  }
];

export function getQuestionnairePackById(packId: string): QuestionnairePack | undefined {
  if (packId === QUESTIONNAIRE_STARTER_PACK.packId) {
    return QUESTIONNAIRE_STARTER_PACK;
  }
  return QUESTIONNAIRE_DOMAIN_PACKS.find((pack) => pack.packId === packId);
}
