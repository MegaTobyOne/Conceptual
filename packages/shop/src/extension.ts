import * as vscode from "vscode";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  PSPF_SLICE_VERSION,
  VERSION_AXES,
  type ActionEntity,
  type LinkEntity,
  type MoneyAmount,
  type RequirementEntity,
  type RiskEntity,
  type TagEntity,
  type V01Entity,
  sanitiseEntityForPublication,
  withEnvelope
} from "@pspf/contracts";
import {
  homeActionButton,
  homeMetricCard,
  homePanelShellHtml,
  homeSection,
  relationshipManagerHtml,
  tokensCss,
  type RelationshipManagerAction
} from "@pspf/webview-shell";
import {
  commercialLinkSpec,
  shopDetailRelationshipActions,
  type CommercialLinkSpec,
  type CommercialSource,
  type ContractRecord,
  type LinkableTarget,
  type SpendItemRecord,
  type SupplierRecord
} from "./relationship-rules.js";
import { commandUri, escapeHtml, formatCurrency, formatToken } from "./webview/util.js";

const SHOP_STORE_VERSION = "1.0.0";
const SHOP_STORE_PATH = [".pspf", "shop", "shop.json"] as const;

const SUPPLIER_TYPES = ["software", "service", "advisory", "managed-service", "other"] as const;
const SUPPLIER_STATUSES = ["active", "inactive", "proposed"] as const;
const CRITICALITIES = ["low", "medium", "high", "critical"] as const;
const CONTRACT_STATUSES = ["draft", "active", "expired", "terminated"] as const;
const SPEND_TYPES = ["capex", "opex", "uplift", "licence", "service"] as const;
const SPEND_STATUSES = ["proposed", "approved", "committed", "spent", "cancelled"] as const;
const SAVINGS_TYPES = [
  "avoided-cost",
  "efficiency",
  "consolidation",
  "risk-reduction",
  "contract-optimisation",
  "other"
] as const;
const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
const SHOP_CONFIGURATION_SECTION = "pspf.shop";
const NEAR_TERM_REVIEW_DAYS = 120;
const MONTH_NAMES = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const;
const CPR_LINKS = {
  valueForMoney: "https://www.finance.gov.au/government/procurement/commonwealth-procurement-rules/value-money",
  accountability:
    "https://www.finance.gov.au/government/procurement/commonwealth-procurement-rules/accountability-and-transparency",
  risk: "https://www.finance.gov.au/government/procurement/commonwealth-procurement-rules/procurement-risk",
  negotiations: "https://www.finance.gov.au/sites/default/files/2025-10/Contract-Negotiations.pdf",
  contractManagement: "https://www.finance.gov.au/government/procurement/contract-management-guide",
  confidentiality:
    "https://www.finance.gov.au/government/procurement/buying-australian-government/confidentiality-throughout-procurement-cycle",
  standards: "https://www.finance.gov.au/sites/default/files/2025-10/Application-and-Verification-of-Standards.pdf",
  supplierConduct:
    "https://www.finance.gov.au/government/procurement/ethical-conduct-suppliers/commonwealth-supplier-code-conduct-overview"
} as const;

interface ShopStore {
  readonly shopStoreVersion: string;
  readonly updatedAt: string;
  readonly suppliers: readonly SupplierRecord[];
  readonly contracts: readonly ContractRecord[];
  readonly spendItems: readonly SpendItemRecord[];
}

interface ForecastYear {
  readonly financialYear: string;
  readonly plannedSpend: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
  readonly netForecast: number;
  readonly itemCount: number;
}

interface ForecastMonth {
  readonly monthKey: string;
  readonly monthLabel: string;
  readonly financialYear: string;
  readonly forecastSpend: number;
  readonly forecastSavings: number;
  readonly itemCount: number;
}

interface SavingScheduleRow {
  readonly spendItem: SpendItemRecord;
  readonly financialYear: string;
  readonly scheduledFrom: string;
  readonly scheduledTo: string;
  readonly plannedSaving: number;
  readonly savingsType: string;
  readonly confidence: string;
  readonly replacementContext: string;
}

interface EfficiencyDividendYear {
  readonly financialYear: string;
  readonly plannedSaving: number;
  readonly itemCount: number;
  readonly confidence: string;
}

interface SpendItemReportRow {
  readonly title: string;
  readonly financialYear: string;
  readonly costCentre: string;
  readonly status: string;
  readonly amount: number;
  readonly forecastCost: number;
  readonly expectedSavings: number;
}

interface ScenarioSummary {
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

interface AssuranceSpendRow {
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

interface SupplierManagementSignal {
  readonly supplier: SupplierRecord;
  readonly performanceMeasure: string;
  readonly contractManagement: string;
  readonly fociCheck: string;
  readonly status: "review" | "watch" | "ok";
}

interface ContractArtefactSignal {
  readonly contract: ContractRecord;
  readonly supplierName: string;
  readonly artefacts: readonly ArtefactSignal[];
}

interface ArtefactSignal {
  readonly label: string;
  readonly status: "ready" | "needed";
  readonly sourceLabel: string;
  readonly href: string;
}

interface CoverageGroup {
  readonly label: string;
  readonly total: number;
  readonly linked: number;
  readonly unlinked: readonly CommercialSource[];
  readonly linkCommand: string;
}

interface ContractRenewal {
  readonly contract: ContractRecord;
  readonly supplierName: string;
  readonly daysUntilEnd: number;
}

interface FundedAction {
  readonly spendItem: SpendItemRecord;
  readonly action: ActionEntity;
  readonly urgency: "blocked" | "overdue" | "open";
}

interface SupplierRisk {
  readonly supplier: SupplierRecord;
  readonly risk: RiskEntity;
  readonly score: number;
}

interface CommercialCoverageDashboard {
  readonly coverage: readonly CoverageGroup[];
  readonly uncontractedSpendItems: readonly SpendItemRecord[];
  readonly renewals: readonly ContractRenewal[];
  readonly fundedActions: readonly FundedAction[];
  readonly supplierRisks: readonly SupplierRisk[];
  readonly supplierManagement: readonly SupplierManagementSignal[];
  readonly contractArtefacts: readonly ContractArtefactSignal[];
  readonly spendItemReport: readonly SpendItemReportRow[];
  readonly scenarioSummaries: readonly ScenarioSummary[];
  readonly assuranceSpend: readonly AssuranceSpendRow[];
  readonly savingSchedule: readonly SavingScheduleRow[];
  readonly efficiencyDividends: readonly EfficiencyDividendYear[];
}

type ShopEditorKind = "supplier" | "contract" | "spend-item";

interface ShopEditorMessage {
  readonly action?: string;
  readonly entityType?: ShopEditorKind;
  readonly entityId?: string;
  readonly fields?: ShopEditorFields;
}

interface ShopEditorFields {
  readonly name?: unknown;
  readonly title?: unknown;
  readonly supplierType?: unknown;
  readonly supplierId?: unknown;
  readonly status?: unknown;
  readonly criticality?: unknown;
  readonly primaryContact?: unknown;
  readonly contractRef?: unknown;
  readonly startsAt?: unknown;
  readonly endsAt?: unknown;
  readonly valueAmount?: unknown;
  readonly serviceSummary?: unknown;
  readonly spendType?: unknown;
  readonly amount?: unknown;
  readonly financialYear?: unknown;
  readonly costCentre?: unknown;
  readonly forecastStartAt?: unknown;
  readonly forecastEndAt?: unknown;
  readonly forecastCost?: unknown;
  readonly expectedSavings?: unknown;
  readonly savingsType?: unknown;
  readonly paybackPeriodMonths?: unknown;
  readonly confidence?: unknown;
  readonly assumptions?: unknown;
  readonly notes?: unknown;
}

let shopStore: ShopStore | undefined;
let suppliersProvider: SupplierTreeProvider | undefined;
let contractsProvider: ContractTreeProvider | undefined;
let spendProvider: SpendTreeProvider | undefined;
let forecastProvider: ForecastViewProvider | undefined;
let homeProvider: ShopHomeViewProvider | undefined;
let forecastPanel: vscode.WebviewPanel | undefined;
let editorPanel: vscode.WebviewPanel | undefined;
let detailPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  suppliersProvider = new SupplierTreeProvider();
  contractsProvider = new ContractTreeProvider();
  spendProvider = new SpendTreeProvider();
  forecastProvider = new ForecastViewProvider();
  homeProvider = new ShopHomeViewProvider();

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
  statusItem.text = `$(briefcase) PSPF Shop v${PSPF_SLICE_VERSION}`;
  statusItem.tooltip = "PSPF Shop commercial planning foundation";
  statusItem.command = "pspf.shop.openHome";
  statusItem.show();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("pspfShop.suppliersView", suppliersProvider),
    vscode.window.registerTreeDataProvider("pspfShop.contractsView", contractsProvider),
    vscode.window.registerTreeDataProvider("pspfShop.spendView", spendProvider),
    vscode.window.registerWebviewViewProvider("pspfShop.homeView", homeProvider),
    vscode.window.registerWebviewViewProvider("pspfShop.forecastView", forecastProvider),
    statusItem,
    vscode.commands.registerCommand("pspf.shop.openHome", openHome),
    vscode.commands.registerCommand("pspf.shop.loadSample", loadSample),
    vscode.commands.registerCommand("pspf.shop.importLocalStore", importLocalStore),
    vscode.commands.registerCommand("pspf.shop.newSupplier", newSupplier),
    vscode.commands.registerCommand("pspf.shop.newContract", newContract),
    vscode.commands.registerCommand("pspf.shop.newSpendItem", newSpendItem),
    vscode.commands.registerCommand("pspf.shop.openDetail", openShopDetail),
    vscode.commands.registerCommand("pspf.shop.editSupplier", editSupplier),
    vscode.commands.registerCommand("pspf.shop.editContract", editContract),
    vscode.commands.registerCommand("pspf.shop.editSpendItem", editSpendItem),
    vscode.commands.registerCommand("pspf.shop.deleteRecord", deleteRecord),
    vscode.commands.registerCommand("pspf.shop.linkSupplierToRequirement", (supplier: SupplierRecord) =>
      linkCommercialRecord(supplier, commercialLinkSpec("supplier", "supports", "requirement"))
    ),
    vscode.commands.registerCommand("pspf.shop.linkSupplierToRisk", (supplier: SupplierRecord) =>
      linkCommercialRecord(supplier, commercialLinkSpec("supplier", "associated-with", "risk"))
    ),
    vscode.commands.registerCommand("pspf.shop.linkContractToRequirement", (contract: ContractRecord) =>
      linkCommercialRecord(contract, commercialLinkSpec("contract", "supports", "requirement"))
    ),
    vscode.commands.registerCommand("pspf.shop.linkContractToSpendItem", (contract: ContractRecord) =>
      linkCommercialRecord(contract, commercialLinkSpec("contract", "funds", "spend-item"))
    ),
    vscode.commands.registerCommand("pspf.shop.linkSpendItemToContract", linkSpendItemToContract),
    vscode.commands.registerCommand("pspf.shop.linkSpendToAction", (spendItem: SpendItemRecord) =>
      linkCommercialRecord(spendItem, commercialLinkSpec("spend-item", "supports", "action"))
    ),
    vscode.commands.registerCommand("pspf.shop.linkSpendToRequirement", (spendItem: SpendItemRecord) =>
      linkCommercialRecord(spendItem, commercialLinkSpec("spend-item", "supports", "requirement"))
    ),
    vscode.commands.registerCommand("pspf.shop.openForecast", openForecast),
    vscode.commands.registerCommand("pspf.shop.exportForecastCsv", () => exportForecastReport("csv")),
    vscode.commands.registerCommand("pspf.shop.exportForecastXls", () => exportForecastReport("xls"))
  );

  void refreshViews();
}

export function deactivate(): void {
  shopStore = undefined;
  editorPanel = undefined;
  detailPanel = undefined;
}

async function openHome(): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.extension.pspfShop");
  await vscode.commands.executeCommand("pspfShop.homeView.focus");
  await refreshViews();
}

async function openForecast(): Promise<void> {
  const store = await loadStore();
  const forecast = deriveForecast(store.spendItems);
  const monthlyForecast = deriveForecastMonths(store.spendItems);
  const dashboard = await deriveCoverageDashboard(store);
  if (forecastPanel) {
    forecastPanel.reveal(vscode.ViewColumn.One);
  } else {
    forecastPanel = vscode.window.createWebviewPanel("pspfShopForecast", "PSPF Shop Forecast", vscode.ViewColumn.One, {
      enableScripts: false,
      enableCommandUris: true
    });
    forecastPanel.onDidDispose(() => {
      forecastPanel = undefined;
    });
  }
  forecastPanel.webview.html = renderForecastHtml(store, forecast, monthlyForecast, dashboard, "panel");
}

async function exportForecastReport(format: "csv" | "xls"): Promise<void> {
  const store = await loadStore();
  const forecast = deriveForecast(store.spendItems);
  const monthlyForecast = deriveForecastMonths(store.spendItems);
  const dashboard = await deriveCoverageDashboard(store);
  const defaultUri = getWorkspaceUri(format === "csv" ? "shop-forecast-report.csv" : "shop-forecast-report.xls");
  const target = await vscode.window.showSaveDialog({
    defaultUri,
    filters: format === "csv" ? { "CSV table": ["csv"] } : { "Excel-compatible table": ["xls"] }
  });
  if (!target) {
    return;
  }
  const content =
    format === "csv"
      ? renderForecastReportCsv(forecast, monthlyForecast, dashboard)
      : renderForecastReportXls(forecast, monthlyForecast, dashboard);
  await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(content));
  vscode.window.showInformationMessage(`Exported Shop forecast report to ${target.fsPath}.`);
}

async function loadSample(): Promise<void> {
  const store = await loadStore();
  if (store.suppliers.length > 0 || store.contracts.length > 0 || store.spendItems.length > 0) {
    const answer = await vscode.window.showWarningMessage(
      "Replace current Shop records with sample commercial planning data?",
      "Replace sample",
      "Cancel"
    );
    if (answer !== "Replace sample") {
      return;
    }
  }

  const sample = buildSampleStore();
  await saveStore(sample);
  await refreshViews();
  vscode.window.showInformationMessage("Loaded PSPF Shop sample data.");
}

async function newSupplier(): Promise<void> {
  await openShopEditor("supplier");
}

async function editSupplier(supplier: SupplierRecord): Promise<void> {
  await openShopEditor("supplier", supplier);
}

async function newContract(): Promise<void> {
  const store = await loadStore();
  if (store.suppliers.length === 0) {
    vscode.window.showWarningMessage("Add a supplier before creating a contract.");
    return;
  }
  await openShopEditor("contract");
}

async function editContract(contract: ContractRecord): Promise<void> {
  await openShopEditor("contract", contract);
}

async function newSpendItem(): Promise<void> {
  await openShopEditor("spend-item");
}

async function promptSpendItemAssuranceLink(spendItem: SpendItemRecord): Promise<void> {
  const answer = await vscode.window.showQuickPick(
    [
      { label: "Link to Requirement", targetType: "requirement" as const, labelText: "Requirement", skip: false },
      { label: "Link to Action", targetType: "action" as const, labelText: "Action", skip: false },
      { label: "Skip for now", targetType: "requirement" as const, labelText: "Requirement", skip: true }
    ],
    {
      placeHolder: "Link this spend item to assurance work now?",
      ignoreFocusOut: true,
      canPickMany: false
    }
  );
  if (!answer || answer.skip) {
    return;
  }
  await linkCommercialRecord(spendItem, {
    linkType: "supports",
    targetType: answer.targetType,
    label: answer.labelText
  });
}

async function editSpendItem(spendItem: SpendItemRecord): Promise<void> {
  await openShopEditor("spend-item", spendItem);
}

