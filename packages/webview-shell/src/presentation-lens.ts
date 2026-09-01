export type PresentationLens = "ciso" | "auditor" | "solo";

export const DEFAULT_PRESENTATION_LENS: PresentationLens = "ciso";

/**
 * ADR 0096 E6 (v1.68.0): the ciso/auditor/solo lenses are retired to one default view. Any stored
 * value — valid or not — migrates deterministically to the single default, following the ADR 0086
 * Colorful→Dark migration precedent. Callers should remove the underlying stored key once read.
 */
export function normalisePresentationLens(_value: unknown): PresentationLens {
  return DEFAULT_PRESENTATION_LENS;
}
