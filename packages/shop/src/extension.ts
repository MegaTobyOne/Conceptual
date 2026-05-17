import * as vscode from "vscode";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
    PSPF_SLICE_VERSION,
    VERSION_AXES,
    type ContractEntity,
    type MoneyAmount,
    type SpendItemEntity,
    type SupplierEntity,
    type V01Entity,
    sanitiseEntityForPublication
} from "@pspf/contracts";

const SHOP_STORE_VERSION = "1.0.0";
const SHOP_STORE_PATH = [".pspf", "shop", "shop.json"] as const;

const SUPPLIER_TYPES = ["software", "service", "advisory", "managed-service", "other"] as const;
const SUPPLIER_STATUSES = ["active", "inactive", "proposed"] as const;
const CRITICALITIES = ["low", "medium", "high", "critical"] as const;
const CONTRACT_STATUSES = ["draft", "active", "expired", "terminated"] as const;
const SPEND_TYPES = ["capex", "opex", "uplift", "licence", "service"] as const;
const SPEND_STATUSES = ["proposed", "approved", "committed", "spent", "cancelled"] as const;
const SAVINGS_TYPES = ["avoided-cost", "efficiency", "consolidation", "risk-reduction", "contract-optimisation", "other"] as const;
const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

interface ShopStore {
    readonly shopStoreVersion: string;
    readonly updatedAt: string;
    readonly suppliers: readonly SupplierRecord[];
    readonly contracts: readonly ContractRecord[];
    readonly spendItems: readonly SpendItemRecord[];
}

type SupplierRecord = SupplierEntity;
type ContractRecord = ContractEntity;
type SpendItemRecord = SpendItemEntity;

interface ForecastYear {
    readonly financialYear: string;
    readonly plannedSpend: number;
    readonly forecastCost: number;
    readonly expectedSavings: number;
    readonly netForecast: number;
    readonly itemCount: number;
}

let shopStore: ShopStore | undefined;
let suppliersProvider: SupplierTreeProvider | undefined;
let contractsProvider: ContractTreeProvider | undefined;
let spendProvider: SpendTreeProvider | undefined;
let forecastProvider: ForecastViewProvider | undefined;
let welcomeProvider: WelcomeTreeProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
    suppliersProvider = new SupplierTreeProvider();
    contractsProvider = new ContractTreeProvider();
    spendProvider = new SpendTreeProvider();
    forecastProvider = new ForecastViewProvider();
    welcomeProvider = new WelcomeTreeProvider();

    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
    statusItem.text = `$(briefcase) PSPF Shop v${PSPF_SLICE_VERSION}`;
    statusItem.tooltip = "PSPF Shop commercial planning foundation";
    statusItem.command = "pspf.shop.openHome";
    statusItem.show();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("pspfShop.suppliersView", suppliersProvider),
        vscode.window.registerTreeDataProvider("pspfShop.contractsView", contractsProvider),
        vscode.window.registerTreeDataProvider("pspfShop.spendView", spendProvider),
        vscode.window.registerTreeDataProvider("pspfShop.welcomeView", welcomeProvider),
        vscode.window.registerWebviewViewProvider("pspfShop.forecastView", forecastProvider),
        statusItem,
        vscode.commands.registerCommand("pspf.shop.openHome", openHome),
        vscode.commands.registerCommand("pspf.shop.loadSample", loadSample),
        vscode.commands.registerCommand("pspf.shop.importLocalStore", importLocalStore),
        vscode.commands.registerCommand("pspf.shop.newSupplier", newSupplier),
        vscode.commands.registerCommand("pspf.shop.newContract", newContract),
        vscode.commands.registerCommand("pspf.shop.newSpendItem", newSpendItem),
        vscode.commands.registerCommand("pspf.shop.editSupplier", editSupplier),
        vscode.commands.registerCommand("pspf.shop.editContract", editContract),
        vscode.commands.registerCommand("pspf.shop.editSpendItem", editSpendItem),
        vscode.commands.registerCommand("pspf.shop.deleteRecord", deleteRecord),
        vscode.commands.registerCommand("pspf.shop.openForecast", openForecast)
    );

    void refreshViews();
}

export function deactivate(): void {
    shopStore = undefined;
}

async function openHome(): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.extension.pspfShop");
    await refreshViews();
}

async function openForecast(): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.extension.pspfShop");
    await vscode.commands.executeCommand("pspfShop.forecastView.focus");
    await refreshViews();
}