async function openShopDetail(entity: SupplierRecord | ContractRecord | SpendItemRecord): Promise<void> {
  const store = await loadStore();
  const current = findShopRecord(store, entity.entityType, entity.id) ?? entity;
  const title = `Shop ${formatToken(current.entityType)}: ${commercialTitle(current)}`;
  if (detailPanel) {
    detailPanel.title = title;
    detailPanel.reveal(vscode.ViewColumn.One);
  } else {
    detailPanel = vscode.window.createWebviewPanel("pspfShopDetail", title, vscode.ViewColumn.One, {
      enableScripts: false,
      enableCommandUris: true
    });
    detailPanel.onDidDispose(() => {
      detailPanel = undefined;
    });
  }
  detailPanel.webview.html = renderShopDetailHtml(store, current);
}

async function openShopEditor(
  entityType: ShopEditorKind,
  entity?: SupplierRecord | ContractRecord | SpendItemRecord
): Promise<void> {
  const store = await loadStore();
  const title = shopEditorTitle(entityType, entity);
  if (editorPanel) {
    editorPanel.title = title;
    editorPanel.reveal(vscode.ViewColumn.One);
  } else {
    editorPanel = vscode.window.createWebviewPanel("pspfShopEditor", title, vscode.ViewColumn.One, {
      enableScripts: true
    });
    editorPanel.webview.onDidReceiveMessage((message: ShopEditorMessage) => {
      void handleShopEditorMessage(message);
    });
    editorPanel.onDidDispose(() => {
      editorPanel = undefined;
    });
  }
  editorPanel.webview.html = renderShopEditorHtml(entityType, store, entity);
}

async function handleShopEditorMessage(message: ShopEditorMessage): Promise<void> {
  if (message.action === "cancelShopRecord") {
    editorPanel?.dispose();
    return;
  }
  if (message.action !== "saveShopRecord" && message.action !== "saveAndCloseShopRecord") {
    return;
  }
  const entityType = message.entityType;
  if (!entityType) {
    return;
  }
  const store = await loadStore();
  const current = findShopRecord(store, entityType, message.entityId);
  const parsed = buildShopRecordFromFields(entityType, message.fields ?? {}, current, store);
  if (typeof parsed === "string") {
    vscode.window.showWarningMessage(parsed);
    return;
  }

  const wasExisting = Boolean(current);
  await upsertShopEntities([parsed]);
  shopStore = undefined;
  await refreshViews();
  if (message.action === "saveAndCloseShopRecord") {
    editorPanel?.dispose();
    if (!wasExisting && parsed.entityType === "spend-item") {
      await promptSpendItemAssuranceLink(parsed);
    }
  } else {
    await openShopEditor(parsed.entityType, parsed);
  }
  vscode.window.showInformationMessage(`Saved ${shopRecordLabel(parsed)}.`);
}

function findShopRecord(
  store: ShopStore,
  entityType: ShopEditorKind,
  entityId: string | undefined
): SupplierRecord | ContractRecord | SpendItemRecord | undefined {
  if (!entityId) {
    return undefined;
  }
  switch (entityType) {
    case "supplier":
      return store.suppliers.find((supplier) => supplier.id === entityId);
    case "contract":
      return store.contracts.find((contract) => contract.id === entityId);
    case "spend-item":
      return store.spendItems.find((spendItem) => spendItem.id === entityId);
  }
}

function buildShopRecordFromFields(
  entityType: ShopEditorKind,
  fields: ShopEditorFields,
  current: SupplierRecord | ContractRecord | SpendItemRecord | undefined,
  store: ShopStore
): SupplierRecord | ContractRecord | SpendItemRecord | string {
  switch (entityType) {
    case "supplier":
      return buildSupplierFromFields(fields, current?.entityType === "supplier" ? current : undefined);
    case "contract":
      return buildContractFromFields(fields, current?.entityType === "contract" ? current : undefined, store);
    case "spend-item":
      return buildSpendItemFromFields(fields, current?.entityType === "spend-item" ? current : undefined);
  }
}

function buildSupplierFromFields(fields: ShopEditorFields, current?: SupplierRecord): SupplierRecord | string {
  const name = stringField(fields.name);
  const supplierType = includedField(SUPPLIER_TYPES, fields.supplierType);
  const status = includedField(SUPPLIER_STATUSES, fields.status);
  const criticality = includedField(CRITICALITIES, fields.criticality);
  if (!name) {
    return "Supplier name is required.";
  }
  if (!supplierType || !status || !criticality) {
    return "Supplier type, status, and criticality are required.";
  }
  return {
    ...(current ?? newCommercialEnvelope("supplier")),
    id: current?.id ?? createShopId("SUP"),
    entityType: "supplier",
    name,
    supplierType,
    status,
    criticality,
    updatedAt: new Date().toISOString(),
    ...(optionalStringField(fields.primaryContact)
      ? { primaryContact: optionalStringField(fields.primaryContact) }
      : {}),
    ...(optionalStringField(fields.notes) ? { notes: optionalStringField(fields.notes) } : {})
  };
}

function buildContractFromFields(
  fields: ShopEditorFields,
  current: ContractRecord | undefined,
  store: ShopStore
): ContractRecord | string {
  const supplierId = stringField(fields.supplierId);
  const title = stringField(fields.title);
  const status = includedField(CONTRACT_STATUSES, fields.status);
  const valueAmount = optionalNumberField(fields.valueAmount);
  if (!supplierId || !store.suppliers.some((supplier) => supplier.id === supplierId)) {
    return "A valid supplier is required before saving a contract.";
  }
  if (!title) {
    return "Contract title is required.";
  }
  if (!status) {
    return "Contract status is required.";
  }
  const startsAt = optionalDateField(fields.startsAt, "Start date");
  if (startsAt.error) {
    return startsAt.error;
  }
  const endsAt = optionalDateField(fields.endsAt, "End date");
  if (endsAt.error) {
    return endsAt.error;
  }
  if (valueAmount.error) {
    return valueAmount.error;
  }
  return {
    ...(current ?? newCommercialEnvelope("contract")),
    id: current?.id ?? createShopId("CTR"),
    entityType: "contract",
    supplierId,
    title,
    status,
    updatedAt: new Date().toISOString(),
    ...(optionalStringField(fields.contractRef) ? { contractRef: optionalStringField(fields.contractRef) } : {}),
    ...(startsAt.value ? { startsAt: startsAt.value } : {}),
    ...(endsAt.value ? { endsAt: endsAt.value } : {}),
    ...(valueAmount.value === undefined ? {} : { value: moneyAmount(valueAmount.value) }),
    ...(optionalStringField(fields.serviceSummary)
      ? { serviceSummary: optionalStringField(fields.serviceSummary) }
      : {})
  };
}

function buildSpendItemFromFields(fields: ShopEditorFields, current?: SpendItemRecord): SpendItemRecord | string {
  const title = stringField(fields.title);
  const spendType = includedField(SPEND_TYPES, fields.spendType);
  const status = includedField(SPEND_STATUSES, fields.status);
  const amount = requiredNumberField(fields.amount, "Amount");
  const financialYear = stringField(fields.financialYear);
  const forecastCost = optionalNumberField(fields.forecastCost, "Forecast cost");
  const expectedSavings = optionalNumberField(fields.expectedSavings, "Expected savings");
  const paybackPeriodMonths = optionalNumberField(fields.paybackPeriodMonths, "Payback period months");
  const savingsType = includedField(SAVINGS_TYPES, fields.savingsType);
  const confidence = includedField(CONFIDENCE_LEVELS, fields.confidence);
  if (!title) {
    return "Spend item title is required.";
  }
  if (!spendType || !status) {
    return "Spend type and status are required.";
  }
  if (amount.error) {
    return amount.error;
  }
  if (validateFinancialYear(financialYear)) {
    return "Financial year must use YYYY-YY.";
  }
  const forecastStartAt = optionalDateField(fields.forecastStartAt, "Forecast start date");
  if (forecastStartAt.error) {
    return forecastStartAt.error;
  }
  const forecastEndAt = optionalDateField(fields.forecastEndAt, "Forecast end date");
  if (forecastEndAt.error) {
    return forecastEndAt.error;
  }
  if (forecastCost.error || expectedSavings.error || paybackPeriodMonths.error) {
    return forecastCost.error ?? expectedSavings.error ?? paybackPeriodMonths.error ?? "Enter a positive number.";
  }
  return {
    ...(current ?? newCommercialEnvelope("spend-item")),
    id: current?.id ?? createShopId("SPD"),
    entityType: "spend-item",
    title,
    spendType,
    status,
    amount: moneyAmount(amount.value),
    financialYear,
    updatedAt: new Date().toISOString(),
    ...(optionalStringField(fields.costCentre) ? { costCentre: optionalStringField(fields.costCentre) } : {}),
    ...(forecastStartAt.value ? { forecastStartAt: forecastStartAt.value } : {}),
    ...(forecastEndAt.value ? { forecastEndAt: forecastEndAt.value } : {}),
    ...(forecastCost.value === undefined ? {} : { forecastCost: moneyAmount(forecastCost.value) }),
    ...(expectedSavings.value === undefined ? {} : { expectedSavings: moneyAmount(expectedSavings.value) }),
    ...(savingsType ? { savingsType } : {}),
    ...(paybackPeriodMonths.value === undefined ? {} : { paybackPeriodMonths: paybackPeriodMonths.value }),
    ...(confidence ? { confidence } : {}),
    ...(optionalStringField(fields.assumptions) ? { assumptions: optionalStringField(fields.assumptions) } : {}),
    ...(optionalStringField(fields.notes) ? { notes: optionalStringField(fields.notes) } : {})
  };
}

async function deleteRecord(entity: SupplierRecord | ContractRecord | SpendItemRecord): Promise<void> {
  const label = entity.entityType === "supplier" ? entity.name : entity.title;
  const answer = await vscode.window.showWarningMessage(
    `Delete ${label} from Core-backed Shop records?`,
    "Delete",
    "Cancel"
  );
  if (answer !== "Delete") {
    return;
  }
  await upsertShopEntities([{ ...entity, recordStatus: "deleted", updatedAt: new Date().toISOString() }]);
  shopStore = undefined;
  await refreshViews();
  vscode.window.showInformationMessage(`Deleted ${label}.`);
}

async function linkCommercialRecord(source: CommercialSource, spec: CommercialLinkSpec): Promise<void> {
  const targets = await listActiveTargets(spec.targetType);
  if (targets.length === 0) {
    vscode.window.showWarningMessage(`No active ${spec.label.toLowerCase()} records are available to link.`);
    return;
  }
  const target = await pickLinkTarget(targets, spec.label);
  if (!target) {
    return;
  }
  const allEntities = await listCoreEntities();
  const duplicate = allEntities.some(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" &&
      entity.recordStatus !== "deleted" &&
      entity.fromId === source.id &&
      entity.toId === target.id &&
      entity.linkType === spec.linkType
  );
  if (duplicate) {
    vscode.window.showInformationMessage(`${commercialTitle(source)} is already linked to ${targetTitle(target)}.`);
    return;
  }

  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${commercialTitle(source)} ${formatToken(spec.linkType)} ${targetTitle(target)}`,
      linkType: spec.linkType,
      fromId: source.id,
      fromType: source.entityType,
      toId: target.id,
      toType: target.entityType
    },
    "shop"
  );
  await upsertCoreEntities([link]);
  await refreshViews();
  vscode.window.showInformationMessage(`Linked ${commercialTitle(source)} to ${targetTitle(target)}.`);
}

async function linkSpendItemToContract(spendItem: SpendItemRecord): Promise<void> {
  const store = await loadStore();
  const contracts = store.contracts.filter((contract) => contract.status !== "terminated");
  if (contracts.length === 0) {
    vscode.window.showWarningMessage("No active or draft contracts are available to fund this spend item.");
    return;
  }
  const selected = await vscode.window.showQuickPick(
    contracts.map((contract) => ({ label: contract.title, description: formatToken(contract.status), contract })),
    { placeHolder: "Contract funding this spend item", ignoreFocusOut: true, canPickMany: false }
  );
  const contract = selected?.contract;
  if (!contract) {
    return;
  }
  const allEntities = await listCoreEntities();
  const duplicate = allEntities.some(
    (entity): entity is LinkEntity =>
      entity.entityType === "link" &&
      entity.recordStatus !== "deleted" &&
      entity.fromId === contract.id &&
      entity.toId === spendItem.id &&
      entity.linkType === "funds"
  );
  if (duplicate) {
    vscode.window.showInformationMessage(`${contract.title} already funds ${spendItem.title}.`);
    return;
  }
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${contract.title} funds ${spendItem.title}`,
      linkType: "funds",
      fromId: contract.id,
      fromType: "contract",
      toId: spendItem.id,
      toType: "spend-item"
    },
    "shop"
  );
  await upsertCoreEntities([link]);
  await refreshViews();
  vscode.window.showInformationMessage(`Linked ${spendItem.title} to funding contract ${contract.title}.`);
}

async function refreshViews(): Promise<void> {
  await loadStore();
  suppliersProvider?.refresh();
  contractsProvider?.refresh();
  spendProvider?.refresh();
  forecastProvider?.refresh();
  homeProvider?.refresh();
  if (forecastPanel) {
    await openForecast();
  }
}

async function loadStore(): Promise<ShopStore> {
  if (shopStore) {
    return shopStore;
  }

  shopStore = await loadCoreStore();
  return shopStore;
}

async function loadLocalStore(): Promise<ShopStore> {
  const filePath = getShopStoreFilePath();
  if (!filePath) {
    return emptyStore();
  }

  try {
    const text = await readFile(filePath, "utf8");
    return normaliseStore(JSON.parse(text));
  } catch (error) {
    if (isNotFoundError(error)) {
      return emptyStore();
    }
    throw error;
  }
}

async function loadCoreStore(): Promise<ShopStore> {
  const [suppliers, contracts, spendItems] = await Promise.all([
    listCoreEntities("supplier"),
    listCoreEntities("contract"),
    listCoreEntities("spend-item")
  ]);

  return {
    shopStoreVersion: SHOP_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    suppliers: suppliers.filter(isActiveEntity).filter(isSupplierEntity),
    contracts: contracts.filter(isActiveEntity).filter(isContractEntity),
    spendItems: spendItems.filter(isActiveEntity).filter(isSpendItemEntity)
  };
}

