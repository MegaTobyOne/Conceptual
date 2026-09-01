export type WorkshopEntityTitleSource = {
  readonly entityType: string;
  readonly id: string;
  readonly title?: string;
  readonly reference?: string;
  readonly controlId?: string;
};

export type RequirementBrowserTitleSource = {
  readonly id: string;
  readonly title?: unknown;
};

export type RequirementFinderAdapterSource = {
  readonly id: string;
  readonly title?: unknown;
  readonly summary?: string;
  readonly domainId: string;
  readonly assessmentStatus: string;
};

export interface RequirementFinderRecordShape {
  readonly id: string;
  readonly title: string;
  readonly searchText: string;
  readonly domainId: string;
  readonly status: string;
  readonly tagIds: readonly string[];
}

/**
 * E3 (v1.65.0, ADR 0096): adapts a Workshop requirement onto the shared, host-agnostic
 * `@pspf/contracts` finder record shape so filtering/ordering can never drift from Explorer's (E2).
 * Kept free of "vscode" and heavy contracts entity imports so it can be unit-tested directly.
 */
export function requirementToFinderRecord(
  requirement: RequirementFinderAdapterSource,
  tagIds: readonly string[]
): RequirementFinderRecordShape {
  return {
    id: requirement.id,
    title: requirementDisplayTitle(requirement.title),
    searchText: requirement.summary ?? "",
    domainId: requirement.domainId,
    status: requirement.assessmentStatus,
    tagIds
  };
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatWorkshopLabel(value: unknown): string {
  return String(value ?? "")
    .replaceAll("-", " ")
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function requirementDisplayTitle(value: unknown): string {
  const title = String(value ?? "").trim();
  return title || "Untitled Requirement";
}

export function requirementBrowserTitlePreview(value: unknown): string {
  const title = requirementDisplayTitle(value);
  const naturalTitle = title.replace(/^\s*PSPF\s+\d+[A-Za-z]?\s*-\s*/i, "").trim();
  return naturalTitle || title;
}

export function requirementNumberLabel(requirement: RequirementBrowserTitleSource): string {
  const match = requirementDisplayTitle(requirement.title).match(
    /^(?:requirement\s*)?([0-9]+[A-Za-z]?(?:\.[0-9]+[A-Za-z]?)*)\b/i
  );
  return match ? `Requirement ${match[1]}` : requirement.id;
}

export function shortWorkshopPanelTitle(entity: WorkshopEntityTitleSource): string {
  switch (entity.entityType) {
    case "requirement":
      return requirementNumberLabel(entity);
    case "evidence":
      return `Evidence ${compactEntityId(entity.id)}`;
    case "action":
      return `Action ${compactEntityId(entity.id)}`;
    case "risk":
      return `Risk ${compactEntityId(entity.id)}`;
    case "direction":
      return entity.reference ? `Direction ${entity.reference}` : `Direction ${compactEntityId(entity.id)}`;
    case "requirement-control-mapping":
      return `ISM Mapping ${compactEntityId(entity.id)}`;
    case "source-control":
      return entity.controlId ? `ISM ${entity.controlId}` : `ISM ${compactEntityId(entity.id)}`;
    default:
      return compactEntityId(entity.id);
  }
}

export function formatShortAuDateTime(value: string | Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    const dateOnly = formatIsoDateOnly(value) ?? formatAuNumericDateOnly(value);
    if (dateOnly) {
      return dateOnly;
    }
  }
  const date = value instanceof Date ? value : parseDateInput(value);
  if (!date) {
    return typeof value === "string" ? value : undefined;
  }
  const usesTime =
    date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0;
  const dateText = formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  if (!dateText) {
    return undefined;
  }
  return usesTime ? `${dateText}, ${formatTime(date)}` : dateText;
}

export function normaliseShortAuDateTime(value: string | undefined, referenceDate = new Date()): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const relativeDate = resolveRelativeDateInput(trimmed, referenceDate);
  if (relativeDate) {
    return formatShortAuDateTime(relativeDate);
  }
  return formatShortAuDateTime(trimmed);
}

function resolveRelativeDateInput(value: string, referenceDate: Date): Date | undefined {
  if (value.toLowerCase() !== "today") {
    return undefined;
  }
  return validLocalDate(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0);
}

function compactEntityId(id: string): string {
  const match = id.match(/^([A-Z]+)-.*?([0-9A-Fa-f]{4})$/);
  return match?.[1] && match[2] ? `${match[1]}-${match[2].toUpperCase()}` : id;
}

function formatIsoDateOnly(value: string): string | undefined {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return undefined;
  }
  return formatDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

function formatAuNumericDateOnly(value: string): string | undefined {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match?.[1] || !match[2] || !match[3]) {
    return undefined;
  }
  return formatDateParts(Number(match[3]), Number(match[2]), Number(match[1]));
}

function formatDateParts(year: number, month: number, day: number): string | undefined {
  const date = validLocalDate(year, month - 1, day, 0, 0);
  return date ? `${day} ${SHORT_MONTHS[month - 1]} ${year}` : undefined;
}

function formatTime(date: Date): string {
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const hour12 = hour % 12 || 12;
  const meridiem = hour < 12 ? "am" : "pm";
  return `${hour12}:${minute} ${meridiem}`;
}

function parseDateInput(value: string): Date | undefined {
  const trimmed = value.trim();
  const auNumeric = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?:\s*([ap]m))?)?$/i);
  if (auNumeric) {
    const day = Number(auNumeric[1]);
    const month = Number(auNumeric[2]);
    const year = Number(auNumeric[3]);
    const hour = normaliseHour(Number(auNumeric[4] ?? 0), auNumeric[6]);
    const minute = Number(auNumeric[5] ?? 0);
    return validLocalDate(year, month - 1, day, hour, minute);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normaliseHour(hour: number, meridiem: string | undefined): number {
  if (!meridiem) {
    return hour;
  }
  const lower = meridiem.toLowerCase();
  if (lower === "pm" && hour < 12) {
    return hour + 12;
  }
  if (lower === "am" && hour === 12) {
    return 0;
  }
  return hour;
}

function validLocalDate(year: number, month: number, day: number, hour: number, minute: number): Date | undefined {
  const date = new Date(year, month, day, hour, minute);
  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
    ? date
    : undefined;
}