async function loadSample(): Promise<void> {
    const store = await loadStore();
    if (store.suppliers.length > 0 || store.contracts.length > 0 || store.spendItems.length > 0) {
        const answer = await vscode.window.showWarningMessage("Replace current Shop records with sample commercial planning data?", "Replace sample", "Cancel");
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
    const name = await promptText("Supplier name");
    if (!name) {
        return;
    }
    const supplierType = await promptPick("Supplier type", SUPPLIER_TYPES);
    if (!supplierType) {
        return;
    }
    const status = await promptPick("Supplier status", SUPPLIER_STATUSES, "active");
    if (!status) {
        return;
    }
    const criticality = await promptPick("Criticality", CRITICALITIES, "medium");
    if (!criticality) {
        return;
    }
    const primaryContact = await promptOptionalText("Primary contact or role");
    const notes = await promptOptionalText("Notes");

    const supplier: SupplierRecord = {
        ...newCommercialEnvelope("supplier"),
        id: createShopId("SUP"),
        entityType: "supplier",
        name,
        supplierType,
        status,
        criticality,
        ...(primaryContact ? { primaryContact } : {}),
        ...(notes ? { notes } : {})
    };

    const store = await loadStore();
    await upsertShopEntities([supplier]);
    shopStore = { ...store, suppliers: [...store.suppliers, supplier] };
    await refreshViews();
    vscode.window.showInformationMessage(`Added supplier ${supplier.name}.`);
}

async function editSupplier(supplier: SupplierRecord): Promise<void> {
    const name = await promptText("Supplier name", supplier.name);
    if (!name) {
        return;
    }
    const supplierType = await promptPick("Supplier type", SUPPLIER_TYPES, supplier.supplierType);
    if (!supplierType) {
        return;
    }
    const status = await promptPick("Supplier status", SUPPLIER_STATUSES, supplier.status);
    if (!status) {
        return;
    }
    const criticality = await promptPick("Criticality", CRITICALITIES, supplier.criticality);
    if (!criticality) {
        return;
    }
    const primaryContact = await promptOptionalText("Primary contact or role", supplier.primaryContact);
    const notes = await promptOptionalText("Notes", supplier.notes);
    const updated: SupplierRecord = {
        ...supplier,
        name,
        supplierType,
        status,
        criticality,
        updatedAt: new Date().toISOString(),
        ...(primaryContact ? { primaryContact } : { primaryContact: undefined }),
        ...(notes ? { notes } : { notes: undefined })
    };
    await upsertShopEntities([updated]);
    shopStore = undefined;
    await refreshViews();
    vscode.window.showInformationMessage(`Updated supplier ${updated.name}.`);
}

async function newContract(): Promise<void> {
    const store = await loadStore();
    if (store.suppliers.length === 0) {
        vscode.window.showWarningMessage("Add a supplier before creating a contract.");
        return;
    }

    const supplier = await promptSupplier(store.suppliers);
    if (!supplier) {
        return;
    }
    const title = await promptText("Contract title");
    if (!title) {
        return;
    }
    const status = await promptPick("Contract status", CONTRACT_STATUSES, "active");
    if (!status) {
        return;
    }
    const contractRef = await promptOptionalText("Contract reference");
    const startsAt = await promptOptionalDate("Start date (YYYY-MM-DD)");
    const endsAt = await promptOptionalDate("End date (YYYY-MM-DD)");
    const valueAmount = await promptOptionalNumber("Contract value (AUD)");
    const serviceSummary = await promptOptionalText("Service summary");

    const contract: ContractRecord = {
        ...newCommercialEnvelope("contract"),
        id: createShopId("CTR"),
        entityType: "contract",
        supplierId: supplier.id,
        title,
        status,
        ...(contractRef ? { contractRef } : {}),
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(valueAmount === undefined ? {} : { value: { amount: valueAmount, currency: "AUD" } }),
        ...(serviceSummary ? { serviceSummary } : {})
    };

    await upsertShopEntities([contract]);
    shopStore = { ...store, contracts: [...store.contracts, contract] };
    await refreshViews();
    vscode.window.showInformationMessage(`Added contract ${contract.title}.`);
}

async function editContract(contract: ContractRecord): Promise<void> {
    const store = await loadStore();
    const supplier = await promptSupplier(store.suppliers, contract.supplierId);
    if (!supplier) {
        return;
    }
    const title = await promptText("Contract title", contract.title);
    if (!title) {
        return;
    }
    const status = await promptPick("Contract status", CONTRACT_STATUSES, contract.status);
    if (!status) {
        return;
    }
    const contractRef = await promptOptionalText("Contract reference", contract.contractRef);
    const startsAt = await promptOptionalDate("Start date (YYYY-MM-DD)", contract.startsAt);
    const endsAt = await promptOptionalDate("End date (YYYY-MM-DD)", contract.endsAt);
    const valueAmount = await promptOptionalNumber("Contract value (AUD)", contract.value?.amount);
    const serviceSummary = await promptOptionalText("Service summary", contract.serviceSummary);
    const updated: ContractRecord = {
        ...contract,
        supplierId: supplier.id,
        title,
        status,
        updatedAt: new Date().toISOString(),
        ...(contractRef ? { contractRef } : { contractRef: undefined }),
        ...(startsAt ? { startsAt } : { startsAt: undefined }),
        ...(endsAt ? { endsAt } : { endsAt: undefined }),
        ...(valueAmount === undefined ? { value: undefined } : { value: { amount: valueAmount, currency: "AUD" } }),
        ...(serviceSummary ? { serviceSummary } : { serviceSummary: undefined })
    };
    await upsertShopEntities([updated]);
    shopStore = undefined;
    await refreshViews();
    vscode.window.showInformationMessage(`Updated contract ${updated.title}.`);
}

async function newSpendItem(): Promise<void> {
    const title = await promptText("Spend item title");
    if (!title) {
        return;
    }
    const spendType = await promptPick("Spend type", SPEND_TYPES, "uplift");
    if (!spendType) {
        return;
    }
    const status = await promptPick("Spend status", SPEND_STATUSES, "proposed");
    if (!status) {
        return;
    }
    const amount = await promptRequiredNumber("Amount (AUD)");
    if (amount === undefined) {
        return;
    }
    const financialYear = await promptFinancialYear();
    if (!financialYear) {
        return;
    }
    const forecastStartAt = await promptOptionalDate("Forecast start date (YYYY-MM-DD)");
    const forecastEndAt = await promptOptionalDate("Forecast end date (YYYY-MM-DD)");
    const forecastCost = await promptOptionalNumber("Forecast cost (AUD)");
    const expectedSavings = await promptOptionalNumber("Expected savings (AUD)");
    const savingsType = expectedSavings === undefined ? undefined : await promptPick("Savings type", SAVINGS_TYPES, "efficiency");
    const paybackPeriodMonths = await promptOptionalNumber("Payback period months");
    const confidence = await promptPick("Confidence", CONFIDENCE_LEVELS, "medium");
    const assumptions = await promptOptionalText("Assumptions");
    const notes = await promptOptionalText("Notes");

    const spendItem: SpendItemRecord = {
        ...newCommercialEnvelope("spend-item"),
        id: createShopId("SPD"),
        entityType: "spend-item",
        title,
        spendType,
        status,
        amount: moneyAmount(amount),
        financialYear,
        ...(forecastStartAt ? { forecastStartAt } : {}),
        ...(forecastEndAt ? { forecastEndAt } : {}),
        ...(forecastCost === undefined ? {} : { forecastCost: moneyAmount(forecastCost) }),
        ...(expectedSavings === undefined ? {} : { expectedSavings: moneyAmount(expectedSavings) }),
        ...(savingsType ? { savingsType } : {}),
        ...(paybackPeriodMonths === undefined ? {} : { paybackPeriodMonths }),
        ...(confidence ? { confidence } : {}),
        ...(assumptions ? { assumptions } : {}),
        ...(notes ? { notes } : {})
    };

    const store = await loadStore();
    await upsertShopEntities([spendItem]);
    shopStore = { ...store, spendItems: [...store.spendItems, spendItem] };
    await refreshViews();
    vscode.window.showInformationMessage(`Added spend item ${spendItem.title}.`);
}

async function editSpendItem(spendItem: SpendItemRecord): Promise<void> {
    const title = await promptText("Spend item title", spendItem.title);
    if (!title) {
        return;
    }
    const spendType = await promptPick("Spend type", SPEND_TYPES, spendItem.spendType);
    if (!spendType) {
        return;
    }
    const status = await promptPick("Spend status", SPEND_STATUSES, spendItem.status);
    if (!status) {
        return;
    }
    const amount = await promptRequiredNumber("Amount (AUD)", spendItem.amount.amount);
    if (amount === undefined) {
        return;
    }
    const financialYear = await promptFinancialYear(spendItem.financialYear);
    if (!financialYear) {
        return;
    }
    const forecastStartAt = await promptOptionalDate("Forecast start date (YYYY-MM-DD)", spendItem.forecastStartAt);
    const forecastEndAt = await promptOptionalDate("Forecast end date (YYYY-MM-DD)", spendItem.forecastEndAt);
    const forecastCost = await promptOptionalNumber("Forecast cost (AUD)", spendItem.forecastCost?.amount);
    const expectedSavings = await promptOptionalNumber("Expected savings (AUD)", spendItem.expectedSavings?.amount);
    const savingsType = expectedSavings === undefined ? undefined : await promptPick("Savings type", SAVINGS_TYPES, spendItem.savingsType ?? "efficiency");
    const paybackPeriodMonths = await promptOptionalNumber("Payback period months", spendItem.paybackPeriodMonths);
    const confidence = await promptPick("Confidence", CONFIDENCE_LEVELS, spendItem.confidence ?? "medium");
    const assumptions = await promptOptionalText("Assumptions", spendItem.assumptions);
    const notes = await promptOptionalText("Notes", spendItem.notes);
    const updated: SpendItemRecord = {
        ...spendItem,
        title,
        spendType,
        status,
        amount: moneyAmount(amount),
        financialYear,
        updatedAt: new Date().toISOString(),
        ...(forecastStartAt ? { forecastStartAt } : { forecastStartAt: undefined }),
        ...(forecastEndAt ? { forecastEndAt } : { forecastEndAt: undefined }),
        ...(forecastCost === undefined ? { forecastCost: undefined } : { forecastCost: moneyAmount(forecastCost) }),
        ...(expectedSavings === undefined ? { expectedSavings: undefined } : { expectedSavings: moneyAmount(expectedSavings) }),
        ...(savingsType ? { savingsType } : { savingsType: undefined }),
        ...(paybackPeriodMonths === undefined ? { paybackPeriodMonths: undefined } : { paybackPeriodMonths }),
        ...(confidence ? { confidence } : { confidence: undefined }),
        ...(assumptions ? { assumptions } : { assumptions: undefined }),
        ...(notes ? { notes } : { notes: undefined })
    };
    await upsertShopEntities([updated]);
    shopStore = undefined;
    await refreshViews();
    vscode.window.showInformationMessage(`Updated spend item ${updated.title}.`);
}

async function deleteRecord(entity: SupplierRecord | ContractRecord | SpendItemRecord): Promise<void> {
    const label = entity.entityType === "supplier" ? entity.name : entity.title;
    const answer = await vscode.window.showWarningMessage(`Delete ${label} from Core-backed Shop records?`, "Delete", "Cancel");
    if (answer !== "Delete") {
        return;
    }
    await upsertShopEntities([{ ...entity, recordStatus: "deleted", updatedAt: new Date().toISOString() }]);
    shopStore = undefined;
    await refreshViews();
    vscode.window.showInformationMessage(`Deleted ${label}.`);
}

async function refreshViews(): Promise<void> {
    await loadStore();
    suppliersProvider?.refresh();
    contractsProvider?.refresh();
    spendProvider?.refresh();
    forecastProvider?.refresh();
    welcomeProvider?.refresh();
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
        vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "supplier"),
        vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "contract"),
        vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "spend-item")
    ]);

    return {
        shopStoreVersion: SHOP_STORE_VERSION,
        updatedAt: new Date().toISOString(),
        suppliers: suppliers.filter(isActiveEntity).filter(isSupplierEntity),
        contracts: contracts.filter(isActiveEntity).filter(isContractEntity),
        spendItems: spendItems.filter(isActiveEntity).filter(isSpendItemEntity)
    };
}