async function listCoreEntities(entityType?: V01Entity["entityType"]): Promise<V01Entity[]> {
  return (await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", entityType)) ?? [];
}

async function listActiveTargets(entityType: LinkableTarget["entityType"]): Promise<LinkableTarget[]> {
  const entities = await listCoreEntities(entityType);
  return entities
    .filter(isActiveEntity)
    .filter((entity): entity is LinkableTarget => isLinkableTarget(entity) && entity.entityType === entityType);
}

async function pickLinkTarget(targets: readonly LinkableTarget[], label: string): Promise<LinkableTarget | undefined> {
  const selected = await vscode.window.showQuickPick(
    targets.map((target) => ({ label: targetTitle(target), description: formatToken(target.entityType), target })),
    { placeHolder: `Link to ${label}`, ignoreFocusOut: true, canPickMany: false }
  );
  return selected?.target;
}

async function importLocalStore(): Promise<void> {
  const localStore = await loadLocalStore();
  const localEntities = [...localStore.suppliers, ...localStore.contracts, ...localStore.spendItems];
  if (localEntities.length === 0) {
    vscode.window.showInformationMessage("No local Shop JSON records found to import.");
    return;
  }

  const coreStore = await loadCoreStore();
  const coreIds = new Set(
    [...coreStore.suppliers, ...coreStore.contracts, ...coreStore.spendItems].map((entity) => entity.id)
  );
  const duplicateCount = localEntities.filter((entity) => coreIds.has(entity.id)).length;
  const message =
    duplicateCount > 0
      ? `Import ${localEntities.length} local Shop records into Core? ${duplicateCount} existing Core records with the same IDs will be updated.`
      : `Import ${localEntities.length} local Shop records into Core?`;
  const answer = await vscode.window.showWarningMessage(message, "Import into Core", "Cancel");
  if (answer !== "Import into Core") {
    return;
  }

  await upsertShopEntities(localEntities);
  shopStore = undefined;
  await refreshViews();
  vscode.window.showInformationMessage(`Imported ${localEntities.length} Shop records into Core.`);
}

async function saveStore(nextStore: ShopStore): Promise<void> {
  await replaceCoreStore(nextStore);
}

async function upsertShopEntities(
  entities: readonly (SupplierRecord | ContractRecord | SpendItemRecord)[]
): Promise<void> {
  await upsertCoreEntities(entities);
}

async function upsertCoreEntities(entities: readonly V01Entity[]): Promise<void> {
  if (entities.length === 0) {
    return;
  }
  await vscode.commands.executeCommand("pspf.core.upsertEntities", entities);
}

async function replaceCoreStore(nextStore: ShopStore): Promise<void> {
  const current = await loadCoreStore();
  const timestamp = new Date().toISOString();
  const nextEntities: Array<SupplierRecord | ContractRecord | SpendItemRecord> = [
    ...nextStore.suppliers,
    ...nextStore.contracts,
    ...nextStore.spendItems
  ];
  const deletedEntities = [...current.suppliers, ...current.contracts, ...current.spendItems]
    .filter((currentEntity) => !nextEntities.some((nextEntity) => nextEntity.id === currentEntity.id))
    .map(
      (entity) =>
        ({ ...entity, recordStatus: "deleted", updatedAt: timestamp }) satisfies
          | SupplierRecord
          | ContractRecord
          | SpendItemRecord
    );
  const activeSuppliers = nextStore.suppliers.map(
    (entity) => ({ ...entity, recordStatus: "active", updatedAt: timestamp }) satisfies SupplierRecord
  );
  const activeContracts = nextStore.contracts.map(
    (entity) => ({ ...entity, recordStatus: "active", updatedAt: timestamp }) satisfies ContractRecord
  );
  const activeSpendItems = nextStore.spendItems.map(
    (entity) => ({ ...entity, recordStatus: "active", updatedAt: timestamp }) satisfies SpendItemRecord
  );
  const activeEntities: Array<SupplierRecord | ContractRecord | SpendItemRecord> = [
    ...activeSuppliers,
    ...activeContracts,
    ...activeSpendItems
  ];
  await upsertShopEntities([...deletedEntities, ...activeEntities]);
  shopStore = {
    shopStoreVersion: SHOP_STORE_VERSION,
    updatedAt: timestamp,
    suppliers: activeSuppliers,
    contracts: activeContracts,
    spendItems: activeSpendItems
  };
}

function getShopStoreFilePath(): string | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return undefined;
  }
  return join(workspaceFolder.uri.fsPath, ...SHOP_STORE_PATH);
}

function emptyStore(): ShopStore {
  return {
    shopStoreVersion: SHOP_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    suppliers: [],
    contracts: [],
    spendItems: []
  };
}

function normaliseStore(value: unknown): ShopStore {
  const source = isRecord(value) ? value : {};
  return {
    shopStoreVersion: typeof source.shopStoreVersion === "string" ? source.shopStoreVersion : SHOP_STORE_VERSION,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    suppliers: Array.isArray(source.suppliers) ? source.suppliers.map(normaliseSupplierRecord).filter(isDefined) : [],
    contracts: Array.isArray(source.contracts) ? source.contracts.map(normaliseContractRecord).filter(isDefined) : [],
    spendItems: Array.isArray(source.spendItems)
      ? source.spendItems.map(normaliseSpendItemRecord).filter(isDefined)
      : []
  };
}

function normaliseSupplierRecord(value: unknown): SupplierRecord | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return undefined;
  }
  const supplierType = mapSupplierType(value.supplierType);
  const status = mapSupplierStatus(value.status);
  const criticality = isIncluded(CRITICALITIES, value.criticality) ? value.criticality : undefined;
  if (!supplierType || !status || !criticality) {
    return undefined;
  }
  return {
    ...normaliseCommercialEnvelope(value, "supplier"),
    id: value.id,
    entityType: "supplier",
    name: value.name,
    supplierType,
    status,
    criticality,
    ...(typeof value.primaryContact === "string" ? { primaryContact: value.primaryContact } : {}),
    ...(typeof value.notes === "string" ? { notes: value.notes } : {})
  };
}

function normaliseContractRecord(value: unknown): ContractRecord | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.supplierId !== "string" ||
    typeof value.title !== "string"
  ) {
    return undefined;
  }
  const status = mapContractStatus(value.status);
  if (!status) {
    return undefined;
  }
  return {
    ...normaliseCommercialEnvelope(value, "contract"),
    id: value.id,
    entityType: "contract",
    supplierId: value.supplierId,
    title: value.title,
    status,
    ...(typeof value.contractRef === "string" ? { contractRef: value.contractRef } : {}),
    ...(typeof value.startsAt === "string" ? { startsAt: value.startsAt } : {}),
    ...(typeof value.endsAt === "string" ? { endsAt: value.endsAt } : {}),
    ...(normaliseMoneyAmount(value.value) ? { value: normaliseMoneyAmount(value.value) } : {}),
    ...(typeof value.serviceSummary === "string" ? { serviceSummary: value.serviceSummary } : {})
  };
}

function normaliseSpendItemRecord(value: unknown): SpendItemRecord | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.financialYear !== "string"
  ) {
    return undefined;
  }
  const spendType = mapSpendType(value.spendType);
  const status = mapSpendStatus(value.status);
  const amount = normaliseMoneyAmount(value.amount);
  if (!spendType || !status || !amount) {
    return undefined;
  }
  const forecastCost = normaliseMoneyAmount(value.forecastCost);
  const expectedSavings = normaliseMoneyAmount(value.expectedSavings);
  const savingsType = mapSavingsType(value.savingsType);
  return {
    ...normaliseCommercialEnvelope(value, "spend-item"),
    id: value.id,
    entityType: "spend-item",
    title: value.title,
    spendType,
    status,
    amount,
    financialYear: value.financialYear,
    ...(typeof value.costCentre === "string" ? { costCentre: value.costCentre } : {}),
    ...(typeof value.forecastStartAt === "string" ? { forecastStartAt: value.forecastStartAt } : {}),
    ...(typeof value.forecastEndAt === "string" ? { forecastEndAt: value.forecastEndAt } : {}),
    ...(forecastCost ? { forecastCost } : {}),
    ...(expectedSavings ? { expectedSavings } : {}),
    ...(savingsType ? { savingsType } : {}),
    ...(typeof value.paybackPeriodMonths === "number" ? { paybackPeriodMonths: value.paybackPeriodMonths } : {}),
    ...(isIncluded(CONFIDENCE_LEVELS, value.confidence) ? { confidence: value.confidence } : {}),
    ...(typeof value.assumptions === "string" ? { assumptions: value.assumptions } : {}),
    ...(typeof value.notes === "string" ? { notes: value.notes } : {})
  };
}

function normaliseMoneyAmount(value: unknown): MoneyAmount | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return moneyAmount(value);
  }
  if (!isRecord(value) || typeof value.amount !== "number" || !Number.isFinite(value.amount)) {
    return undefined;
  }
  return {
    amount: value.amount,
    currency: typeof value.currency === "string" && value.currency ? value.currency : "AUD"
  };
}

function mapSupplierType(value: unknown): SupplierRecord["supplierType"] | undefined {
  if (isIncluded(SUPPLIER_TYPES, value)) {
    return value;
  }
  if (value === "hardware" || value === "telecommunications" || value === "facilities") {
    return "service";
  }
  if (value === "consulting") {
    return "advisory";
  }
  return undefined;
}

function mapSupplierStatus(value: unknown): SupplierRecord["status"] | undefined {
  if (isIncluded(SUPPLIER_STATUSES, value)) {
    return value;
  }
  return value === "prospective" ? "proposed" : undefined;
}

function mapContractStatus(value: unknown): ContractRecord["status"] | undefined {
  if (isIncluded(CONTRACT_STATUSES, value)) {
    return value;
  }
  return value === "archived" ? "terminated" : undefined;
}

function mapSpendType(value: unknown): SpendItemRecord["spendType"] | undefined {
  if (isIncluded(SPEND_TYPES, value)) {
    return value;
  }
  if (value === "baseline" || value === "forecast") {
    return "opex";
  }
  if (value === "saving" || value === "avoidance") {
    return "uplift";
  }
  return value === "investment" ? "capex" : undefined;
}

function mapSpendStatus(value: unknown): SpendItemRecord["status"] | undefined {
  if (isIncluded(SPEND_STATUSES, value)) {
    return value;
  }
  if (value === "planned") {
    return "proposed";
  }
  return value === "realised" ? "spent" : undefined;
}

function mapSavingsType(value: unknown): SpendItemRecord["savingsType"] | undefined {
  if (isIncluded(SAVINGS_TYPES, value)) {
    return value;
  }
  if (value === "cost-reduction" || value === "service-improvement") {
    return "efficiency";
  }
  return value === "cost-avoidance" ? "avoided-cost" : undefined;
}

