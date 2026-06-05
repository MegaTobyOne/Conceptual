import { type LinkEntity, type MoneyAmount } from "@pspf/contracts";
import { type SpendItemRecord } from "./relationship-rules.js";
import { formatCurrency, formatToken } from "./webview/util.js";

const MONTH_NAMES = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const;

export interface ForecastYear {
  readonly financialYear: string;
  readonly plannedSpend: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
  readonly netForecast: number;
  readonly itemCount: number;
}

export interface ForecastMonth {
  readonly monthKey: string;
  readonly monthLabel: string;
  readonly financialYear: string;
  readonly forecastSpend: number;
  readonly forecastSavings: number;
  readonly itemCount: number;
}

export interface SpendItemReportRow {
  readonly title: string;
  readonly financialYear: string;
  readonly costCentre: string;
  readonly status: string;
  readonly amount: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
}

export interface ScenarioSummary {
  readonly label: string;
  readonly description: string;
  readonly itemCount: number;
  readonly plannedSpend: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
  readonly netForecast: number;
  readonly lowConfidenceCount: number;
  readonly unlinkedItemCount: number;
}

export interface SpendTotals {
  readonly plannedSpend: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
  readonly netForecast: number;
}

export interface AssuranceSpendRow {
  readonly scope: "Requirement" | "Action" | "Tag";
  readonly title: string;
  readonly secondary: string;
  readonly itemCount: number;
  readonly multiLinkedItemCount: number;
  readonly plannedSpend: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
  readonly netForecast: number;
  readonly confidence: string;
}

export function deriveForecast(spendItems: readonly SpendItemRecord[]): ForecastYear[] {
  const byYear = new Map<string, ForecastYear>();
  for (const item of forecastOnlyItems(spendItems)) {
    const existing = byYear.get(item.financialYear) ?? {
      financialYear: item.financialYear,
      plannedSpend: 0,
      forecastCost: 0,
      expectedSavings: 0,
      netForecast: 0,
      itemCount: 0
    };
    const plannedSpend = existing.plannedSpend + moneyAmountValue(item.amount);
    const forecastCost = existing.forecastCost + forecastCostValue(item);
    const expectedSavings = existing.expectedSavings + moneyAmountValue(item.expectedSavings);
    byYear.set(item.financialYear, {
      financialYear: item.financialYear,
      plannedSpend,
      forecastCost,
      expectedSavings,
      netForecast: forecastCost - expectedSavings,
      itemCount: existing.itemCount + 1
    });
  }
  return [...byYear.values()].sort((first, second) => first.financialYear.localeCompare(second.financialYear));
}

export function deriveForecastMonths(spendItems: readonly SpendItemRecord[]): ForecastMonth[] {
  const byMonth = new Map<string, ForecastMonth>();
  for (const item of forecastOnlyItems(spendItems)) {
    const months = forecastMonthsForItem(item);
    if (months.length === 0) {
      continue;
    }
    const monthlySpend = forecastCostValue(item) / months.length;
    for (const month of months) {
      const existing = byMonth.get(month.monthKey) ?? {
        monthKey: month.monthKey,
        monthLabel: month.monthLabel,
        financialYear: month.financialYear,
        forecastSpend: 0,
        forecastSavings: 0,
        itemCount: 0
      };
      byMonth.set(month.monthKey, {
        ...existing,
        forecastSpend: existing.forecastSpend + monthlySpend,
        forecastSavings: existing.forecastSavings + moneyAmountValue(item.expectedSavings) / months.length,
        itemCount: existing.itemCount + 1
      });
    }
  }
  return [...byMonth.values()].sort((first, second) => first.monthKey.localeCompare(second.monthKey));
}

export function deriveScenarioSummaries(
  spendItems: readonly SpendItemRecord[],
  links: readonly LinkEntity[]
): ScenarioSummary[] {
  const scenarios: Array<{
    readonly label: string;
    readonly description: string;
    readonly statuses: readonly string[];
  }> = [
    {
      label: "Approved and committed baseline",
      description: "Approved and committed work only",
      statuses: ["approved", "committed"]
    },
    { label: "Approved only", description: "Approved work before commitments", statuses: ["approved"] },
    {
      label: "Include proposed work",
      description: "Baseline plus proposed ideas and options",
      statuses: ["approved", "committed", "proposed"]
    }
  ];
  return scenarios.map((scenario) => {
    const items = spendItems.filter((item) => scenario.statuses.includes(item.status));
    const totals = spendTotals(items);
    return {
      label: scenario.label,
      description: scenario.description,
      itemCount: items.length,
      plannedSpend: totals.plannedSpend,
      forecastCost: totals.forecastCost,
      expectedSavings: totals.expectedSavings,
      netForecast: totals.netForecast,
      lowConfidenceCount: items.filter((item) => item.confidence === "low").length,
      unlinkedItemCount: items.filter((item) => !hasAssuranceSpendLink(item, links)).length
    };
  });
}

