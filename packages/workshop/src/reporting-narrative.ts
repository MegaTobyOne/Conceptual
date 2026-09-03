// Slice R3 (ADR 0097): pure helpers for editable narrative sections on the Reporting Workbench.
// Testable without vscode. Bodies are operator free text and stay sensitive; titles are slot labels only.
import type { EntityDraft, NarrativeEntity } from "@pspf/contracts";

const TITLE_LIMIT = 120;

const EXEC_BRIEF_SLOT_HEADINGS: Readonly<Record<string, string>> = {
  "exec-brief.where-we-stand": "Where we stand",
  "exec-brief.what-changed": "What changed",
  "exec-brief.top-exposures": "Top exposures",
  "exec-brief.decisions-needed": "Decisions needed",
  "exec-brief.what-happens-next": "What happens next"
};

export interface NarrativeDraftFields {
  readonly [key: string]: string | undefined;
}

export interface NarrativeDraftContext {
  readonly basedOnSnapshotId?: string;
}

export type NarrativeDraftResult =
  | { readonly ok: true; readonly draft: EntityDraft<"narrative">; readonly heading: string }
  | { readonly ok: false; readonly reason: string };

/** Title for a narrative record: the section heading when known, otherwise derived from the slot. */
export function narrativeTitleForSlot(slot: string, heading?: string): string {
  const trimmedHeading = heading?.trim() ?? "";
  if (trimmedHeading.length > 0) {
    return truncate(`Narrative: ${trimmedHeading}`);
  }
  const execHeading = EXEC_BRIEF_SLOT_HEADINGS[slot];
  if (execHeading) {
    return truncate(`Narrative: ${execHeading}`);
  }
  const parts = slot.split(".");
  if (parts.length === 3 && parts[0] === "domain") {
    return truncate(`Narrative: Domain ${parts[1]}`);
  }
  return truncate(`Narrative: ${slot}`);
}

/** Validates webview form fields and maps them to a narrative entity draft. */
export function buildNarrativeDraft(
  fields: NarrativeDraftFields,
  context: NarrativeDraftContext
): NarrativeDraftResult {
  const slot = fields.slot?.trim() ?? "";
  if (slot.length === 0) {
    return { ok: false, reason: "The narrative has no section slot." };
  }
  const body = fields.body?.trim() ?? "";
  if (body.length === 0) {
    return { ok: false, reason: "Write something before saving, or choose Use generated to keep the generated text." };
  }
  const heading = fields.heading?.trim() ?? "";
  const targetType = fields.targetType?.trim() ?? "";
  const targetId = fields.targetId?.trim() ?? "";
  const supersedesId = fields.supersedesId?.trim() ?? "";
  return {
    ok: true,
    heading: heading || narrativeTitleForSlot(slot).replace(/^Narrative: /, ""),
    draft: {
      entityType: "narrative",
      title: narrativeTitleForSlot(slot, heading),
      slot,
      body,
      audience: "executive",
      ...(context.basedOnSnapshotId ? { basedOnSnapshotId: context.basedOnSnapshotId } : {}),
      ...(targetType && targetId ? { targetType, targetId } : {}),
      ...(supersedesId ? { supersedesId } : {})
    }
  };
}

export type RestoreTarget =
  /** The superseded record is still active: retiring `current` makes it the active record again. */
  | { readonly mode: "retire-current"; readonly current: NarrativeEntity; readonly previous: NarrativeEntity }
  /** The superseded record was retired earlier: copy its body into a new record that supersedes `current`. */
  | { readonly mode: "recreate"; readonly current: NarrativeEntity; readonly previous: NarrativeEntity };

/**
 * Works out how to bring back the narrative `current` superseded. The renderer treats a slot's
 * active record as the one not named by any other active record's `supersedesId`, so retiring the
 * superseder is enough when the previous record is still active. Returns undefined when `current`
 * supersedes nothing, or the previous record is missing or filed under a different slot.
 */
export function resolveRestoreTarget(
  current: NarrativeEntity,
  allNarratives: readonly NarrativeEntity[]
): RestoreTarget | undefined {
  if (!current.supersedesId || current.supersedesId === current.id) {
    return undefined;
  }
  const previous = allNarratives.find((item) => item.id === current.supersedesId);
  if (!previous || previous.slot !== current.slot || previous.body.trim().length === 0) {
    return undefined;
  }
  return previous.recordStatus === "active"
    ? { mode: "retire-current", current, previous }
    : { mode: "recreate", current, previous };
}

/**
 * `current` plus every active record it transitively supersedes. Retiring only the head of the
 * chain would make its predecessor active again, so "Use generated" retires the whole chain.
 */
export function collectRetireChain(
  current: NarrativeEntity,
  allNarratives: readonly NarrativeEntity[]
): readonly NarrativeEntity[] {
  const byId = new Map(allNarratives.map((item) => [item.id, item]));
  const chain: NarrativeEntity[] = [];
  const seen = new Set<string>();
  let cursor: NarrativeEntity | undefined = current;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (cursor.recordStatus === "active" && cursor.slot === current.slot) {
      chain.push(cursor);
    }
    cursor = cursor.supersedesId ? byId.get(cursor.supersedesId) : undefined;
  }
  return chain;
}

function truncate(value: string): string {
  return value.length <= TITLE_LIMIT ? value : `${value.slice(0, TITLE_LIMIT - 1)}…`;
}