function isDefined<Value>(value: Value | undefined): value is Value {
  return value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIncluded<const Value extends string>(values: readonly Value[], value: unknown): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

function isActiveEntity(entity: V01Entity): boolean {
  return entity.recordStatus !== "deleted";
}

function isSupplierEntity(entity: V01Entity): entity is SupplierRecord {
  return entity.entityType === "supplier";
}

function isContractEntity(entity: V01Entity): entity is ContractRecord {
  return entity.entityType === "contract";
}

function isSpendItemEntity(entity: V01Entity): entity is SpendItemRecord {
  return entity.entityType === "spend-item";
}

function isLinkableTarget(entity: V01Entity): entity is LinkableTarget {
  return (
    entity.entityType === "requirement" ||
    entity.entityType === "action" ||
    entity.entityType === "risk" ||
    entity.entityType === "spend-item"
  );
}

function commercialTitle(entity: CommercialSource): string {
  return entity.entityType === "supplier" ? entity.name : entity.title;
}

function targetTitle(entity: LinkableTarget): string {
  return entity.title;
}

function newCommercialEnvelope(
  entityType: "supplier" | "contract" | "spend-item"
): Pick<
  SupplierRecord | ContractRecord | SpendItemRecord,
  "entityType" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus"
> {
  const timestamp = new Date().toISOString();
  return {
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProduct: "shop",
    recordStatus: "active"
  };
}

function normaliseCommercialEnvelope(
  value: Record<string, unknown>,
  entityType: "supplier" | "contract" | "spend-item"
): Pick<
  SupplierRecord | ContractRecord | SpendItemRecord,
  "entityType" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus"
> {
  const timestamp = new Date().toISOString();
  return {
    entityType,
    schemaVersion: typeof value.schemaVersion === "string" ? value.schemaVersion : VERSION_AXES.schemaVersion,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : timestamp,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : timestamp,
    sourceProduct: "shop",
    recordStatus:
      value.recordStatus === "archived" || value.recordStatus === "inactive" || value.recordStatus === "deleted"
        ? value.recordStatus
        : "active"
  };
}

function createShopId(prefix: "SUP" | "CTR" | "SPD"): string {
  return `${prefix}-${randomUUID()}`;
}

function buildSampleStore(): ShopStore {
  const supplierId = "SUP-00000000-0000-4000-8000-000000000901";
  const contractId = "CTR-00000000-0000-4000-8000-000000000901";
  const timestamp = new Date().toISOString();
  return {
    shopStoreVersion: SHOP_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    suppliers: [
      {
        ...sampleCommercialEnvelope("supplier", timestamp),
        id: supplierId,
        entityType: "supplier",
        name: "Secure Cloud Services",
        supplierType: "managed-service",
        status: "active",
        criticality: "high",
        notes: "Sample supplier note retained only in the local Shop store."
      }
    ],
    contracts: [
      {
        ...sampleCommercialEnvelope("contract", timestamp),
        id: contractId,
        entityType: "contract",
        supplierId,
        title: "Managed security monitoring",
        contractRef: "SHOP-SAMPLE-001",
        status: "active",
        startsAt: "2026-07-01",
        endsAt: "2027-06-30",
        value: {
          amount: 240000,
          currency: "AUD"
        },
        serviceSummary: "Sample support arrangement for validation only."
      }
    ],
    spendItems: [
      {
        ...sampleCommercialEnvelope("spend-item", timestamp),
        id: "SPD-00000000-0000-4000-8000-000000000901",
        entityType: "spend-item",
        title: "Security monitoring renewal",
        spendType: "opex",
        status: "proposed",
        amount: moneyAmount(240000),
        financialYear: "2026-27",
        costCentre: "SEC-OPS",
        forecastStartAt: "2026-07-01",
        forecastEndAt: "2027-06-30",
        forecastCost: moneyAmount(252000),
        expectedSavings: moneyAmount(15000),
        savingsType: "avoided-cost",
        paybackPeriodMonths: 12,
        confidence: "medium",
        assumptions: "Sample assumptions are local only.",
        notes: "Used to validate first Shop forecast rendering."
      },
      {
        ...sampleCommercialEnvelope("spend-item", timestamp),
        id: "SPD-00000000-0000-4000-8000-000000000902",
        entityType: "spend-item",
        title: "Evidence automation pilot",
        spendType: "capex",
        status: "proposed",
        amount: moneyAmount(80000),
        financialYear: "2026-27",
        costCentre: "SEC-OPS",
        forecastCost: moneyAmount(80000),
        expectedSavings: moneyAmount(25000),
        savingsType: "efficiency",
        paybackPeriodMonths: 18,
        confidence: "low"
      }
    ]
  };
}

function sampleCommercialEnvelope(
  entityType: "supplier" | "contract" | "spend-item",
  timestamp: string
): Pick<
  SupplierRecord | ContractRecord | SpendItemRecord,
  "entityType" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus"
> {
  return {
    entityType,
    schemaVersion: VERSION_AXES.schemaVersion,
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceProduct: "shop",
    recordStatus: "active"
  };
}

function validateOptionalDate(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? undefined : "Use YYYY-MM-DD.";
}

function validateFinancialYear(value: string): string | undefined {
  return /^\d{4}-\d{2}$/.test(value.trim()) ? undefined : "Use YYYY-YY.";
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalStringField(value: unknown): string | undefined {
  return cleanText(typeof value === "string" ? value : undefined);
}

function includedField<const Value extends string>(values: readonly Value[], value: unknown): Value | undefined {
  return isIncluded(values, value) ? value : undefined;
}

function requiredNumberField(value: unknown, labelText: string): { readonly value: number; readonly error?: string } {
  const parsed = optionalNumberField(value, labelText);
  if (parsed.error) {
    return { value: 0, error: parsed.error };
  }
  return parsed.value === undefined ? { value: 0, error: `${labelText} is required.` } : { value: parsed.value };
}

function optionalNumberField(
  value: unknown,
  labelText = "Number"
): { readonly value?: number; readonly error?: string } {
  const text = stringField(value);
  if (!text) {
    return {};
  }
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0
    ? { value: parsed }
    : { error: `${labelText} must be a positive number.` };
}

function optionalDateField(value: unknown, labelText: string): { readonly value?: string; readonly error?: string } {
  const text = stringField(value);
  if (!text) {
    return {};
  }
  return validateOptionalDate(text) ? { error: `${labelText} must use YYYY-MM-DD.` } : { value: text };
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getDefaultCostCentre(): string | undefined {
  return cleanText(vscode.workspace.getConfiguration(SHOP_CONFIGURATION_SECTION).get<string>("defaultCostCentre"));
}

class SupplierTreeProvider implements vscode.TreeDataProvider<ShopTreeItem> {
  private readonly changedEmitter = new vscode.EventEmitter<ShopTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.changedEmitter.event;

  refresh(): void {
    this.changedEmitter.fire();
  }

  getTreeItem(element: ShopTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ShopTreeItem[]> {
    const store = await loadStore();
    if (store.suppliers.length === 0) {
      return [new ShopTreeItem("No suppliers yet", "Use New Supplier or Load Shop Sample", "info")];
    }
    return store.suppliers.map(
      (supplier) =>
        new EntityTreeItem(
          supplier.name,
          `${formatToken(supplier.supplierType)} - ${formatToken(supplier.status)} - ${formatToken(supplier.criticality)}`,
          "supplier",
          "pspf.shop.openDetail",
          supplier,
          "pspfShopSupplier"
        )
    );
  }
}

class ContractTreeProvider implements vscode.TreeDataProvider<ShopTreeItem> {
  private readonly changedEmitter = new vscode.EventEmitter<ShopTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.changedEmitter.event;

  refresh(): void {
    this.changedEmitter.fire();
  }

  getTreeItem(element: ShopTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ShopTreeItem[]> {
    const store = await loadStore();
    if (store.contracts.length === 0) {
      return [new ShopTreeItem("No contracts yet", "Use New Contract or Load Shop Sample", "info")];
    }
    return store.contracts.map((contract) => {
      const supplier = store.suppliers.find((candidate) => candidate.id === contract.supplierId);
      const value = contract.value ? ` - ${formatMoneyAmount(contract.value)}` : "";
      return new EntityTreeItem(
        contract.title,
        `${supplier?.name ?? "Unknown supplier"} - ${formatToken(contract.status)}${value}`,
        "contract",
        "pspf.shop.openDetail",
        contract,
        "pspfShopContract"
      );
    });
  }
}

class SpendTreeProvider implements vscode.TreeDataProvider<ShopTreeItem> {
  private readonly changedEmitter = new vscode.EventEmitter<ShopTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.changedEmitter.event;

  refresh(): void {
    this.changedEmitter.fire();
  }

  getTreeItem(element: ShopTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ShopTreeItem[]> {
    const store = await loadStore();
    if (store.spendItems.length === 0) {
      return [new ShopTreeItem("No spend items yet", "Use New Spend Item or Load Shop Sample", "info")];
    }
    return store.spendItems.map(
      (item) =>
        new EntityTreeItem(
          item.title,
          `${item.financialYear}${item.costCentre ? ` - ${item.costCentre}` : ""} - ${formatToken(item.status)} - ${formatMoneyAmount(item.amount)}`,
          "spend",
          "pspf.shop.openDetail",
          item,
          "pspfShopSpendItem"
        )
    );
  }
}

class ShopHomeViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, enableCommandUris: true };
    webviewView.webview.onDidReceiveMessage((message: { command?: string }) => {
      if (typeof message?.command === "string" && SHOP_HOME_ALLOWED_COMMANDS.has(message.command)) {
        void vscode.commands.executeCommand(message.command);
      }
    });
    void this.render();
  }

  refresh(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    if (!this.view) {
      return;
    }
    const store = await loadStore();
    this.view.webview.html = renderShopHomeHtml(store);
  }
}

const SHOP_HOME_ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  "pspf.shop.openHome",
  "pspf.shop.loadSample",
  "pspf.shop.importLocalStore",
  "pspf.shop.newSupplier",
  "pspf.shop.newContract",
  "pspf.shop.newSpendItem",
  "pspf.shop.openForecast",
  "pspf.shop.exportForecastCsv",
  "pspf.shop.exportForecastXls"
]);

function renderShopHomeHtml(store: ShopStore): string {
  const supplierCount = store.suppliers.length;
  const contractCount = store.contracts.length;
  const spendCount = store.spendItems.length;
  const axes = `Schema ${VERSION_AXES.schemaVersion} · Bundle ${VERSION_AXES.bundleVersion} · API ${VERSION_AXES.apiVersion}`;

  const heroBody = `
    <p class="muted">${axes}</p>
    <p>Shop is the commercial planning surface for suppliers, contracts, and spend items. Use the Suppliers, Contracts, and Spend panels below to browse records; this Home tab is for quick capture and forecast review.</p>
    <div class="grid" role="list">
      ${homeMetricCard("Suppliers", supplierCount)}
      ${homeMetricCard("Contracts", contractCount)}
      ${homeMetricCard("Spend items", spendCount)}
    </div>
  `;

  const createBody = `<div class="action-list">
    ${homeActionButton("pspf.shop.newSupplier", "New supplier", "Capture a supplier")}
    ${homeActionButton("pspf.shop.newContract", "New contract", "Capture a supplier contract")}
    ${homeActionButton("pspf.shop.newSpendItem", "New spend item", "Capture planned or forecast spend")}
  </div>`;

  const forecastBody = `<div class="action-list compact">
    ${homeActionButton("pspf.shop.openForecast", "Open forecast", "Open the full forecast panel")}
    ${homeActionButton("pspf.shop.exportForecastCsv", "Export CSV", "Save forecast as CSV")}
    ${homeActionButton("pspf.shop.exportForecastXls", "Export XLS", "Save forecast as XLS")}
  </div>`;

  const dataBody = `<div class="action-list compact">
    ${homeActionButton("pspf.shop.loadSample", "Load sample", "Replace current Shop data with sample records")}
    ${homeActionButton("pspf.shop.importLocalStore", "Import local JSON", "Import .pspf/shop/shop.json records into Core")}
  </div>`;

  const body = [
    homeSection({
      id: "overview",
      hero: true,
      eyebrow: "Commercial planning",
      heading: "Shop workspace",
      body: heroBody
    }),
    homeSection({ id: "create", eyebrow: "Author", heading: "Create records", body: createBody }),
    homeSection({ id: "forecast", eyebrow: "Review", heading: "Forecast & savings", body: forecastBody }),
    homeSection({ id: "data", eyebrow: "Data", heading: "Sample & import", body: dataBody })
  ].join("");

  return homePanelShellHtml({
    extensionLabel: "PSPF Shop",
    title: "PSPF Shop",
    tagline: "Commercial planning",
    version: PSPF_SLICE_VERSION,
    accent: "amber",
    sensitivityBanner: "OFFICIAL: Sensitive · Local workspace writes stay in Shop until you snapshot or export.",
    nav: [
      { href: "overview", label: "Overview" },
      { href: "create", label: "Create" },
      { href: "forecast", label: "Forecast" },
      { href: "data", label: "Data" }
    ],
    body
  });
}

class ShopTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    iconName: "contract" | "home" | "info" | "sample" | "spend" | "supplier"
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = description;
    this.iconPath = new vscode.ThemeIcon(iconFor(iconName));
  }
}

class EntityTreeItem extends ShopTreeItem {
  constructor(
    label: string,
    description: string,
    iconName: "contract" | "spend" | "supplier",
    openCommand: string,
    entity: SupplierRecord | ContractRecord | SpendItemRecord,
    contextValue: string
  ) {
    super(label, description, iconName);
    this.command = { command: openCommand, title: "Open detail", arguments: [entity] };
    this.contextValue = contextValue;
  }
}

class ForecastViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: false, enableCommandUris: true };
    void this.render();
  }

  refresh(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    if (!this.view) {
      return;
    }
    const store = await loadStore();
    const forecast = deriveForecast(store.spendItems);
    const monthlyForecast = deriveForecastMonths(store.spendItems);
    const dashboard = await deriveCoverageDashboard(store);
    this.view.webview.html = renderCompactForecastHtml(store, forecast, monthlyForecast, dashboard);
  }
}

