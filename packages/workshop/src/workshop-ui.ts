export type WorkshopEntityTitleSource = {
    readonly entityType: string;
    readonly id: string;
    readonly title?: string;
    readonly reference?: string;
    readonly controlId?: string;
};

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortWorkshopPanelTitle(entity: WorkshopEntityTitleSource): string {
    switch (entity.entityType) {
        case "requirement":
            return `Requirement ${extractRequirementNumber(entity.title) ?? compactEntityId(entity.id)}`;
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
    const usesTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0;
    const dateText = formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
    if (!dateText) {
        return undefined;
    }
    return usesTime ? `${dateText}, ${formatTime(date)}` : dateText;
}

export function normaliseShortAuDateTime(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    return formatShortAuDateTime(trimmed);
}

function extractRequirementNumber(title: string | undefined): string | undefined {
    const match = title?.trim().match(/^(?:requirement\s*)?([0-9]+[A-Za-z]?(?:\.[0-9]+[A-Za-z]?)*)\b/i);
    return match?.[1];
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
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute ? date : undefined;
}