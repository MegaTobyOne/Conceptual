import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Store } from "./data/store.ts";
import "./register-view.ts";
import { backupIsDue, createBackup, parseBackup, type ParsedBackup } from "./domain/backup.ts";
import {
  composeBrief,
  editionFileName,
  editionMarkdown,
  redactEditionForPublish,
  redactForPublish
} from "./domain/brief.ts";
import { PROFILES, buildDossier, profileAnswers, type Dossier } from "./domain/dossier.ts";
import { newId } from "./domain/ids.ts";
import { suggestMatches } from "./domain/matching.ts";
import { COPILOT_PROMPT_TEMPLATE, parseCapture, type CaptureDraft } from "./domain/parser.ts";
import { importRegisterBundle, referenceStatus } from "./domain/register.ts";
import {
  FOLLOW_UP_STATES,
  PROFILE_IDS,
  type Edition,
  type FollowUpState,
  type Matter,
  type ProfileId,
  type Provenance,
  type RegisterEntity,
  type RegisterSnapshot,
  type TrailItem
} from "./domain/types.ts";

type Route = "capture" | "dossier" | "register" | "brief";

const CTX = "ctx";
const CAPTURE = "capture";
const LAST_BACKUP = "lastBackupAt";

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function pickFile(accept: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => void input.files?.[0]?.text().then(resolve, () => resolve(undefined)));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

function liveRegisterTitle(record: RegisterEntity): string {
  const value = record as RegisterEntity & { title?: string; controlId?: string; slot?: string };
  return value.title ?? value.controlId ?? value.slot ?? record.id;
}

function liveReferenceStatus(ref: Matter["refs"][number], records: RegisterEntity[]): string {
  if (ref.kind === "external") return "external";
  const record = records.find((item) => item.id === ref.targetId);
  if (!record) return "missing";
  return liveRegisterTitle(record) === ref.label ? "current" : "changed";
}

@customElement("pspf-workbench")
export class Workbench extends LitElement {
  static override styles = css`
    :host {
      display: block;
      color: #e6edf3;
      font:
        14px/1.45 system-ui,
        sans-serif;
      min-height: 100vh;
    }
    header {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 16px;
      border-bottom: 1px solid #263040;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 16px;
      margin: 0 8px 0 0;
    }
    main {
      display: grid;
      grid-template-columns: 280px 1fr;
      min-height: calc(100vh - 50px);
    }
    main.register-page {
      grid-template-columns: minmax(0, 1fr);
    }
    nav.list {
      border-right: 1px solid #263040;
      padding: 8px;
      overflow: auto;
    }
    section.work {
      padding: 16px;
      max-width: 900px;
    }
    section.work.register-work {
      max-width: none;
      padding: 8px;
    }
    button {
      background: #1b2735;
      color: inherit;
      border: 1px solid #34445a;
      border-radius: 6px;
      padding: 5px 10px;
      cursor: pointer;
      font: inherit;
    }
    button[aria-pressed="true"],
    button[aria-current="true"] {
      background: #2b4a73;
      border-color: #5b8bd0;
    }
    button.matter {
      display: block;
      width: 100%;
      text-align: left;
      margin-bottom: 4px;
      white-space: normal;
    }
    textarea,
    input,
    select {
      background: #0f1620;
      color: inherit;
      border: 1px solid #34445a;
      border-radius: 6px;
      padding: 6px;
      font: inherit;
      box-sizing: border-box;
    }
    textarea {
      width: 100%;
      min-height: 140px;
    }
    label {
      display: block;
      margin: 8px 0 2px;
      font-size: 12px;
      color: #9fb0c3;
    }
    .banner {
      background: #4a3b12;
      border: 1px solid #8a6d1c;
      padding: 6px 10px;
      border-radius: 6px;
    }
    .error {
      background: #4a1b1b;
      border: 1px solid #8a2c2c;
      padding: 6px 10px;
      border-radius: 6px;
      margin: 8px 0;
    }
    .card {
      border: 1px solid #263040;
      border-radius: 8px;
      padding: 10px;
      margin: 8px 0;
    }
    .unknown {
      color: #e0b050;
    }
    .muted {
      color: #9fb0c3;
      font-size: 12px;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin: 8px 0;
    }
    ul {
      padding-left: 20px;
      margin: 4px 0;
    }
    pre {
      white-space: pre-wrap;
      background: #0f1620;
      padding: 8px;
      border-radius: 6px;
    }
  `;

