export type PresentationLens = "ciso" | "auditor" | "solo";

export const DEFAULT_PRESENTATION_LENS: PresentationLens = "ciso";

export function decodePresentationLens(value: unknown): PresentationLens {
  return value === "auditor" || value === "solo" || value === "ciso" ? value : DEFAULT_PRESENTATION_LENS;
}

export function encodePresentationLens(value: PresentationLens): string {
  return value;
}

export const PRESENTATION_LENS_LABELS: Readonly<Record<PresentationLens, string>> = {
  ciso: "CISO",
  auditor: "Auditor",
  solo: "Solo IT"
};
