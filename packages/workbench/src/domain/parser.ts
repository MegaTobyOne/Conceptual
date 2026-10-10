import { DISPOSITIONS, type Disposition, type Source, type TrailState, type TrailType } from "./types.ts";

export interface CaptureDraft {
  type: TrailType;
  state: TrailState;
  value: string;
  disposition?: Disposition;
  source: Source;
  warnings: string[];
}

const LABEL_TYPES: Record<string, TrailType> = {
  ask: "ask",
  action: "proposed-action",
  owner: "owner",
  advice: "advice",
  question: "open-question",
  decision: "decision",
  status: "status",
  outcome: "outcome",
  delay: "delay-reason",
  note: "note"
};

const LABEL_PATTERN = /^([A-Za-z]+):\s?(.*)$/;
const MODIFIERS = new Set(["source", "link", "disposition"]);

function stateOf(value: string): TrailState {
  const normalised = value.trim().toLowerCase();
  if (normalised === "unknown") return "unknown";
  if (normalised === "no response" || normalised === "no response recorded") {
    return "no-response-recorded";
  }
  return "known";
}

interface Block {
  type: TrailType;
  lines: string[];
  raw: string[];
  source?: string;
  link?: string;
  disposition?: string;
}

/**
 * Parse the explicit capture format (ADR 0103 §6). Deterministic: nothing is inferred,
 * and text outside a labelled item is kept verbatim as a note draft.
 */
export function parseCapture(input: string, sourceLabel = "Pasted capture"): CaptureDraft[] {
  const blocks: Block[] = [];
  const strays: string[] = [];
  let current: Block | undefined;

  for (const line of input.replaceAll("\r\n", "\n").split("\n")) {
    const match = LABEL_PATTERN.exec(line);
    const label = match?.[1]?.toLowerCase();
    const rest = match?.[2] ?? "";

    if (label && LABEL_TYPES[label]) {
      current = { type: LABEL_TYPES[label], lines: [rest], raw: [line] };
      blocks.push(current);
    } else if (label && MODIFIERS.has(label) && current) {
      current.raw.push(line);
      if (label === "source") current.source = rest.trim();
      else if (label === "link") current.link = rest.trim();
      else current.disposition = rest.trim().toLowerCase();
    } else if (line.trim() === "") {
      current = undefined;
    } else if (current) {
      current.lines.push(line.trim());
      current.raw.push(line);
    } else {
      strays.push(line);
    }
  }

  const drafts: CaptureDraft[] = blocks.map((block) => {
    const value = block.lines.join("\n").trim();
    const warnings: string[] = [];
    let disposition: Disposition | undefined;
    if (block.disposition) {
      if ((DISPOSITIONS as readonly string[]).includes(block.disposition)) {
        disposition = block.disposition as Disposition;
      } else {
        warnings.push(`Unrecognised disposition "${block.disposition}" was not applied.`);
      }
    }
    if (disposition && block.type !== "decision") {
      warnings.push("Disposition applies to Decision items only and was not applied.");
      disposition = undefined;
    }
    if (value === "") warnings.push("Item has no text.");
    if (block.type === "decision" && !block.source) {
      warnings.push("A decision needs a source; add a Source: line before accepting it.");
    }
    const source: Source = { label: block.source || sourceLabel, excerpt: block.raw.join("\n") };
    if (block.link) source.link = block.link;
    const draft: CaptureDraft = {
      type: block.type,
      state: stateOf(value),
      value,
      source,
      warnings
    };
    if (disposition) draft.disposition = disposition;
    return draft;
  });

  const stray = strays.join("\n").trim();
  if (stray) {
    drafts.push({
      type: "note",
      state: "known",
      value: stray,
      source: { label: sourceLabel, excerpt: stray },
      warnings: ["Unlabelled text was kept as a note; nothing was inferred from it."]
    });
  }
  return drafts;
}

/** Prompt that asks Microsoft 365 Copilot to emit the capture format. */
export const COPILOT_PROMPT_TEMPLATE = `From the meeting or thread below, list only what is explicitly stated. Use one block per item, with these labels: Ask, Action, Owner, Advice, Question, Decision, Status, Outcome, Delay, Note.
After an item you may add "Source:" (where it was said) and "Link:" (a link to it). For a Decision you may add "Disposition:" with one of: decided, more-information-requested, deferred, no-decision-recorded.
Write "unknown" for anything not stated. Do not guess owners, decisions or reasons.`;