function deriveForecast(spendItems: readonly SpendItemRecord[]): ForecastYear[] {
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
    const forecastCost = existing.forecastCost + (moneyAmountValue(item.forecastCost) || moneyAmountValue(item.amount));
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

function deriveForecastMonths(spendItems: readonly SpendItemRecord[]): ForecastMonth[] {
  const byMonth = new Map<string, ForecastMonth>();
  for (const item of forecastOnlyItems(spendItems)) {
    const months = forecastMonthsForItem(item);
    if (months.length === 0) {
      continue;
    }
    const monthlySpend = (moneyAmountValue(item.forecastCost) || moneyAmountValue(item.amount)) / months.length;
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

function forecastOnlyItems(spendItems: readonly SpendItemRecord[]): SpendItemRecord[] {
  return spendItems.filter((item) => item.status !== "spent" && item.status !== "cancelled");
}

function forecastMonthsForItem(item: SpendItemRecord): ForecastMonth[] {
  const explicitMonths = monthsBetween(item.forecastStartAt, item.forecastEndAt, item.financialYear);
  if (explicitMonths.length > 0) {
    return explicitMonths;
  }
  return monthsForFinancialYear(item.financialYear);
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

async function deriveCoverageDashboard(store: ShopStore): Promise<CommercialCoverageDashboard> {
  const entities = await listCoreEntities();
  const activeEntities = entities.filter(isActiveEntity);
  const links = activeEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const actionById = new Map(
    activeEntities
      .filter((entity): entity is ActionEntity => entity.entityType === "action")
      .map((action) => [action.id, action])
  );
  const requirementById = new Map(
    activeEntities
      .filter((entity): entity is RequirementEntity => entity.entityType === "requirement")
      .map((requirement) => [requirement.id, requirement])
  );
  const tagById = new Map(
    activeEntities.filter((entity): entity is TagEntity => entity.entityType === "tag").map((tag) => [tag.id, tag])
  );
  const riskById = new Map(
    activeEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk").map((risk) => [risk.id, risk])
  );
  const supplierById = new Map(store.suppliers.map((supplier) => [supplier.id, supplier]));
  const today = startOfUtcDay(new Date());
  const savingSchedule = deriveSavingSchedule(store, links);

  return {
    coverage: [
      coverageGroup(
        "Suppliers",
        store.suppliers,
        links,
        isSupplierAssuranceLink,
        "pspf.shop.linkSupplierToRequirement"
      ),
      coverageGroup(
        "Contracts",
        store.contracts,
        links,
        isContractAssuranceLink,
        "pspf.shop.linkContractToRequirement"
      ),
      coverageGroup("Spend items", store.spendItems, links, isSpendAssuranceLink, "pspf.shop.linkSpendToAction")
    ],
    uncontractedSpendItems: store.spendItems
      .filter((item) => !links.some((link) => isContractFundingLink(link) && link.toId === item.id))
      .sort(
        (first, second) =>
          first.financialYear.localeCompare(second.financialYear) || first.title.localeCompare(second.title)
      ),
    renewals: store.contracts
      .filter((contract) => contract.status === "active")
      .map((contract) => ({
        contract,
        supplierName: supplierById.get(contract.supplierId)?.name ?? "Unknown supplier",
        daysUntilEnd: daysUntil(contract.endsAt, today)
      }))
      .filter(
        (renewal): renewal is ContractRenewal =>
          renewal.daysUntilEnd !== undefined &&
          renewal.daysUntilEnd >= 0 &&
          renewal.daysUntilEnd <= NEAR_TERM_REVIEW_DAYS
      )
      .sort(
        (first, second) =>
          first.daysUntilEnd - second.daysUntilEnd || first.contract.title.localeCompare(second.contract.title)
      ),
    fundedActions: links
      .filter((link) => isSpendAssuranceLink(link) && link.toType === "action")
      .map((link) => {
        const spendItem = store.spendItems.find((candidate) => candidate.id === link.fromId);
        const action = actionById.get(link.toId);
        return spendItem && action && isOpenAction(action)
          ? { spendItem, action, urgency: actionUrgency(action, today) }
          : undefined;
      })
      .filter(isDefined)
      .sort(
        (first, second) =>
          urgencyRank(first.urgency) - urgencyRank(second.urgency) ||
          first.action.title.localeCompare(second.action.title)
      ),
    supplierRisks: links
      .filter(isSupplierRiskLink)
      .map((link) => {
        const supplier = store.suppliers.find((candidate) => candidate.id === link.fromId);
        const risk = riskById.get(link.toId);
        const score = risk ? risk.likelihood * risk.impact : 0;
        return supplier && risk && (risk.status === "open" || score >= 12) ? { supplier, risk, score } : undefined;
      })
      .filter(isDefined)
      .sort((first, second) => second.score - first.score || first.risk.title.localeCompare(second.risk.title)),
    supplierManagement: deriveSupplierManagement(store),
    contractArtefacts: deriveContractArtefacts(store),
    spendItemReport: deriveSpendItemReport(store.spendItems),
    scenarioSummaries: deriveScenarioSummaries(store.spendItems, links),
    assuranceSpend: deriveAssuranceSpend(store.spendItems, links, requirementById, actionById, tagById),
    savingSchedule,
    efficiencyDividends: deriveEfficiencyDividends(savingSchedule)
  };
}

function deriveScenarioSummaries(
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

function deriveAssuranceSpend(
  spendItems: readonly SpendItemRecord[],
  links: readonly LinkEntity[],
  requirementById: ReadonlyMap<string, RequirementEntity>,
  actionById: ReadonlyMap<string, ActionEntity>,
  tagById: ReadonlyMap<string, TagEntity>
): AssuranceSpendRow[] {
  const forecastItems = forecastOnlyItems(spendItems);
  const requirementGroups = new Map<string, SpendItemRecord[]>();
  const actionGroups = new Map<string, SpendItemRecord[]>();
  const tagGroups = new Map<string, SpendItemRecord[]>();

  for (const item of forecastItems) {
    const actionIds = linkedActionIdsForSpend(item, links);
    for (const actionId of actionIds) {
      addGroupedItem(actionGroups, actionId, item);
    }

    const requirementIds = linkedRequirementIdsForSpend(item, links, actionIds);
    for (const requirementId of requirementIds) {
      addGroupedItem(requirementGroups, requirementId, item);
      for (const tagId of tagIdsForRequirement(requirementId, links)) {
        addGroupedItem(tagGroups, tagId, item);
      }
    }
  }

  const rows = [
    ...[...requirementGroups.entries()].map(([requirementId, items]) => {
      const requirement = requirementById.get(requirementId);
      return assuranceSpendRow(
        "Requirement",
        requirement?.title ?? requirementId,
        requirement ? `${requirement.domainId} · ${formatToken(requirement.assessmentStatus)}` : "Missing Requirement",
        items,
        links
      );
    }),
    ...[...tagGroups.entries()].map(([tagId, items]) => {
      const tag = tagById.get(tagId);
      return assuranceSpendRow("Tag", tag?.title ?? tagId, tag ? tag.label : "Missing tag", items, links);
    }),
    ...[...actionGroups.entries()].map(([actionId, items]) => {
      const action = actionById.get(actionId);
      return assuranceSpendRow(
        "Action",
        action?.title ?? actionId,
        action ? formatToken(action.status) : "Missing Action",
        items,
        links
      );
    })
  ];

  return rows.sort(
    (first, second) =>
      scopeRank(first.scope) - scopeRank(second.scope) ||
      second.forecastCost - first.forecastCost ||
      first.title.localeCompare(second.title)
  );
}

function assuranceSpendRow(
  scope: AssuranceSpendRow["scope"],
  title: string,
  secondary: string,
  items: readonly SpendItemRecord[],
  links: readonly LinkEntity[]
): AssuranceSpendRow {
  const uniqueItems = uniqueSpendItems(items);
  const totals = spendTotals(uniqueItems);
  return {
    scope,
    title,
    secondary,
    itemCount: uniqueItems.length,
    multiLinkedItemCount: uniqueItems.filter((item) => linkedAssuranceTargetCount(item, links) > 1).length,
    plannedSpend: totals.plannedSpend,
    forecastCost: totals.forecastCost,
    expectedSavings: totals.expectedSavings,
    netForecast: totals.netForecast,
    confidence: mixedConfidence(uniqueItems)
  };
}

function spendTotals(
  items: readonly SpendItemRecord[]
): Omit<ScenarioSummary, "label" | "description" | "itemCount" | "lowConfidenceCount" | "unlinkedItemCount"> {
  const plannedSpend = items.reduce((total, item) => total + moneyAmountValue(item.amount), 0);
  const forecastCost = items.reduce(
    (total, item) => total + (moneyAmountValue(item.forecastCost) || moneyAmountValue(item.amount)),
    0
  );
  const expectedSavings = items.reduce((total, item) => total + moneyAmountValue(item.expectedSavings), 0);
  return { plannedSpend, forecastCost, expectedSavings, netForecast: forecastCost - expectedSavings };
}

function linkedActionIdsForSpend(item: SpendItemRecord, links: readonly LinkEntity[]): Set<string> {
  return new Set(
    links
      .filter((link) => isSpendAssuranceLink(link) && link.fromId === item.id && link.toType === "action")
      .map((link) => link.toId)
  );
}

function linkedRequirementIdsForSpend(
  item: SpendItemRecord,
  links: readonly LinkEntity[],
  actionIds: ReadonlySet<string>
): Set<string> {
  const requirementIds = new Set(
    links
      .filter((link) => isSpendAssuranceLink(link) && link.fromId === item.id && link.toType === "requirement")
      .map((link) => link.toId)
  );
  for (const link of links) {
    if (
      link.fromType === "requirement" &&
      link.toType === "action" &&
      link.linkType === "addressed-by" &&
      actionIds.has(link.toId)
    ) {
      requirementIds.add(link.fromId);
    }
  }
  return requirementIds;
}

function tagIdsForRequirement(requirementId: string, links: readonly LinkEntity[]): Set<string> {
  return new Set(
    links
      .filter(
        (link) =>
          link.fromType === "requirement" &&
          link.fromId === requirementId &&
          link.toType === "tag" &&
          link.linkType === "tagged-with"
      )
      .map((link) => link.toId)
  );
}

function addGroupedItem(groups: Map<string, SpendItemRecord[]>, key: string, item: SpendItemRecord): void {
  const existing = groups.get(key) ?? [];
  if (!existing.some((candidate) => candidate.id === item.id)) {
    groups.set(key, [...existing, item]);
  }
}

function uniqueSpendItems(items: readonly SpendItemRecord[]): SpendItemRecord[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function hasAssuranceSpendLink(item: SpendItemRecord, links: readonly LinkEntity[]): boolean {
  return links.some((link) => isSpendAssuranceLink(link) && link.fromId === item.id);
}

function linkedAssuranceTargetCount(item: SpendItemRecord, links: readonly LinkEntity[]): number {
  return links.filter((link) => isSpendAssuranceLink(link) && link.fromId === item.id).length;
}

function mixedConfidence(items: readonly SpendItemRecord[]): string {
  if (items.length === 0) {
    return "Not set";
  }
  return items.reduce(
    (current, item) => lowerConfidence(current, item.confidence ? formatToken(item.confidence) : "Medium"),
    "High"
  );
}

function scopeRank(scope: AssuranceSpendRow["scope"]): number {
  switch (scope) {
    case "Requirement":
      return 0;
    case "Tag":
      return 1;
    case "Action":
      return 2;
  }
}

function deriveSpendItemReport(spendItems: readonly SpendItemRecord[]): SpendItemReportRow[] {
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
      forecastCost: moneyAmountValue(item.forecastCost) || moneyAmountValue(item.amount),
      expectedSavings: moneyAmountValue(item.expectedSavings)
    }));
}

function deriveSavingSchedule(store: ShopStore, links: readonly LinkEntity[]): SavingScheduleRow[] {
  const contractById = new Map(store.contracts.map((contract) => [contract.id, contract]));
  return forecastOnlyItems(store.spendItems)
    .filter((item) => moneyAmountValue(item.expectedSavings) > 0)
    .map((item) => {
      const linkedContracts = links
        .filter(
          (link) =>
            link.linkType === "funds" &&
            link.toType === "spend-item" &&
            link.toId === item.id &&
            link.fromType === "contract"
        )
        .map((link) => contractById.get(link.fromId))
        .filter(isDefined)
        .sort((first, second) => first.title.localeCompare(second.title));
      return {
        spendItem: item,
        financialYear: item.financialYear,
        scheduledFrom: item.forecastStartAt ?? `FY ${item.financialYear}`,
        scheduledTo: item.forecastEndAt ?? `FY ${item.financialYear}`,
        plannedSaving: moneyAmountValue(item.expectedSavings),
        savingsType: item.savingsType ? formatToken(item.savingsType) : "Efficiency",
        confidence: item.confidence ? formatToken(item.confidence) : "Medium",
        replacementContext: replacementContext(linkedContracts)
      };
    })
    .sort(
      (first, second) =>
        first.financialYear.localeCompare(second.financialYear) ||
        first.spendItem.title.localeCompare(second.spendItem.title)
    );
}

function deriveEfficiencyDividends(savingSchedule: readonly SavingScheduleRow[]): EfficiencyDividendYear[] {
  const byYear = new Map<string, EfficiencyDividendYear>();
  for (const saving of savingSchedule) {
    const existing = byYear.get(saving.financialYear) ?? {
      financialYear: saving.financialYear,
      plannedSaving: 0,
      itemCount: 0,
      confidence: "High"
    };
    byYear.set(saving.financialYear, {
      financialYear: saving.financialYear,
      plannedSaving: existing.plannedSaving + saving.plannedSaving,
      itemCount: existing.itemCount + 1,
      confidence: lowerConfidence(existing.confidence, saving.confidence)
    });
  }
  return [...byYear.values()].sort((first, second) => first.financialYear.localeCompare(second.financialYear));
}

function replacementContext(contracts: readonly ContractRecord[]): string {
  if (contracts.length === 0) {
    return "Link a contract to show replacement context";
  }
  const replacement =
    contracts.find((contract) => contract.status === "active" || contract.status === "draft") ?? contracts[0];
  if (!replacement) {
    return "Link a contract to show replacement context";
  }
  const replaced = contracts.find(
    (contract) => contract.id !== replacement.id && (contract.status === "expired" || contract.status === "terminated")
  );
  return replaced
    ? `${replacement.title} replaces ${replaced.title}`
    : contracts.map((contract) => contract.title).join("; ");
}

function lowerConfidence(first: string, second: string): string {
  const rank = new Map([
    ["Low", 0],
    ["Medium", 1],
    ["High", 2]
  ]);
  return (rank.get(first) ?? 1) <= (rank.get(second) ?? 1) ? first : second;
}

function deriveSupplierManagement(store: ShopStore): SupplierManagementSignal[] {
  return store.suppliers
    .slice()
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((supplier) => {
      const contracts = store.contracts.filter(
        (contract) => contract.supplierId === supplier.id && contract.status === "active"
      );
      const highAttention =
        supplier.criticality === "high" ||
        supplier.criticality === "critical" ||
        supplier.supplierType === "managed-service";
      return {
        supplier,
        performanceMeasure: supplierPerformanceMeasure(supplier),
        contractManagement:
          contracts.length > 0
            ? `${contracts.length} active contract review${contracts.length === 1 ? "" : "s"}`
            : "Needs active contract management link",
        fociCheck: highAttention ? "FOCI check required before next review" : "FOCI check to confirm no change",
        status: contracts.length === 0 ? "review" : highAttention ? "watch" : "ok"
      };
    });
}

function supplierPerformanceMeasure(supplier: SupplierRecord): string {
  switch (supplier.supplierType) {
    case "managed-service":
      return "Monthly service performance and incident review";
    case "software":
      return "Licence, availability, and support performance check";
    case "advisory":
      return "Milestone acceptance and deliverable quality review";
    case "service":
      return "Service level and contract management review";
    case "other":
      return "Supplier performance review";
  }
}

function deriveContractArtefacts(store: ShopStore): ContractArtefactSignal[] {
  const supplierById = new Map(store.suppliers.map((supplier) => [supplier.id, supplier.name]));
  return store.contracts
    .slice()
    .sort((first, second) => first.title.localeCompare(second.title))
    .map((contract) => ({
      contract,
      supplierName: supplierById.get(contract.supplierId) ?? "Unknown supplier",
      artefacts: contractArtefacts(contract)
    }));
}

function contractArtefacts(contract: ContractRecord): ArtefactSignal[] {
  return [
    {
      label: "Value-for-money and decision record",
      status: contract.value ? "ready" : "needed",
      sourceLabel: "CPR value for money",
      href: CPR_LINKS.valueForMoney
    },
    {
      label: "Risk and FOCI assessment",
      status: contract.status === "active" ? "needed" : "ready",
      sourceLabel: "CPR procurement risk",
      href: CPR_LINKS.risk
    },
    {
      label: "Contract management plan",
      status: contract.endsAt ? "ready" : "needed",
      sourceLabel: "Finance Contract Management Guide",
      href: CPR_LINKS.contractManagement
    },
    {
      label: "Negotiation and contract terms pack",
      status: contract.contractRef ? "ready" : "needed",
      sourceLabel: "Finance contract negotiations",
      href: CPR_LINKS.negotiations
    },
    {
      label: "Accountability, confidentiality, and reporting evidence",
      status: contract.contractRef && contract.startsAt && contract.endsAt ? "ready" : "needed",
      sourceLabel: "CPR accountability and transparency",
      href: CPR_LINKS.accountability
    },
    {
      label: "Supplier conduct and significant-events check",
      status: contract.status === "active" ? "needed" : "ready",
      sourceLabel: "Commonwealth Supplier Code of Conduct",
      href: CPR_LINKS.supplierConduct
    }
  ];
}

function coverageGroup(
  label: string,
  records: readonly CommercialSource[],
  links: readonly LinkEntity[],
  isCoveredLink: (link: LinkEntity) => boolean,
  linkCommand: string
): CoverageGroup {
  const linkedIds = new Set(links.filter(isCoveredLink).map((link) => link.fromId));
  return {
    label,
    total: records.length,
    linked: records.filter((record) => linkedIds.has(record.id)).length,
    unlinked: records.filter((record) => !linkedIds.has(record.id)),
    linkCommand
  };
}

function isSupplierAssuranceLink(link: LinkEntity): boolean {
  return (
    link.fromType === "supplier" &&
    ((link.linkType === "supports" && link.toType === "requirement") ||
      (link.linkType === "associated-with" && link.toType === "risk"))
  );
}

function isContractAssuranceLink(link: LinkEntity): boolean {
  return (
    link.fromType === "contract" &&
    ((link.linkType === "supports" && link.toType === "requirement") ||
      (link.linkType === "funds" && link.toType === "spend-item"))
  );
}

function isContractFundingLink(link: LinkEntity): boolean {
  return link.fromType === "contract" && link.toType === "spend-item" && link.linkType === "funds";
}

function isSpendAssuranceLink(link: LinkEntity): boolean {
  return (
    link.fromType === "spend-item" &&
    link.linkType === "supports" &&
    (link.toType === "action" || link.toType === "requirement")
  );
}

function isSupplierRiskLink(link: LinkEntity): boolean {
  return link.fromType === "supplier" && link.toType === "risk" && link.linkType === "associated-with";
}

function daysUntil(dateText: string | undefined, today: Date): number | undefined {
  if (!dateText) {
    return undefined;
  }
  const date = startOfUtcDay(new Date(`${dateText}T00:00:00Z`));
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isOpenAction(action: ActionEntity): boolean {
  return action.status !== "done" && action.status !== "cancelled";
}

function actionUrgency(action: ActionEntity, today: Date): FundedAction["urgency"] {
  if (action.status === "blocked") {
    return "blocked";
  }
  const dueIn = daysUntil(action.dueDate, today);
  return dueIn !== undefined && dueIn < 0 ? "overdue" : "open";
}

function urgencyRank(urgency: FundedAction["urgency"]): number {
  switch (urgency) {
    case "blocked":
      return 0;
    case "overdue":
      return 1;
    case "open":
      return 2;
  }
}

function renderShopEditorHtml(
  entityType: ShopEditorKind,
  store: ShopStore,
  entity: SupplierRecord | ContractRecord | SpendItemRecord | undefined
): string {
  const heading = shopEditorTitle(entityType, entity);
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${tokensCss("extension")}
    :root { --shop-amber: var(--pspf-warn); --shop-panel: color-mix(in srgb, var(--pspf-surface) 88%, var(--pspf-primary)); }
    body { color: var(--pspf-text); background: var(--pspf-surface); font-family: var(--vscode-font-family); margin: 0; padding: 20px; }
    main { max-width: 920px; margin: 0 auto; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    h2 { font-size: 1rem; margin: 0 0 8px; }
    p { color: var(--pspf-muted); margin: 0 0 14px; }
    .masthead { border-left: 4px solid var(--shop-amber); background: var(--shop-panel); padding: var(--pspf-gap-md) var(--pspf-pad); margin: 0 0 var(--pspf-pad); }
    .eyebrow { color: var(--pspf-primary); font-size: var(--pspf-type-label); font-weight: 700; letter-spacing: var(--pspf-letter-label); text-transform: uppercase; margin: 0 0 4px; }
    .panel { border: 1px solid var(--pspf-border); border-radius: var(--pspf-radius); padding: var(--pspf-gap); margin: 0 0 var(--pspf-gap-md); }
    .form-grid { display: grid; gap: 12px; }
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    label { display: grid; gap: 5px; font-size: 0.88rem; }
    input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid var(--vscode-input-border, var(--pspf-border)); border-radius: 6px; padding: 8px 10px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); font: inherit; }
    textarea { line-height: 1.45; resize: vertical; }
    input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
    .form-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
    button { min-height: 38px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 6px; padding: 8px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .muted { color: var(--pspf-muted); }
  </style>
</head>
<body>
  <main>
    <section class="masthead">
      <p class="eyebrow">Commercial planning editor</p>
      <h1>${escapeHtml(heading)}</h1>
      <p>Shop records are Core-backed commercial planning records. Use this panel when related fields need to be reviewed together before saving.</p>
    </section>
    <form class="form-grid" data-entity-type="${escapeHtml(entityType)}" data-entity-id="${escapeHtml(entity?.id ?? "")}">
      ${renderShopEditorFields(entityType, store, entity)}
      <section class="panel">
        <h2>Write action</h2>
        <p class="muted">Save keeps the panel open. Save and close returns to the Shop views; new spend items can then be linked to assurance work.</p>
        <div class="form-actions">
          <button type="button" data-action="saveShopRecord">Save</button>
          <button type="button" data-action="saveAndCloseShopRecord">Save and close</button>
          <button type="button" data-action="cancelShopRecord">Cancel</button>
        </div>
      </section>
    </form>
  </main>
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const form = button.closest('form');
        if (!form) {
          return;
        }
        const data = new FormData(form);
        const fields = {};
        for (const [key, value] of data.entries()) {
          fields[key] = String(value);
        }
        button.setAttribute('aria-busy', 'true');
        vscode.postMessage({
          action: button.dataset.action,
          entityType: form.dataset.entityType,
          entityId: form.dataset.entityId,
          fields
        });
        setTimeout(() => button.removeAttribute('aria-busy'), 800);
      });
    });
  </script>
</body>
</html>`;
}

function renderShopEditorFields(
  entityType: ShopEditorKind,
  store: ShopStore,
  entity: SupplierRecord | ContractRecord | SpendItemRecord | undefined
): string {
  switch (entityType) {
    case "supplier":
      return renderSupplierEditorFields(entity?.entityType === "supplier" ? entity : undefined);
    case "contract":
      return renderContractEditorFields(store, entity?.entityType === "contract" ? entity : undefined);
    case "spend-item":
      return renderSpendItemEditorFields(entity?.entityType === "spend-item" ? entity : undefined);
  }
}

function renderSupplierEditorFields(supplier: SupplierRecord | undefined): string {
  return `<section class="panel">
    <h2>Supplier</h2>
    ${inputControl("name", "Supplier name", supplier?.name ?? "", true, "1")}
    <div class="two-col">
      ${selectControl("supplierType", "Supplier type", SUPPLIER_TYPES, supplier?.supplierType ?? "service", "2")}
      ${selectControl("status", "Status", SUPPLIER_STATUSES, supplier?.status ?? "active", "3")}
      ${selectControl("criticality", "Criticality", CRITICALITIES, supplier?.criticality ?? "medium", "4")}
      ${inputControl("primaryContact", "Primary contact or role", supplier?.primaryContact ?? "", false, "5")}
    </div>
    ${textareaControl("notes", "Notes", supplier?.notes ?? "", "6")}
  </section>`;
}

function renderContractEditorFields(store: ShopStore, contract: ContractRecord | undefined): string {
  const selectedSupplierId = contract?.supplierId ?? store.suppliers[0]?.id ?? "";
  return `<section class="panel">
    <h2>Contract</h2>
    ${selectSupplierControl(store.suppliers, selectedSupplierId, "1")}
    ${inputControl("title", "Contract title", contract?.title ?? "", true, "2")}
    <div class="two-col">
      ${selectControl("status", "Status", CONTRACT_STATUSES, contract?.status ?? "active", "3")}
      ${inputControl("contractRef", "Contract reference", contract?.contractRef ?? "", false, "4")}
      ${inputControl("startsAt", "Start date", contract?.startsAt ?? "", false, "5", "YYYY-MM-DD")}
      ${inputControl("endsAt", "End date", contract?.endsAt ?? "", false, "6", "YYYY-MM-DD")}
      ${inputControl("valueAmount", "Contract value (AUD)", contract?.value?.amount.toString() ?? "", false, "7", "0")}
    </div>
    ${textareaControl("serviceSummary", "Service summary", contract?.serviceSummary ?? "", "8")}
  </section>`;
}

function renderSpendItemEditorFields(spendItem: SpendItemRecord | undefined): string {
  const currentYear = new Date().getFullYear();
  const defaultFinancialYear = `${currentYear}-${String((currentYear + 1) % 100).padStart(2, "0")}`;
  return `<section class="panel">
    <h2>Spend item</h2>
    ${inputControl("title", "Spend item title", spendItem?.title ?? "", true, "1")}
    <div class="two-col">
      ${selectControl("spendType", "Spend type", SPEND_TYPES, spendItem?.spendType ?? "uplift", "2")}
      ${selectControl("status", "Status", SPEND_STATUSES, spendItem?.status ?? "proposed", "3")}
      ${inputControl("amount", "Amount (AUD)", moneyInputValue(spendItem?.amount), true, "4", "0")}
      ${inputControl("financialYear", "Financial year", spendItem?.financialYear ?? defaultFinancialYear, true, "5", "YYYY-YY")}
      ${inputControl("costCentre", "Cost centre", spendItem?.costCentre ?? getDefaultCostCentre() ?? "", false, "6")}
      ${selectControl("confidence", "Confidence", CONFIDENCE_LEVELS, spendItem?.confidence ?? "medium", "7")}
    </div>
  </section>
  <section class="panel">
    <h2>Forecast and savings</h2>
    <div class="two-col">
      ${inputControl("forecastStartAt", "Forecast start date", spendItem?.forecastStartAt ?? "", false, "8", "YYYY-MM-DD")}
      ${inputControl("forecastEndAt", "Forecast end date", spendItem?.forecastEndAt ?? "", false, "9", "YYYY-MM-DD")}
      ${inputControl("forecastCost", "Forecast cost (AUD)", moneyInputValue(spendItem?.forecastCost), false, "10", "0")}
      ${inputControl("expectedSavings", "Expected savings (AUD)", moneyInputValue(spendItem?.expectedSavings), false, "11", "0")}
      ${selectControl("savingsType", "Savings type", SAVINGS_TYPES, spendItem?.savingsType ?? "efficiency", "12")}
      ${inputControl("paybackPeriodMonths", "Payback period months", spendItem?.paybackPeriodMonths?.toString() ?? "", false, "13", "0")}
    </div>
    ${textareaControl("assumptions", "Assumptions", spendItem?.assumptions ?? "", "14")}
    ${textareaControl("notes", "Notes", spendItem?.notes ?? "", "15")}
  </section>`;
}

function inputControl(
  name: string,
  labelText: string,
  value: string,
  required: boolean,
  tabIndex: string,
  placeholder = ""
): string {
  return `<label><span>${escapeHtml(labelText)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value)}" tabindex="${escapeHtml(tabIndex)}"${required ? " required" : ""}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}></label>`;
}

