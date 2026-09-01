// Shared explainer renderer (ADR 0096 / E1, v1.63.0).
// The single implementation of explainer word-selection logic; Explorer and Workshop each
// call this and lay the three parts into their own markup — see pspf-grand-plan.md E1.
import { PSPF_REQUIREMENT_REFERENCES } from "../generated/reference-data.js";
import { REQUIREMENT_EXPLAINERS } from "./section-explainers.js";

export interface RequirementExplainerFacts {
  /** Canonical PSPF requirement id, e.g. "REQ-PSPF-2025-001" (Workshop `RequirementEntity.id`, Explorer `Requirement.canonicalId`). */
  readonly requirementId: string;
  /** Caller-computed dynamic "why it matters" text (e.g. from `buildConsequenceStatement`); falls back to curated text when absent. */
  readonly consequenceStatement?: string;
  /** Caller-computed count of open blockers/actions gating this requirement; when > 0, produces a dynamic next-step sentence. */
  readonly openBlockerCount?: number;
}

export interface RequirementExplainer {
  readonly whatThisMeans: string;
  readonly whyItMatters: string;
  readonly whatToDoNext: string;
  readonly attribution: string;
  readonly sourceId: string;
  /** Undefined for a custom (non-baseline) requirement with no PSPF section to resolve. */
  readonly sectionCode?: string;
}

const FALLBACK_EXPLAINER: Omit<RequirementExplainer, "whyItMatters" | "whatToDoNext"> = {
  whatThisMeans: "This is a custom requirement, so no PSPF plain-language guidance is available for it yet.",
  attribution: "PSPF product team",
  sourceId: "custom-requirement"
};

function openBlockerSentence(openBlockerCount: number): string {
  const blockerWord = openBlockerCount === 1 ? "blocker is" : "blockers are";
  return `${openBlockerCount} open ${blockerWord} in the way of this being resolved — review them in Actions.`;
}

export function buildRequirementExplainer(facts: RequirementExplainerFacts): RequirementExplainer {
  const reference = PSPF_REQUIREMENT_REFERENCES.find((item) => item.requirementId === facts.requirementId);
  if (!reference) {
    return {
      ...FALLBACK_EXPLAINER,
      whyItMatters: facts.consequenceStatement ?? "No standard guidance is available for this custom requirement.",
      whatToDoNext:
        facts.openBlockerCount && facts.openBlockerCount > 0
          ? openBlockerSentence(facts.openBlockerCount)
          : "Record your own rationale for this requirement's current state."
    };
  }
  const explainer = REQUIREMENT_EXPLAINERS.find((item) => item.sectionCode === reference.sectionCode);
  if (!explainer) {
    return {
      ...FALLBACK_EXPLAINER,
      whyItMatters:
        facts.consequenceStatement ?? "No standard guidance is available for this requirement's section yet.",
      whatToDoNext:
        facts.openBlockerCount && facts.openBlockerCount > 0
          ? openBlockerSentence(facts.openBlockerCount)
          : "Record your own rationale for this requirement's current state.",
      sectionCode: reference.sectionCode
    };
  }
  return {
    whatThisMeans: explainer.whatThisMeans,
    whyItMatters: facts.consequenceStatement ?? explainer.whyItMattersFallback,
    whatToDoNext:
      facts.openBlockerCount && facts.openBlockerCount > 0
        ? openBlockerSentence(facts.openBlockerCount)
        : explainer.whatToDoNextFallback,
    attribution: explainer.attribution,
    sourceId: explainer.sourceId,
    sectionCode: explainer.sectionCode
  };
}
