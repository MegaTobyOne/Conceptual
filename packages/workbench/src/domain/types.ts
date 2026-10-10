// Workbench-local records (ADR 0103 §3). Not canonical entities and never part of the master bundle.

export type Publication = "public" | "sensitive" | "restricted";

export const ID_PREFIXES = {
  matter: "MTR",
  trail: "TRL",
  edition: "EDN",
  draft: "DRF",
  snapshot: "SNP"
} as const;

export const TRAIL_TYPES = [
  "ask",
  "proposed-action",
  "owner",
  "advice",
  "open-question",
  "decision",
  "status",
  "outcome",
  "delay-reason",
  "note"
] as const;
export type TrailType = (typeof TRAIL_TYPES)[number];

export const TRAIL_STATES = ["known", "unknown", "no-response-recorded"] as const;
export type TrailState = (typeof TRAIL_STATES)[number];

export const DISPOSITIONS = ["decided", "more-information-requested", "deferred", "no-decision-recorded"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const FOLLOW_UP_STATES = ["open", "waiting", "closed"] as const;
export type FollowUpState = (typeof FOLLOW_UP_STATES)[number];

export const PROFILE_IDS = ["ciso", "ops", "committee"] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export type Provenance = "typed" | "parsed" | "ai-draft";

export interface Reference {
  kind: "register-requirement" | "register-risk" | "register-action" | "external";
  targetId: string;
  label: string;
  /** Snapshot the target was last checked against; absent for external pointers. */
  snapshotId?: string;
  lastCheckedAt: string;
}

export interface Matter {
  id: string;
  title: string;
  scope: string;
  intendedOutcome: string;
  followUpState: FollowUpState;
  nextStep: string;
  checkpointAt?: string;
  lastReviewedAt?: string;
  refs: Reference[];
  createdAt: string;
  updatedAt: string;
  /** Prior values; the current record is never the only copy of its history. */
  log: MatterLogEntry[];
}

export interface MatterLogEntry {
  at: string;
  field: string;
  previous: string;
}

export interface Source {
  label: string;
  excerpt?: string;
  link?: string;
}

export interface TrailItem {
  id: string;
  matterId: string;
  type: TrailType;
  state: TrailState;
  /** Set only on `decision` items that record an evidenced disposition. */
  disposition?: Disposition;
  value: string;
  source?: Source;
  provenance: Provenance;
  recordedAt: string;
  supersedes?: string;
}

export interface Edition {
  id: string;
  matterId: string;
  profile: ProfileId;
  audience: string;
  occasion: string;
  issuedAt: string;
  text: string;
  sourceRevisions: string[];
  correctsEditionId?: string;
  redactionSummary: string[];
}

export interface Draft {
  id: string;
  kind: "capture" | "brief" | "matter";
  text: string;
  context: { route: string; selection?: string; scroll?: number };
  updatedAt: string;
}

export interface RegisterItem {
  id: string;
  kind: "register-requirement" | "register-risk" | "register-action";
  title: string;
}

export interface RegisterSnapshot {
  id: string;
  importedAt: string;
  bundleVersion: string;
  generatedAt?: string;
  checksum: string;
  items: RegisterItem[];
}

export interface Tombstone {
  id: string;
  erasedAt: string;
}

/** Every field is sensitive unless listed here (ADR 0005 default-deny). */
export const PUBLICATION_POLICY: Record<"matter" | "trail" | "edition", Record<string, Publication>> = {
  matter: { id: "public" },
  trail: { id: "public" },
  edition: { id: "public" }
};

export function publicationOf(record: keyof typeof PUBLICATION_POLICY, field: string): Publication {
  return PUBLICATION_POLICY[record][field] ?? "sensitive";
}
