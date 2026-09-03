// Slice R4 (ADR 0097, v1.74.0): Reporting Workbench suggested actions — scope the gaps, rank them,
// and turn only the operator's ticked suggestions into Action drafts. Pure apart from the explainer import.
import type { ReportingPackScope } from "@pspf/brief-renderer";
import {
  buildSuggestedActions,
  withEnvelope,
  type ActionEntity,
  type LinkEntity,
  type RequirementEntity,
  type RiskEntity,
  type SuggestedAction,
  type SuggestedActionExplainer,
  type V01Entity
} from "@pspf/contracts";
import { buildRequirementExplainer } from "@pspf/reference-data";
import { formatShortAuDateTime } from "./workshop-ui.js";

export const WORKBENCH_SUGGESTION_LIMIT = 10;

export type SuggestionExplainerLookup = (requirementId: string) => SuggestedActionExplainer | undefined;

// Suggestions only exist for gaps with no open action, so the explainer's open-blocker count is always 0.
export const defaultSuggestionExplainer: SuggestionExplainerLookup = (requirementId) => {
  const explainer = buildRequirementExplainer({ requirementId, openBlockerCount: 0 });
  return {
    whatToDoNext: explainer.whatToDoNext,
    ...(explainer.sectionCode ? { sectionCode: explainer.sectionCode } : {})
  };
};

export function buildWorkbenchSuggestions(
  allEntities: readonly V01Entity[],
  scope: ReportingPackScope,
  now: string,
  explainerFor: SuggestionExplainerLookup = defaultSuggestionExplainer
): readonly SuggestedAction[] {
  const scopedDomainIds = new Set(scope.domainIds);
  return buildSuggestedActions({
    requirements: allEntities.filter(
      (entity): entity is RequirementEntity =>
        entity.entityType === "requirement" && (scope.kind === "all" || scopedDomainIds.has(entity.domainId))
    ),
    actions: allEntities.filter((entity): entity is ActionEntity => entity.entityType === "action"),
    links: allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link"),
    risks: allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk"),
    now,
    explainerFor,
    limit: WORKBENCH_SUGGESTION_LIMIT
  });
}

export interface AcceptedActionDraft {
  readonly action: ActionEntity;
  readonly link: LinkEntity;
}

/** One Action plus its requirement→action `addressed-by` link per selected suggestion; unknown ids are ignored. */
export function buildAcceptedActionDrafts(
  suggestions: readonly SuggestedAction[],
  selectedRequirementIds: readonly string[],
  now: string
): readonly AcceptedActionDraft[] {
  const selected = new Set(selectedRequirementIds);
  return suggestions
    .filter((suggestion) => selected.has(suggestion.requirementId))
    .map((suggestion) => {
      const action = withEnvelope(
        "action",
        {
          entityType: "action",
          title: suggestion.title,
          status: "todo",
          dueDate: formatShortAuDateTime(suggestion.suggestedDueDate) ?? suggestion.suggestedDueDate,
          ...(suggestion.ownerTeam ? { ownerTeam: suggestion.ownerTeam } : {}),
          commentary: [{ createdAt: now, text: suggestion.rationale }]
        },
        "workshop"
      );
      const link = withEnvelope(
        "link",
        {
          entityType: "link",
          title: `${suggestion.requirementTitle} addressed by ${action.title}`,
          linkType: "addressed-by",
          fromId: suggestion.requirementId,
          fromType: "requirement",
          toId: action.id,
          toType: "action"
        },
        "workshop"
      );
      return { action, link };
    });
}