async function importLocalStore(): Promise<void> {
    const localStore = await loadLocalStore();
    const localEntities = [...localStore.suppliers, ...localStore.contracts, ...localStore.spendItems];
    if (localEntities.length === 0) {
        vscode.window.showInformationMessage("No local Shop JSON records found to import.");
        return;
    }

    const coreStore = await loadCoreStore();
    const coreIds = new Set([...coreStore.suppliers, ...coreStore.contracts, ...coreStore.spendItems].map((entity) => entity.id));
    const duplicateCount = localEntities.filter((entity) => coreIds.has(entity.id)).length;
    const message = duplicateCount > 0
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

async function upsertShopEntities(entities: readonly (SupplierRecord | ContractRecord | SpendItemRecord)[]): Promise<void> {
    if (entities.length === 0) {
        return;
    }
    await vscode.commands.executeCommand("pspf.core.upsertEntities", entities);
}

async function replaceCoreStore(nextStore: ShopStore): Promise<void> {
    const current = await loadCoreStore();
    const timestamp = new Date().toISOString();
    const nextEntities: Array<SupplierRecord | ContractRecord | SpendItemRecord> = [...nextStore.suppliers, ...nextStore.contracts, ...nextStore.spendItems];
    const deletedEntities = [...current.suppliers, ...current.contracts, ...current.spendItems]
        .filter((currentEntity) => !nextEntities.some((nextEntity) => nextEntity.id === currentEntity.id))
        .map((entity) => ({ ...entity, recordStatus: "deleted", updatedAt: timestamp }) satisfies SupplierRecord | ContractRecord | SpendItemRecord);
    const activeSuppliers = nextStore.suppliers.map((entity) => ({ ...entity, recordStatus: "active", updatedAt: timestamp }) satisfies SupplierRecord);
    const activeContracts = nextStore.contracts.map((entity) => ({ ...entity, recordStatus: "active", updatedAt: timestamp }) satisfies ContractRecord);
    const activeSpendItems = nextStore.spendItems.map((entity) => ({ ...entity, recordStatus: "active", updatedAt: timestamp }) satisfies SpendItemRecord);
    const activeEntities: Array<SupplierRecord | ContractRecord | SpendItemRecord> = [...activeSuppliers, ...activeContracts, ...activeSpendItems];
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
        spendItems: Array.isArray(source.spendItems) ? source.spendItems.map(normaliseSpendItemRecord).filter(isDefined) : []
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
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.supplierId !== "string" || typeof value.title !== "string") {
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
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.financialYear !== "string") {
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

function newCommercialEnvelope(entityType: "supplier" | "contract" | "spend-item"): Pick<SupplierRecord | ContractRecord | SpendItemRecord, "entityType" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus"> {
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

function normaliseCommercialEnvelope(value: Record<string, unknown>, entityType: "supplier" | "contract" | "spend-item"): Pick<SupplierRecord | ContractRecord | SpendItemRecord, "entityType" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus"> {
    const timestamp = new Date().toISOString();
    return {
        entityType,
        schemaVersion: typeof value.schemaVersion === "string" ? value.schemaVersion : VERSION_AXES.schemaVersion,
        createdAt: typeof value.createdAt === "string" ? value.createdAt : timestamp,
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : timestamp,
        sourceProduct: "shop",
        recordStatus: value.recordStatus === "archived" || value.recordStatus === "inactive" || value.recordStatus === "deleted" ? value.recordStatus : "active"
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
                primaryContact: "Commercial manager",
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
                forecastCost: moneyAmount(80000),
                expectedSavings: moneyAmount(25000),
                savingsType: "efficiency",
                paybackPeriodMonths: 18,
                confidence: "low"
            }
        ]
    };
}