export function deriveSpendItemReport(spendItems: readonly SpendItemRecord[]): SpendItemReportRow[] {
  return spendItems
    .slice()
    .sort(
      (first, second) =>
        first.financialYear.localeCompare(second.financialYear) || first.title.localeCompare(second.title)
    )
    .map((item) => ({
      title: item.title,
      financialYear: item.financialYear,
      costCentre: item.costCentre ?? "",
      status: formatToken(item.status),
      amount: moneyAmountValue(item.amount),
      forecastCost: forecastCostValue(item),
      expectedSavings: moneyAmountValue(item.expectedSavings)
    }));
}

export function spendTotals(items: readonly SpendItemRecord[]): SpendTotals {
  const plannedSpend = items.reduce((total, item) => total + moneyAmountValue(item.amount), 0);
  const forecastCost = items.reduce((total, item) => total + forecastCostValue(item), 0);
  const expectedSavings = items.reduce((total, item) => total + moneyAmountValue(item.expectedSavings), 0);
  return { plannedSpend, forecastCost, expectedSavings, netForecast: forecastCost - expectedSavings };
}

export function forecastOnlyItems(spendItems: readonly SpendItemRecord[]): SpendItemRecord[] {
  return spendItems.filter((item) => item.status !== "spent" && item.status !== "cancelled");
}

export function forecastMonthsForItem(item: SpendItemRecord): ForecastMonth[] {
  const explicitMonths = monthsBetween(item.forecastStartAt, item.forecastEndAt, item.financialYear);
  if (explicitMonths.length > 0) {
    return explicitMonths;
  }
  return monthsForFinancialYear(item.financialYear);
}

export function moneyInputValue(value: MoneyAmount | undefined): string {
  const amount = moneyAmountNumber(value);
  return amount === undefined ? "" : amount.toString();
}

export function moneyAmountValue(value: MoneyAmount | undefined): number {
  return moneyAmountNumber(value) ?? 0;
}

export function moneyAmountNumber(value: MoneyAmount | undefined): number | undefined {
  return typeof value?.amount === "number" && Number.isFinite(value.amount)
    ? roundMoneyAmount(value.amount)
    : undefined;
}

function roundMoneyAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoneyAmount(value: MoneyAmount | undefined): string {
  return formatCurrency(
    moneyAmountValue(value),
    typeof value?.currency === "string" && value.currency ? value.currency : "AUD"
  );
}

export function forecastCostValue(item: SpendItemRecord): number {
  return moneyAmountNumber(item.forecastCost) ?? moneyAmountValue(item.amount);
}

function monthsBetween(
  startText: string | undefined,
  endText: string | undefined,
  fallbackFinancialYear: string
): ForecastMonth[] {
  if (!startText || !endText) {
    return [];
  }
  const start = new Date(`${startText}T00:00:00Z`);
  const end = new Date(`${endText}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }
  const months: ForecastMonth[] = [];
  let cursorYear = start.getUTCFullYear();
  let cursorMonth = start.getUTCMonth();
  const endKey = end.getUTCFullYear() * 12 + end.getUTCMonth();
  while (cursorYear * 12 + cursorMonth <= endKey && months.length < 60) {
    months.push(monthBucket(cursorYear, cursorMonth, fallbackFinancialYear));
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }
  return months;
}

function monthsForFinancialYear(financialYear: string): ForecastMonth[] {
  const match = financialYear.match(/^(\d{4})-\d{2}$/);
  if (!match) {
    return [];
  }
  const startYear = Number(match[1]);
  return MONTH_NAMES.map((_, index) => {
    const month = (index + 6) % 12;
    const year = index < 6 ? startYear : startYear + 1;
    return monthBucket(year, month, financialYear);
  });
}

function monthBucket(year: number, month: number, fallbackFinancialYear: string): ForecastMonth {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    monthKey,
    monthLabel: new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month, 1))
    ),
    financialYear: financialYearForMonth(year, month) ?? fallbackFinancialYear,
    forecastSpend: 0,
    forecastSavings: 0,
    itemCount: 0
  };
}

function financialYearForMonth(year: number, month: number): string | undefined {
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return undefined;
  }
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function hasAssuranceSpendLink(item: SpendItemRecord, links: readonly LinkEntity[]): boolean {
  return links.some((link) => isSpendAssuranceLink(link) && link.fromId === item.id);
}

function isSpendAssuranceLink(link: LinkEntity): boolean {
  return (
    link.fromType === "spend-item" &&
    link.linkType === "supports" &&
    (link.toType === "action" || link.toType === "requirement")
  );
}
