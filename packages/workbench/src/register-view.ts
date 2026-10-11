import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  VERSION_AXES,
  createEntityId,
  operatorLinkRulesForSource,
  validateRegisterEntityEnvelope,
  type LinkEntity,
  type RiskAssessment,
  type RiskEntity,
  type RiskEscalationState,
  type RiskEventEntity
} from "@pspf/contracts";
import type { Store } from "./data/store.ts";
import {
  createRegisterDraft,
  REGISTER_AUTHORING_TYPES,
  type RegisterAuthoringType
} from "./domain/register-authoring.ts";
import { parseRegisterImport } from "./domain/register-import.ts";
import type { Draft, RegisterChange, RegisterEntity } from "./domain/types.ts";

const TYPE_LABELS: Record<RegisterAuthoringType, string> = {
  requirement: "Requirements",
  evidence: "Evidence",
  action: "Actions",
  risk: "Risks",
  direction: "Directions",
  narrative: "Narratives",
  "requirement-control-mapping": "ISM mappings"
};

function recordTitle(record: RegisterEntity): string {
  const candidate = record as RegisterEntity & { title?: string; slot?: string; controlId?: string };
  return candidate.title?.trim() || candidate.slot || candidate.controlId || record.id;
}

function recordStatus(record: RegisterEntity): string {
  if ("assessmentStatus" in record) return record.assessmentStatus;
  if ("responseState" in record) return record.responseState;
  if ("status" in record) return record.status;
  return record.recordStatus;
}

function parseRegisterDraft(value: string): RegisterEntity | undefined {
  try {
    const record = JSON.parse(value) as unknown;
    if (validateRegisterEntityEnvelope(record).length > 0) return undefined;
    const type = (record as RegisterEntity).entityType;
    return REGISTER_AUTHORING_TYPES.includes(type as RegisterAuthoringType) ? (record as RegisterEntity) : undefined;
  } catch {
    return undefined;
  }
}

function pickJsonFile(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => void input.files?.[0]?.text().then(resolve, () => resolve(undefined)));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

