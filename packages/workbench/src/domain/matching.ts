export interface Candidate {
  id: string;
  title: string;
  /** Extra identifiers (for example a register requirement ID) matched exactly. */
  aliases?: string[];
}

export type MatchBasis = "exact-id" | "exact-title" | "token-overlap";

export interface Suggestion {
  candidate: Candidate;
  basis: MatchBasis;
  score: number;
  matchedText: string;
}

// Starting values from ADR 0103 §6; re-tune against synthetic examples.
export const MATCH_THRESHOLD = 0.6;
export const MIN_SHARED_TOKENS = 2;
export const MAX_SUGGESTIONS = 3;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "with"
]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function normalise(text: string): string {
  return tokens(text).join(" ");
}

/** Exact IDs first, then exact normalised title, then token overlap. Suggestions only; never merges. */
export function suggestMatches(text: string, candidates: Candidate[]): Suggestion[] {
  const lower = text.toLowerCase();
  const textTokens = new Set(tokens(text));
  const normalisedText = normalise(text);
  const found: Suggestion[] = [];

  for (const candidate of candidates) {
    const ids = [candidate.id, ...(candidate.aliases ?? [])];
    const hit = ids.find((id) => id && lower.includes(id.toLowerCase()));
    if (hit) {
      found.push({ candidate, basis: "exact-id", score: 1, matchedText: hit });
      continue;
    }
    const title = normalise(candidate.title);
    if (title && title === normalisedText) {
      found.push({ candidate, basis: "exact-title", score: 1, matchedText: candidate.title });
      continue;
    }
    const candidateTokens = new Set(tokens(candidate.title));
    const shared = [...candidateTokens].filter((t) => textTokens.has(t));
    const union = new Set([...candidateTokens, ...textTokens]).size;
    const score = union === 0 ? 0 : shared.length / union;
    if (shared.length >= MIN_SHARED_TOKENS && score >= MATCH_THRESHOLD) {
      found.push({ candidate, basis: "token-overlap", score, matchedText: shared.join(" ") });
    }
  }

  const rank: Record<MatchBasis, number> = { "exact-id": 0, "exact-title": 1, "token-overlap": 2 };
  return found
    .sort((a, b) => rank[a.basis] - rank[b.basis] || b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, MAX_SUGGESTIONS);
}