function textareaControl(name: string, labelText: string, value: string, tabIndex: string): string {
  return `<label><span>${escapeHtml(labelText)}</span><textarea name="${escapeHtml(name)}" rows="4" tabindex="${escapeHtml(tabIndex)}">${escapeHtml(value)}</textarea></label>`;
}

function selectControl<Value extends string>(
  name: string,
  labelText: string,
  values: readonly Value[],
  selectedValue: Value,
  tabIndex: string
): string {
  return `<label><span>${escapeHtml(labelText)}</span><select name="${escapeHtml(name)}" tabindex="${escapeHtml(tabIndex)}">${values.map((value) => `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(formatToken(value))}</option>`).join("")}</select></label>`;
}

function selectSupplierControl(
  suppliers: readonly SupplierRecord[],
  selectedSupplierId: string,
  tabIndex: string
): string {
  return `<label><span>Supplier</span><select name="supplierId" tabindex="${escapeHtml(tabIndex)}">${suppliers.map((supplier) => `<option value="${escapeHtml(supplier.id)}"${supplier.id === selectedSupplierId ? " selected" : ""}>${escapeHtml(supplier.name)}</option>`).join("")}</select></label>`;
}

function shopEditorTitle(
  entityType: ShopEditorKind,
  entity: SupplierRecord | ContractRecord | SpendItemRecord | undefined
): string {
  const action = entity ? "Edit" : "New";
  switch (entityType) {
    case "supplier":
      return `${action} Supplier${entity?.entityType === "supplier" ? `: ${entity.name}` : ""}`;
    case "contract":
      return `${action} Contract${entity?.entityType === "contract" ? `: ${entity.title}` : ""}`;
    case "spend-item":
      return `${action} Spend Item${entity?.entityType === "spend-item" ? `: ${entity.title}` : ""}`;
  }
}

function shopRecordLabel(entity: SupplierRecord | ContractRecord | SpendItemRecord): string {
  return entity.entityType === "supplier"
    ? `supplier ${entity.name}`
    : `${formatToken(entity.entityType)} ${entity.title}`;
}

