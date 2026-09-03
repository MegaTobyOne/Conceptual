import type { V01Entity } from "@pspf/contracts";

/**
 * Distinct owner-team labels already recorded on Actions and Requirements, sorted
 * en-AU. Duplicates are folded case-insensitively, keeping the first-seen casing so
 * the pick list reflects how the operator actually typed the team name.
 */
export function collectOwnerTeams(entities: readonly V01Entity[]): string[] {
  const byKey = new Map<string, string>();
  for (const entity of entities) {
    if (entity.recordStatus === "deleted") {
      continue;
    }
    if (entity.entityType !== "action" && entity.entityType !== "requirement") {
      continue;
    }
    const team = entity.ownerTeam?.trim();
    if (!team) {
      continue;
    }
    const key = team.toLocaleLowerCase("en-AU");
    if (!byKey.has(key)) {
      byKey.set(key, team);
    }
  }
  return [...byKey.values()].sort((left, right) => left.localeCompare(right, "en-AU", { sensitivity: "base" }));
}