  private store?: Store;
  @state() private matters: Matter[] = [];
  @state() private selected?: string | undefined;
  @state() private route: Route = "capture";
  @state() private trail: TrailItem[] = [];
  @state() private editions: Edition[] = [];
  @state() private snapshot?: RegisterSnapshot | undefined;
  @state() private registerItems: RegisterEntity[] = [];
  @state() private captureText = "";
  @state() private captureProvenance: Provenance = "parsed";
  @state() private drafts: CaptureDraft[] = [];
  @state() private profile: ProfileId = "ciso";
  @state() private briefText = "";
  @state() private audience = "";
  @state() private occasion = "";
  @state() private people = "";
  @state() private refQuery = "";
  private checkedSnapshots = new Map<string, RegisterSnapshot>();
  @state() private error = "";
  @state() private notice = "";
  @state() private backupDue = false;
  @state() private pendingRestore?: ParsedBackup | undefined;
  @state() private ready = false;
  @state() private writerMode: "loading" | "writer" | "readonly" = "loading";
  @state() private storagePersistence: "pending" | "granted" | "denied" | "unsupported" = "pending";
  private releaseWriter?: () => void;
  private readonly pageHideHandler = () => {
    void this.flushTransientDrafts();
  };
  private readonly visibilityHandler = () => {
    if (document.visibilityState === "hidden") void this.flushTransientDrafts();
  };

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    try {
      this.store = await Store.open();
      await this.restore();
      window.addEventListener("pagehide", this.pageHideHandler);
      document.addEventListener("visibilitychange", this.visibilityHandler);
      void this.coordinateWriter();
      void this.requestPersistentStorage();
    } catch (e) {
      this.error = `Browser storage is unavailable: ${(e as Error).message}`;
    }
  }

  override disconnectedCallback(): void {
    window.removeEventListener("pagehide", this.pageHideHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.releaseWriter?.();
    this.store?.close();
    super.disconnectedCallback();
  }

  private async coordinateWriter(): Promise<void> {
    if (!navigator.locks) {
      this.writerMode = "readonly";
      this.ready = true;
      return;
    }
    try {
      await navigator.locks.request("pspf-workbench-writer", { mode: "exclusive", ifAvailable: true }, async (lock) => {
        if (!lock) {
          this.writerMode = "readonly";
          this.ready = true;
          return;
        }
        this.writerMode = "writer";
        this.ready = true;
        await new Promise<void>((resolve) => {
          this.releaseWriter = resolve;
        });
      });
    } catch (error) {
      this.writerMode = "readonly";
      this.error = `Single-writer protection is unavailable: ${(error as Error).message}`;
      this.ready = true;
    }
  }

  private async requestPersistentStorage(): Promise<void> {
    const storage = navigator.storage;
    if (!storage?.persist) {
      this.storagePersistence = "unsupported";
      return;
    }
    try {
      const persisted = await storage.persisted();
      this.storagePersistence = persisted || (await storage.persist()) ? "granted" : "denied";
    } catch {
      this.storagePersistence = "denied";
    }
  }

  private async flushTransientDrafts(): Promise<void> {
    if (!this.store || this.writerMode !== "writer") return;
    const now = new Date().toISOString();
    const writes = [
      this.store.saveDraft({
        id: CAPTURE,
        kind: "capture" as const,
        text: this.captureText,
        context: { route: "capture" },
        updatedAt: now
      }),
      this.store.saveDraft({
        id: CTX,
        kind: "matter" as const,
        text: "",
        context: { route: this.route, ...(this.selected ? { selection: this.selected } : {}) },
        updatedAt: now
      })
    ];
    if (this.selected) {
      writes.push(
        this.store.saveDraft({
          id: `brief:${this.selected}`,
          kind: "brief",
          text: this.briefText,
          context: { route: "brief", selection: this.selected },
          updatedAt: now
        })
      );
    }
    await Promise.allSettled(writes);
  }

  private async restore(): Promise<void> {
    const s = this.store!;
    this.matters = await s.listMatters();
    this.registerItems = await s.listRegisterEntities();
    this.snapshot = await s.latestSnapshot();
    for (const snap of await s.listSnapshots()) this.checkedSnapshots.set(snap.id, snap);
    this.backupDue = backupIsDue(await s.getMeta(LAST_BACKUP));
    this.captureText = (await s.getDraft(CAPTURE))?.text ?? "";
    const ctx = (await s.getDraft(CTX))?.context;
    if (ctx) {
      this.route = ctx.route as Route;
      if (ctx.selection && this.matters.some((m) => m.id === ctx.selection)) await this.select(ctx.selection, false);
    }
  }

  private async persistContext(): Promise<void> {
    if (this.writerMode !== "writer") return;
    await this.store!.saveDraft({
      id: CTX,
      kind: "matter",
      text: "",
      context: { route: this.route, ...(this.selected ? { selection: this.selected } : {}) },
      updatedAt: new Date().toISOString()
    });
  }

  private async select(id: string | undefined, persist = true): Promise<void> {
    this.selected = id;
    this.trail = id ? await this.store!.listTrail(id) : [];
    this.editions = id ? await this.store!.listEditions(id) : [];
    const brief = id ? await this.store!.getDraft(`brief:${id}`) : undefined;
    this.briefText = brief?.text ?? "";
    if (persist) await this.persistContext();
  }

  private async go(route: Route): Promise<void> {
    this.route = route;
    await this.persistContext();
  }

  private get matter(): Matter | undefined {
    return this.matters.find((m) => m.id === this.selected);
  }

  private get dossier(): Dossier | undefined {
    const m = this.matter;
    return m ? buildDossier(m, this.trail, this.editions, this.registerItems) : undefined;
  }

  private async guard(action: () => Promise<void>): Promise<void> {
    this.error = "";
    this.notice = "";
    if (this.writerMode !== "writer") {
      this.error = "This tab is read-only because another tab holds the workbench writer lock.";
      return;
    }
    try {
      await action();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  // Matters

  private newMatter(): Promise<void> {
    return this.guard(async () => {
      const title = prompt("What is the concern or question?")?.trim();
      if (!title) return;
      const now = new Date().toISOString();
      const matter = await this.store!.saveMatter(
        {
          id: newId("matter"),
          title,
          scope: "",
          intendedOutcome: "",
          followUpState: "open",
          nextStep: "",
          refs: [],
          createdAt: now,
          updatedAt: now,
          log: []
        },
        now
      );
      this.matters = await this.store!.listMatters();
      await this.select(matter.id);
      await this.go("dossier");
    });
  }

  private updateMatter(patch: Partial<Matter>): Promise<void> {
    return this.guard(async () => {
      const m = this.matter;
      if (!m) return;
      await this.store!.saveMatter({ ...m, ...patch });
      this.matters = await this.store!.listMatters();
      this.notice = "Saved.";
    });
  }

  private eraseMatter(): Promise<void> {
    return this.guard(async () => {
      const m = this.matter;
      if (!m || !confirm(`Erase "${m.title}" and everything attached to it? Earlier backups are not changed.`)) return;
      await this.store!.eraseMatter(m.id);
      this.matters = await this.store!.listMatters();
      await this.select(undefined);
    });
  }

  // Capture

  private onCaptureInput(e: Event): void {
    this.captureText = (e.target as HTMLTextAreaElement).value;
    if (this.writerMode !== "writer") return;
    void this.store!.saveDraft({
      id: CAPTURE,
      kind: "capture",
      text: this.captureText,
      context: { route: "capture" },
      updatedAt: new Date().toISOString()
    });
  }

  private parse(): void {
    this.drafts = parseCapture(this.captureText);
  }

  private accept(index: number): Promise<void> {
    return this.guard(async () => {
      const d = this.drafts[index];
      if (!d || !this.selected) throw new Error("Select or create a matter first.");
      await this.store!.addTrailItems([
        {
          id: newId("trail"),
          matterId: this.selected,
          type: d.type,
          state: d.state,
          ...(d.disposition ? { disposition: d.disposition } : {}),
          value: d.value,
          ...(d.type === "owner" ? { role: d.value } : {}),
          ...(d.personName ? { personName: d.personName } : {}),
          source: d.source,
          provenance: this.captureProvenance,
          recordedAt: new Date().toISOString()
        }
      ]);
      this.trail = await this.store!.listTrail(this.selected);
      this.drafts = this.drafts.filter((_, i) => i !== index);
    });
  }

  private suggestionsFor(d: CaptureDraft) {
    const candidates = [
      ...this.matters.map((m) => ({ id: m.id, title: m.title })),
      ...this.registerItems
        .filter(
          (record) =>
            record.entityType === "requirement" || record.entityType === "risk" || record.entityType === "action"
        )
        .map((record) => ({ id: record.id, title: liveRegisterTitle(record) })),
      ...(this.snapshot?.items ?? []).map((i) => ({ id: i.id, title: i.title }))
    ];
    return suggestMatches(d.value, candidates);
  }

  private async refreshLiveRegister(): Promise<void> {
    this.registerItems = await this.store!.listRegisterEntities();
  }

  private linkRef(item: RegisterSnapshot["items"][number]): Promise<void> {
    const m = this.matter;
    if (!m || !this.snapshot || m.refs.some((r) => r.targetId === item.id)) return Promise.resolve();
    this.refQuery = "";
    return this.updateMatter({
      refs: [
        ...m.refs,
        {
          kind: item.kind,
          targetId: item.id,
          label: item.title,
          snapshotId: this.snapshot.id,
          lastCheckedAt: new Date().toISOString()
        }
      ]
    });
  }

  private linkLiveReference(id: string): Promise<void> {
    return this.guard(async () => {
      const matter = this.matter;
      const item = this.registerItems.find(
        (record) =>
          record.id === id &&
          (record.entityType === "requirement" ||
            record.entityType === "risk" ||
            record.entityType === "action" ||
            record.entityType === "narrative")
      );
      if (!matter || !item || matter.refs.some((ref) => ref.targetId === item.id)) return;
      const kind = `register-${item.entityType}` as Matter["refs"][number]["kind"];
      await this.updateMatter({
        refs: [
          ...matter.refs,
          { kind, targetId: item.id, label: liveRegisterTitle(item), lastCheckedAt: new Date().toISOString() }
        ]
      });
      this.refQuery = "";
    });
  }

  // Register, backup, publish

  private importRegister(): Promise<void> {
    return this.guard(async () => {
      const text = await pickFile(".json,application/json");
      if (!text) return;
      const snap = await importRegisterBundle(text);
      await this.store!.addSnapshot(snap);
      this.checkedSnapshots.set(snap.id, snap);
      this.snapshot = snap;
      this.notice = `Register reference imported (${snap.items.length} items). It is read-only.`;
    });
  }

  private backup(): Promise<void> {
    return this.guard(async () => {
      const text = await createBackup(await this.store!.exportAll(), __APP_VERSION__);
      download(
        `pspf-workbench-backup-OFFICIAL-Sensitive-${new Date().toISOString().slice(0, 10)}.json`,
        text,
        "application/json"
      );
      await this.store!.setMeta(LAST_BACKUP, new Date().toISOString());
      this.backupDue = false;
      this.notice =
        "Full-register backup downloaded, including sensitive fields. Store it only in an approved location.";
    });
  }

  private chooseRestore(): Promise<void> {
    return this.guard(async () => {
      const text = await pickFile(".json,application/json");
      if (!text) return;
      this.pendingRestore = await parseBackup(text);
    });
  }

  private confirmRestore(): Promise<void> {
    return this.guard(async () => {
      if (!this.pendingRestore) return;
      await this.store!.replaceAll(this.pendingRestore.data);
      this.pendingRestore = undefined;
      this.selected = undefined;
      await this.restore();
      this.notice = "Restored. Earlier backups may contain data you have since erased.";
    });
  }

  private onBriefInput(e: Event): void {
    this.briefText = (e.target as HTMLTextAreaElement).value;
    if (!this.selected || this.writerMode !== "writer") return;
    void this.store!.saveDraft({
      id: `brief:${this.selected}`,
      kind: "brief",
      text: this.briefText,
      context: { route: "brief", selection: this.selected },
      updatedAt: new Date().toISOString()
    });
  }

  private compose(): void {
    const d = this.dossier;
    if (d) this.briefText = composeBrief(d, this.profile);
  }

  private get redaction() {
    return redactForPublish(this.briefText, this.publicationNames);
  }

  private get publicationNames(): string[] {
    return [...this.people.split(","), ...this.trail.flatMap((item) => (item.personName ? [item.personName] : []))];
  }

  private issue(): Promise<void> {
    return this.guard(async () => {
      const m = this.matter;
      if (!m) return;
      if (!this.audience.trim() || !this.occasion.trim())
        throw new Error("Enter an audience and an occasion before issuing.");
      const edition = redactEditionForPublish(
        {
          id: newId("edition"),
          matterId: m.id,
          profile: this.profile,
          audience: this.audience.trim(),
          occasion: this.occasion.trim(),
          issuedAt: new Date().toISOString(),
          text: this.briefText,
          sourceRevisions: [
            ...this.trail.map((t) => t.id),
            ...(this.dossier?.narratives.map((record) => record.id) ?? [])
          ],
          redactionSummary: []
        },
        this.publicationNames
      );
      await this.store!.issueEdition(edition);
      await this.store!.deleteDraft(`brief:${m.id}`);
      this.editions = await this.store!.listEditions(m.id);
      const md = editionMarkdown(edition);
      const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker;
      if (picker) {
        try {
          const dir = await picker.call(window);
          const file = await dir.getFileHandle(editionFileName(edition), { create: true });
          const w = await file.createWritable();
          await w.write(md);
          await w.close();
          this.notice = "Issued and written to the chosen folder.";
          return;
        } catch {
          // fall through to download when the picker is cancelled or unavailable
        }
      }
      download(editionFileName(edition), md, "text/markdown");
      this.notice = "Issued and downloaded.";
    });
  }

  // Keyboard navigation in the matter list

  private onListKey(e: KeyboardEvent): void {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.matter") ?? [])];
    const i = buttons.indexOf(e.target as HTMLButtonElement);
    const next = buttons[i + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  // Rendering

  override render() {
    return html` <header>
        <h1>PSPF Workbench</h1>
        <button ?disabled=${this.writerMode !== "writer"} @click=${() => this.newMatter()}>New matter</button>
        <button ?disabled=${this.writerMode !== "writer"} @click=${() => this.importRegister()}>
          Import reference
        </button>
        <button ?disabled=${this.writerMode !== "writer"} @click=${() => this.backup()}>Back up</button>
        <button ?disabled=${this.writerMode !== "writer"} @click=${() => this.chooseRestore()}>Restore</button>
        <span class="muted"
          >${this.snapshot
            ? `Register: ${this.snapshot.items.length} items, ${this.snapshot.importedAt.slice(0, 10)}`
            : "No register reference"}</span
        >
        ${this.backupDue
          ? html`<span class="banner" role="status">No recent backup. Browser storage can be cleared.</span>`
          : nothing}
        ${this.writerMode === "readonly"
          ? html`<span class="banner" role="status">Another tab holds the writer lock. This tab is read-only.</span>`
          : nothing}
        ${this.storagePersistence === "granted"
          ? html`<span class="muted" role="status">Persistent browser storage granted.</span>`
          : this.storagePersistence === "denied" || this.storagePersistence === "unsupported"
            ? html`<span class="banner" role="status">Browser storage may be cleared. Keep an approved backup.</span>`
            : nothing}
      </header>
      <main class=${this.route === "register" ? "register-page" : ""}>
        <nav class="list" aria-label="Matters" ?hidden=${this.route === "register"} @keydown=${this.onListKey}>
          ${this.matters.length === 0 ? html`<p class="muted">No matters yet.</p>` : nothing}
          ${this.matters.map(
            (m) =>
              html` <button
                class="matter"
                aria-current=${m.id === this.selected ? "true" : "false"}
                @click=${() => this.select(m.id)}
              >
                ${m.title}<br /><span class="muted">${m.followUpState} · ${m.updatedAt.slice(0, 10)}</span>
              </button>`
          )}
        </nav>
        <section class="work ${this.route === "register" ? "register-work" : ""}">
          ${this.error ? html`<div class="error" role="alert">${this.error}</div>` : nothing}
          ${this.notice ? html`<div class="card" role="status">${this.notice}</div>` : nothing}
          ${this.pendingRestore ? this.renderRestore() : nothing}
          <div class="row" role="group" aria-label="View">
            ${(["capture", "dossier", "register", "brief"] as Route[]).map(
              (r) =>
                html` <button aria-pressed=${this.route === r ? "true" : "false"} @click=${() => this.go(r)}>
                  ${r[0]!.toUpperCase() + r.slice(1)}
                </button>`
            )}
          </div>
          ${!this.ready
            ? html`<p>Loading…</p>`
            : this.route === "capture"
              ? this.renderCapture()
              : this.route === "dossier"
                ? this.renderDossier()
                : this.route === "register"
                  ? html`<pspf-register-view
                      .store=${this.store}
                      .writable=${this.writerMode === "writer"}
                      @register-changed=${() => this.refreshLiveRegister()}
                    ></pspf-register-view>`
                  : this.renderBrief()}
        </section>
      </main>`;
  }

  private renderRestore() {
    const { summary } = this.pendingRestore!;
    return html`<div class="card" role="alertdialog" aria-label="Confirm restore">
      <strong>Replace current data with this backup?</strong>
      <p>
        Created ${summary.createdAt}. ${summary.counts.matters} matters, ${summary.counts.trail} trail items,
        ${summary.counts.editions} editions, ${summary.counts.entities} entities, ${summary.counts.links} links, and
        ${summary.counts.changeLog} change entries. Newest update: ${summary.newestUpdate ?? "none"}.
      </p>
      <p class="muted">
        This full-register backup contains sensitive fields. Its change history begins in the workbench and does not
        include earlier Core or Git history. Current contents are kept unless restore completes; this backup may contain
        data you have since erased.
      </p>
      <button ?disabled=${this.writerMode !== "writer"} @click=${() => this.confirmRestore()}>Replace</button>
      <button
        @click=${() => {
          this.pendingRestore = undefined;
        }}
      >
        Cancel
      </button>
    </div>`;
  }

  private renderCapture() {
    return html` <label for="cap">Paste a recap, email or note in the capture format</label>
      <textarea id="cap" .value=${this.captureText} @input=${this.onCaptureInput}></textarea>
      <div class="row">
        <label
          >Capture source<select
            .value=${this.captureProvenance}
            ?disabled=${this.writerMode !== "writer"}
            @change=${(event: Event) => {
              this.captureProvenance = (event.target as HTMLSelectElement).value as Provenance;
            }}
          >
            <option value="typed">Typed by operator</option>
            <option value="parsed">Pasted source text</option>
            <option value="ai-draft">Pasted from Copilot</option>
          </select></label
        >
        <button @click=${() => this.parse()}>Parse into drafts</button>
        <button @click=${() => navigator.clipboard?.writeText(COPILOT_PROMPT_TEMPLATE)}>Copy Copilot prompt</button>
        <span class="muted"
          >${this.selected
            ? `Accepting into: ${this.matter?.title}`
            : "Select or create a matter to accept drafts."}</span
        >
      </div>
      ${this.drafts.map(
        (d, i) =>
          html` <div class="card">
            <strong>${d.type}</strong> <span class=${d.state === "known" ? "" : "unknown"}>(${d.state})</span>
            ${d.disposition ? html` · ${d.disposition}` : nothing}
            <div>${d.value || html`<em>No text</em>`}</div>
            <div class="muted">Source: ${d.source.label}</div>
            ${d.warnings.map((w) => html`<div class="unknown">${w}</div>`)}
            ${this.suggestionsFor(d).map(
              (s) =>
                html`<div class="muted">Possible match (${s.basis}): ${s.candidate.title} (${s.candidate.id})</div>`
            )}
            <div class="row">
              <button ?disabled=${!this.selected || this.writerMode !== "writer"} @click=${() => this.accept(i)}>
                Accept into matter
              </button>
              <button
                @click=${() => {
                  this.drafts = this.drafts.filter((_, j) => j !== i);
                }}
              >
                Discard
              </button>
            </div>
          </div>`
      )}`;
  }

  private renderDossier() {
    const d = this.dossier;
    if (!d) return html`<p>Select or create a matter.</p>`;
    const m = d.matter;
    return html` <h2>${m.title}</h2>
      <div class="row">
        <label
          >Follow-up
          <select
            @change=${(e: Event) =>
              this.updateMatter({ followUpState: (e.target as HTMLSelectElement).value as FollowUpState })}
          >
            ${FOLLOW_UP_STATES.map((s) => html`<option value=${s} ?selected=${m.followUpState === s}>${s}</option>`)}
          </select></label
        >
        <button @click=${() => this.updateMatter({ lastReviewedAt: new Date().toISOString() })}>Mark reviewed</button>
        <button @click=${() => this.eraseMatter()}>Erase matter</button>
      </div>
      <label for="scope">Scope</label>
      <input
        id="scope"
        .value=${m.scope}
        @change=${(e: Event) => this.updateMatter({ scope: (e.target as HTMLInputElement).value })}
      />
      <label for="outcome">Intended outcome</label>
      <input
        id="outcome"
        .value=${m.intendedOutcome}
        @change=${(e: Event) => this.updateMatter({ intendedOutcome: (e.target as HTMLInputElement).value })}
      />
      <label for="next">Next step</label>
      <input
        id="next"
        size="60"
        .value=${m.nextStep}
        @change=${(e: Event) => this.updateMatter({ nextStep: (e.target as HTMLInputElement).value })}
      />
      ${d.warnings.map((w) => html`<div class="banner">${w}</div>`)}
      <h3>Where things stand</h3>
      ${d.positions.map(
        (p) =>
          html`<div class="card">
            <strong>${p.type}</strong>:
            ${p.item && !p.unknown
              ? html`${p.item.value}
                  <span class="muted"
                    >(${p.item.source?.label ?? "no source"}${p.item.disposition
                      ? ` · ${p.item.disposition}`
                      : ""})</span
                  >`
              : html`<span class="unknown"
                  >${p.item?.state === "no-response-recorded" ? "No response recorded" : "Unknown"}</span
                >`}
          </div>`
      )}
      <h3>Changes</h3>
      <p class="muted">
        ${d.sinceReview.length} since last review · ${d.sinceIssue.length} since last issued
        edition${d.latestEdition ? ` (${d.latestEdition.issuedAt.slice(0, 10)})` : ""}
      </p>
      <h3>References</h3>
      ${m.refs.length === 0
        ? html`<p class="muted">None.</p>`
        : html`<ul>
            ${m.refs.map(
              (r) =>
                html`<li>
                  ${r.label} (${r.targetId}):
                  ${this.registerItems.length > 0
                    ? liveReferenceStatus(r, this.registerItems)
                    : referenceStatus(
                        r,
                        this.snapshot,
                        r.snapshotId ? this.checkedSnapshots.get(r.snapshotId) : undefined
                      )}
                </li>`
            )}
          </ul>`}
      ${this.registerItems.length > 0 || this.snapshot
        ? html` <label for="ref">Link a register item (ID or words from the title)</label>
            <input
              id="ref"
              size="50"
              .value=${this.refQuery}
              @input=${(e: Event) => {
                this.refQuery = (e.target as HTMLInputElement).value;
              }}
            />
            ${this.refQuery
              ? this.registerItems.length > 0
                ? suggestMatches(
                    this.refQuery,
                    this.registerItems
                      .filter(
                        (record) =>
                          record.entityType === "requirement" ||
                          record.entityType === "risk" ||
                          record.entityType === "action" ||
                          record.entityType === "narrative"
                      )
                      .map((record) => ({ id: record.id, title: liveRegisterTitle(record) }))
                  ).map(
                    (suggestion) =>
                      html`<div>
                        <button @click=${() => this.linkLiveReference(suggestion.candidate.id)}>Link</button>
                        ${suggestion.candidate.title}
                        <span class="muted">(${suggestion.candidate.id}, ${suggestion.basis})</span>
                      </div>`
                  )
                : suggestMatches(this.refQuery, this.snapshot?.items ?? []).map(
                    (s) =>
                      html`<div>
                        <button @click=${() => this.linkRef(s.candidate as RegisterSnapshot["items"][number])}>
                          Link
                        </button>
                        ${s.candidate.title} <span class="muted">(${s.candidate.id}, ${s.basis})</span>
                      </div>`
                  )
              : nothing}`
        : nothing}
      <h3>Issued editions</h3>
      ${this.editions.length === 0
        ? html`<p class="muted">None.</p>`
        : html`<ul>
            ${this.editions.map((e) => html`<li>${e.issuedAt.slice(0, 10)} · ${e.audience} · ${e.occasion}</li>`)}
          </ul>`}`;
  }

  private renderBrief() {
    const d = this.dossier;
    if (!d) return html`<p>Select or create a matter.</p>`;
    const r = this.redaction;
    return html` <div class="row">
        <label
          >Profile
          <select
            @change=${(e: Event) => {
              this.profile = (e.target as HTMLSelectElement).value as ProfileId;
            }}
          >
            ${PROFILE_IDS.map(
              (p) => html`<option value=${p} ?selected=${this.profile === p}>${PROFILES[p].label}</option>`
            )}
          </select></label
        >
        <button @click=${() => this.compose()}>Compose from dossier</button>
      </div>
      <p class="muted">
        Readiness: ${PROFILES[this.profile].readiness.join("; ")}. Unanswered:
        ${profileAnswers(d, this.profile).filter((a) => a.unknown).length}.
      </p>
      <label for="brief">Brief (edit before issuing)</label>
      <textarea id="brief" .value=${this.briefText} @input=${this.onBriefInput}></textarea>
      <label for="aud">Audience</label
      ><input
        id="aud"
        .value=${this.audience}
        @input=${(e: Event) => {
          this.audience = (e.target as HTMLInputElement).value;
        }}
      />
      <label for="occ">Occasion</label
      ><input
        id="occ"
        .value=${this.occasion}
        @input=${(e: Event) => {
          this.occasion = (e.target as HTMLInputElement).value;
        }}
      />
      <label for="ppl">Names to remove (comma separated)</label
      ><input
        id="ppl"
        size="50"
        .value=${this.people}
        @input=${(e: Event) => {
          this.people = (e.target as HTMLInputElement).value;
        }}
      />
      <h3>Preview</h3>
      <p class="muted">
        ${r.summary.length ? r.summary.join("; ") : "No redactions needed."} Selecting a profile does not widen
        disclosure.
      </p>
      <pre>${r.text}</pre>
      <button @click=${() => this.issue()}>Issue and publish Markdown</button>`;
  }
}
