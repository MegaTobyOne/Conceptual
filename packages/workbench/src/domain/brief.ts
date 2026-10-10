import { PROFILES, profileAnswers, type Dossier } from "./dossier.ts";
import type { Edition, ProfileId } from "./types.ts";

/** Starting text for an operator to review and edit; never issued automatically. */
export function composeBrief(dossier: Dossier, profileId: ProfileId): string {
  const lines = [
    `# ${dossier.matter.title}`,
    "",
    `Intended outcome: ${dossier.matter.intendedOutcome || "Unknown"}`,
    ""
  ];
  for (const answer of profileAnswers(dossier, profileId)) {
    lines.push(`## ${answer.question}`);
    if (answer.unknown) lines.push("Unknown. Nothing is recorded.");
    for (const item of answer.items) {
      const origin = item.source ? ` (source: ${item.source.label})` : " (no source recorded)";
      lines.push(`- ${item.value}${origin}`);
    }
    lines.push("");
  }
  if (dossier.warnings.length > 0) {
    lines.push("## Limitations", ...dossier.warnings.map((w) => `- ${w}`), "");
  }
  lines.push(`## Next step`, dossier.matter.nextStep || "Unknown", "");
  return lines.join("\n");
}

export interface Redaction {
  text: string;
  summary: string[];
}

const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g;

/** Default-deny at the publish boundary: emails and listed names never leave (ADR 0005). */
export function redactForPublish(text: string, peopleNames: string[]): Redaction {
  const summary: string[] = [];
  let out = text;
  const emails = out.match(EMAIL)?.length ?? 0;
  if (emails > 0) {
    out = out.replace(EMAIL, "[email removed]");
    summary.push(`${emails} email address${emails === 1 ? "" : "es"} removed`);
  }
  for (const name of peopleNames.map((n) => n.trim()).filter((n) => n.length > 1)) {
    const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "gi");
    const count = out.match(pattern)?.length ?? 0;
    if (count > 0) {
      out = out.replace(pattern, "[person]");
      summary.push(`${count} mention${count === 1 ? "" : "s"} of a listed person removed`);
    }
  }
  return { text: out, summary };
}

export function editionMarkdown(edition: Edition): string {
  const profile = PROFILES[edition.profile].label;
  const header = [
    `<!-- PSPF Workbench edition; OFFICIAL: Sensitive -->`,
    `Audience: ${edition.audience}`,
    `Occasion: ${edition.occasion}`,
    `Profile: ${profile}`,
    `Issued: ${edition.issuedAt}`,
    ""
  ];
  const footer =
    edition.redactionSummary.length > 0
      ? ["", "---", "Redactions applied before issue:", ...edition.redactionSummary.map((s) => `- ${s}`)]
      : [];
  return [...header, edition.text.trimEnd(), ...footer, ""].join("\n");
}

export function editionFileName(edition: Edition): string {
  const stamp = edition.issuedAt.slice(0, 10);
  const slug =
    edition.occasion
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "brief";
  return `${stamp}-${slug}-${edition.profile}.md`;
}
