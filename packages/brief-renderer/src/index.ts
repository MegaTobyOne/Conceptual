import type { ActionEntity, DirectionEntity, DomainEntity, EvidenceEntity, LinkEntity, RequirementEntity, RiskEntity } from "@pspf/contracts";

export interface PostureBriefInput {
  readonly generatedAt: Date | string;
  readonly requirements: readonly RequirementEntity[];
  readonly evidence: readonly EvidenceEntity[];
  readonly actions: readonly ActionEntity[];
  readonly risks: readonly RiskEntity[];
  readonly links: readonly LinkEntity[];
  readonly domains: readonly Pick<DomainEntity, "id" | "title">[];
  readonly directions?: readonly DirectionEntity[];
  readonly sourceLabel?: string;
  readonly bundleVersion?: string;
  readonly schemaVersion?: string;
}

export function renderPostureBriefMarkdown(input: PostureBriefInput): string {
  const requirementsById = new Map(input.requirements.map((requirement) => [requirement.id, requirement]));
  const requirementTitlesByTargetId = buildRequirementTitlesByTargetId(input.links, requirementsById);
  const evidenceIdsByRequirement = buildIdsByRequirement(input.links, "supported-by", "evidence");
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const openActions = input.actions.filter((action) => !["done", "cancelled"].includes(action.status));
  const openRisks = input.risks.filter((risk) => risk.status !== "closed");
  const directions = input.directions ?? [];
  const directionsNeedingResponse = directions.filter((direction) => direction.responseState === "not-set" || direction.responseState === "no").length;
  const currentEvidenceRequirements = input.requirements.filter((requirement) => (evidenceIdsByRequirement.get(requirement.id) ?? []).some((evidenceId) => evidenceById.get(evidenceId)?.freshness === "current")).length;
  const evidenceNeedsReview = input.evidence.filter((item) => item.freshness !== "current").length;
  const metadata = [
    `Generated: ${formatDisplayDate(input.generatedAt)}`,
    input.sourceLabel ? `Source: ${input.sourceLabel}` : undefined,
    input.bundleVersion ? `Bundle version: ${input.bundleVersion}` : undefined,
    input.schemaVersion ? `Schema version: ${input.schemaVersion}` : undefined
  ].filter((line): line is string => Boolean(line));

  return [
    "OFFICIAL: Sensitive",
    "",
    "# PSPF Posture Brief",
    "",
    ...metadata,
    "",
    "## Summary",
    "",
    `- Requirements: ${input.requirements.length}`,
    `- Evidence items: ${input.evidence.length}`,
    `- Actions: ${input.actions.length}`,
    `- Risks: ${input.risks.length}`,
    `- Directions: ${directions.length}${directions.length > 0 ? ` (${directionsNeedingResponse} need a response)` : ""}`,
    "",
    "## Requirement Status",
    "",
    ...statusRows(input.requirements),
    "",
    "## Evidence Basis",
    "",
    `- Requirements with current evidence: ${currentEvidenceRequirements}`,
    `- Evidence needing freshness review: ${evidenceNeedsReview}`,
    "",
    "## Domain Summary",
    "",
    ...input.domains.map((domain) => {
      const domainRequirements = input.requirements.filter((requirement) => requirement.domainId === domain.id);
      const domainMet = domainRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
      return `- ${domain.title}: ${domainRequirements.length} requirement(s), ${domainMet} met`;
    }),
    "",
    "## Open Actions",
    "",
    ...(openActions.length === 0 ? ["- None recorded."] : openActions.map((action) => `- ${action.title} (${label(action.status)}${action.dueDate ? `, due ${action.dueDate}` : ""}) - ${requirementTitlesByTargetId.get(action.id) ?? "No linked requirement"}`)),
    "",
    "## Open Risks",
    "",
    ...(openRisks.length === 0 ? ["- None recorded."] : openRisks.map((risk) => `- ${risk.title} (${label(risk.status)}, likelihood ${risk.likelihood}, impact ${risk.impact}) - ${requirementTitlesByTargetId.get(risk.id) ?? "No linked requirement"}`)),
    "",
    "## Directions",
    "",
    ...(directions.length === 0 ? ["- None registered."] : directions.map((direction) => `- ${direction.reference}: ${direction.title} (${label(direction.responseState)}${direction.sourceAuthority ? `, ${direction.sourceAuthority}` : ""})`)),
    "",
    "Note: internal summaries and restricted personal fields are excluded from this brief."
  ].join("\n");
}