function sampleCommercialEnvelope(entityType: "supplier" | "contract" | "spend-item", timestamp: string): Pick<SupplierRecord | ContractRecord | SpendItemRecord, "entityType" | "schemaVersion" | "createdAt" | "updatedAt" | "sourceProduct" | "recordStatus"> {
    return {
        entityType,
        schemaVersion: VERSION_AXES.schemaVersion,
        createdAt: timestamp,
        updatedAt: timestamp,
        sourceProduct: "shop",
        recordStatus: "active"
    };
}

async function promptText(prompt: string, value?: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({ prompt, value, ignoreFocusOut: true, validateInput: validateRequiredText });
    return cleanText(input);
}

async function promptOptionalText(prompt: string, value?: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({ prompt, value, ignoreFocusOut: true });
    return cleanText(input);
}

async function promptPick<const Value extends string>(placeHolder: string, values: readonly Value[], preferred?: Value): Promise<Value | undefined> {
    const picks = values.map((value) => ({ label: formatToken(value), value }));
    const selected = await vscode.window.showQuickPick(picks, {
        placeHolder,
        ignoreFocusOut: true,
        canPickMany: false,
        ...(preferred ? { activeItem: picks.find((pick) => pick.value === preferred) } : {})
    });
    return selected?.value;
}