@customElement("pspf-register-view")
export class RegisterView extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
      color: #e6edf3;
      font:
        14px/1.45 system-ui,
        sans-serif;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(210px, 270px) minmax(0, 1fr);
      min-height: calc(100vh - 130px);
    }
    aside {
      border-right: 1px solid #263040;
      padding: 8px;
      overflow: auto;
    }
    section {
      padding: 12px 18px;
      min-width: 0;
      max-width: 960px;
    }
    h2 {
      margin: 8px 0;
      font-size: 18px;
    }
    h3 {
      margin: 18px 0 6px;
      font-size: 15px;
    }
    button,
    input,
    textarea,
    select {
      color: inherit;
      font: inherit;
    }
    button,
    input,
    textarea,
    select {
      background: #0f1620;
      border: 1px solid #34445a;
      border-radius: 5px;
      padding: 7px 9px;
      box-sizing: border-box;
    }
    button {
      background: #1b2735;
      cursor: pointer;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible,
    select:focus-visible {
      outline: 2px solid #5b9bd5;
      outline-offset: 2px;
    }
    label {
      display: block;
      margin: 9px 0 3px;
      color: #aebdcd;
      font-size: 12px;
    }
    label input,
    label textarea,
    label select {
      display: block;
      width: 100%;
      margin-top: 3px;
    }
    textarea {
      min-height: 100px;
      resize: vertical;
    }
    .record {
      display: block;
      width: 100%;
      margin: 5px 0;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .record[aria-current="true"] {
      background: #2b4a73;
      border-color: #5b8bd0;
    }
    .record[aria-current="true"] .muted {
      color: #e1eaf4;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
    }
    .muted {
      color: #9fb0c3;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .notice,
    .error {
      margin: 8px 0;
      padding: 7px 10px;
      border: 1px solid #526579;
      border-radius: 5px;
    }
    .error {
      border-color: #8a2c2c;
      background: #4a1b1b;
    }
    .notice {
      background: #162b38;
    }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 14px;
    }
    .span-two {
      grid-column: 1 / -1;
    }
    .rule {
      border: 0;
      border-top: 1px solid #263040;
      margin: 18px 0;
    }
    @media (max-width: 720px) {
      .layout {
        grid-template-columns: 1fr;
      }
      aside {
        border-right: 0;
        border-bottom: 1px solid #263040;
        max-height: 280px;
      }
      section {
        padding: 10px;
      }
      .field-grid {
        grid-template-columns: 1fr;
      }
      .span-two {
        grid-column: auto;
      }
    }
  `;

  @property({ attribute: false }) store: Store | undefined;
  @property({ type: Boolean }) writable = false;
  @state() private type: RegisterAuthoringType = "requirement";
  @state() private all: RegisterEntity[] = [];
  @state() private items: RegisterEntity[] = [];
  @state() private selected: RegisterEntity | undefined;
  @state() private draft: RegisterEntity | undefined;
  @state() private links: LinkEntity[] = [];
  @state() private changes: RegisterChange[] = [];
  @state() private linkTarget = "";
  @state() private escalationReason = "";
  @state() private escalationState: RiskEscalationState = "proposed";
  @state() private escalationDestination = "";
  @state() private notice = "";
  @state() private error = "";
  @state() private ismBaseline = "";
  @state() private loading = true;
  private navigationRevision = 0;
  private readonly pageHideHandler = () => {
    if (this.draft) void this.persistDraft(this.draft);
  };
  private readonly visibilityHandler = () => {
    if (document.visibilityState === "hidden" && this.draft) void this.persistDraft(this.draft);
  };

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    try {
      await this.load(true);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
    window.addEventListener("pagehide", this.pageHideHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  override disconnectedCallback(): void {
    window.removeEventListener("pagehide", this.pageHideHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    super.disconnectedCallback();
  }

  private async load(restoreDraft: boolean): Promise<void> {
    if (!this.store) return;
    this.ismBaseline = (await import("@pspf/ism-source-library")).ISM_OSCAL_RELEASE;
    this.all = await this.store.listRegisterEntities();
    if (restoreDraft) {
      const drafts = (await this.store.listDrafts())
        .filter((item) => item.kind === "register" && item.context.route === "register")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const savedDraft = drafts[0];
      if (savedDraft) {
        const restored = parseRegisterDraft(savedDraft.text);
        if (restored) {
          this.type = restored.entityType as RegisterAuthoringType;
          this.draft = restored;
          this.selected = await this.store.getRegisterEntity(restored.id);
          this.notice = "An unfinished register draft was restored.";
        }
      }
    }
    this.refreshItems();
    if (this.selected) this.links = await this.store.listLinks(this.selected.id);
  }

  private refreshItems(): void {
    this.items = this.all.filter((record) => record.entityType === this.type);
  }

  private notifyRegisterChanged(): void {
    this.dispatchEvent(new CustomEvent("register-changed", { bubbles: true, composed: true }));
  }

  private async importMigration(): Promise<void> {
    this.error = "";
    this.notice = "";
    if (!this.store || !this.writable) {
      this.error = "This tab is read-only.";
      return;
    }
    try {
      const text = await pickJsonFile();
      if (!text) return;
      const file = await parseRegisterImport(text);
      const total = file.entities.length + file.links.length;
      const counts = Object.entries(file.recordCounts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entityType, count]) => `${entityType}: ${count}`)
        .join("\n");
      if (!confirm(`Import ${total} register records from the checksummed migration file?\n\n${counts}`)) return;
      const result = await this.store.importRegister(file);
      this.all = await this.store.listRegisterEntities();
      this.refreshItems();
      this.notifyRegisterChanged();
      this.notice = `Migration complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async selectType(event: Event): Promise<void> {
    this.navigationRevision += 1;
    this.type = (event.target as HTMLSelectElement).value as RegisterAuthoringType;
    this.selected = undefined;
    this.draft = undefined;
    this.links = [];
    this.changes = [];
    this.notice = "";
    this.refreshItems();
  }

  private async openRecord(id: string): Promise<void> {
    if (!this.store) return;
    const revision = ++this.navigationRevision;
    const [record, savedDraft, links, changes] = await Promise.all([
      this.store.getRegisterEntity(id),
      this.store.getDraft(`register:${id}`),
      this.store.listLinks(id),
      this.store.listChangeLog(id)
    ]);
    if (!record || revision !== this.navigationRevision) return;
    this.selected = record;
    if (REGISTER_AUTHORING_TYPES.includes(record.entityType as RegisterAuthoringType)) {
      this.type = record.entityType as RegisterAuthoringType;
      this.refreshItems();
    }
    this.draft = savedDraft ? (parseRegisterDraft(savedDraft.text) ?? record) : record;
    this.links = links;
    this.changes = changes;
    this.linkTarget = "";
    this.escalationReason = "";
    this.notice = savedDraft ? "An unfinished register draft was restored." : "";
  }

  private createRecord(): void {
    this.navigationRevision += 1;
    const domain = this.all.find((record) => record.entityType === "domain");
    const requirement = this.all.find((record) => record.entityType === "requirement");
    const sourceControl = this.all.find((record) => record.entityType === "source-control");
    this.selected = undefined;
    this.links = [];
    this.changes = [];
    this.linkTarget = "";
    this.draft = createRegisterDraft(this.type, {
      ...(domain ? { domainId: domain.id } : {}),
      ...(requirement ? { requirementId: requirement.id } : {}),
      ...(sourceControl?.entityType === "source-control"
        ? { sourceControlId: sourceControl.id, oscalRelease: sourceControl.provenance.oscalRelease }
        : {})
    });
    this.notice = "New record. Changes are saved as a draft until you select Save.";
  }

  private updateField(field: string, value: unknown): void {
    if (!this.draft) return;
    const next = { ...this.draft, [field]: value } as RegisterEntity;
    if (
      next.entityType === "risk" &&
      next.assessment?.basis === "legacy" &&
      (field === "likelihood" || field === "impact")
    ) {
      Object.assign(next, { assessment: { ...next.assessment, [field]: value, assessedAt: new Date().toISOString() } });
    }
    if (next.entityType === "requirement-control-mapping" && field === "sourceControlId") {
      const control = this.all.find((record) => record.entityType === "source-control" && record.id === value);
      if (control?.entityType === "source-control")
        Object.assign(next, {
          provenance: { ...next.provenance, oscalRelease: control.provenance.oscalRelease }
        });
    }
    this.draft = next;
    void this.persistDraft(next);
  }

  private async persistDraft(record: RegisterEntity): Promise<void> {
    if (!this.store || !this.writable) return;
    const draft: Draft = {
      id: `register:${record.id}`,
      kind: "register",
      text: JSON.stringify(record),
      context: { route: "register", selection: record.id },
      updatedAt: new Date().toISOString()
    };
    try {
      await this.store.saveDraft(draft);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async saveRecord(): Promise<void> {
    this.error = "";
    this.notice = "";
    if (!this.store || !this.writable || !this.draft) {
      this.error = "This tab is read-only or no record is selected.";
      return;
    }
    try {
      const now = new Date().toISOString();
      const record =
        this.draft.entityType === "narrative" && this.selected?.entityType === "narrative"
          ? {
              ...this.draft,
              id: createEntityId("narrative"),
              createdAt: now,
              updatedAt: now,
              supersedesId: this.selected.id
            }
          : {
              ...this.draft,
              updatedAt: now,
              ...(this.draft.entityType === "requirement"
                ? {
                    assessmentReviewedAt: now,
                    ...(this.draft.acceptanceDefinition !==
                    (this.selected?.entityType === "requirement" ? this.selected.acceptanceDefinition : undefined)
                      ? { acceptanceDefinitionUpdatedAt: now }
                      : {})
                  }
                : {})
            };
      await this.store.saveRegisterEntity(record, now);
      await this.store.deleteDraft(`register:${this.draft.id}`);
      this.type = record.entityType as RegisterAuthoringType;
      this.all = await this.store.listRegisterEntities();
      this.refreshItems();
      this.notifyRegisterChanged();
      await this.openRecord(record.id);
      this.notice = record.entityType === "narrative" ? "Narrative revision saved." : "Register record saved.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async restoreNarrative(previous: RegisterEntity): Promise<void> {
    const current = this.selected;
    if (!current || current.entityType !== "narrative" || previous.entityType !== "narrative") return;
    const now = new Date().toISOString();
    this.selected = undefined;
    const draft: RegisterEntity = {
      ...previous,
      id: createEntityId("narrative"),
      createdAt: now,
      updatedAt: now,
      supersedesId: current.id
    };
    this.draft = draft;
    this.notice = "Previous narrative content loaded as a new draft. Review it and select Save.";
    await this.persistDraft(draft);
  }

  private availableLinkTargets(): Array<{
    record: RegisterEntity;
    linkType: LinkEntity["linkType"];
    reverse: boolean;
  }> {
    if (!this.selected) return [];
    const rules = operatorLinkRulesForSource("workshop");
    const targets: Array<{ record: RegisterEntity; linkType: LinkEntity["linkType"]; reverse: boolean }> = [];
    for (const record of this.all) {
      if (record.id === this.selected.id) continue;
      const direct = rules.find(
        (rule) => rule.fromType === this.selected?.entityType && rule.toType === record.entityType
      );
      if (direct) {
        targets.push({ record, linkType: direct.linkType, reverse: false });
        continue;
      }
      const reverse = rules.find(
        (rule) => rule.fromType === record.entityType && rule.toType === this.selected?.entityType
      );
      if (reverse) targets.push({ record, linkType: reverse.linkType, reverse: true });
    }
    return targets;
  }

  private narrativeVersions(record: Extract<RegisterEntity, { entityType: "narrative" }>) {
    return this.all.filter(
      (item): item is Extract<RegisterEntity, { entityType: "narrative" }> =>
        item.entityType === "narrative" && item.slot === record.slot && item.id !== record.id
    );
  }

  private async createLink(): Promise<void> {
    this.error = "";
    if (!this.store || !this.writable || !this.selected || !this.linkTarget) return;
    const target = this.all.find((record) => record.id === this.linkTarget);
    const relation = this.availableLinkTargets().find((option) => option.record.id === this.linkTarget);
    if (!target || !relation) return;
    const now = new Date().toISOString();
    const from = relation.reverse ? target : this.selected;
    const to = relation.reverse ? this.selected : target;
    const link: LinkEntity = {
      id: createEntityId("link"),
      entityType: "link",
      schemaVersion: VERSION_AXES.schemaVersion,
      linkType: relation.linkType as LinkEntity["linkType"],
      fromId: from.id,
      fromType: from.entityType,
      toId: to.id,
      toType: to.entityType,
      createdAt: now,
      updatedAt: now,
      sourceProduct: "workshop",
      recordStatus: "active"
    };
    try {
      await this.store.saveLink(link, now);
      this.links = await this.store.listLinks(this.selected.id);
      this.linkTarget = "";
      this.notice = "Typed link saved.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async recordEscalation(): Promise<void> {
    this.error = "";
    if (!this.store || !this.writable || this.selected?.entityType !== "risk") return;
    const reason = this.escalationReason.trim();
    if (!reason) {
      this.error = "Enter the reason for this escalation.";
      return;
    }
    const now = new Date().toISOString();
    const event: RiskEventEntity = {
      id: createEntityId("risk-event"),
      entityType: "risk-event",
      schemaVersion: VERSION_AXES.schemaVersion,
      riskId: this.selected.id,
      kind: "escalation",
      occurredAt: now,
      summary: reason,
      escalation: {
        state: this.escalationState,
        reason,
        ...(this.escalationDestination ? { destinationRiskId: this.escalationDestination } : {}),
        ...(this.escalationState !== "proposed" ? { decidedAt: now } : {})
      },
      createdAt: now,
      updatedAt: now,
      sourceProduct: "workshop",
      recordStatus: "active"
    };
    try {
      await this.store.recordRiskEscalation(event, now);
      this.all = await this.store.listRegisterEntities();
      this.escalationReason = "";
      this.escalationDestination = "";
      this.notice = "Risk escalation recorded in history.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private fieldText(label: string, field: string, value: unknown, multiline = false) {
    const text = typeof value === "string" ? value : "";
    return html`<label class=${multiline ? "span-two" : ""}
      >${label}${multiline
        ? html`<textarea
            .value=${text}
            ?disabled=${!this.writable}
            @input=${(event: Event) => this.updateField(field, (event.target as HTMLTextAreaElement).value)}
          ></textarea>`
        : html`<input
            .value=${text}
            ?disabled=${!this.writable}
            @input=${(event: Event) => this.updateField(field, (event.target as HTMLInputElement).value)}
          />`}</label
    >`;
  }

  private fieldNumber(label: string, field: string, value: unknown, min = 0, max = 100) {
    return html`<label
      >${label}<input
        type="number"
        min=${min}
        max=${max}
        .value=${String(value ?? "")}
        ?disabled=${!this.writable}
        @input=${(event: Event) => this.updateField(field, Number((event.target as HTMLInputElement).value))}
    /></label>`;
  }

  private fieldSelect(
    label: string,
    field: string,
    value: unknown,
    options: readonly { value: string; label: string }[]
  ) {
    return html`<label
      >${label}<select
        .value=${String(value ?? "")}
        ?disabled=${!this.writable}
        @change=${(event: Event) => this.updateField(field, (event.target as HTMLSelectElement).value)}
      >
        ${options.map(
          (option) =>
            html`<option value=${option.value} ?selected=${String(value ?? "") === option.value}>
              ${option.label}
            </option>`
        )}
      </select></label
    >`;
  }

  private renderFields(record: RegisterEntity) {
    switch (record.entityType) {
      case "requirement":
        return html`<div class="field-grid">
          ${this.fieldText("Title", "title", record.title)}
          ${this.fieldSelect(
            "Domain",
            "domainId",
            record.domainId,
            this.all
              .filter((item) => item.entityType === "domain")
              .map((item) => ({ value: item.id, label: recordTitle(item) }))
          )}
          ${this.fieldSelect(
            "Assessment",
            "assessmentStatus",
            record.assessmentStatus,
            ["not-started", "in-progress", "met", "partially-met", "not-met", "not-applicable", "under-review"].map(
              (value) => ({ value, label: value })
            )
          )}
          ${this.fieldText("Owner team", "ownerTeam", record.ownerTeam)}
          ${this.fieldText("Assessment rationale", "assessmentRationale", record.assessmentRationale, true)}
          ${this.fieldText("Acceptance definition", "acceptanceDefinition", record.acceptanceDefinition, true)}
        </div>`;
      case "evidence":
        return html`<div class="field-grid">
          ${this.fieldText("Title", "title", record.title)}
          ${this.fieldSelect(
            "Evidence type",
            "evidenceType",
            record.evidenceType,
            ["document", "url", "note"].map((value) => ({ value, label: value }))
          )}
          ${this.fieldText("Reference", "reference", record.reference, true)}
          ${this.fieldSelect(
            "Freshness",
            "freshness",
            record.freshness,
            ["current", "ageing", "stale", "expired", "unknown"].map((value) => ({ value, label: value }))
          )}
        </div>`;
      case "action":
        return html`<div class="field-grid">
          ${this.fieldText("Title", "title", record.title)}
          ${this.fieldSelect(
            "Status",
            "status",
            record.status,
            ["todo", "in-progress", "blocked", "done", "cancelled"].map((value) => ({ value, label: value }))
          )}
          ${this.fieldText("Due date", "dueDate", record.dueDate)}
          ${this.fieldText("Owner team", "ownerTeam", record.ownerTeam)}
          ${this.fieldSelect(
            "Planning state",
            "planningState",
            record.planningState,
            ["", "candidate", "committed", "deferred", "excluded"].map((value) => ({
              value,
              label: value || "Not set"
            }))
          )}
          ${this.fieldSelect(
            "Blocker class",
            "blockerClass",
            record.blockerClass,
            ["", "us", "funding", "assessor", "supplier"].map((value) => ({ value, label: value || "Derived" }))
          )}
          ${record.dueDateHistory?.length
            ? html`<p class="muted span-two">
                Due-date history: ${record.dueDateHistory.map((entry) => entry.dueDate ?? "cleared").join(" → ")}
              </p>`
            : nothing}
        </div>`;
      case "risk":
        return html`<div class="field-grid">
          ${this.fieldText("Title", "title", record.title)}
          ${this.fieldSelect(
            "Status",
            "status",
            record.status,
            ["open", "monitored", "closed"].map((value) => ({ value, label: value }))
          )}
          ${this.renderRiskAssessment(record)}
          ${this.fieldSelect("Primary category", "primaryCategoryId", record.primaryCategoryId, [
            { value: "", label: "Not set" },
            ...this.all.flatMap((item) =>
              item.entityType === "risk-framework"
                ? (item.categories ?? []).map((category) => ({ value: category.id, label: category.label }))
                : []
            )
          ])}
          ${this.fieldSelect(
            "Response",
            "response",
            record.response,
            ["", "not-decided", "reduce", "avoid", "share", "accept"].map((value) => ({
              value,
              label: value || "Not set"
            }))
          )}
          ${this.fieldText("Owner team", "ownerTeam", record.ownerTeam)}
          ${this.fieldText("Review by", "reviewBy", record.reviewBy)}
          ${this.fieldText("Description", "description", record.description, true)}
          ${record.assessmentState
            ? html`<p class="muted span-two">Assessment state: ${record.assessmentState} (derived)</p>`
            : nothing}
        </div>`;
      case "direction":
        return html`<div class="field-grid">
          ${this.fieldText("Title", "title", record.title)}
          ${this.fieldText("Reference", "reference", record.reference)}
          ${this.fieldText("Issuing authority", "sourceAuthority", record.sourceAuthority)}
          ${this.fieldText("Issued date", "issuedAt", record.issuedAt)}
          ${this.fieldSelect(
            "Response",
            "responseState",
            record.responseState,
            ["not-set", "yes", "no", "risk-managed"].map((value) => ({ value, label: value }))
          )}
        </div>`;
      case "narrative":
        return html`<div class="field-grid">
          ${this.fieldText("Narrative slot", "slot", record.slot)}
          ${this.fieldSelect(
            "Audience",
            "audience",
            record.audience,
            ["internal", "executive"].map((value) => ({ value, label: value }))
          )}
          ${this.fieldText("Narrative", "body", record.body, true)}
          <div class="row span-two">
            <button
              disabled
              title="Generated brief text returns with the briefs capability in W4+."
              @click=${() => undefined}
            >
              Use generated
            </button>
            <span class="muted">Generated brief text returns in W4+. Saving creates a new revision.</span>
          </div>
        </div>`;
      case "requirement-control-mapping": {
        const requirements = this.all.filter((item) => item.entityType === "requirement");
        const controls = this.all.filter((item) => item.entityType === "source-control");
        return html`<div class="field-grid">
          ${this.fieldSelect(
            "Requirement",
            "requirementId",
            record.requirementId,
            requirements.map((item) => ({ value: item.id, label: recordTitle(item) }))
          )}
          ${this.fieldSelect(
            "ISM control",
            "sourceControlId",
            record.sourceControlId,
            controls.map((item) => ({
              value: item.id,
              label: item.entityType === "source-control" ? `${item.controlId} ${item.title}` : item.id
            }))
          )}
          ${this.fieldSelect(
            "Coverage",
            "coverageQualifier",
            record.coverageQualifier,
            ["primary", "partial", "compensating"].map((value) => ({ value, label: value }))
          )}
          ${this.fieldText("Applicability profile", "applicabilityProfile", record.applicabilityProfile)}
          ${this.fieldSelect(
            "Confidence",
            "confidence",
            record.confidence,
            ["low", "medium", "high"].map((value) => ({ value, label: value }))
          )}
          ${this.fieldText("Review by", "reviewBy", record.reviewBy)}
          ${this.fieldText("Rationale", "rationale", record.rationale, true)}
          <p class="muted span-two">Source release: ${record.provenance.oscalRelease || "not recorded"}</p>
          ${this.ismBaseline && record.provenance.oscalRelease !== this.ismBaseline
            ? html`<p class="notice span-two">
                Mapping source differs from baseline ${this.ismBaseline}; review the control before marking reviewed.
              </p>`
            : nothing}
        </div>`;
      }
      default:
        return nothing;
    }
  }

  private renderRiskAssessment(record: RiskEntity) {
    const assessment = record.assessment;
    const basis = assessment?.basis ?? "legacy";
    const custom = assessment?.basis === "custom" ? assessment : undefined;
    const framework = this.all.find((item) => item.entityType === "risk-framework");
    const methodologies = framework?.entityType === "risk-framework" ? (framework.methodologies ?? []) : [];
    const methodology = custom ? methodologies.find((item) => item.id === custom.methodologyId) : undefined;
    const revision = methodology?.revisions.find((item) => item.revisionId === custom?.revisionId);
    const updateAssessment = (next: RiskAssessment) => this.updateField("assessment", next);
    return html`<label
        >Assessment basis<select
          ?disabled=${!this.writable}
          @change=${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            updateAssessment(
              value === "unassessed"
                ? { basis: "unassessed" }
                : {
                    basis: "legacy",
                    likelihood: record.likelihood,
                    impact: record.impact,
                    assessedAt: new Date().toISOString()
                  }
            );
          }}
        >
          ${["unassessed", "legacy", ...(custom ? ["custom"] : [])].map(
            (value) => html`<option value=${value} ?selected=${value === basis}>${value}</option>`
          )}
        </select></label
      >
      ${basis === "legacy"
        ? html` ${this.fieldNumber(
            "Likelihood",
            "likelihood",
            assessment?.basis === "legacy" ? assessment.likelihood : record.likelihood,
            1,
            5
          )}
          ${this.fieldNumber(
            "Impact",
            "impact",
            assessment?.basis === "legacy" ? assessment.impact : record.impact,
            1,
            5
          )}`
        : nothing}
      ${custom
        ? html`
            <p class="muted span-two">
              Methodology: ${methodology?.label ?? custom.methodologyId} / ${custom.revisionId}
            </p>
            ${(["likelihood", "impact"] as const).map(
              (dimension) =>
                html`<label
                  >${dimension === "likelihood" ? "Likelihood" : "Impact"}<select
                    ?disabled=${!this.writable || !revision}
                    @change=${(event: Event) =>
                      updateAssessment({
                        ...custom,
                        current: {
                          ...custom.current,
                          [dimension === "likelihood" ? "likelihoodId" : "impactId"]: (
                            event.target as HTMLSelectElement
                          ).value
                        },
                        assessedAt: new Date().toISOString()
                      })}
                  >
                    ${(revision?.[dimension === "likelihood" ? "likelihoodLevels" : "impactLevels"] ?? []).map(
                      (level) =>
                        html`<option
                          value=${level.id}
                          ?selected=${level.id ===
                          custom.current[dimension === "likelihood" ? "likelihoodId" : "impactId"]}
                        >
                          ${level.label}
                        </option>`
                    )}
                  </select></label
                >`
            )}
            <label class="span-two"
              >Assessment rationale<textarea
                ?disabled=${!this.writable}
                .value=${custom.rationale ?? ""}
                @input=${(event: Event) =>
                  updateAssessment({ ...custom, rationale: (event.target as HTMLTextAreaElement).value })}
              ></textarea>
            </label>
          `
        : nothing}`;
  }

  private renderLinks() {
    const targets = this.availableLinkTargets();
    return html`<hr class="rule" />
      <h3>Links</h3>
      ${this.selected
        ? html`<div class="row">
            <label
              >Link to<select
                .value=${this.linkTarget}
                ?disabled=${!this.writable}
                @change=${(event: Event) => {
                  this.linkTarget = (event.target as HTMLSelectElement).value;
                }}
              >
                <option value="">Choose a record</option>
                ${targets.map(
                  (item) =>
                    html`<option value=${item.record.id}>${recordTitle(item.record)} · ${item.linkType}</option>`
                )}
              </select></label
            ><button ?disabled=${!this.writable || !this.linkTarget} @click=${() => this.createLink()}>
              Add typed link
            </button>
          </div>`
        : html`<p class="muted">Save the record before adding links.</p>`}
      ${this.links.length === 0
        ? html`<p class="muted">No links recorded.</p>`
        : this.links.map((link) => {
            const targetId = link.fromId === this.selected?.id ? link.toId : link.fromId;
            const target = this.all.find((item) => item.id === targetId);
            return html`<button class="record" @click=${() => target && this.openRecord(target.id)}>
              ${link.linkType} · ${target ? recordTitle(target) : targetId}<br /><span class="muted">${targetId}</span>
            </button>`;
          })}`;
  }

  private renderEscalations() {
    if (this.selected?.entityType !== "risk") return nothing;
    const events = this.all.filter(
      (record): record is RiskEventEntity => record.entityType === "risk-event" && record.riskId === this.selected?.id
    );
    const risks = this.all.filter((record) => record.entityType === "risk" && record.id !== this.selected?.id);
    return html`<hr class="rule" />
      <h3>Escalation history</h3>
      ${events.map(
        (event) =>
          html`<p>
            <strong>${event.escalation?.state ?? "unknown"}</strong> · ${event.occurredAt.slice(0, 10)}<br />${event
              .escalation?.reason ?? event.summary}
          </p>`
      )}
      <label
        >Escalation state<select
          .value=${this.escalationState}
          ?disabled=${!this.writable}
          @change=${(event: Event) => {
            this.escalationState = (event.target as HTMLSelectElement).value as RiskEscalationState;
          }}
        >
          ${["proposed", "accepted", "declined", "withdrawn"].map(
            (value) => html`<option value=${value}>${value}</option>`
          )}
        </select></label
      >
      <label
        >Destination Risk<select
          .value=${this.escalationDestination}
          ?disabled=${!this.writable}
          @change=${(event: Event) => {
            this.escalationDestination = (event.target as HTMLSelectElement).value;
          }}
        >
          <option value="">No destination</option>
          ${risks.map((risk) => html`<option value=${risk.id}>${recordTitle(risk)}</option>`)}
        </select></label
      >
      <label
        >Reason<textarea
          .value=${this.escalationReason}
          ?disabled=${!this.writable}
          @input=${(event: Event) => {
            this.escalationReason = (event.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
      </label>
      <button ?disabled=${!this.writable} @click=${() => this.recordEscalation()}>Record escalation</button>`;
  }

  private renderEditor() {
    const record = this.draft;
    if (!record) return html`<p class="muted">Select a record or create a new one.</p>`;
    return html`<div class="row">
        <div>
          <h2>
            ${this.selected
              ? recordTitle(this.selected)
              : `New ${TYPE_LABELS[this.type].toLowerCase().replace(/s$/, "")}`}
          </h2>
          <div class="muted">${record.id} · ${recordStatus(record)}</div>
        </div>
        <button ?disabled=${!this.writable} @click=${() => this.saveRecord()}>Save</button>
      </div>
      ${this.renderFields(record)}
      ${record.entityType === "narrative" && this.selected?.entityType === "narrative"
        ? html`<div class="row">
            ${this.narrativeVersions(this.selected).map(
              (item) =>
                html`<button @click=${() => this.restoreNarrative(item)}>
                  Restore version ${item.updatedAt.slice(0, 10)}
                </button>`
            )}
          </div>`
        : nothing}
      ${record.entityType === "requirement-control-mapping"
        ? html`<button
            ?disabled=${!this.writable}
            @click=${() => this.updateField("lastReviewedAt", new Date().toISOString())}
          >
            Mark reviewed
          </button>`
        : nothing}
      ${this.renderLinks()}${this.renderEscalations()}`;
  }

  override render() {
    return html`<div class="layout">
      <aside aria-label="Register records">
        <h2>Register</h2>
        <button ?disabled=${!this.writable || this.loading} @click=${() => this.importMigration()}>
          Import migration file
        </button>
        <label
          >Record type<select
            ?disabled=${this.loading}
            .value=${this.type}
            @change=${(event: Event) => this.selectType(event)}
          >
            ${REGISTER_AUTHORING_TYPES.map((type) => html`<option value=${type}>${TYPE_LABELS[type]}</option>`)}
          </select></label
        >
        <button ?disabled=${!this.writable || this.loading} @click=${() => this.createRecord()}>New record</button>
        ${this.items.length === 0
          ? html`<p class="muted">No ${TYPE_LABELS[this.type].toLowerCase()} in the register.</p>`
          : nothing}
        ${this.items.map(
          (record) =>
            html`<button
              class="record"
              aria-current=${this.selected?.id === record.id ? "true" : "false"}
              @click=${() => this.openRecord(record.id)}
            >
              ${recordTitle(record)}<br /><span class="muted"
                >${recordStatus(record)} · ${record.updatedAt.slice(0, 10)}</span
              >
            </button>`
        )}
      </aside>
      <section aria-label="Register record detail">
        ${this.error ? html`<div class="error" role="alert">${this.error}</div>` : nothing}
        ${this.notice ? html`<div class="notice" role="status">${this.notice}</div>` : nothing} ${this.renderEditor()}
        ${this.renderChangeHistory()}
      </section>
    </div>`;
  }

  private renderChangeHistory() {
    if (!this.selected) return nothing;
    return html`<hr class="rule" />
      <h3>Change history</h3>
      ${this.changes.length === 0
        ? html`<p class="muted">No workbench changes are recorded yet. Imported Core history is not available here.</p>`
        : this.changes.map(
            (change) =>
              html`<p>
                <strong>${change.recordedAt.slice(0, 16).replace("T", " ")}</strong>
                · ${change.fieldSet.length ? change.fieldSet.join(", ") : "Saved without field changes"}
              </p>`
          )}`;
  }
}