export const POSTURE_BRIEF_BROWSER_SCRIPT = String.raw`globalThis.pspfBriefRenderer = (() => {
  function renderPostureBriefMarkdown(input) {
    const requirementsById = new Map((input.requirements || []).map((requirement) => [requirement.id, requirement]));
    const requirementTitlesByTargetId = buildRequirementTitlesByTargetId(input.links || [], requirementsById);
    const evidenceIdsByRequirement = buildIdsByRequirement(input.links || [], "supported-by", "evidence");
    const evidenceById = new Map((input.evidence || []).map((item) => [item.id, item]));
    const openActions = (input.actions || []).filter((action) => !["done", "cancelled"].includes(action.status));
    const openRisks = (input.risks || []).filter((risk) => risk.status !== "closed");
    const directions = input.directions || [];
    const directionsNeedingResponse = directions.filter((direction) => direction.responseState === "not-set" || direction.responseState === "no").length;
    const currentEvidenceRequirements = (input.requirements || []).filter((requirement) => (evidenceIdsByRequirement.get(requirement.id) || []).some((evidenceId) => evidenceById.get(evidenceId)?.freshness === "current")).length;
    const evidenceNeedsReview = (input.evidence || []).filter((item) => item.freshness !== "current").length;
    const metadata = [
      "Generated: " + formatDisplayDate(input.generatedAt),
      input.sourceLabel ? "Source: " + input.sourceLabel : undefined,
      input.bundleVersion ? "Bundle version: " + input.bundleVersion : undefined,
      input.schemaVersion ? "Schema version: " + input.schemaVersion : undefined
    ].filter(Boolean);
    return [
      "OFFICIAL: Sensitive",
      "",
      "# PSPF Posture Brief",
      "",
      ...metadata,
      "",
      "## Summary",
      "",
      "- Requirements: " + (input.requirements || []).length,
      "- Evidence items: " + (input.evidence || []).length,
      "- Actions: " + (input.actions || []).length,
      "- Risks: " + (input.risks || []).length,
      "- Directions: " + directions.length + (directions.length > 0 ? " (" + directionsNeedingResponse + " need a response)" : ""),
      "",
      "## Requirement Status",
      "",
      ...statusRows(input.requirements || []),
      "",
      "## Evidence Basis",
      "",
      "- Requirements with current evidence: " + currentEvidenceRequirements,
      "- Evidence needing freshness review: " + evidenceNeedsReview,
      "",
      "## Domain Summary",
      "",
      ...(input.domains || []).map((domain) => {
        const domainRequirements = (input.requirements || []).filter((requirement) => requirement.domainId === domain.id);
        const domainMet = domainRequirements.filter((requirement) => requirement.assessmentStatus === "met").length;
        return "- " + domain.title + ": " + domainRequirements.length + " requirement(s), " + domainMet + " met";
      }),
      "",
      "## Open Actions",
      "",
      ...(openActions.length === 0 ? ["- None recorded."] : openActions.map((action) => "- " + action.title + " (" + label(action.status) + (action.dueDate ? ", due " + action.dueDate : "") + ") - " + (requirementTitlesByTargetId.get(action.id) || "No linked requirement"))),
      "",
      "## Open Risks",
      "",
      ...(openRisks.length === 0 ? ["- None recorded."] : openRisks.map((risk) => "- " + risk.title + " (" + label(risk.status) + ", likelihood " + risk.likelihood + ", impact " + risk.impact + ") - " + (requirementTitlesByTargetId.get(risk.id) || "No linked requirement"))),
      "",
      "## Directions",
      "",
      ...(directions.length === 0 ? ["- None registered."] : directions.map((direction) => "- " + direction.reference + ": " + direction.title + " (" + label(direction.responseState) + (direction.sourceAuthority ? ", " + direction.sourceAuthority : "") + ")")),
      "",
      "Note: internal summaries and restricted personal fields are excluded from this brief."
    ].join("\n");
  }
  function statusRows(requirements) {
    const counts = countBy(requirements, (requirement) => requirement.assessmentStatus);
    const rows = Object.entries(counts).map(([status, count]) => "- " + label(status) + ": " + count);
    return rows.length > 0 ? rows : ["- None recorded."];
  }
  function buildRequirementTitlesByTargetId(links, requirementsById) {
    const titlesByTargetId = new Map();
    for (const link of links) {
      if (link.fromType !== "requirement") {
        continue;
      }
      const requirement = requirementsById.get(link.fromId);
      if (!requirement) {
        continue;
      }
      titlesByTargetId.set(link.toId, [...(titlesByTargetId.get(link.toId) || []), requirement.title]);
    }
    return new Map(Array.from(titlesByTargetId.entries()).map(([targetId, titles]) => [targetId, titles.join("; ")]));
  }
  function buildIdsByRequirement(links, linkType, toType) {
    const idsByRequirement = new Map();
    for (const link of links) {
      if (link.fromType === "requirement" && link.linkType === linkType && link.toType === toType) {
        idsByRequirement.set(link.fromId, [...(idsByRequirement.get(link.fromId) || []), link.toId]);
      }
    }
    return idsByRequirement;
  }
  function countBy(items, getKey) {
    const counts = {};
    for (const item of items) {
      const key = getKey(item);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
  function label(value) {
    return String(value).replaceAll("-", " ").replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase()).replace(/^./, (letter) => letter.toUpperCase());
  }
  function formatDisplayDate(value) {
    return value ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "unknown";
  }
  return { renderPostureBriefMarkdown };
})();`;

