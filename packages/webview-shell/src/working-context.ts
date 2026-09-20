export type WorkingContext = "operations" | "oversight-assurance";

export const DEFAULT_WORKING_CONTEXT: WorkingContext = "operations";

export function normaliseWorkingContext(value: unknown): WorkingContext {
  return value === "oversight-assurance" ? "oversight-assurance" : DEFAULT_WORKING_CONTEXT;
}

export function workingContextLabel(context: WorkingContext): string {
  return context === "oversight-assurance" ? "Oversight & Assurance" : "Operations";
}