async function promptSupplier(suppliers: readonly SupplierRecord[], selectedSupplierId?: string): Promise<SupplierRecord | undefined> {
    const picks = suppliers.map((supplier) => ({ label: supplier.name, description: formatToken(supplier.criticality), supplier }));
    const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: "Supplier",
        ignoreFocusOut: true,
        canPickMany: false,
        ...(selectedSupplierId ? { activeItem: picks.find((pick) => pick.supplier.id === selectedSupplierId) } : {})
    });
    return selected?.supplier;
}

async function promptOptionalDate(prompt: string, value?: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({ prompt, value, ignoreFocusOut: true, validateInput: validateOptionalDate });
    return cleanText(input);
}

async function promptFinancialYear(value?: string): Promise<string | undefined> {
    const currentYear = new Date().getFullYear();
    const defaultValue = value ?? `${currentYear}-${String((currentYear + 1) % 100).padStart(2, "0")}`;
    const input = await vscode.window.showInputBox({
        prompt: "Financial year (YYYY-YY)",
        value: defaultValue,
        ignoreFocusOut: true,
        validateInput: validateFinancialYear
    });
    return cleanText(input);
}

async function promptRequiredNumber(prompt: string, value?: number): Promise<number | undefined> {
    const input = await vscode.window.showInputBox({ prompt, value: value?.toString(), ignoreFocusOut: true, validateInput: validateRequiredNumber });
    return parseOptionalNumber(input);
}