function renderShopDetailHtml(store: ShopStore, entity: SupplierRecord | ContractRecord | SpendItemRecord): string {
  const heading = commercialTitle(entity);
  const editCommand = shopDetailEditCommand(entity);
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${tokensCss("extension")}
    :root { --shop-amber: var(--pspf-warn); --shop-panel: color-mix(in srgb, var(--pspf-surface) 88%, var(--pspf-primary)); }
    body { color: var(--pspf-text); background: var(--pspf-surface); font-family: var(--vscode-font-family); margin: 0; padding: 20px; }
    main { max-width: 920px; margin: 0 auto; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; }
    h2 { font-size: 1rem; margin: 0 0 8px; }
    p { color: var(--pspf-muted); margin: 0 0 14px; }
    .masthead { border-left: 4px solid var(--shop-amber); background: var(--shop-panel); padding: var(--pspf-gap-md) var(--pspf-pad); margin: 0 0 var(--pspf-pad); }
    .eyebrow { color: var(--pspf-primary); font-size: var(--pspf-type-label); font-weight: 700; letter-spacing: var(--pspf-letter-label); text-transform: uppercase; margin: 0 0 4px; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: var(--pspf-gap-sm); margin-top: var(--pspf-gap); }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: var(--pspf-gap-sm); }
    .detail-field { border: 1px solid var(--pspf-border); border-radius: var(--pspf-radius); padding: var(--pspf-pad-sm); background: var(--pspf-surface-strong); min-width: 0; }
    .detail-field span { display: block; color: var(--pspf-muted); font-size: var(--pspf-type-label); font-weight: 700; letter-spacing: var(--pspf-letter-label); text-transform: uppercase; }
    .detail-field strong { display: block; margin-top: 4px; overflow-wrap: anywhere; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <section class="masthead">
      <p class="eyebrow">Commercial planning detail</p>
      <h1>${escapeHtml(heading)}</h1>
      <p>Review the Shop record before editing or linking it to assurance work.</p>
      <div class="detail-actions">
        <a class="pspf-button pspf-button--secondary" href="${escapeHtml(commandUri(editCommand, [entity]))}">Edit</a>
        <a class="pspf-button pspf-button--secondary" href="${escapeHtml(commandUri("pspf.shop.deleteRecord", [entity]))}">Delete</a>
        <a class="pspf-button pspf-button--secondary" href="${escapeHtml(commandUri("pspf.shop.openForecast", []))}">Open forecast</a>
      </div>
    </section>
    <section class="pspf-section">
      <h2>${escapeHtml(formatToken(entity.entityType))}</h2>
      <div class="detail-grid">${shopDetailRows(entity, store).map(renderShopDetailField).join("")}</div>
    </section>
    <section class="pspf-section">
      <h2>Record metadata</h2>
      <div class="detail-grid">${shopMetadataRows(entity).map(renderShopDetailField).join("")}</div>
    </section>
    ${relationshipManagerHtml({
      title: "Relationship actions",
      description:
        "Link this commercial record to assurance records using the shared relationship manager pattern and canonical Shop relationship rules.",
      actions: shopDetailRelationshipActions(entity),
      emptyText: "No relationship actions are available for this Shop record."
    })}
  </main>
</body>
</html>`;
}

function shopDetailRows(
  entity: SupplierRecord | ContractRecord | SpendItemRecord,
  store: ShopStore
): readonly { readonly label: string; readonly value: string }[] {
  switch (entity.entityType) {
    case "supplier":
      return [
        { label: "Name", value: entity.name },
        { label: "Supplier type", value: formatToken(entity.supplierType) },
        { label: "Status", value: formatToken(entity.status) },
        { label: "Criticality", value: formatToken(entity.criticality) },
        { label: "Primary contact", value: entity.primaryContact ?? "Not recorded" },
        { label: "Notes", value: entity.notes ?? "Not recorded" }
      ];
    case "contract": {
      const supplier = store.suppliers.find((candidate) => candidate.id === entity.supplierId);
      return [
        { label: "Title", value: entity.title },
        { label: "Supplier", value: supplier?.name ?? entity.supplierId },
        { label: "Status", value: formatToken(entity.status) },
        { label: "Contract reference", value: entity.contractRef ?? "Not recorded" },
        { label: "Start date", value: entity.startsAt ?? "Not recorded" },
        { label: "End date", value: entity.endsAt ?? "Not recorded" },
        {
          label: "Contract value",
          value: entity.value ? formatMoneyAmount(entity.value) : "Not recorded"
        },
        { label: "Service summary", value: entity.serviceSummary ?? "Not recorded" }
      ];
    }
    case "spend-item":
      return [
        { label: "Title", value: entity.title },
        { label: "Spend type", value: formatToken(entity.spendType) },
        { label: "Status", value: formatToken(entity.status) },
        { label: "Amount", value: formatMoneyAmount(entity.amount) },
        { label: "Financial year", value: entity.financialYear },
        { label: "Cost centre", value: entity.costCentre ?? "Not recorded" },
        { label: "Confidence", value: formatToken(entity.confidence ?? "medium") },
        { label: "Forecast start", value: entity.forecastStartAt ?? "Not recorded" },
        { label: "Forecast end", value: entity.forecastEndAt ?? "Not recorded" },
        {
          label: "Forecast cost",
          value: entity.forecastCost ? formatMoneyAmount(entity.forecastCost) : "Not recorded"
        },
        {
          label: "Expected savings",
          value: entity.expectedSavings ? formatMoneyAmount(entity.expectedSavings) : "Not recorded"
        },
        { label: "Savings type", value: formatToken(entity.savingsType ?? "efficiency") },
        { label: "Payback months", value: entity.paybackPeriodMonths?.toString() ?? "Not recorded" },
        { label: "Assumptions", value: entity.assumptions ?? "Not recorded" },
        { label: "Notes", value: entity.notes ?? "Not recorded" }
      ];
  }
}

function shopMetadataRows(
  entity: SupplierRecord | ContractRecord | SpendItemRecord
): readonly { readonly label: string; readonly value: string }[] {
  return [
    { label: "ID", value: entity.id },
    { label: "Source product", value: formatToken(entity.sourceProduct) },
    { label: "Record status", value: formatToken(entity.recordStatus) },
    { label: "Schema version", value: entity.schemaVersion },
    { label: "Created", value: entity.createdAt },
    { label: "Updated", value: entity.updatedAt }
  ];
}

function renderShopDetailField(row: { readonly label: string; readonly value: string }): string {
  return `<div class="detail-field"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`;
}

function shopDetailEditCommand(entity: SupplierRecord | ContractRecord | SpendItemRecord): string {
  switch (entity.entityType) {
    case "supplier":
      return "pspf.shop.editSupplier";
    case "contract":
      return "pspf.shop.editContract";
    case "spend-item":
      return "pspf.shop.editSpendItem";
  }
}

function renderCompactForecastHtml(
  store: ShopStore,
  forecast: readonly ForecastYear[],
  monthlyForecast: readonly ForecastMonth[],
  dashboard: CommercialCoverageDashboard
): string {
  const publicationStatus = getPublicationStatus(store);
  const nextForecast = forecast[0];
  const nextMonth = monthlyForecast.find((month) => month.forecastSpend > 0);
  const unlinkedCount = dashboard.coverage.reduce((total, group) => total + group.unlinked.length, 0);
  const uncontractedSpendCount = dashboard.uncontractedSpendItems.length;
  const urgentActions = dashboard.fundedActions.filter(
    (item) => item.urgency === "blocked" || item.urgency === "overdue"
  ).length;
  const managementReviews = dashboard.supplierManagement.filter((item) => item.status !== "ok").length;
  const artefactGaps = dashboard.contractArtefacts.reduce(
    (total, contract) => total + contract.artefacts.filter((artefact) => artefact.status === "needed").length,
    0
  );
  const nextDividend = dashboard.efficiencyDividends[0];
  const proposedScenario = dashboard.scenarioSummaries.find((scenario) => scenario.label === "Include proposed work");
  return `<!doctype html>
<html lang="en-AU">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Shared PSPF webview tokens + base rules (see @pspf/webview-shell). */
        ${tokensCss("extension")}
        :root { --shop-amber: var(--pspf-warn); --shop-amber-soft: var(--pspf-warn-soft); --shop-panel: color-mix(in srgb, var(--pspf-surface) 88%, var(--pspf-primary)); }
        body { color: var(--pspf-text); background: var(--pspf-surface); font-family: var(--vscode-font-family); margin: 0; padding: var(--pspf-gap-md); }
        h1 { font-size: 1rem; margin: 0 0 6px; }
        p { color: var(--pspf-muted); margin: 0 0 10px; }
        .masthead { border-left: 4px solid var(--shop-amber); background: var(--shop-panel); padding: var(--pspf-gap); margin: 0 0 var(--pspf-gap); }
        .eyebrow { color: var(--pspf-primary); font-size: var(--pspf-type-label); font-weight: 700; letter-spacing: var(--pspf-letter-label); text-transform: uppercase; margin: 0 0 4px; }
        .summary { display: grid; gap: var(--pspf-pad-sm); }
        .summary .pspf-pill { justify-content: flex-start; padding: 6px var(--pspf-pad-sm); }
        .summary .pspf-pill strong { color: var(--shop-amber); }
    </style>
</head>
<body>
    <div class="masthead">
        <p class="eyebrow">Commercial planning</p>
        <h1>Shop Forecast</h1>
        <p>Compact forecast summary. Open the full forecast for coverage, renewal, action, and risk detail.</p>
    </div>
    <div class="summary">
        <span class="pspf-pill"><strong>${store.suppliers.length}</strong> suppliers</span>
        <span class="pspf-pill"><strong>${store.contracts.length}</strong> contracts</span>
        <span class="pspf-pill"><strong>${store.spendItems.length}</strong> spend items</span>
        <span class="pspf-pill"><strong>${unlinkedCount}</strong> unlinked assurance records</span>
        <span class="pspf-pill"><strong>${uncontractedSpendCount}</strong> spend items need contract funding links</span>
        <span class="pspf-pill"><strong>${dashboard.renewals.length}</strong> contracts in review window</span>
        <span class="pspf-pill"><strong>${urgentActions}</strong> funded blocked or overdue Actions</span>
        <span class="pspf-pill"><strong>${managementReviews}</strong> supplier management checks due</span>
        <span class="pspf-pill"><strong>${artefactGaps}</strong> contract artefact gaps</span>
        <span class="pspf-pill">${publicationStatus}</span>
        <span class="pspf-pill">${nextForecast ? `${escapeHtml(nextForecast.financialYear)} net forecast ${escapeHtml(formatCurrency(nextForecast.netForecast))}` : "No spend forecast yet"}</span>
        <span class="pspf-pill">${nextMonth ? `${escapeHtml(nextMonth.monthLabel)} forecast ${escapeHtml(formatCurrency(nextMonth.forecastSpend))}` : "No monthly forecast yet"}</span>
        <span class="pspf-pill">${nextDividend ? `${escapeHtml(nextDividend.financialYear)} planned efficiency dividend ${escapeHtml(formatCurrency(nextDividend.plannedSaving))}` : "No planned efficiency dividend yet"}</span>
        <span class="pspf-pill">${proposedScenario ? `Scenario net ${escapeHtml(formatCurrency(proposedScenario.netForecast))}` : "No scenario forecast yet"}</span>
    </div>
    <p><a href="${escapeHtml(commandUri("pspf.shop.openForecast", []))}">Open full forecast</a></p>
</body>
</html>`;
}

function renderForecastHtml(
  store: ShopStore,
  forecast: readonly ForecastYear[],
  monthlyForecast: readonly ForecastMonth[],
  dashboard: CommercialCoverageDashboard,
  mode: "panel" | "view" = "panel"
): string {
  const publicationStatus = getPublicationStatus(store);
  const monthlyRows =
    monthlyForecast.length === 0
      ? '<tr><td colspan="4">No forecast spend by month yet.</td></tr>'
      : monthlyForecast
          .map(
            (month) => `
            <tr>
                <td>${escapeHtml(month.monthLabel)}</td>
                <td>${escapeHtml(month.financialYear)}</td>
                <td>${month.itemCount}</td>
                <td>${escapeHtml(formatCurrency(month.forecastSpend))}</td>
                <td>${escapeHtml(formatCurrency(month.forecastSavings))}</td>
            </tr>`
          )
          .join("");
  const maxMonthlySpend = Math.max(...monthlyForecast.map((month) => month.forecastSpend), 0);
  const monthlyBars =
    monthlyForecast.length === 0
      ? '<p class="muted">Add forecast dates or financial years to spend items to see the monthly view.</p>'
      : `<div class="month-grid">${monthlyForecast.map((month) => renderMonthBar(month, maxMonthlySpend)).join("")}</div>`;
  const rows =
    forecast.length === 0
      ? '<tr><td colspan="6">No spend items yet.</td></tr>'
      : forecast
          .map(
            (year) => `
      <tr>
        <td>${escapeHtml(year.financialYear)}</td>
        <td>${year.itemCount}</td>
        <td>${escapeHtml(formatCurrency(year.plannedSpend))}</td>
        <td>${escapeHtml(formatCurrency(year.forecastCost))}</td>
        <td>${escapeHtml(formatCurrency(year.expectedSavings))}</td>
        <td>${escapeHtml(formatCurrency(year.netForecast))}</td>
      </tr>`
          )
          .join("");
  const scenarioRows =
    dashboard.scenarioSummaries.length === 0
      ? '<tr><td colspan="8">No scenario forecast yet.</td></tr>'
      : dashboard.scenarioSummaries
          .map(
            (scenario) => `
            <tr>
                <td>${escapeHtml(scenario.label)}</td>
                <td>${escapeHtml(scenario.description)}</td>
                <td>${scenario.itemCount}</td>
                <td>${escapeHtml(formatCurrency(scenario.plannedSpend))}</td>
                <td>${escapeHtml(formatCurrency(scenario.forecastCost))}</td>
                <td>${escapeHtml(formatCurrency(scenario.expectedSavings))}</td>
                <td>${escapeHtml(formatCurrency(scenario.netForecast))}</td>
                <td>${scenario.lowConfidenceCount} low confidence · ${scenario.unlinkedItemCount} need assurance links</td>
            </tr>`
          )
          .join("");
  const assuranceSpendRows =
    dashboard.assuranceSpend.length === 0
      ? '<tr><td colspan="9">Link spend items to Requirements or Actions to see assurance spend attribution.</td></tr>'
      : dashboard.assuranceSpend
          .map(
            (row) => `
            <tr>
                <td>${escapeHtml(row.scope)}</td>
                <td>${escapeHtml(row.title)}</td>
                <td>${escapeHtml(row.secondary)}</td>
                <td>${row.itemCount}</td>
                <td>${row.multiLinkedItemCount}</td>
                <td>${escapeHtml(formatCurrency(row.plannedSpend))}</td>
                <td>${escapeHtml(formatCurrency(row.forecastCost))}</td>
                <td>${escapeHtml(formatCurrency(row.expectedSavings))}</td>
                <td>${escapeHtml(row.confidence)}</td>
            </tr>`
          )
          .join("");
  const coverageRows = dashboard.coverage.map((group) => renderCoverageRow(group)).join("");
  const relationshipActions = renderAssuranceRelationshipActions(dashboard);
  const fundingCueRows =
    dashboard.uncontractedSpendItems.length === 0
      ? '<tr><td colspan="4">All spend items have a contract funding link.</td></tr>'
      : dashboard.uncontractedSpendItems
          .map(
            (item) => `
            <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.financialYear)}</td>
                <td>${escapeHtml(item.costCentre ?? "Not set")}</td>
                <td><a href="${escapeHtml(commandUri("pspf.shop.linkSpendItemToContract", [item]))}">Link to contract</a></td>
            </tr>`
          )
          .join("");
  const renewalRows =
    dashboard.renewals.length === 0
      ? '<tr><td colspan="4">No active contracts end inside the near-term review window.</td></tr>'
      : dashboard.renewals
          .map(
            (renewal) => `
            <tr>
                <td>${escapeHtml(renewal.contract.title)}</td>
                <td>${escapeHtml(renewal.supplierName)}</td>
                <td>${escapeHtml(renewal.contract.endsAt ?? "Not set")}</td>
                <td>${renewal.daysUntilEnd} days</td>
            </tr>`
          )
          .join("");
  const fundedActionRows =
    dashboard.fundedActions.length === 0
      ? '<tr><td colspan="4">No spend items are linked to open, blocked, or overdue Actions.</td></tr>'
      : dashboard.fundedActions
          .map(
            (item) => `
            <tr>
                <td>${escapeHtml(item.spendItem.title)}</td>
                <td>${escapeHtml(item.action.title)}</td>
                <td><span class="status status-${escapeHtml(item.urgency)}">${escapeHtml(formatToken(item.urgency))}</span></td>
                <td>${escapeHtml(formatToken(item.action.status))}${item.action.dueDate ? `, due ${escapeHtml(item.action.dueDate)}` : ""}</td>
            </tr>`
          )
          .join("");
  const supplierRiskRows =
    dashboard.supplierRisks.length === 0
      ? '<tr><td colspan="4">No suppliers are linked to open or high-scoring Risks.</td></tr>'
      : dashboard.supplierRisks
          .map(
            (item) => `
            <tr>
                <td>${escapeHtml(item.supplier.name)}</td>
                <td>${escapeHtml(item.risk.title)}</td>
                <td>${escapeHtml(formatToken(item.risk.status))}</td>
                <td>${item.score}</td>
            </tr>`
          )
          .join("");
  const supplierManagementRows =
    dashboard.supplierManagement.length === 0
      ? '<tr><td colspan="5">No suppliers yet.</td></tr>'
      : dashboard.supplierManagement
          .map(
            (item) => `
            <tr>
                <td>${escapeHtml(item.supplier.name)}</td>
                <td>${escapeHtml(formatToken(item.supplier.criticality))}</td>
                <td>${escapeHtml(item.performanceMeasure)}</td>
                <td>${escapeHtml(item.contractManagement)}</td>
                <td><span class="status status-${escapeHtml(item.status)}">${escapeHtml(item.fociCheck)}</span></td>
            </tr>`
          )
          .join("");
  const contractArtefactRows =
    dashboard.contractArtefacts.length === 0
      ? '<tr><td colspan="5">No contracts yet.</td></tr>'
      : dashboard.contractArtefacts
          .flatMap((item) =>
            item.artefacts.map(
              (artefact) => `
            <tr>
                <td>${escapeHtml(item.contract.title)}</td>
                <td>${escapeHtml(item.supplierName)}</td>
                <td>${escapeHtml(artefact.label)}</td>
                <td><span class="status status-${escapeHtml(artefact.status)}">${escapeHtml(artefact.status === "ready" ? "Present" : "Needs link")}</span></td>
                <td><a href="${escapeHtml(artefact.href)}">${escapeHtml(artefact.sourceLabel)}</a></td>
            </tr>`
            )
          )
          .join("");
  const spendItemReportRows =
    dashboard.spendItemReport.length === 0
      ? '<tr><td colspan="7">No spend items yet.</td></tr>'
      : dashboard.spendItemReport
          .map(
            (item) => `
            <tr>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.financialYear)}</td>
                <td>${escapeHtml(item.costCentre || "Not set")}</td>
                <td>${escapeHtml(item.status)}</td>
                <td>${escapeHtml(formatCurrency(item.amount))}</td>
                <td>${escapeHtml(formatCurrency(item.forecastCost))}</td>
                <td>${escapeHtml(formatCurrency(item.expectedSavings))}</td>
            </tr>`
          )
          .join("");
  const savingScheduleRows =
    dashboard.savingSchedule.length === 0
      ? '<tr><td colspan="8">No planned savings yet. Add expected savings to a spend item and link any replacement contract to it.</td></tr>'
      : dashboard.savingSchedule
          .map(
            (saving) => `
            <tr>
                <td>${escapeHtml(saving.spendItem.title)}</td>
                <td>${escapeHtml(saving.financialYear)}</td>
                <td>${escapeHtml(saving.spendItem.costCentre ?? "Not set")}</td>
                <td>${escapeHtml(saving.scheduledFrom)}</td>
                <td>${escapeHtml(saving.scheduledTo)}</td>
                <td>${escapeHtml(formatCurrency(saving.plannedSaving))}</td>
                <td>${escapeHtml(saving.savingsType)}</td>
                <td>${escapeHtml(saving.confidence)}</td>
                <td>${escapeHtml(saving.replacementContext)}</td>
            </tr>`
          )
          .join("");
  const efficiencyDividendRows =
    dashboard.efficiencyDividends.length === 0
      ? '<tr><td colspan="4">No planned efficiency dividends yet.</td></tr>'
      : dashboard.efficiencyDividends
          .map(
            (dividend) => `
            <tr>
                <td>${escapeHtml(dividend.financialYear)}</td>
                <td>${dividend.itemCount}</td>
                <td>${escapeHtml(formatCurrency(dividend.plannedSaving))}</td>
                <td>${escapeHtml(dividend.confidence)}</td>
            </tr>`
          )
          .join("");

  const maxWidth = mode === "panel" ? "1120px" : "none";
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
        /* Shared PSPF webview tokens + base rules (see @pspf/webview-shell). */
        ${tokensCss("extension")}
        :root { --shop-amber: var(--pspf-warn); --shop-amber-soft: var(--pspf-warn-soft); --shop-panel: color-mix(in srgb, var(--pspf-surface) 88%, var(--pspf-primary)); }
      body { color: var(--pspf-text); background: var(--pspf-surface); font-family: var(--vscode-font-family); margin: 0; padding: 20px; }
        main { max-width: ${maxWidth}; margin: 0 auto; }
        h1 { font-size: 1.25rem; margin: 0 0 8px; }
    p { color: var(--pspf-muted); margin: 0 0 16px; }
      .muted { color: var(--pspf-muted); }
      .masthead { border-left: 4px solid var(--shop-amber); background: var(--shop-panel); padding: var(--pspf-gap-md) var(--pspf-pad); margin: 0 0 var(--pspf-pad); }
      .eyebrow { color: var(--pspf-primary); font-size: var(--pspf-type-label); font-weight: 700; letter-spacing: var(--pspf-letter-label); text-transform: uppercase; margin: 0 0 4px; }
    h2 { font-size: 1rem; margin: 20px 0 8px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
    th, td { border-bottom: 1px solid var(--pspf-border); padding: var(--pspf-table-cell-pad-y) var(--pspf-table-cell-pad-x); text-align: left; }
    th { color: var(--pspf-muted); font-weight: 600; }
    .summary { display: flex; flex-wrap: wrap; gap: var(--pspf-pad-sm); margin: 0 0 var(--pspf-pad); }
    .summary .pspf-pill { padding: 6px var(--pspf-pad-sm); }
      .summary .pspf-pill strong { color: var(--shop-amber); }
      .panel { border: 1px solid var(--pspf-border); border-radius: var(--pspf-radius); padding: var(--pspf-gap); margin: 0 0 var(--pspf-gap-md); }
        .coverage { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
      .coverage-card { background: color-mix(in srgb, var(--pspf-surface) 92%, var(--shop-amber)); border-left: 3px solid var(--pspf-primary); padding: var(--pspf-gap); }
      .coverage-card strong { display: block; font-size: 1.4rem; color: var(--shop-amber); }
      .coverage-card a { display: inline-block; margin-top: 6px; }
        .month-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 8px; margin: 0 0 14px; }
        .month-card { border: 1px solid var(--pspf-border); border-radius: var(--pspf-radius); padding: var(--pspf-pad-sm); min-height: 92px; display: grid; align-content: end; gap: var(--pspf-gap-sm); }
        .month-bar { background: color-mix(in srgb, var(--pspf-primary) 72%, var(--pspf-surface)); border-radius: 4px 4px 2px 2px; min-height: 4px; height: var(--height); }
        .month-card strong { color: var(--shop-amber); }
        .status { border: 1px solid var(--pspf-border); border-radius: var(--pspf-radius-pill); padding: 2px 6px; white-space: nowrap; }
        .status-blocked { border-color: var(--vscode-errorForeground); }
        .status-overdue { border-color: var(--shop-amber); }
        .status-review, .status-needed { border-color: var(--vscode-errorForeground); }
        .status-watch { border-color: var(--shop-amber); }
        .status-ok, .status-ready { border-color: var(--pspf-primary); }
  </style>
</head>
<body>
    <main>
    <div class="masthead">
        <p class="eyebrow">Commercial planning</p>
        <h1>Shop Forecast</h1>
    <p>Derived from Core-backed Shop spend items. Shop is a commercial planning view, not the contract system of record; use it to see upcoming forecast spend, management checks, and artefact gaps.</p>
    </div>
  <div class="summary">
        <span class="pspf-pill"><strong>${store.suppliers.length}</strong> suppliers</span>
        <span class="pspf-pill"><strong>${store.contracts.length}</strong> contracts</span>
        <span class="pspf-pill"><strong>${store.spendItems.length}</strong> spend items</span>
        <span class="pspf-pill">${publicationStatus}</span>
          <span class="pspf-pill"><a href="${escapeHtml(commandUri("pspf.shop.exportForecastCsv", []))}">Export CSV</a></span>
          <span class="pspf-pill"><a href="${escapeHtml(commandUri("pspf.shop.exportForecastXls", []))}">Export XLS</a></span>
  </div>
    <section class="panel">
        <h2>Assurance coverage</h2>
        <div class="coverage">${coverageRows}</div>
    </section>
    ${relationshipActions}
    <section>
      <h2>Scenario comparison</h2>
      <p class="muted">Compare approved work, the approved and committed baseline, and proposed-inclusive planning without changing source records.</p>
      <table>
        <thead><tr><th>Scenario</th><th>Description</th><th>Items</th><th>Planned spend</th><th>Forecast cost</th><th>Expected savings</th><th>Net forecast</th><th>Signals</th></tr></thead>
        <tbody>${scenarioRows}</tbody>
      </table>
    </section>
    <section>
      <h2>Spend by Requirement, tag, and Action</h2>
      <p class="muted">Headline totals de-duplicate spend items. Grouped rows show when the same spend item contributes to multiple assurance outcomes.</p>
      <table>
        <thead><tr><th>Scope</th><th>Name</th><th>Context</th><th>Items</th><th>Multi-linked</th><th>Planned spend</th><th>Forecast cost</th><th>Expected savings</th><th>Confidence</th></tr></thead>
        <tbody>${assuranceSpendRows}</tbody>
      </table>
    </section>
    <section>
        <h2>Spend items needing contract funding links</h2>
        <p class="muted">Spend items should be funded by a Contract through the existing <code>contract funds spend-item</code> relationship.</p>
        <table>
            <thead><tr><th>Spend item</th><th>Financial year</th><th>Cost centre</th><th>Action</th></tr></thead>
            <tbody>${fundingCueRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Near-term contract review</h2>
        <table>
            <thead><tr><th>Contract</th><th>Supplier</th><th>End date</th><th>Review window</th></tr></thead>
            <tbody>${renewalRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Forecast spend by month</h2>
        <p class="muted">Forward-looking forecast only. Actuals are not shown in this panel.</p>
        ${monthlyBars}
        <table>
            <thead><tr><th>Month</th><th>Financial year</th><th>Items</th><th>Forecast spend</th><th>Planned saving</th></tr></thead>
            <tbody>${monthlyRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Spend item report</h2>
        <p class="muted">Export-friendly spend item detail, including financial year and cost centre.</p>
        <table>
            <thead><tr><th>Spend item</th><th>Financial year</th><th>Cost centre</th><th>Status</th><th>Planned spend</th><th>Forecast cost</th><th>Expected savings</th></tr></thead>
            <tbody>${spendItemReportRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Planned savings schedule</h2>
        <p class="muted">Schedule when and how much a saving might be. Link contracts to the saving spend item to show replacement or consolidation context.</p>
        <table>
            <thead><tr><th>Spend item</th><th>Financial year</th><th>Cost centre</th><th>From</th><th>To</th><th>Planned saving</th><th>Saving type</th><th>Confidence</th><th>Replacement context</th></tr></thead>
            <tbody>${savingScheduleRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Planned efficiency dividends</h2>
        <p class="muted">Consolidated annual view of scheduled expected savings for simple reporting.</p>
        <table>
            <thead><tr><th>Financial year</th><th>Saving items</th><th>Planned efficiency dividend</th><th>Lowest confidence</th></tr></thead>
            <tbody>${efficiencyDividendRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Forecast spend by financial year</h2>
        <table>
            <thead>
            <tr><th>Financial year</th><th>Items</th><th>Planned spend</th><th>Forecast cost</th><th>Expected savings</th><th>Net forecast</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </section>
    <section>
        <h2>Supplier performance and management checks</h2>
        <p class="muted">Minimum lightweight checks for every supplier, including contract management and FOCI prompts.</p>
        <table>
            <thead><tr><th>Supplier</th><th>Criticality</th><th>Performance measure</th><th>Contract management</th><th>FOCI check</th></tr></thead>
            <tbody>${supplierManagementRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Contract artefact links</h2>
        <p class="muted">Key CPR-aligned artefacts to locate in the contract system of record. These links point to Finance guidance and highlight what needs to be found.</p>
        <table>
            <thead><tr><th>Contract</th><th>Supplier</th><th>Artefact</th><th>Status</th><th>CPR source</th></tr></thead>
            <tbody>${contractArtefactRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Funded Actions</h2>
        <table>
            <thead><tr><th>Spend item</th><th>Action</th><th>Signal</th><th>Status</th></tr></thead>
            <tbody>${fundedActionRows}</tbody>
        </table>
    </section>
    <section>
        <h2>Supplier Risk links</h2>
        <table>
            <thead><tr><th>Supplier</th><th>Risk</th><th>Status</th><th>Score</th></tr></thead>
            <tbody>${supplierRiskRows}</tbody>
        </table>
    </section>
    </main>
</body>
</html>`;
}

