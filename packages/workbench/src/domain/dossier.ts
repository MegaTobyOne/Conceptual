import type { Edition, Matter, ProfileId, TrailItem, TrailType } from "./types.ts";

/** The seven information types that measure recovery (decision register, 2026-10-06). */
export const RECOVERY_TYPES = [
  "ask",
  "proposed-action",
  "owner",
  "decision",
  "status",
  "outcome",
  "delay-reason"
] as const satisfies readonly TrailType[];

export interface Profile {
  id: ProfileId;
  label: string;
  /** Candidate questions only; a profile grants no access and no decision authority. */
  questions: { text: string; types: TrailType[] }[];
  readiness: string[];
}

export const PROFILES: Record<ProfileId, Profile> = {
  ciso: {
    id: "ciso",
    label: "CISO",
    questions: [
      { text: "What is being asked, and by whom?", types: ["ask"] },
      { text: "What advice or action is proposed?", types: ["advice", "proposed-action"] },
      { text: "What is the current status and the evidence behind it?", types: ["status"] },
      { text: "What escalation or decision is needed?", types: ["decision", "open-question"] }
    ],
    readiness: ["Every decision names a source", "Contradicting or missing evidence is listed"]
  },
  ops: {
    id: "ops",
    label: "Ops",
    questions: [
      { text: "What are the next steps?", types: ["proposed-action"] },
      { text: "Who owns them?", types: ["owner"] },
      { text: "What would show it is done?", types: ["outcome", "status"] },
      { text: "Where does a blocked step get help?", types: ["delay-reason", "open-question"] }
    ],
    readiness: ["Each step has an owner or is marked unknown", "Expected result is stated"]
  },
  committee: {
    id: "committee",
    label: "Committee (DIDC example)",
    questions: [
      { text: "What decision or noting is requested?", types: ["ask"] },
      { text: "What advice has been given?", types: ["advice"] },
      { text: "What has the committee decided, if anything?", types: ["decision"] },
      { text: "What is still waiting on a decision owner?", types: ["open-question", "delay-reason"] }
    ],
    readiness: ["Remit and decision rights are verified, not assumed", "Advice is not shown as approval"]
  }
};

export interface Position {
  type: TrailType;
  item?: TrailItem;
  /** True when nothing is recorded: the dossier shows "unknown", never an inference. */
  unknown: boolean;
}

export interface Dossier {
  matter: Matter;
  positions: Position[];
  advice: TrailItem[];
  openQuestions: TrailItem[];
  warnings: string[];
  sinceReview: TrailItem[];
  sinceIssue: TrailItem[];
  latestEdition?: Edition;
}

function currentItems(items: TrailItem[]): TrailItem[] {
  const superseded = new Set(items.map((i) => i.supersedes).filter(Boolean));
  return items.filter((i) => !superseded.has(i.id));
}

function latest(items: TrailItem[]): TrailItem | undefined {
  return [...items].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)).at(-1);
}

/** Derived view over stored records; nothing here is persisted. */
export function buildDossier(matter: Matter, trail: TrailItem[], editions: Edition[]): Dossier {
  const mine = currentItems(trail.filter((t) => t.matterId === matter.id));
  const positions: Position[] = RECOVERY_TYPES.map((type) => {
    const item = latest(mine.filter((t) => t.type === type));
    return item ? { type, item, unknown: item.state !== "known" } : { type, unknown: true };
  });

  const advice = mine.filter((t) => t.type === "advice");
  const decision = positions.find((p) => p.type === "decision");
  const warnings: string[] = [];
  if (advice.length > 0 && (!decision?.item || decision.unknown)) {
    warnings.push("Advice is recorded but no decision is; advice is not approval.");
  }
  if (decision?.item?.state === "known" && !decision.item.source) {
    warnings.push("The recorded decision has no source.");
  }

  const latestEdition = [...editions.filter((e) => e.matterId === matter.id)]
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
    .at(-1);

  const after = (baseline: string | undefined) => (baseline ? mine.filter((t) => t.recordedAt > baseline) : mine);

  const dossier: Dossier = {
    matter,
    positions,
    advice,
    openQuestions: mine.filter((t) => t.type === "open-question"),
    warnings,
    sinceReview: after(matter.lastReviewedAt),
    sinceIssue: after(latestEdition?.issuedAt)
  };
  if (latestEdition) dossier.latestEdition = latestEdition;
  return dossier;
}

export function profileAnswers(
  dossier: Dossier,
  profileId: ProfileId
): { question: string; items: TrailItem[]; unknown: boolean }[] {
  const all = [
    ...dossier.positions.flatMap((p) => (p.item ? [p.item] : [])),
    ...dossier.advice,
    ...dossier.openQuestions
  ];
  return PROFILES[profileId].questions.map((q) => {
    const items = [...new Set(all.filter((i) => q.types.includes(i.type) && i.state === "known"))];
    return { question: q.text, items, unknown: items.length === 0 };
  });
}
