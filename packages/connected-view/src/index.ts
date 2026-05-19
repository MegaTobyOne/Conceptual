import type {
  ActionEntity,
  AssessmentStatus,
  DirectionEntity,
  DirectionResponseState,
  DomainEntity,
  LinkEntity,
  RequirementEntity,
  RiskEntity
} from "@pspf/contracts";

/**
 * PSPF Connected View — shared renderer for Workshop (interactive panel) and
 * Explorer (publication-mode static site).
 *
 * The view shows Requirements (optionally grouped by domain) alongside Risks
 * and Actions, with Directions as an optional left-hand lane. Curved SVG
 * connectors trace the chain Direction → Requirement → Risk → Action and any
 * direct Requirement → Action supports. Single-click selects, Cmd/Ctrl-click
 * adds to selection; the full connected chain lights up.
 *
 * No raw narrative or restricted field is ever included — only titles,
 * references, and small status badges that are already published surface in
 * existing v0.1 views.
 */

/* -------------------- input + model types -------------------- */

export interface ConnectedViewInput {
  readonly requirements: readonly RequirementEntity[];
  readonly risks: readonly RiskEntity[];
  readonly actions: readonly ActionEntity[];
  readonly directions?: readonly DirectionEntity[];
  readonly links: readonly LinkEntity[];
  readonly domains: readonly Pick<DomainEntity, "id" | "title" | "code" | "sortOrder">[];
}

export type ConnectedViewNodeKind = "direction" | "requirement" | "risk" | "action";

export type ConnectedViewBadgeTone =
  | "ok"
  | "partial"
  | "gap"
  | "info"
  | "warn"
  | "danger"
  | "neutral";

export interface ConnectedViewBadge {
  readonly label: string;
  readonly tone: ConnectedViewBadgeTone;
}

export interface ConnectedViewNode {
  readonly id: string;
  readonly kind: ConnectedViewNodeKind;
  readonly title: string;
  readonly reference: string;
  readonly domainCode?: string;
  readonly badges: readonly ConnectedViewBadge[];
}

export interface ConnectedViewEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly linkType: string;
}

export interface ConnectedViewLane {
  readonly id: string;
  readonly title: string;
  readonly kind: "directions" | "requirements" | "risks" | "actions";
  readonly domainCode?: string;
  readonly nodeIds: readonly string[];
}

export interface ConnectedViewModel {
  readonly nodes: readonly ConnectedViewNode[];
  readonly edges: readonly ConnectedViewEdge[];
  readonly domains: readonly { readonly id: string; readonly code: string; readonly title: string }[];
  readonly groupedLanes: readonly ConnectedViewLane[];
  readonly compactLanes: readonly ConnectedViewLane[];
}

/* -------------------- link verbs we surface -------------------- */

const DIRECTION_TO_REQUIREMENT_LINKS = new Set(["targets"]);
const REQUIREMENT_TO_RISK_LINKS = new Set(["exposed-by", "treated-by"]);
const RISK_TO_ACTION_LINKS = new Set(["addressed-by", "treated-by"]);
const REQUIREMENT_TO_ACTION_LINKS = new Set(["supported-by", "addressed-by"]);
const DIRECTION_TO_ACTION_LINKS = new Set(["addressed-by", "supported-by"]);

/* -------------------- builder -------------------- */

export function buildConnectedViewModel(input: ConnectedViewInput): ConnectedViewModel {
  const domains = input.domains
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((domain) => ({ id: domain.id, code: domain.code, title: domain.title }));
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));

  const directionNodes: ConnectedViewNode[] = (input.directions ?? []).map((direction) => ({
    id: direction.id,
    kind: "direction",
    title: direction.title,
    reference: direction.reference,
    badges: directionBadges(direction)
  }));

  const requirementNodes: ConnectedViewNode[] = input.requirements.map((requirement) => ({
    id: requirement.id,
    kind: "requirement",
    title: requirement.title,
    reference: shortRequirementRef(requirement),
    domainCode: domainById.get(requirement.domainId)?.code,
    badges: [statusBadge(requirement.assessmentStatus)]
  }));

  const riskNodes: ConnectedViewNode[] = input.risks.map((risk) => ({
    id: risk.id,
    kind: "risk",
    title: risk.title,
    reference: shortIdRef(risk.id),
    badges: [riskBadge(risk)]
  }));

  const actionNodes: ConnectedViewNode[] = input.actions.map((action) => ({
    id: action.id,
    kind: "action",
    title: action.title,
    reference: shortIdRef(action.id),
    badges: actionBadges(action)
  }));

  const nodes = [...directionNodes, ...requirementNodes, ...riskNodes, ...actionNodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = edgesFromLinks(input.links, nodeIds);

  const directionsLane: ConnectedViewLane = {
    id: "lane-directions",
    title: "Directions",
    kind: "directions",
    nodeIds: directionNodes.map((node) => node.id)
  };

  const groupedRequirementLanes: ConnectedViewLane[] = domains
    .map((domain) => ({
      id: `lane-req-${domain.code}`,
      title: domain.title,
      kind: "requirements" as const,
      domainCode: domain.code,
      nodeIds: requirementNodes
        .filter((node) => node.domainCode === domain.code)
        .map((node) => node.id)
    }))
    .filter((lane) => lane.nodeIds.length > 0);

  const compactRequirementsLane: ConnectedViewLane = {
    id: "lane-requirements",
    title: "Requirements",
    kind: "requirements",
    nodeIds: requirementNodes.map((node) => node.id)
  };

  const risksLane: ConnectedViewLane = {
    id: "lane-risks",
    title: "Risks",
    kind: "risks",
    nodeIds: riskNodes.map((node) => node.id)
  };

  const actionsLane: ConnectedViewLane = {
    id: "lane-actions",
    title: "Actions",
    kind: "actions",
    nodeIds: actionNodes.map((node) => node.id)
  };

  return {
    nodes,
    edges,
    domains,
    groupedLanes: [directionsLane, ...groupedRequirementLanes, risksLane, actionsLane],
    compactLanes: [directionsLane, compactRequirementsLane, risksLane, actionsLane]
  };
}

function edgesFromLinks(links: readonly LinkEntity[], nodeIds: ReadonlySet<string>): ConnectedViewEdge[] {
  const edges: ConnectedViewEdge[] = [];
  for (const link of links) {
    if (!nodeIds.has(link.fromId) || !nodeIds.has(link.toId)) {
      continue;
    }
    if (link.fromId === link.toId) {
      continue;
    }
    if (isOrientedEdge(link)) {
      edges.push({ fromId: link.fromId, toId: link.toId, linkType: link.linkType });
    } else if (isReverseOrientedEdge(link)) {
      edges.push({ fromId: link.toId, toId: link.fromId, linkType: link.linkType });
    }
  }
  return edges;
}