function statusRows(requirements: readonly RequirementEntity[]): readonly string[] {
  const rows = Object.entries(countBy(requirements, (requirement) => requirement.assessmentStatus)).map(([status, count]) => `- ${label(status)}: ${count}`);
  return rows.length > 0 ? rows : ["- None recorded."];
}

function buildRequirementTitlesByTargetId(links: readonly LinkEntity[], requirementsById: ReadonlyMap<string, RequirementEntity>): ReadonlyMap<string, string> {
  const titlesByTargetId = new Map<string, string[]>();
  for (const link of links) {
    if (link.fromType !== "requirement") {
      continue;
    }
    const requirement = requirementsById.get(link.fromId);
    if (!requirement) {
      continue;
    }
    titlesByTargetId.set(link.toId, [...(titlesByTargetId.get(link.toId) ?? []), requirement.title]);
  }
  return new Map(Array.from(titlesByTargetId.entries()).map(([targetId, titles]) => [targetId, titles.join("; ")]));
}

function buildIdsByRequirement(links: readonly LinkEntity[], linkType: string, toType: string): ReadonlyMap<string, readonly string[]> {
  const idsByRequirement = new Map<string, string[]>();
  for (const link of links) {
    if (link.fromType === "requirement" && link.linkType === linkType && link.toType === toType) {
      idsByRequirement.set(link.fromId, [...(idsByRequirement.get(link.fromId) ?? []), link.toId]);
    }
  }
  return idsByRequirement;
}

function countBy<T>(items: readonly T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function label(value: string): string {
  return value.replaceAll("-", " ").replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (letter) => letter.toUpperCase());
}

function formatDisplayDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}