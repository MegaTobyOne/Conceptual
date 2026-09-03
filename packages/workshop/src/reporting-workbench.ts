// Slice R1 (ADR 0097): pure helpers for the Reporting Workbench panel, testable without vscode.
import type { ReportingPackAnchor, ReportingPackScope } from "@pspf/brief-renderer";
import { PSPF_DOMAINS } from "@pspf/contracts";
import { PSPF_REFERENCE_DOMAINS } from "@pspf/reference-data";

export interface ReportingDomainOption {
  readonly id: string;
  readonly title: string;
  /** Domain entity code, for example "information". */
  readonly code: string;
  /** PSPF domain family short code, for example "INFO". */
  readonly family: string;
}

export const REPORTING_DOMAIN_OPTIONS: readonly ReportingDomainOption[] = PSPF_DOMAINS.map((domain) => ({
  id: domain.id,
  title: domain.title,
  code: domain.code,
  family: PSPF_REFERENCE_DOMAINS.find((reference) => reference.domainId === domain.id)?.family ?? domain.code
}));

/** Maps `pspf.workshop.myDomains` entries (family code, entity code, title, or id) to domain ids. */
export function resolveMyDomainIds(
  settingCodes: readonly unknown[],
  domains: readonly ReportingDomainOption[] = REPORTING_DOMAIN_OPTIONS
): string[] {
  const ids: string[] = [];
  for (const raw of settingCodes) {
    if (typeof raw !== "string") {
      continue;
    }
    const needle = raw.trim().toLocaleLowerCase("en-AU");
    if (needle.length === 0) {
      continue;
    }
    const match = domains.find(
      (domain) =>
        domain.id.toLocaleLowerCase("en-AU") === needle ||
        domain.family.toLocaleLowerCase("en-AU") === needle ||
        domain.code.toLocaleLowerCase("en-AU") === needle ||
        domain.title.toLocaleLowerCase("en-AU") === needle
    );
    if (match && !ids.includes(match.id)) {
      ids.push(match.id);
    }
  }
  return ids;
}

export function resolveReportingScope(
  settingCodes: readonly unknown[],
  requestedKind?: ReportingPackScope["kind"],
  domains: readonly ReportingDomainOption[] = REPORTING_DOMAIN_OPTIONS
): ReportingPackScope {
  const myDomainIds = resolveMyDomainIds(settingCodes, domains);
  const kind = requestedKind ?? (myDomainIds.length > 0 ? "me" : "all");
  if (kind === "me" && myDomainIds.length > 0) {
    return { kind: "me", domainIds: myDomainIds };
  }
  return { kind: "all", domainIds: [] };
}

export function toReportingAnchor(sideFile: unknown): ReportingPackAnchor | undefined {
  if (typeof sideFile !== "object" || sideFile === null) {
    return undefined;
  }
  const value = sideFile as {
    readonly snapshotId?: unknown;
    readonly title?: unknown;
    readonly capturedAt?: unknown;
    readonly recordStatus?: unknown;
    readonly counts?: unknown;
  };
  if (typeof value.snapshotId !== "string" || typeof value.capturedAt !== "string") {
    return undefined;
  }
  const recordStatus = statusMaps(value.recordStatus, (entry) => typeof entry === "string");
  const counts = statusMaps(value.counts, (entry) => typeof entry === "number");
  return {
    snapshotId: value.snapshotId,
    title: typeof value.title === "string" && value.title.trim() ? value.title : value.snapshotId,
    capturedAt: value.capturedAt,
    ...(recordStatus ? { recordStatus: recordStatus as ReportingPackAnchor["recordStatus"] } : {}),
    ...(counts ? { counts: counts as ReportingPackAnchor["counts"] } : {})
  };
}

export function selectReportingAnchor(
  anchors: readonly ReportingPackAnchor[],
  selection: string | undefined
): ReportingPackAnchor | undefined {
  if (selection === "none") {
    return undefined;
  }
  if (selection) {
    const match = anchors.find((anchor) => anchor.snapshotId === selection);
    if (match) {
      return match;
    }
  }
  return anchors[0];
}

function statusMaps(
  value: unknown,
  isEntry: (entry: unknown) => boolean
): Record<"requirements" | "risks" | "actions", Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const maps = value as Record<string, unknown>;
  const result: Partial<Record<"requirements" | "risks" | "actions", Record<string, unknown>>> = {};
  for (const key of ["requirements", "risks", "actions"] as const) {
    const map = maps[key];
    if (typeof map !== "object" || map === null || Array.isArray(map)) {
      return undefined;
    }
    if (!Object.values(map as Record<string, unknown>).every(isEntry)) {
      return undefined;
    }
    result[key] = map as Record<string, unknown>;
  }
  return result as Record<"requirements" | "risks" | "actions", Record<string, unknown>>;
}