async function promptOptionalNumber(prompt: string, value?: number): Promise<number | undefined> {
    const input = await vscode.window.showInputBox({ prompt, value: value?.toString(), ignoreFocusOut: true, validateInput: validateOptionalNumber });
    return parseOptionalNumber(input);
}

function validateRequiredText(value: string): string | undefined {
    return value.trim().length > 0 ? undefined : "Enter a value.";
}

function validateRequiredNumber(value: string): string | undefined {
    if (!value.trim()) {
        return "Enter an amount.";
    }
    return validateOptionalNumber(value);
}

function validateOptionalNumber(value: string): string | undefined {
    if (!value.trim()) {
        return undefined;
    }
    const numberValue = Number(value.replace(/,/g, ""));
    return Number.isFinite(numberValue) && numberValue >= 0 ? undefined : "Enter a positive number.";
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

function parseOptionalNumber(value: string | undefined): number | undefined {
    const cleanValue = cleanText(value);
    if (!cleanValue) {
        return undefined;
    }
    return Number(cleanValue.replace(/,/g, ""));
}

function cleanText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
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
        return store.suppliers.map((supplier) => new EntityTreeItem(
            supplier.name,
            `${formatToken(supplier.supplierType)} - ${formatToken(supplier.status)} - ${formatToken(supplier.criticality)}`,
            "supplier",
            "pspf.shop.editSupplier",
            supplier
        ));
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
            const value = contract.value ? ` - ${formatCurrency(contract.value.amount, contract.value.currency)}` : "";
            return new EntityTreeItem(contract.title, `${supplier?.name ?? "Unknown supplier"} - ${formatToken(contract.status)}${value}`, "contract", "pspf.shop.editContract", contract);
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
        return store.spendItems.map((item) => new EntityTreeItem(
            item.title,
            `${item.financialYear} - ${formatToken(item.status)} - ${formatCurrency(item.amount.amount, item.amount.currency)}`,
            "spend",
            "pspf.shop.editSpendItem",
            item
        ));
    }
}

class WelcomeTreeProvider implements vscode.TreeDataProvider<ShopTreeItem> {
    private readonly changedEmitter = new vscode.EventEmitter<ShopTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this.changedEmitter.event;

    refresh(): void {
        this.changedEmitter.fire();
    }

    getTreeItem(element: ShopTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): ShopTreeItem[] {
        return [
            new CommandTreeItem("Open Shop", "Focus the Shop activity views", "pspf.shop.openHome", "home"),
            new CommandTreeItem("Load sample", "Replace Core-backed Shop data with sample records", "pspf.shop.loadSample", "sample"),
            new CommandTreeItem("Import local JSON", "Import .pspf/shop/shop.json records into Core", "pspf.shop.importLocalStore", "sample"),
            new CommandTreeItem("New supplier", "Capture a supplier", "pspf.shop.newSupplier", "supplier"),
            new CommandTreeItem("New contract", "Capture a supplier contract", "pspf.shop.newContract", "contract"),
            new CommandTreeItem("New spend item", "Capture planned or forecast spend", "pspf.shop.newSpendItem", "spend")
        ];
    }
}