function isOrientedEdge(link: LinkEntity): boolean {
  if (link.fromType === "direction" && link.toType === "requirement" && DIRECTION_TO_REQUIREMENT_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "requirement" && link.toType === "risk" && REQUIREMENT_TO_RISK_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "risk" && link.toType === "action" && RISK_TO_ACTION_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "requirement" && link.toType === "action" && REQUIREMENT_TO_ACTION_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "direction" && link.toType === "action" && DIRECTION_TO_ACTION_LINKS.has(link.linkType)) {
    return true;
  }
  return false;
}

function isReverseOrientedEdge(link: LinkEntity): boolean {
  if (link.fromType === "risk" && link.toType === "requirement" && REQUIREMENT_TO_RISK_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "action" && link.toType === "risk" && RISK_TO_ACTION_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "action" && link.toType === "requirement" && REQUIREMENT_TO_ACTION_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "requirement" && link.toType === "direction" && DIRECTION_TO_REQUIREMENT_LINKS.has(link.linkType)) {
    return true;
  }
  if (link.fromType === "action" && link.toType === "direction" && DIRECTION_TO_ACTION_LINKS.has(link.linkType)) {
    return true;
  }
  return false;
}

/* -------------------- badge helpers -------------------- */

function statusBadge(status: AssessmentStatus): ConnectedViewBadge {
  switch (status) {
    case "met":
      return { label: "Met", tone: "ok" };
    case "partially-met":
      return { label: "Partially met", tone: "partial" };
    case "not-met":
      return { label: "Not met", tone: "gap" };
    case "in-progress":
      return { label: "In progress", tone: "info" };
    case "under-review":
      return { label: "Under review", tone: "info" };
    case "not-applicable":
      return { label: "N/A", tone: "neutral" };
    default:
      return { label: "Not started", tone: "neutral" };
  }
}

function riskBadge(risk: RiskEntity): ConnectedViewBadge {
  const score = Math.max(1, Math.min(5, risk.likelihood)) * Math.max(1, Math.min(5, risk.impact));
  if (risk.status === "closed") {
    return { label: "Closed", tone: "neutral" };
  }
  if (score >= 16) {
    return { label: "High", tone: "danger" };
  }
  if (score >= 9) {
    return { label: "Medium", tone: "warn" };
  }
  return { label: "Low", tone: "info" };
}

function actionBadges(action: ActionEntity): readonly ConnectedViewBadge[] {
  const status = actionStatusBadge(action.status);
  if (action.impact?.urgency === "overdue") {
    return [status, { label: "Overdue", tone: "danger" }];
  }
  if (action.impact?.urgency === "blocked") {
    return [status, { label: "Blocked", tone: "warn" }];
  }
  if (action.impact?.urgency === "due-soon") {
    return [status, { label: "Due soon", tone: "warn" }];
  }
  return [status];
}

