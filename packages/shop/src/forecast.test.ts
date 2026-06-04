import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type LinkEntity } from "@pspf/contracts";
import {
  deriveForecast,
  deriveForecastMonths,
  deriveScenarioSummaries,
  deriveSpendItemReport,
  formatMoneyAmount,
  moneyInputValue,
  spendTotals
} from "./forecast.js";
import { type SpendItemRecord } from "./relationship-rules.js";

const now = "2026-05-29T00:00:00.000Z";

function spendItem({
  id,
  title,
  status,
  ...overrides
}: Partial<SpendItemRecord> & Pick<SpendItemRecord, "id" | "title" | "status">): SpendItemRecord {
  return {
    id,
    entityType: "spend-item",
    schemaVersion: "0.1.0",
    createdAt: now,
    updatedAt: now,
    sourceProduct: "shop",
    recordStatus: "active",
    title,
    spendType: "uplift",
    status,
    amount: { amount: 0, currency: "AUD" },
    financialYear: "2025-26",
    ...overrides
  };
}

function link(overrides: Pick<LinkEntity, "id" | "fromId" | "toId" | "toType">): LinkEntity {
  return {
    id: overrides.id,
    entityType: "link",
    schemaVersion: "0.1.0",
    createdAt: now,
    updatedAt: now,
    sourceProduct: "shop",
    recordStatus: "active",
    linkType: "supports",
    fromType: "spend-item",
    fromId: overrides.fromId,
    toId: overrides.toId,
    toType: overrides.toType
  };
}

const spendItems: SpendItemRecord[] = [
  spendItem({
    id: "spend-alpha",
    title: "Alpha uplift",
    status: "approved",
    amount: { amount: 1200, currency: "AUD" },
    forecastCost: { amount: 1500, currency: "AUD" },
    expectedSavings: { amount: 300, currency: "AUD" },
    forecastStartAt: "2025-07-01",
    forecastEndAt: "2025-09-30",
    costCentre: "ICT",
    confidence: "low"
  }),
  spendItem({
    id: "spend-beta",
    title: "Beta service",
    status: "committed",
    amount: { amount: 600, currency: "AUD" },
    expectedSavings: { amount: 120, currency: "AUD" },
    confidence: "medium"
  }),
  spendItem({
    id: "spend-gamma",
    title: "Gamma option",
    status: "proposed",
    amount: { amount: 900, currency: "AUD" },
    forecastCost: { amount: 1000, currency: "AUD" },
    expectedSavings: { amount: 100, currency: "AUD" },
    financialYear: "2026-27",
    forecastStartAt: "2026-08-01",
    forecastEndAt: "2026-08-31",
    confidence: "high"
  }),
  spendItem({
    id: "spend-spent",
    title: "Spent legacy",
    status: "spent",
    amount: { amount: 5000, currency: "AUD" },
    forecastCost: { amount: 7000, currency: "AUD" },
    expectedSavings: { amount: 700, currency: "AUD" }
  }),
  spendItem({
    id: "spend-cancelled",
    title: "Cancelled option",
    status: "cancelled",
    amount: { amount: 8000, currency: "AUD" },
    expectedSavings: { amount: 800, currency: "AUD" }
  })
];

const assuranceLinks: LinkEntity[] = [
  link({ id: "link-alpha", fromId: "spend-alpha", toId: "req-1", toType: "requirement" })
];

describe("Shop forecast money arithmetic", () => {
  it("totals forecast years from forward-looking spend only", () => {
    assert.deepEqual(deriveForecast(spendItems), [
      {
        financialYear: "2025-26",
        plannedSpend: 1800,
        forecastCost: 2100,
        expectedSavings: 420,
        netForecast: 1680,
        itemCount: 2
      },
      {
        financialYear: "2026-27",
        plannedSpend: 900,
        forecastCost: 1000,
        expectedSavings: 100,
        netForecast: 900,
        itemCount: 1
      }
    ]);
  });

  it("allocates forecast cost and savings by month", () => {
    const months = deriveForecastMonths(spendItems);
    const july2025 = months.find((month) => month.monthKey === "2025-07");
    const october2025 = months.find((month) => month.monthKey === "2025-10");
    const august2026 = months.find((month) => month.monthKey === "2026-08");

    assert.deepEqual(july2025, {
      monthKey: "2025-07",
      monthLabel: "July 2025",
      financialYear: "2025-26",
      forecastSpend: 550,
      forecastSavings: 110,
      itemCount: 2
    });
    assert.deepEqual(october2025, {
      monthKey: "2025-10",
      monthLabel: "Oct 2025",
      financialYear: "2025-26",
      forecastSpend: 50,
      forecastSavings: 10,
      itemCount: 1
    });
    assert.deepEqual(august2026, {
      monthKey: "2026-08",
      monthLabel: "Aug 2026",
      financialYear: "2026-27",
      forecastSpend: 1000,
      forecastSavings: 100,
      itemCount: 1
    });
  });

  it("calculates scenario totals and assurance-link gaps", () => {
    assert.deepEqual(deriveScenarioSummaries(spendItems, assuranceLinks), [
      {
        label: "Approved and committed baseline",
        description: "Approved and committed work only",
        itemCount: 2,
        plannedSpend: 1800,
        forecastCost: 2100,
        expectedSavings: 420,
        netForecast: 1680,
        lowConfidenceCount: 1,
        unlinkedItemCount: 1
      },
      {
        label: "Approved only",
        description: "Approved work before commitments",
        itemCount: 1,
        plannedSpend: 1200,
        forecastCost: 1500,
        expectedSavings: 300,
        netForecast: 1200,
        lowConfidenceCount: 1,
        unlinkedItemCount: 0
      },
      {
        label: "Include proposed work",
        description: "Baseline plus proposed ideas and options",
        itemCount: 3,
        plannedSpend: 2700,
        forecastCost: 3100,
        expectedSavings: 520,
        netForecast: 2580,
        lowConfidenceCount: 1,
        unlinkedItemCount: 2
      }
    ]);
  });

  it("uses forecast-cost fallback consistently in totals and report columns", () => {
    const betaOnly = [spendItems[1]!];

    assert.deepEqual(spendTotals(betaOnly), {
      plannedSpend: 600,
      forecastCost: 600,
      expectedSavings: 120,
      netForecast: 480
    });

    assert.deepEqual(deriveSpendItemReport(betaOnly), [
      {
        title: "Beta service",
        financialYear: "2025-26",
        costCentre: "",
        status: "Committed",
        amount: 600,
        forecastCost: 600,
        expectedSavings: 120
      }
    ]);
  });

  it("formats dollar values for display helpers", () => {
    assert.equal(formatMoneyAmount({ amount: 1234, currency: "AUD" }), "$1,234");
    assert.equal(formatMoneyAmount({ amount: 1234.567, currency: "AUD" }), "$1,234.57");
    assert.equal(formatMoneyAmount({ amount: 0, currency: "AUD" }), "$0");
    assert.equal(moneyInputValue({ amount: 9876, currency: "AUD" }), "9876");
    assert.equal(moneyInputValue({ amount: 9876.543, currency: "AUD" }), "9876.54");
  });
});