class ShopTreeItem extends vscode.TreeItem {
    constructor(label: string, description: string, iconName: "contract" | "home" | "info" | "sample" | "spend" | "supplier") {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.tooltip = description;
        this.iconPath = new vscode.ThemeIcon(iconFor(iconName));
    }
}

class CommandTreeItem extends ShopTreeItem {
    constructor(label: string, description: string, commandId: string, iconName: "contract" | "home" | "sample" | "spend" | "supplier") {
        super(label, description, iconName);
        this.command = { command: commandId, title: label };
    }
}

class EntityTreeItem extends ShopTreeItem {
    constructor(label: string, description: string, iconName: "contract" | "spend" | "supplier", editCommand: string, entity: SupplierRecord | ContractRecord | SpendItemRecord) {
        super(label, description, iconName);
        this.command = { command: editCommand, title: "Edit", arguments: [entity] };
        this.contextValue = "pspfShopRecord";
    }
}

class ForecastViewProvider implements vscode.WebviewViewProvider {
    private view: vscode.WebviewView | undefined;

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: false };
        this.render();
    }

    refresh(): void {
        this.render();
    }

    private render(): void {
        if (!this.view) {
            return;
        }
        const store = shopStore ?? emptyStore();
        const forecast = deriveForecast(store.spendItems);
        this.view.webview.html = renderForecastHtml(store, forecast);
    }
}

function deriveForecast(spendItems: readonly SpendItemRecord[]): ForecastYear[] {
    const byYear = new Map<string, ForecastYear>();
    for (const item of spendItems) {
        const existing = byYear.get(item.financialYear) ?? {
            financialYear: item.financialYear,
            plannedSpend: 0,
            forecastCost: 0,
            expectedSavings: 0,
            netForecast: 0,
            itemCount: 0
        };
        const plannedSpend = existing.plannedSpend + item.amount.amount;
        const forecastCost = existing.forecastCost + (item.forecastCost?.amount ?? item.amount.amount);
        const expectedSavings = existing.expectedSavings + (item.expectedSavings?.amount ?? 0);
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

function renderForecastHtml(store: ShopStore, forecast: readonly ForecastYear[]): string {
    const publicationStatus = getPublicationStatus(store);
    const rows = forecast.length === 0
        ? "<tr><td colspan=\"6\">No spend items yet.</td></tr>"
        : forecast.map((year) => `
      <tr>
        <td>${escapeHtml(year.financialYear)}</td>
        <td>${year.itemCount}</td>
        <td>${escapeHtml(formatCurrency(year.plannedSpend))}</td>
        <td>${escapeHtml(formatCurrency(year.forecastCost))}</td>
        <td>${escapeHtml(formatCurrency(year.expectedSavings))}</td>
        <td>${escapeHtml(formatCurrency(year.netForecast))}</td>
      </tr>`).join("");

    return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); margin: 0; padding: 16px; }
    h1 { font-size: 1.2rem; margin: 0 0 8px; }
    p { color: var(--vscode-descriptionForeground); margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid var(--vscode-panel-border); padding: 8px 6px; text-align: left; }
    th { color: var(--vscode-descriptionForeground); font-weight: 600; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
    .pill { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 6px 8px; }
  </style>
</head>
<body>
  <h1>Shop Forecast</h1>
    <p>Derived from Core-backed Shop spend items. Commercial fields use the canonical publication policy before reaching snapshots or export bundles.</p>
  <div class="summary">
    <span class="pill">${store.suppliers.length} suppliers</span>
    <span class="pill">${store.contracts.length} contracts</span>
    <span class="pill">${store.spendItems.length} spend items</span>
        <span class="pill">${publicationStatus}</span>
  </div>
  <table>
    <thead>
      <tr><th>Financial year</th><th>Items</th><th>Planned spend</th><th>Forecast cost</th><th>Expected savings</th><th>Net forecast</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
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

function formatToken(value: string): string {
    return value.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}

function formatCurrency(value: number, currency = "AUD"): string {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function moneyAmount(amount: number, currency = "AUD"): MoneyAmount {
    return { amount, currency };
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

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