function actionStatusBadge(status: ActionEntity["status"]): ConnectedViewBadge {
  switch (status) {
    case "done":
      return { label: "Done", tone: "ok" };
    case "in-progress":
      return { label: "In progress", tone: "info" };
    case "blocked":
      return { label: "Blocked", tone: "warn" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "todo":
    default:
      return { label: "To do", tone: "neutral" };
  }
}

function directionBadges(direction: DirectionEntity): readonly ConnectedViewBadge[] {
  const responseLabel = directionResponseLabel(direction.responseState);
  return [responseLabel];
}

function directionResponseLabel(state: DirectionResponseState): ConnectedViewBadge {
  switch (state) {
    case "yes":
      return { label: "Yes", tone: "ok" };
    case "no":
      return { label: "No", tone: "gap" };
    case "risk-managed":
      return { label: "Risk-managed", tone: "warn" };
    default:
      return { label: "Not set", tone: "neutral" };
  }
}

/* -------------------- short refs -------------------- */

function shortRequirementRef(requirement: RequirementEntity): string {
  return shortIdRef(requirement.id);
}

function shortIdRef(id: string): string {
  const prefix = id.split("-", 1)[0] ?? id;
  const tail = id.slice(-6).toUpperCase();
  return `${prefix}-${tail}`;
}

/* -------------------- render: HTML body -------------------- */

export interface ConnectedViewRenderOptions {
  readonly mode?: "workshop" | "explorer";
  readonly defaultLayout?: "domains" | "compact";
  readonly title?: string;
  readonly subtitle?: string;
  readonly showDirectionsLane?: boolean;
}

/**
 * Returns a self-contained HTML fragment for the connected view, including a
 * scoped <style> block, the lane shell, and an inline data island. The host
 * page is responsible for adding the browser script (see
 * CONNECTED_VIEW_BROWSER_SCRIPT) once per page.
 */
export function renderConnectedViewBodyHtml(model: ConnectedViewModel, options: ConnectedViewRenderOptions = {}): string {
  const mode = options.mode ?? "workshop";
  const defaultLayout = options.defaultLayout ?? (mode === "explorer" ? "compact" : "domains");
  const showDirections = options.showDirectionsLane ?? true;
  const lanes = defaultLayout === "compact" ? model.compactLanes : model.groupedLanes;
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const initialClass = defaultLayout === "compact" ? "layout-compact" : "layout-grouped";

  const dataPayload = JSON.stringify({
    edges: model.edges,
    grouped: model.groupedLanes,
    compact: model.compactLanes,
    domains: model.domains
  });

  const laneHtml = lanes
    .map((lane) => renderLaneHtml(lane, nodesById, mode))
    .join("");

  return `
<div class="pspf-connected-view ${initialClass}" data-pspf-connected-view data-default-layout="${defaultLayout}" data-mode="${mode}">
  <header class="cv-toolbar">
    <div class="cv-title">
      <strong>${escapeHtml(options.title ?? "Connected View")}</strong>
      <span class="cv-subtitle">${escapeHtml(options.subtitle ?? "Requirements ↔ Risks ↔ Actions")}</span>
    </div>
    <div class="cv-controls">
      <button type="button" class="cv-chip cv-chip-layout" data-cv-action="toggle-layout" aria-pressed="${defaultLayout === "compact" ? "true" : "false"}">
        <span class="cv-chip-label">Layout:</span>
        <span class="cv-chip-value" data-cv-layout-label>${defaultLayout === "compact" ? "Compact" : "Domain lanes"}</span>
      </button>
      <button type="button" class="cv-chip cv-chip-directions" data-cv-action="toggle-directions" aria-pressed="${showDirections ? "true" : "false"}">
        <span class="cv-dot cv-dot-directions"></span>Directions
      </button>
      <button type="button" class="cv-chip" data-cv-lane-toggle="requirements" aria-pressed="true">Requirements</button>
      <button type="button" class="cv-chip" data-cv-lane-toggle="risks" aria-pressed="true">Risks</button>
      <button type="button" class="cv-chip" data-cv-lane-toggle="actions" aria-pressed="true">Actions</button>
      <button type="button" class="cv-chip" data-cv-action="zoom-out" aria-label="Zoom out">−</button>
      <span class="cv-zoom-level" data-cv-zoom-label>100%</span>
      <button type="button" class="cv-chip" data-cv-action="zoom-in" aria-label="Zoom in">+</button>
      <button type="button" class="cv-chip" data-cv-action="zoom-reset">Reset</button>
      <button type="button" class="cv-chip cv-chip-clear" data-cv-action="clear" hidden>Clear selection</button>
      <button type="button" class="cv-chip cv-chip-refresh" data-cv-action="refresh" title="Refresh" aria-label="Refresh">↻ Refresh</button>
      <span class="cv-hint">Click to select · ${platformModifierHint()}-click for multiple · Hover for details · Double-click to open</span>
    </div>
  </header>
  <div class="cv-board" data-cv-board>
    ${laneHtml}
    <svg class="cv-links" aria-hidden="true" data-cv-links></svg>
  </div>
  <div class="cv-hover" data-cv-hover hidden></div>
  <script type="application/json" data-cv-data>${dataPayload.replace(/</g, "\\u003c")}</script>
</div>`;
}

function renderLaneHtml(lane: ConnectedViewLane, nodesById: Map<string, ConnectedViewNode>, mode: "workshop" | "explorer"): string {
  const cards = lane.nodeIds
    .map((id) => nodesById.get(id))
    .filter((node): node is ConnectedViewNode => Boolean(node))
    .map((node) => renderCardHtml(node, mode))
    .join("");
  const laneKindClass = `cv-lane-${lane.kind}`;
  const domainClass = lane.domainCode ? ` cv-lane-domain cv-domain-${lane.domainCode}` : "";
  const visibleByDefault = lane.kind === "directions" ? "" : "";
  const emptyMarker = lane.nodeIds.length === 0 ? '<p class="cv-empty">None</p>' : "";
  return `
<section class="cv-lane ${laneKindClass}${domainClass}" data-cv-lane="${escapeAttr(lane.id)}" data-cv-lane-kind="${lane.kind}"${lane.domainCode ? ` data-cv-domain="${escapeAttr(lane.domainCode)}"` : ""}${visibleByDefault}>
  <header class="cv-lane-header">
    <span class="cv-lane-dot"></span>
    <h2>${escapeHtml(lane.title)}</h2>
    <span class="cv-lane-count">${lane.nodeIds.length}</span>
  </header>
  <div class="cv-lane-cards">${cards}${emptyMarker}</div>
</section>`;
}

function renderCardHtml(node: ConnectedViewNode, mode: "workshop" | "explorer"): string {
  const badgeLabels = node.badges.map((badge) => badge.label).join(" · ");
  const tooltipText = badgeLabels
    ? `${node.reference} — ${node.title}\n${badgeLabels}`
    : `${node.reference} — ${node.title}`;
  const domainAttr = node.domainCode ? ` data-cv-domain="${escapeAttr(node.domainCode)}"` : "";
  const detailAttr = badgeLabels ? ` data-cv-detail="${escapeAttr(badgeLabels)}"` : "";
  const openButton = mode === "workshop"
    ? `<button type="button" class="cv-card-open" data-command="openEntity" data-entity-type="${escapeAttr(node.kind)}" data-entity-id="${escapeAttr(node.id)}" aria-label="Open ${escapeAttr(node.kind)} detail" tabindex="-1">Open</button>`
    : "";
  return `
<article class="cv-card cv-card-${node.kind}" data-cv-card data-cv-id="${escapeAttr(node.id)}" data-cv-kind="${node.kind}"${domainAttr}${detailAttr} tabindex="0" aria-label="${escapeAttr(tooltipText)}">
  <div class="cv-card-ref">${escapeHtml(node.reference)}</div>
  <div class="cv-card-title">${escapeHtml(node.title)}</div>
  ${openButton}
</article>`;
}

function platformModifierHint(): string {
  return "Cmd/Ctrl";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

/* -------------------- styles -------------------- */

export const CONNECTED_VIEW_STYLES = String.raw`
.pspf-connected-view {
  --cv-bg: var(--vscode-editor-background, #141311);
  --cv-surface: var(--vscode-input-background, #1d1b17);
  --cv-surface-strong: color-mix(in srgb, var(--vscode-input-background, #25221d) 90%, #ffffff 4%);
  --cv-border: var(--vscode-panel-border, #2a3140);
  --cv-text: var(--vscode-foreground, #e6e9ef);
  --cv-muted: var(--vscode-descriptionForeground, #8a93a3);
  --cv-accent: var(--vscode-textLink-foreground, #4f8cff);
  --cv-dom-governance: #6ea8ff;
  --cv-dom-security-risk: #f0a36d;
  --cv-dom-information: #7ad3a3;
  --cv-dom-technology: #b39bff;
  --cv-dom-personnel: #f0c36d;
  --cv-dom-physical: #d59bff;
  --cv-risk: #ff8c8c;
  --cv-action: #5dd4c2;
  --cv-direction: #87a8ff;
  --cv-line: color-mix(in srgb, var(--cv-muted) 55%, transparent);
  --cv-line-sel: var(--cv-accent);
  position: relative;
  display: flex;
  flex-direction: column;
  --cv-zoom: 1;
  color: var(--cv-text);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
}
.pspf-connected-view * { box-sizing: border-box; }

.cv-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 10px 12px;
  border: 1px solid var(--cv-border); border-radius: 8px 8px 0 0;
  background: var(--cv-surface);
}
.cv-title strong { font-size: 14px; font-weight: 600; }
.cv-title .cv-subtitle { color: var(--cv-muted); font-size: 12px; margin-left: 8px; }
.cv-controls { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.cv-hint { color: var(--cv-muted); font-size: 11.5px; margin-left: 6px; }

.cv-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--cv-border); background: var(--cv-surface-strong);
  color: var(--cv-text); font: inherit; cursor: pointer;
}
.cv-chip[aria-pressed="false"] { opacity: 0.55; }
.cv-chip-label { color: var(--cv-muted); }
.cv-zoom-level { color: var(--cv-muted); font-size: 11.5px; min-width: 38px; text-align: center; }
.cv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cv-muted); }
.cv-dot-directions { background: var(--cv-direction); }

.cv-board {
  position: relative;
  display: grid; gap: 12px; padding: 14px;
  border: 1px solid var(--cv-border); border-top: 0;
  border-radius: 0 0 8px 8px;
  background: color-mix(in srgb, var(--cv-bg) 90%, transparent);
  min-height: 480px;
  overflow: auto;
  zoom: var(--cv-zoom);
}
.cv-lane.cv-lane-hidden { display: none !important; }
.pspf-connected-view.layout-grouped .cv-board {
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 1fr);
}
.pspf-connected-view.layout-compact .cv-board {
  grid-template-columns: minmax(260px, 1.3fr) minmax(260px, 1fr) minmax(260px, 1fr);
}
.pspf-connected-view.layout-compact .cv-lane-domain { display: none; }
.pspf-connected-view.layout-compact [data-cv-lane="lane-requirements"] { display: flex; }
.pspf-connected-view.layout-grouped [data-cv-lane="lane-requirements"] { display: none; }

.cv-lane {
  display: flex; flex-direction: column;
  background: var(--cv-surface);
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  min-height: 360px;
}
.cv-lane-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--cv-border);
}
.cv-lane-header h2 {
  margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--cv-muted); flex: 1;
}
.cv-lane-count {
  font-size: 11px; color: var(--cv-muted);
  padding: 1px 7px; border-radius: 999px; border: 1px solid var(--cv-border);
}
.cv-lane-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--cv-muted);
}
.cv-lane-directions .cv-lane-dot { background: var(--cv-direction); }
.cv-lane-risks .cv-lane-dot { background: var(--cv-risk); }
.cv-lane-actions .cv-lane-dot { background: var(--cv-action); }
.cv-lane-requirements .cv-lane-dot { background: linear-gradient(90deg, var(--cv-dom-governance), var(--cv-dom-information), var(--cv-dom-personnel), var(--cv-dom-physical)); }
.cv-domain-governance .cv-lane-dot { background: var(--cv-dom-governance); }
.cv-domain-security-risk .cv-lane-dot { background: var(--cv-dom-security-risk); }
.cv-domain-information .cv-lane-dot { background: var(--cv-dom-information); }
.cv-domain-technology .cv-lane-dot { background: var(--cv-dom-technology); }
.cv-domain-personnel .cv-lane-dot { background: var(--cv-dom-personnel); }
.cv-domain-physical .cv-lane-dot { background: var(--cv-dom-physical); }

.cv-lane-cards {
  padding: 8px; display: flex; flex-direction: column; gap: 6px;
  overflow: visible;
}
.cv-empty {
  margin: 6px; color: var(--cv-muted); font-size: 12px; text-align: center;
}

.cv-card {
  position: relative;
  background: var(--cv-surface-strong);
  border: 1px solid var(--cv-border);
  border-left: 3px solid color-mix(in srgb, var(--cv-muted) 50%, transparent);
  border-radius: 6px;
  padding: 7px 9px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, opacity 200ms ease;
  outline: none;
}
.cv-card:hover { background: color-mix(in srgb, var(--cv-surface-strong) 85%, var(--cv-accent) 10%); }
.cv-card:focus-visible { outline: 2px solid var(--cv-accent); outline-offset: 1px; }
.cv-card-ref {
  font-size: 10.5px; color: var(--cv-muted);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: 0.3px;
}
.cv-card-title {
  font-size: 12.5px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-clamp: 2;
  overflow-wrap: anywhere; line-height: 1.3;
}
.cv-badge {
  font-size: 10.5px; padding: 1px 7px; border-radius: 999px;
  border: 1px solid var(--cv-border); color: var(--cv-muted);
  background: color-mix(in srgb, var(--cv-surface) 60%, transparent);
}
.cv-badge-ok { color: var(--cv-action); border-color: color-mix(in srgb, var(--cv-action) 50%, transparent); }
.cv-badge-info { color: var(--cv-accent); border-color: color-mix(in srgb, var(--cv-accent) 50%, transparent); }
.cv-badge-partial { color: var(--cv-dom-personnel); border-color: color-mix(in srgb, var(--cv-dom-personnel) 50%, transparent); }
.cv-badge-warn { color: var(--cv-dom-security-risk); border-color: color-mix(in srgb, var(--cv-dom-security-risk) 50%, transparent); }
.cv-badge-gap, .cv-badge-danger { color: var(--cv-risk); border-color: color-mix(in srgb, var(--cv-risk) 50%, transparent); }
.cv-badge-neutral { color: var(--cv-muted); }

.cv-card-direction { border-left-color: var(--cv-direction); }
.cv-card-requirement[data-cv-domain="governance"]    { border-left-color: var(--cv-dom-governance); }
.cv-card-requirement[data-cv-domain="security-risk"] { border-left-color: var(--cv-dom-security-risk); }
.cv-card-requirement[data-cv-domain="information"]   { border-left-color: var(--cv-dom-information); }
.cv-card-requirement[data-cv-domain="technology"]    { border-left-color: var(--cv-dom-technology); }
.cv-card-requirement[data-cv-domain="personnel"]     { border-left-color: var(--cv-dom-personnel); }
.cv-card-requirement[data-cv-domain="physical"]      { border-left-color: var(--cv-dom-physical); }
.cv-card-risk   { border-left-color: var(--cv-risk); }
.cv-card-action { border-left-color: var(--cv-action); }

.cv-card-open {
  position: absolute; top: 6px; right: 6px;
  font-size: 10.5px; padding: 1px 7px;
  border: 1px solid var(--cv-border); border-radius: 999px;
  background: var(--cv-surface);
  color: var(--cv-text);
  cursor: pointer;
  opacity: 0; transition: opacity 120ms ease;
}
.cv-card:hover .cv-card-open,
.cv-card.cv-selected .cv-card-open,
.cv-card.cv-connected .cv-card-open { opacity: 1; }

.pspf-connected-view.cv-has-selection .cv-card { opacity: 0.34; }
.cv-card.cv-selected,
.cv-card.cv-connected { opacity: 1 !important; }
.cv-card.cv-selected {
  outline: 2px solid var(--cv-accent);
  outline-offset: 1px;
  background: color-mix(in srgb, var(--cv-accent) 16%, var(--cv-surface-strong));
}
.cv-card.cv-connected {
  background: color-mix(in srgb, var(--cv-accent) 7%, var(--cv-surface-strong));
  border-color: color-mix(in srgb, var(--cv-accent) 35%, var(--cv-border));
}
.cv-card.cv-related-requirement {
  background: color-mix(in srgb, var(--cv-accent) 14%, var(--cv-surface-strong));
  border-color: color-mix(in srgb, var(--cv-accent) 65%, var(--cv-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--cv-accent) 35%, transparent);
}
.cv-card.cv-scroll-target { box-shadow: 0 0 0 3px color-mix(in srgb, var(--cv-accent) 55%, transparent); }

.cv-links {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none; overflow: visible;
}
.cv-links path {
  fill: none; stroke: var(--cv-line); stroke-width: 1.25;
  opacity: 0.35;
  transition: stroke 200ms ease, stroke-width 200ms ease, opacity 200ms ease;
}
.pspf-connected-view.cv-has-selection .cv-links path { opacity: 0.08; }
.cv-links path.cv-highlight {
  stroke: var(--cv-line-sel);
  stroke-width: 2;
  opacity: 1 !important;
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--cv-accent) 45%, transparent));
}

.cv-hover {
  position: absolute;
  width: 280px; max-width: calc(100% - 8px); max-height: 360px; overflow: auto;
  background: var(--cv-surface);
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  padding: 10px 12px 12px;
  font-size: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  pointer-events: none;
  z-index: 5;
}
.cv-hover[hidden] { display: none; }
.cv-hover h3 { margin: 0 0 4px; font-size: 13px; }
.cv-hover .cv-ref { color: var(--cv-muted); font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
.cv-hover .cv-section { margin-top: 8px; }
.cv-hover .cv-section h4 {
  margin: 0 0 3px; font-size: 10.5px; letter-spacing: 0.5px;
  text-transform: uppercase; color: var(--cv-muted);
}
.cv-hover ul { margin: 0; padding-left: 14px; list-style: disc; }
.cv-hover li { margin: 2px 0; }
.cv-hover .cv-hover-empty { color: var(--cv-muted); font-style: italic; }

@media (prefers-reduced-motion: reduce) {
  .cv-card, .cv-links path, .cv-card-open { transition: none; }
}
@media (max-width: 900px) {
  .pspf-connected-view.layout-grouped .cv-board,
  .pspf-connected-view.layout-compact .cv-board {
    grid-auto-flow: row;
    grid-auto-columns: unset;
    grid-template-columns: 1fr;
  }
}
`;

/* -------------------- browser script -------------------- */

/**
 * IIFE that initialises any `.pspf-connected-view` blocks on the page. Safe to
 * include multiple times — it self-de-duplicates via a sentinel.
 */
export const CONNECTED_VIEW_BROWSER_SCRIPT = String.raw`(() => {
  if (globalThis.__pspfConnectedViewInit) return;
  globalThis.__pspfConnectedViewInit = true;

  /* ---- shared model + HTML renderer (browser port) ---- */

  const DIR_TO_REQ = new Set(["targets"]);
  const REQ_TO_RISK = new Set(["exposed-by", "treated-by"]);
  const RISK_TO_ACT = new Set(["addressed-by", "treated-by"]);
  const REQ_TO_ACT = new Set(["supported-by", "addressed-by"]);
  const DIR_TO_ACT = new Set(["addressed-by", "supported-by"]);

  function shortIdRef(id) {
    const idStr = String(id || "");
    const dash = idStr.indexOf("-");
    const prefix = dash >= 0 ? idStr.slice(0, dash) : idStr;
    const tail = idStr.slice(-6).toUpperCase();
    return prefix + "-" + tail;
  }

  function statusBadge(s) {
    switch (s) {
      case "met": return { label: "Met", tone: "ok" };
      case "partially-met": return { label: "Partially met", tone: "partial" };
      case "not-met": return { label: "Not met", tone: "gap" };
      case "in-progress": return { label: "In progress", tone: "info" };
      case "under-review": return { label: "Under review", tone: "info" };
      case "not-applicable": return { label: "N/A", tone: "neutral" };
      default: return { label: "Not started", tone: "neutral" };
    }
  }
  function riskBadge(r) {
    const li = Math.max(1, Math.min(5, +r.likelihood || 1));
    const im = Math.max(1, Math.min(5, +r.impact || 1));
    const score = li * im;
    if (r.status === "closed") return { label: "Closed", tone: "neutral" };
    if (score >= 16) return { label: "High", tone: "danger" };
    if (score >= 9) return { label: "Medium", tone: "warn" };
    return { label: "Low", tone: "info" };
  }
  function actionStatusBadge(s) {
    switch (s) {
      case "done": return { label: "Done", tone: "ok" };
      case "in-progress": return { label: "In progress", tone: "info" };
      case "blocked": return { label: "Blocked", tone: "warn" };
      case "cancelled": return { label: "Cancelled", tone: "neutral" };
      default: return { label: "To do", tone: "neutral" };
    }
  }
  function actionBadges(a) {
    const st = actionStatusBadge(a.status);
    const u = a.impact && a.impact.urgency;
    if (u === "overdue") return [st, { label: "Overdue", tone: "danger" }];
    if (u === "blocked") return [st, { label: "Blocked", tone: "warn" }];
    if (u === "due-soon") return [st, { label: "Due soon", tone: "warn" }];
    return [st];
  }
  function directionBadges(d) {
    switch (d.responseState) {
      case "yes": return [{ label: "Yes", tone: "ok" }];
      case "no": return [{ label: "No", tone: "gap" }];
      case "risk-managed": return [{ label: "Risk-managed", tone: "warn" }];
      default: return [{ label: "Not set", tone: "neutral" }];
    }
  }

  function isOriented(l) {
    if (l.fromType === "direction" && l.toType === "requirement" && DIR_TO_REQ.has(l.linkType)) return true;
    if (l.fromType === "requirement" && l.toType === "risk" && REQ_TO_RISK.has(l.linkType)) return true;
    if (l.fromType === "risk" && l.toType === "action" && RISK_TO_ACT.has(l.linkType)) return true;
    if (l.fromType === "requirement" && l.toType === "action" && REQ_TO_ACT.has(l.linkType)) return true;
    if (l.fromType === "direction" && l.toType === "action" && DIR_TO_ACT.has(l.linkType)) return true;
    return false;
  }
  function isReverseOriented(l) {
    if (l.fromType === "risk" && l.toType === "requirement" && REQ_TO_RISK.has(l.linkType)) return true;
    if (l.fromType === "action" && l.toType === "risk" && RISK_TO_ACT.has(l.linkType)) return true;
    if (l.fromType === "action" && l.toType === "requirement" && REQ_TO_ACT.has(l.linkType)) return true;
    if (l.fromType === "requirement" && l.toType === "direction" && DIR_TO_REQ.has(l.linkType)) return true;
    if (l.fromType === "action" && l.toType === "direction" && DIR_TO_ACT.has(l.linkType)) return true;
    return false;
  }

  function buildModel(input) {
    const requirements = input.requirements || [];
    const risks = input.risks || [];
    const actions = input.actions || [];
    const directions = input.directions || [];
    const links = input.links || [];
    const domainsRaw = (input.domains || []).slice().sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    const domains = domainsRaw.map(function (d) { return { id: d.id, code: d.code, title: d.title }; });
    const domainById = new Map(domains.map(function (d) { return [d.id, d]; }));

    const directionNodes = directions.map(function (d) {
      return { id: d.id, kind: "direction", title: d.title, reference: d.reference || shortIdRef(d.id), badges: directionBadges(d) };
    });
    const requirementNodes = requirements.map(function (r) {
      const dom = domainById.get(r.domainId);
      return { id: r.id, kind: "requirement", title: r.title, reference: shortIdRef(r.id), domainCode: dom && dom.code, badges: [statusBadge(r.assessmentStatus)] };
    });
    const riskNodes = risks.map(function (r) {
      return { id: r.id, kind: "risk", title: r.title, reference: shortIdRef(r.id), badges: [riskBadge(r)] };
    });
    const actionNodes = actions.map(function (a) {
      return { id: a.id, kind: "action", title: a.title, reference: shortIdRef(a.id), badges: actionBadges(a) };
    });
    const nodes = directionNodes.concat(requirementNodes, riskNodes, actionNodes);
    const nodeIds = new Set(nodes.map(function (n) { return n.id; }));

    const edges = [];
    for (const link of links) {
      if (!nodeIds.has(link.fromId) || !nodeIds.has(link.toId)) continue;
      if (link.fromId === link.toId) continue;
      if (isOriented(link)) edges.push({ fromId: link.fromId, toId: link.toId, linkType: link.linkType });
      else if (isReverseOriented(link)) edges.push({ fromId: link.toId, toId: link.fromId, linkType: link.linkType });
    }

    const directionsLane = { id: "lane-directions", title: "Directions", kind: "directions", nodeIds: directionNodes.map(function (n) { return n.id; }) };
    const groupedReqLanes = domains.map(function (d) {
      return { id: "lane-req-" + d.code, title: d.title, kind: "requirements", domainCode: d.code, nodeIds: requirementNodes.filter(function (n) { return n.domainCode === d.code; }).map(function (n) { return n.id; }) };
    }).filter(function (l) { return l.nodeIds.length > 0; });
    const compactReqLane = { id: "lane-requirements", title: "Requirements", kind: "requirements", nodeIds: requirementNodes.map(function (n) { return n.id; }) };
    const risksLane = { id: "lane-risks", title: "Risks", kind: "risks", nodeIds: riskNodes.map(function (n) { return n.id; }) };
    const actionsLane = { id: "lane-actions", title: "Actions", kind: "actions", nodeIds: actionNodes.map(function (n) { return n.id; }) };

    return {
      nodes: nodes, edges: edges, domains: domains,
      groupedLanes: [directionsLane].concat(groupedReqLanes, [risksLane, actionsLane]),
      compactLanes: [directionsLane, compactReqLane, risksLane, actionsLane]
    };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(s) { return esc(s).replace(/'/g, "&#39;"); }

  function renderCard(node, mode) {
    const badgeLabels = (node.badges || []).map(function (b) { return b.label; }).join(" \u00b7 ");
    const tooltipText = badgeLabels
      ? node.reference + " \u2014 " + node.title + "\n" + badgeLabels
      : node.reference + " \u2014 " + node.title;
    const domainAttr = node.domainCode ? ' data-cv-domain="' + escAttr(node.domainCode) + '"' : "";
    const detailAttr = badgeLabels ? ' data-cv-detail="' + escAttr(badgeLabels) + '"' : "";
    const openBtn = mode === "workshop"
      ? '<button type="button" class="cv-card-open" data-command="openEntity" data-entity-type="' + escAttr(node.kind) + '" data-entity-id="' + escAttr(node.id) + '" aria-label="Open ' + escAttr(node.kind) + ' detail" tabindex="-1">Open</button>'
      : '';
    return '<article class="cv-card cv-card-' + esc(node.kind) + '" data-cv-card data-cv-id="' + escAttr(node.id) + '" data-cv-kind="' + esc(node.kind) + '"' + domainAttr + detailAttr + ' tabindex="0" aria-label="' + escAttr(tooltipText) + '">' +
      '<div class="cv-card-ref">' + esc(node.reference) + '</div>' +
      '<div class="cv-card-title">' + esc(node.title) + '</div>' +
      openBtn +
      '</article>';
  }
  function renderLane(lane, nodesById, mode) {
    const cards = lane.nodeIds.map(function (id) { return nodesById.get(id); }).filter(Boolean).map(function (n) { return renderCard(n, mode); }).join("");
    const empty = lane.nodeIds.length === 0 ? '<p class="cv-empty">None</p>' : "";
    const domainClass = lane.domainCode ? ' cv-lane-domain cv-domain-' + esc(lane.domainCode) : "";
    return '<section class="cv-lane cv-lane-' + esc(lane.kind) + domainClass + '" data-cv-lane="' + escAttr(lane.id) + '" data-cv-lane-kind="' + esc(lane.kind) + '"' + (lane.domainCode ? ' data-cv-domain="' + escAttr(lane.domainCode) + '"' : '') + '>' +
      '<header class="cv-lane-header"><span class="cv-lane-dot"></span><h2>' + esc(lane.title) + '</h2><span class="cv-lane-count">' + lane.nodeIds.length + '</span></header>' +
      '<div class="cv-lane-cards">' + cards + empty + '</div>' +
      '</section>';
  }

  function renderHtml(model, options) {
    const opts = options || {};
    const mode = opts.mode || "workshop";
    const defaultLayout = opts.defaultLayout || (mode === "explorer" ? "compact" : "domains");
    const lanes = defaultLayout === "compact" ? model.compactLanes : model.groupedLanes;
    const nodesById = new Map(model.nodes.map(function (n) { return [n.id, n]; }));
    const initialClass = defaultLayout === "compact" ? "layout-compact" : "layout-grouped";
    const title = opts.title || "Connected View";
    const subtitle = opts.subtitle || "Requirements \u2194 Risks \u2194 Actions";
    const showDirections = opts.showDirectionsLane !== false;
    const dataPayload = JSON.stringify({ edges: model.edges, grouped: model.groupedLanes, compact: model.compactLanes, domains: model.domains }).replace(/</g, "\\u003c");
    const laneHtml = lanes.map(function (l) { return renderLane(l, nodesById, mode); }).join("");
    return '<div class="pspf-connected-view ' + initialClass + '" data-pspf-connected-view data-default-layout="' + defaultLayout + '" data-mode="' + mode + '">' +
      '<header class="cv-toolbar">' +
        '<div class="cv-title"><strong>' + esc(title) + '</strong><span class="cv-subtitle">' + esc(subtitle) + '</span></div>' +
        '<div class="cv-controls">' +
          '<button type="button" class="cv-chip cv-chip-layout" data-cv-action="toggle-layout" aria-pressed="' + (defaultLayout === "compact" ? "true" : "false") + '"><span class="cv-chip-label">Layout:</span><span class="cv-chip-value" data-cv-layout-label>' + (defaultLayout === "compact" ? "Compact" : "Domain lanes") + '</span></button>' +
          '<button type="button" class="cv-chip cv-chip-directions" data-cv-action="toggle-directions" aria-pressed="' + (showDirections ? "true" : "false") + '"><span class="cv-dot cv-dot-directions"></span>Directions</button>' +
          '<button type="button" class="cv-chip" data-cv-lane-toggle="requirements" aria-pressed="true">Requirements</button>' +
          '<button type="button" class="cv-chip" data-cv-lane-toggle="risks" aria-pressed="true">Risks</button>' +
          '<button type="button" class="cv-chip" data-cv-lane-toggle="actions" aria-pressed="true">Actions</button>' +
          '<button type="button" class="cv-chip" data-cv-action="zoom-out" aria-label="Zoom out">-</button>' +
          '<span class="cv-zoom-level" data-cv-zoom-label>100%</span>' +
          '<button type="button" class="cv-chip" data-cv-action="zoom-in" aria-label="Zoom in">+</button>' +
          '<button type="button" class="cv-chip" data-cv-action="zoom-reset">Reset</button>' +
          '<button type="button" class="cv-chip cv-chip-clear" data-cv-action="clear" hidden>Clear selection</button>' +
          '<button type="button" class="cv-chip cv-chip-refresh" data-cv-action="refresh" title="Refresh" aria-label="Refresh">\u21bb Refresh</button>' +
          '<span class="cv-hint">Click to select \u00b7 Cmd/Ctrl-click for multiple \u00b7 Hover for details \u00b7 Double-click to open</span>' +
        '</div>' +
      '</header>' +
      '<div class="cv-board" data-cv-board>' + laneHtml + '<svg class="cv-links" aria-hidden="true" data-cv-links></svg></div>' +
      '<div class="cv-hover" data-cv-hover hidden></div>' +
      '<script type="application/json" data-cv-data>' + dataPayload + '<\/script>' +
      '</div>';
  }

  function renderInto(mountEl, input, options) {
    if (!mountEl) return null;
    const model = buildModel(input || {});
    mountEl.innerHTML = renderHtml(model, options);
    const root = mountEl.querySelector("[data-pspf-connected-view]");
    if (root) init(root);
    return root;
  }

  /* ---- interactive runtime ---- */

  function init(root) {
    if (root.dataset.cvInited === "1") return;
    root.dataset.cvInited = "1";

    const dataNode = root.querySelector("[data-cv-data]");
    if (!dataNode) return;
    let data;
    try { data = JSON.parse(dataNode.textContent || "{}"); } catch (e) { return; }
    const edges = Array.isArray(data.edges) ? data.edges : [];

    const board = root.querySelector("[data-cv-board]");
    const svg = root.querySelector("[data-cv-links]");
    const hoverEl = root.querySelector("[data-cv-hover]");
    const clearBtn = root.querySelector('[data-cv-action="clear"].cv-chip-clear');
    const refreshBtn = root.querySelector('[data-cv-action="refresh"]');
    const layoutBtn = root.querySelector('[data-cv-action="toggle-layout"]');
    const layoutLabel = root.querySelector("[data-cv-layout-label]");
    const directionsBtn = root.querySelector('[data-cv-action="toggle-directions"]');
    const zoomOutBtn = root.querySelector('[data-cv-action="zoom-out"]');
    const zoomInBtn = root.querySelector('[data-cv-action="zoom-in"]');
    const zoomResetBtn = root.querySelector('[data-cv-action="zoom-reset"]');
    const zoomLabel = root.querySelector('[data-cv-zoom-label]');
    const laneButtons = root.querySelectorAll('[data-cv-lane-toggle]');

    const selection = new Set();
    let zoom = 1;

    const neighbours = new Map();
    for (const edge of edges) {
      if (!neighbours.has(edge.fromId)) neighbours.set(edge.fromId, new Set());
      if (!neighbours.has(edge.toId)) neighbours.set(edge.toId, new Set());
      neighbours.get(edge.fromId).add(edge.toId);
      neighbours.get(edge.toId).add(edge.fromId);
    }

    function transitive(seeds) {
      const out = new Set(seeds);
      let frontier = new Set(seeds);
      while (frontier.size) {
        const next = new Set();
        for (const id of frontier) {
          const nb = neighbours.get(id);
          if (!nb) continue;
          for (const x of nb) if (!out.has(x)) { out.add(x); next.add(x); }
        }
        frontier = next;
      }
      return out;
    }

    function cssEscape(value) {
      return String(value).replace(/(["\\\\\]])/g, "\\\\$1");
    }

    function visibleCard(id) {
      const cards = root.querySelectorAll('[data-cv-card][data-cv-id="' + cssEscape(id) + '"]');
      for (const c of cards) {
        if (c.offsetParent !== null) return c;
      }
      return null;
    }

    function anchor(el, side) {
      const br = board.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = side === "right" ? r.right - br.left + board.scrollLeft : r.left - br.left + board.scrollLeft;
      const y = r.top - br.top + board.scrollTop + r.height / 2;
      return { x: x, y: y };
    }

    function drawLinks() {
      if (!svg) return;
      const w = board.scrollWidth;
      const h = board.scrollHeight;
      svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      for (const edge of edges) {
        const a = visibleCard(edge.fromId);
        const b = visibleCard(edge.toId);
        if (!a || !b) continue;
        const p1 = anchor(a, "right");
        const p2 = anchor(b, "left");
        const dx = Math.max(40, (p2.x - p1.x) * 0.45);
        const d = "M " + p1.x + " " + p1.y + " C " + (p1.x + dx) + " " + p1.y + ", " + (p2.x - dx) + " " + p2.y + ", " + p2.x + " " + p2.y;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.dataset.from = edge.fromId;
        path.dataset.to = edge.toId;
        svg.appendChild(path);
      }
      applySelectionStyles();
    }

    function scrollSelectionIntoView(connected) {
      const ids = selection.size ? Array.from(selection) : Array.from(connected || []);
      const target = ids.map(visibleCard).find(Boolean);
      if (!target) return;
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      target.classList.add("cv-scroll-target");
      setTimeout(function () { target.classList.remove("cv-scroll-target"); }, 900);
    }

    function readCard(el) {
      return {
        id: el.dataset.cvId,
        kind: el.dataset.cvKind,
        ref: (el.querySelector(".cv-card-ref") || {}).textContent || "",
        title: (el.querySelector(".cv-card-title") || {}).textContent || "",
        detail: el.dataset.cvDetail || ""
      };
    }
    function nodeInfo(id) {
      const el = visibleCard(id) || root.querySelector('[data-cv-id="' + cssEscape(id) + '"]');
      if (!el) return null;
      return readCard(el);
    }

    function applySelectionStyles() {
      const hasSel = selection.size > 0;
      root.classList.toggle("cv-has-selection", hasSel);
      if (clearBtn) clearBtn.hidden = !hasSel;
      const connected = hasSel ? transitive(Array.from(selection)) : new Set();
      root.querySelectorAll("[data-cv-card]").forEach(function (el) {
        const id = el.dataset.cvId;
        const isSelected = selection.has(id);
        const isConnected = !isSelected && connected.has(id);
        el.classList.toggle("cv-selected", isSelected);
        el.classList.toggle("cv-connected", isConnected);
        el.classList.toggle("cv-related-requirement", isConnected && el.dataset.cvKind === "requirement");
      });
      if (svg) {
        svg.querySelectorAll("path").forEach(function (p) {
          const inChain = connected.has(p.dataset.from) && connected.has(p.dataset.to);
          p.classList.toggle("cv-highlight", hasSel && inChain);
        });
      }
      if (hasSel) scrollSelectionIntoView(connected);
    }

    function setZoom(next) {
      zoom = Math.max(0.7, Math.min(1.5, next));
      root.style.setProperty("--cv-zoom", String(zoom));
      if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + "%";
      requestAnimationFrame(drawLinks);
    }

    function setLaneVisibility(kind, show) {
      root.querySelectorAll('[data-cv-lane-kind="' + kind + '"]').forEach(function (el) {
        el.classList.toggle("cv-lane-hidden", !show);
      });
      requestAnimationFrame(drawLinks);
    }

    function escHtml(s) {
      return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function section(title, items) {
      return '<div class="cv-section"><h4>' + escHtml(title) + ' (' + items.length + ')</h4><ul>' +
        items.map(function (i) { return '<li>' + escHtml(i.ref) + ' \u2014 ' + escHtml(i.title) + '</li>'; }).join("") +
        '</ul></div>';
    }
    function detailSection(detail) {
      if (!detail) return "";
      return '<div class="cv-section"><h4>Details</h4><ul>' +
        detail.split(" \u00b7 ").filter(Boolean).map(function (item) { return '<li>' + escHtml(item) + '</li>'; }).join("") +
        '</ul></div>';
    }
    function showHover(card) {
      if (!hoverEl) return;
      const id = card.dataset.cvId;
      const info = nodeInfo(id);
      if (!info) return;
      const directIds = neighbours.get(id);
      const grouped = { direction: [], requirement: [], risk: [], action: [] };
      if (directIds) {
        directIds.forEach(function (nid) {
          const ni = nodeInfo(nid);
          if (ni && grouped[ni.kind]) grouped[ni.kind].push(ni);
        });
      }
      const sections = [];
      if (grouped.direction.length) sections.push(section("Directions", grouped.direction));
      if (grouped.requirement.length) sections.push(section("Requirements", grouped.requirement));
      if (grouped.risk.length) sections.push(section("Risks", grouped.risk));
      if (grouped.action.length) sections.push(section("Actions", grouped.action));
      const body = sections.length ? sections.join("") : '<div class="cv-hover-empty">No direct links</div>';
      hoverEl.innerHTML =
        '<div class="cv-ref">' + escHtml(info.ref) + '</div>' +
        '<h3>' + escHtml(info.title) + '</h3>' +
        detailSection(info.detail) +
        body;
      hoverEl.hidden = false;
      positionHover(card);
    }
    function positionHover(card) {
      if (!hoverEl) return;
      const rootRect = root.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      hoverEl.style.visibility = "hidden";
      hoverEl.hidden = false;
      const hw = hoverEl.offsetWidth || 280;
      const hh = hoverEl.offsetHeight || 200;
      const gap = 8;
      let left = cardRect.right - rootRect.left + gap;
      if (left + hw > rootRect.width - 4) {
        left = cardRect.left - rootRect.left - hw - gap;
      }
      if (left < 4) left = 4;
      let top = cardRect.top - rootRect.top;
      if (top + hh > rootRect.height - 4) top = rootRect.height - hh - 4;
      if (top < 4) top = 4;
      hoverEl.style.left = left + "px";
      hoverEl.style.top = top + "px";
      hoverEl.style.visibility = "";
    }
    function hideHover() {
      if (!hoverEl) return;
      hoverEl.hidden = true;
      hoverEl.innerHTML = "";
    }

    board.addEventListener("click", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest(".cv-card-open")) return;
      const card = target.closest("[data-cv-card]");
      if (!card) return;
      const id = card.dataset.cvId;
      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        if (selection.has(id)) selection.delete(id); else selection.add(id);
      } else {
        if (selection.size === 1 && selection.has(id)) selection.clear();
        else { selection.clear(); selection.add(id); }
      }
      hideHover();
      applySelectionStyles();
    });
    board.addEventListener("dblclick", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const card = target.closest("[data-cv-card]");
      if (!card) return;
      const open = card.querySelector(".cv-card-open");
      if (open) open.click();
    });
    board.addEventListener("keydown", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const card = target.closest("[data-cv-card]");
      if (!card) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const id = card.dataset.cvId;
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          if (selection.has(id)) selection.delete(id); else selection.add(id);
        } else {
          if (selection.size === 1 && selection.has(id)) selection.clear();
          else { selection.clear(); selection.add(id); }
        }
        applySelectionStyles();
      }
    });
    if (clearBtn) clearBtn.addEventListener("click", function () { selection.clear(); applySelectionStyles(); });
    if (refreshBtn) refreshBtn.addEventListener("click", function () {
      try {
        const shared = globalThis.__pspfWorkshopVscode;
        if (shared && typeof shared.postMessage === "function") {
          shared.postMessage({ command: "refresh" });
          return;
        }
        if (typeof globalThis.acquireVsCodeApi === "function") {
          if (!globalThis.__pspfCvVsCode) globalThis.__pspfCvVsCode = globalThis.acquireVsCodeApi();
          globalThis.__pspfCvVsCode.postMessage({ command: "refresh" });
          return;
        }
      } catch (e) { /* fall through */ }
      location.reload();
    });
    if (layoutBtn && layoutLabel) {
      layoutBtn.addEventListener("click", function () {
        const compact = root.classList.toggle("layout-compact");
        root.classList.toggle("layout-grouped", !compact);
        layoutBtn.setAttribute("aria-pressed", compact ? "true" : "false");
        layoutLabel.textContent = compact ? "Compact" : "Domain lanes";
        requestAnimationFrame(drawLinks);
      });
    }
    if (directionsBtn) {
      directionsBtn.addEventListener("click", function () {
        const showing = directionsBtn.getAttribute("aria-pressed") !== "false";
        directionsBtn.setAttribute("aria-pressed", showing ? "false" : "true");
        setLaneVisibility("directions", showing ? false : true);
      });
    }
    laneButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const kind = button.dataset.cvLaneToggle;
        const showing = button.getAttribute("aria-pressed") !== "false";
        button.setAttribute("aria-pressed", showing ? "false" : "true");
        setLaneVisibility(kind, showing ? false : true);
      });
    });
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", function () { setZoom(zoom - 0.1); });
    if (zoomInBtn) zoomInBtn.addEventListener("click", function () { setZoom(zoom + 0.1); });
    if (zoomResetBtn) zoomResetBtn.addEventListener("click", function () { setZoom(1); });
    board.addEventListener("mouseover", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const card = target.closest("[data-cv-card]");
      if (!card) return;
      showHover(card);
    });
    board.addEventListener("mouseout", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!target) return;
      const card = target.closest("[data-cv-card]");
      if (!card) return;
      if (related && card.contains(related)) return;
      hideHover();
    });
    board.addEventListener("focusin", function (event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const card = target.closest("[data-cv-card]");
      if (card) showHover(card);
    });
    board.addEventListener("focusout", function () { hideHover(); });
    board.addEventListener("scroll", hideHover, { passive: true });
    window.addEventListener("scroll", hideHover, { passive: true });

    window.addEventListener("resize", drawLinks);
    if (typeof ResizeObserver === "function") new ResizeObserver(drawLinks).observe(board);
    requestAnimationFrame(drawLinks);
  }

  function initAll() {
    document.querySelectorAll("[data-pspf-connected-view]").forEach(init);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
  globalThis.pspfConnectedView = { initAll: initAll, init: init, buildModel: buildModel, renderHtml: renderHtml, renderInto: renderInto };
})();`;