function renderForecastReportCsv(
  forecast: readonly ForecastYear[],
  monthlyForecast: readonly ForecastMonth[],
  dashboard: CommercialCoverageDashboard
): string {
  return [
    csvSection("Forecast spend by month", [
      ["Month", "Financial year", "Items", "Forecast spend", "Planned saving"],
      ...monthlyForecast.map((month) => [
        month.monthLabel,
        month.financialYear,
        month.itemCount,
        month.forecastSpend,
        month.forecastSavings
      ])
    ]),
    csvSection("Forecast spend by financial year", [
      ["Financial year", "Items", "Planned spend", "Forecast cost", "Expected savings", "Net forecast"],
      ...forecast.map((year) => [
        year.financialYear,
        year.itemCount,
        year.plannedSpend,
        year.forecastCost,
        year.expectedSavings,
        year.netForecast
      ])
    ]),
    csvSection("Scenario comparison", [
      [
        "Scenario",
        "Description",
        "Items",
        "Planned spend",
        "Forecast cost",
        "Expected savings",
        "Net forecast",
        "Low confidence items",
        "Items needing assurance links"
      ],
      ...dashboard.scenarioSummaries.map((scenario) => [
        scenario.label,
        scenario.description,
        scenario.itemCount,
        scenario.plannedSpend,
        scenario.forecastCost,
        scenario.expectedSavings,
        scenario.netForecast,
        scenario.lowConfidenceCount,
        scenario.unlinkedItemCount
      ])
    ]),
    csvSection("Spend by Requirement tag and Action", [
      [
        "Scope",
        "Name",
        "Context",
        "Items",
        "Multi-linked items",
        "Planned spend",
        "Forecast cost",
        "Expected savings",
        "Net forecast",
        "Confidence"
      ],
      ...dashboard.assuranceSpend.map((row) => [
        row.scope,
        row.title,
        row.secondary,
        row.itemCount,
        row.multiLinkedItemCount,
        row.plannedSpend,
        row.forecastCost,
        row.expectedSavings,
        row.netForecast,
        row.confidence
      ])
    ]),
    csvSection("Spend item report", [
      ["Spend item", "Financial year", "Cost centre", "Status", "Planned spend", "Forecast cost", "Expected savings"],
      ...dashboard.spendItemReport.map((item) => [
        item.title,
        item.financialYear,
        item.costCentre,
        item.status,
        item.amount,
        item.forecastCost,
        item.expectedSavings
      ])
    ]),
    csvSection("Planned savings schedule", [
      [
        "Spend item",
        "Financial year",
        "Cost centre",
        "From",
        "To",
        "Planned saving",
        "Saving type",
        "Confidence",
        "Replacement context"
      ],
      ...dashboard.savingSchedule.map((saving) => [
        saving.spendItem.title,
        saving.financialYear,
        saving.spendItem.costCentre ?? "",
        saving.scheduledFrom,
        saving.scheduledTo,
        saving.plannedSaving,
        saving.savingsType,
        saving.confidence,
        saving.replacementContext
      ])
    ]),
    csvSection("Planned efficiency dividends", [
      ["Financial year", "Saving items", "Planned efficiency dividend", "Lowest confidence"],
      ...dashboard.efficiencyDividends.map((dividend) => [
        dividend.financialYear,
        dividend.itemCount,
        dividend.plannedSaving,
        dividend.confidence
      ])
    ])
  ].join("\n");
}

function renderForecastReportXls(
  forecast: readonly ForecastYear[],
  monthlyForecast: readonly ForecastMonth[],
  dashboard: CommercialCoverageDashboard
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Shop forecast report</title></head><body>
${htmlTable("Forecast spend by month", [["Month", "Financial year", "Items", "Forecast spend", "Planned saving"], ...monthlyForecast.map((month) => [month.monthLabel, month.financialYear, month.itemCount, month.forecastSpend, month.forecastSavings])])}
${htmlTable("Forecast spend by financial year", [["Financial year", "Items", "Planned spend", "Forecast cost", "Expected savings", "Net forecast"], ...forecast.map((year) => [year.financialYear, year.itemCount, year.plannedSpend, year.forecastCost, year.expectedSavings, year.netForecast])])}
${htmlTable("Scenario comparison", [["Scenario", "Description", "Items", "Planned spend", "Forecast cost", "Expected savings", "Net forecast", "Low confidence items", "Items needing assurance links"], ...dashboard.scenarioSummaries.map((scenario) => [scenario.label, scenario.description, scenario.itemCount, scenario.plannedSpend, scenario.forecastCost, scenario.expectedSavings, scenario.netForecast, scenario.lowConfidenceCount, scenario.unlinkedItemCount])])}
${htmlTable("Spend by Requirement tag and Action", [["Scope", "Name", "Context", "Items", "Multi-linked items", "Planned spend", "Forecast cost", "Expected savings", "Net forecast", "Confidence"], ...dashboard.assuranceSpend.map((row) => [row.scope, row.title, row.secondary, row.itemCount, row.multiLinkedItemCount, row.plannedSpend, row.forecastCost, row.expectedSavings, row.netForecast, row.confidence])])}
${htmlTable("Spend item report", [["Spend item", "Financial year", "Cost centre", "Status", "Planned spend", "Forecast cost", "Expected savings"], ...dashboard.spendItemReport.map((item) => [item.title, item.financialYear, item.costCentre, item.status, item.amount, item.forecastCost, item.expectedSavings])])}
${htmlTable("Planned savings schedule", [["Spend item", "Financial year", "Cost centre", "From", "To", "Planned saving", "Saving type", "Confidence", "Replacement context"], ...dashboard.savingSchedule.map((saving) => [saving.spendItem.title, saving.financialYear, saving.spendItem.costCentre ?? "", saving.scheduledFrom, saving.scheduledTo, saving.plannedSaving, saving.savingsType, saving.confidence, saving.replacementContext])])}
${htmlTable("Planned efficiency dividends", [["Financial year", "Saving items", "Planned efficiency dividend", "Lowest confidence"], ...dashboard.efficiencyDividends.map((dividend) => [dividend.financialYear, dividend.itemCount, dividend.plannedSaving, dividend.confidence])])}
</body></html>`;
}

function csvSection(title: string, rows: readonly (readonly unknown[])[]): string {
  return [[title], ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function htmlTable(title: string, rows: readonly (readonly unknown[])[]): string {
  const [headings, ...bodyRows] = rows;
  if (!headings) {
    return `<h1>${escapeHtml(title)}</h1><table border="1"></table>`;
  }
  return `<h1>${escapeHtml(title)}</h1><table border="1"><thead><tr>${headings.map((heading) => `<th>${escapeHtml(String(heading))}</th>`).join("")}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function renderMonthBar(month: ForecastMonth, maxMonthlySpend: number): string {
  const height = maxMonthlySpend > 0 ? Math.max(8, Math.round((month.forecastSpend / maxMonthlySpend) * 58)) : 8;
  return `<div class="month-card">
                <div class="month-bar" style="--height: ${height}px;"></div>
                <span>${escapeHtml(month.monthLabel)}</span>
                <strong>${escapeHtml(formatCurrency(month.forecastSpend))}</strong>
        </div>`;
}

function renderCoverageRow(group: CoverageGroup): string {
  const unlinkedCount = group.unlinked.length;
  return `<div class="coverage-card">
        <strong>${group.linked}/${group.total}</strong>
        <span>${escapeHtml(group.label)} linked</span><br>
        <span>${unlinkedCount} unlinked</span><br>
        <span>${unlinkedCount === 0 ? "All active records have coverage links." : "Use Relationship actions below."}</span>
    </div>`;
}

function renderAssuranceRelationshipActions(dashboard: CommercialCoverageDashboard): string {
  const actions: RelationshipManagerAction[] = dashboard.coverage.map((group) => {
    const sample = group.unlinked[0];
    return {
      label: sample ? `Link ${commercialTitle(sample)}` : "All linked",
      fromLabel: group.label,
      phrase: "needs assurance link",
      toLabel: group.label === "Supplier Risk" ? "Risk" : "Requirement or Action",
      href: sample ? commandUri(group.linkCommand, [sample]) : undefined,
      disabledReason: "All active records linked"
    };
  });
  return relationshipManagerHtml({
    title: "Relationship actions",
    description: "Quick actions use the shared relationship manager pattern and the canonical Shop relationship rules.",
    actions,
    emptyText: "No assurance relationship actions are available."
  });
}

function getPublicationStatus(store: ShopStore): string {
  const entities = [...store.suppliers, ...store.contracts, ...store.spendItems];
  const blocked = entities.filter((entity) => {
    try {
      sanitiseEntityForPublication(entity);
      return false;
    } catch {
      return true;
    }
  }).length;
  return blocked === 0 ? "Publishable with redaction" : `${blocked} records need redaction review`;
}

function getWorkspaceUri(fileName: string): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? vscode.Uri.joinPath(folder.uri, fileName) : undefined;
}

function moneyAmount(amount: number, currency = "AUD"): MoneyAmount {
  return { amount, currency };
}

function moneyInputValue(value: MoneyAmount | undefined): string {
  const amount = moneyAmountNumber(value);
  return amount === undefined ? "" : amount.toString();
}

function moneyAmountValue(value: MoneyAmount | undefined): number {
  return moneyAmountNumber(value) ?? 0;
}

function moneyAmountNumber(value: MoneyAmount | undefined): number | undefined {
  return typeof value?.amount === "number" && Number.isFinite(value.amount) ? value.amount : undefined;
}

function formatMoneyAmount(value: MoneyAmount | undefined): string {
  return formatCurrency(
    moneyAmountValue(value),
    typeof value?.currency === "string" && value.currency ? value.currency : "AUD"
  );
}

function iconFor(iconName: "contract" | "home" | "info" | "sample" | "spend" | "supplier"): string {
  switch (iconName) {
    case "contract":
      return "file-text";
    case "home":
      return "home";
    case "info":
      return "info";
    case "sample":
      return "database";
    case "spend":
      return "graph-line";
    case "supplier":
      return "briefcase";
  }
}
