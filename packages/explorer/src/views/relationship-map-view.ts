/**
 * Relationship map: Cytoscape-rendered network of requirements, risks,
 * actions and directions, edged by both stored `Relationship` records and
 * the implicit links carried by Risks (requirementIds, actionIds), Actions
 * (requirementIds, riskIds) and Directions (requirementIds).
 *
 * Cytoscape is loaded lazily so the main bundle stays slim.
 */

import { LitElement, css, html, svg, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { consume } from '@lit/context';
import type { Core, EventObjectNode, LayoutOptions } from 'cytoscape';
import { designTokens } from '../app/design-tokens.ts';
import {
  buildRelationshipMapGraph,
  formatRelationshipMapSummary,
  orderRelationshipMapNodes,
  type MapNode,
  type MapFilters,
  type RelationshipMapGraph,
  type RiskBand,
} from '../domain/relationship-map.ts';
import { appStoreContext } from '../state/contexts.ts';
import type { AppStore } from '../state/app-store.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';
import type { ActionStatus, ComplianceState, DirectionResponseState } from '../data/types.ts';

function mapComplianceLabel(state: ComplianceState): string {
  switch (state) {
    case 'yes':
      return 'Fully implemented';
    case 'no':
      return 'Not yet implemented';
    case 'risk-managed':
      return 'Risk-managed';
    case 'not-applicable':
      return 'Not applicable';
    case 'not-set':
      return 'Not set';
  }
}

function mapDirectionResponseLabel(state: DirectionResponseState): string {
  switch (state) {
    case 'yes':
      return 'Dealt with';
    case 'no':
      return 'Not dealt with';
    case 'risk-managed':
      return 'Risk-managed';
    case 'not-set':
      return 'Needs response';
  }
}

/**
 * Build the human-readable tooltip lines shown when a map node is hovered.
 * Exported so the lines can be unit-tested without standing up Cytoscape.
 */
export function relationshipMapTooltipLines(node: MapNode): readonly string[] {
  const lines: string[] = [];
  switch (node.kind) {
    case 'requirement':
      if (node.complianceState) {
        lines.push(`Compliance: ${mapComplianceLabel(node.complianceState)}`);
      }
      break;
    case 'risk':
      if (node.riskBand) lines.push(`Band: ${node.riskBand}`);
      if (node.riskTreatment) {
        lines.push(
          `${node.riskTreatment.activeActionsTreating} active / ${node.riskTreatment.actionsTreating} actions`,
        );
      }
      break;
    case 'action':
      if (node.actionStatus) lines.push(`Status: ${node.actionStatus}`);
      if (node.actionOverdue) lines.push('Overdue');
      if (node.actionValue) {
        lines.push(
          `Addresses ${node.actionValue.requirementsAddressed} requirement${
            node.actionValue.requirementsAddressed === 1 ? '' : 's'
          } · treats ${node.actionValue.risksTreated} risk${
            node.actionValue.risksTreated === 1 ? '' : 's'
          }`,
        );
      }
      break;
    case 'direction':
      if (node.directionResponseState) {
        lines.push(`Response: ${mapDirectionResponseLabel(node.directionResponseState)}`);
      }
      if (node.directionImpact) {
        lines.push(`Affects ${node.directionImpact.requirementsModified} requirement(s)`);
      }
      break;
  }
  return lines;
}

type MapLayoutName = 'lanes' | 'cose' | 'breadthfirst' | 'concentric' | 'grid';

const MAP_LAYOUT_OPTIONS: readonly { value: MapLayoutName; label: string }[] = [
  { value: 'lanes', label: 'Lanes (by relationship)' },
  { value: 'cose', label: 'Force-directed' },
  { value: 'breadthfirst', label: 'Hierarchy' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'grid', label: 'Grid' },
];

@customElement('pspf-relationship-map-view')
export class RelationshipMapView extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      h2 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-xl);
      }
      .intro {
        margin: 0 0 var(--space-3) 0;
        color: var(--colour-fg-muted);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }
      .metric {
        padding: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      .metric strong {
        display: block;
        font-size: var(--text-lg);
      }
      .metric span {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
      }
      .toolbar {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: var(--space-2);
      }
      .copy-status {
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      .legend {
        display: flex;
        gap: var(--space-3) var(--space-4);
        align-items: flex-start;
        flex-wrap: wrap;
        margin-bottom: var(--space-2);
        padding: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        font-size: var(--text-sm);
      }
      .legend-section {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        flex-wrap: wrap;
      }
      .legend strong {
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
      }
      .legend-item {
        display: inline-flex;
        gap: var(--space-1);
        align-items: center;
      }
      .legend-glyph {
        width: 18px;
        height: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .legend-glyph svg {
        width: 100%;
        height: 100%;
      }
      .swatch {
        width: 1.8rem;
        height: 3px;
        border-radius: 999px;
        background: var(--swatch-colour);
      }
      .filters {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
        padding: var(--space-2);
        margin-bottom: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
      }
      .filter-group {
        border: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 12rem;
      }
      .filter-group legend {
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
        font-weight: 600;
        padding: 0;
      }
      .chip {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        font-size: var(--text-sm);
      }
      .filter-clear {
        align-self: flex-start;
      }
      .view-controls {
        display: flex;
        gap: var(--space-3);
        align-items: flex-end;
        flex-wrap: wrap;
        padding: var(--space-2);
        margin-bottom: var(--space-2);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        position: relative;
      }
      .view-controls .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .view-controls .control-label {
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
        font-weight: 600;
      }
      .view-controls input[type='search'],
      .view-controls select {
        font: inherit;
        padding: 4px 6px;
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
        color: var(--colour-fg);
        min-width: 14rem;
      }
      .search-results {
        list-style: none;
        margin: 0;
        padding: 4px;
        position: absolute;
        top: 100%;
        left: var(--space-2);
        right: var(--space-2);
        z-index: 5;
        background: var(--colour-bg-elevated);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md, 0 4px 12px rgba(15, 23, 42, 0.1));
        max-height: 16rem;
        overflow-y: auto;
      }
      .search-results li {
        margin: 0;
      }
      .search-results li.empty {
        padding: 6px 8px;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
      }
      .search-results button {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        padding: 6px 8px;
        cursor: pointer;
        color: var(--colour-fg);
        font: inherit;
        border-radius: var(--radius-sm);
      }
      .search-results button:hover,
      .search-results button:focus-visible {
        background: var(--colour-bg-subtle, rgba(15, 23, 42, 0.06));
      }
      .search-results .kind {
        display: inline-block;
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
        margin-right: 6px;
      }
      .reset-selection {
        margin-left: auto;
      }
      .map-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(17rem, 22rem);
        gap: var(--space-3);
        align-items: stretch;
      }
      label.row {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        font-size: var(--text-sm);
      }
      .stage {
        position: relative;
        height: 520px;
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        overflow: hidden;
      }
      .canvas {
        position: absolute;
        inset: 0;
      }
      .lane-headers {
        position: absolute;
        inset: var(--space-1) var(--space-2) auto var(--space-2);
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-2);
        pointer-events: none;
        z-index: 2;
      }
      .lane-header {
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
        text-align: center;
        padding: 2px 6px;
        background: color-mix(in srgb, var(--colour-bg-elevated) 80%, transparent);
        border-radius: var(--radius-sm);
      }
      .map-tooltip {
        position: absolute;
        transform: translate(12px, -50%);
        background: var(--colour-bg-elevated);
        color: var(--colour-fg);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-2);
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm);
        line-height: 1.35;
        pointer-events: none;
        z-index: 4;
        max-width: 18rem;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .map-tooltip strong {
        font-size: var(--text-base);
      }
      .map-tooltip .kind {
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--colour-fg-muted);
        font-size: var(--text-sm);
        text-align: center;
        padding: var(--space-3);
      }
      .inspector {
        padding: var(--space-3);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        background: var(--colour-bg-elevated);
        min-height: 520px;
      }
      .inspector h3 {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-md);
      }
      .inspector p {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--text-sm);
      }
      .inspector a {
        color: inherit;
      }
      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin: var(--space-2) 0;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: 2px var(--space-1);
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
        font-size: var(--text-xs);
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: var(--space-1) var(--space-2);
        margin: var(--space-2) 0 0 0;
        font-size: var(--text-sm);
      }
      dt {
        color: var(--colour-fg-muted);
      }
      dd {
        margin: 0;
      }
      .connections {
        margin-top: var(--space-3);
        font-size: var(--text-sm);
      }
      .connections h4 {
        margin: 0 0 var(--space-1) 0;
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
        font-weight: 600;
      }
      .connections ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .connections li {
        display: flex;
        gap: var(--space-1);
        align-items: center;
        flex-wrap: wrap;
      }
      .connections a {
        color: inherit;
      }
      details.fallback {
        margin-top: var(--space-3);
        font-size: var(--text-sm);
      }
      details.fallback summary {
        cursor: pointer;
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: var(--space-2);
      }
      th,
      td {
        padding: var(--space-1) var(--space-2);
        text-align: left;
        border-bottom: 1px solid var(--colour-border);
        font-size: var(--text-sm);
      }
      th {
        color: var(--colour-fg-muted);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      @media (max-width: 980px) {
        .summary,
        .map-layout {
          grid-template-columns: 1fr;
        }
        .inspector {
          min-height: 0;
        }
      }
      .mode-toggle {
        display: inline-flex;
        border: 1px solid var(--colour-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .mode-toggle button {
        font: inherit;
        padding: 4px 10px;
        background: var(--colour-bg-elevated);
        color: var(--colour-fg);
        border: none;
        cursor: pointer;
      }
      .mode-toggle button + button {
        border-left: 1px solid var(--colour-border);
      }
      .mode-toggle button.active {
        background: var(--colour-accent, #2563eb);
        color: var(--colour-accent-fg, #fff);
      }
      .board {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-4);
        min-height: 520px;
        position: relative;
      }
      .board-edges {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
        z-index: 0;
      }
      .board-edges path {
        fill: none;
        stroke: var(--colour-border-strong, var(--colour-border));
        stroke-width: 1.25;
        stroke-opacity: 0.55;
        transition: stroke-opacity 120ms ease;
      }
      .board-edges path.edge-dimmed {
        stroke-opacity: 0.08;
      }
      .board-edges path.edge-highlighted {
        stroke: var(--colour-accent, #2563eb);
        stroke-width: 2;
        stroke-opacity: 0.9;
      }
      .board-column {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2);
        border: 1px dashed color-mix(in srgb, var(--colour-border) 60%, transparent);
        border-radius: var(--radius-md);
        /* Transparent column so SVG connection lines remain visible between
           cards. Individual cards keep solid backgrounds for readability. */
        background: transparent;
        max-height: 600px;
        overflow-y: auto;
        position: relative;
        z-index: 1;
      }
      .board-column h3 {
        margin: 0 0 var(--space-1) 0;
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colour-fg-muted);
        position: sticky;
        top: 0;
        /* Translucent so the column header doesn't fully hide edges that
           start from cards just below it while users scroll. */
        background: color-mix(in srgb, var(--colour-bg-elevated) 75%, transparent);
        backdrop-filter: blur(2px);
        padding-bottom: 4px;
      }
      .board-column .count {
        font-weight: 400;
        color: var(--colour-fg-muted);
      }
      .board-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-1) var(--space-2);
        border: 1px solid var(--colour-border);
        border-left: 4px solid var(--card-accent, var(--colour-status-not-set));
        border-radius: var(--radius-sm);
        background: var(--colour-bg);
        cursor: pointer;
        text-align: left;
        font: inherit;
        color: inherit;
      }
      .board-card:hover,
      .board-card:focus-visible {
        background: var(--colour-bg-subtle, rgba(15, 23, 42, 0.04));
      }
      .board-card.selected {
        outline: 2px solid var(--colour-accent, #2563eb);
        outline-offset: 1px;
      }
      .board-card.focused {
        outline: 2px solid var(--colour-accent, #2563eb);
        outline-offset: 1px;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
      }
      .board-card.linked {
        border-color: var(--colour-accent, #2563eb);
      }
      .board-card.dimmed {
        opacity: 0.3;
        filter: saturate(0.5);
      }
      .board-card.dimmed:hover,
      .board-card.dimmed:focus-visible {
        opacity: 0.6;
      }
      .board-card .card-title {
        font-weight: 600;
        font-size: var(--text-sm);
      }
      .board-card .card-meta {
        font-size: var(--text-xs);
        color: var(--colour-fg-muted);
      }
      .board-empty {
        font-size: var(--text-sm);
        color: var(--colour-fg-muted);
        padding: var(--space-2);
      }
      @media (max-width: 980px) {
        .board {
          grid-template-columns: 1fr;
          min-height: 0;
        }
      }
    `,
  ];

  @consume({ context: appStoreContext, subscribe: true })
  private store: AppStore | undefined;

  // eslint-disable-next-line no-unused-private-class-members
  #watcher = new SignalWatcher(this, () =>
    this.store
      ? [
          this.store.compliance,
          this.store.risks,
          this.store.actions,
          this.store.directions,
          this.store.relationships,
          this.store.workTracking,
        ]
      : [],
  );

  @state() private accessor showRequirements = true;
  @state() private accessor showRisks = true;
  @state() private accessor showActions = true;
  @state() private accessor showDirections = true;
  @state() private accessor unlinkedGapsOnly = false;
  @state() private accessor selectedNodeId = '';
  @state() private accessor copyStatus = '';
  @state() private accessor showFilters = false;
  @state() private accessor complianceFilter: ReadonlySet<ComplianceState> = new Set();
  @state() private accessor riskBandFilter: ReadonlySet<RiskBand> = new Set();
  @state() private accessor actionStatusFilter: ReadonlySet<ActionStatus> = new Set();
  @state() private accessor actionOverdueOnly = false;
  @state() private accessor directionResponseFilter: ReadonlySet<DirectionResponseState> =
    new Set();
  @state() private accessor layoutName: MapLayoutName = 'lanes';
  @state() private accessor searchQuery = '';
  @state() private accessor viewMode: 'graph' | 'board' = 'graph';
  @state() private accessor focusedNodeIds: ReadonlySet<string> = new Set();
  /** Bumped by board observers to trigger a re-render of edge lines. */
  @state() private accessor boardLayoutVersion = 0;

  #cy: Core | null = null;
  #canvas: HTMLDivElement | null = null;
  #graphSignature = '';
  #lastLayoutName: MapLayoutName | null = null;
  #urlFocusApplied = false;
  #lastCentredNodeId: string | null = null;
  #hover: { nodeId: string; x: number; y: number } | null = null;
  #boardEl: HTMLDivElement | null = null;
  #boardResizeObserver: ResizeObserver | null = null;
  #boardScrollCleanup: (() => void) | null = null;
  #boardRafId = 0;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#cy?.destroy();
    this.#cy = null;
    this.#graphSignature = '';
    this.#teardownBoardObservers();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.#urlFocusApplied) {
      try {
        const params = new URLSearchParams(window.location.search);
        const focus = params.get('focus');
        if (focus) this.selectedNodeId = focus;
      } catch {
        // No-op: not all environments expose a parseable URL.
      }
      this.#urlFocusApplied = true;
    }
  }

  override render(): TemplateResult {
    const graph = this.#graph();
    const { nodes, edges, summary } = graph;
    const selected =
      nodes.find((node) => node.id === this.selectedNodeId) ??
      nodes.find((node) => node.kind === 'requirement') ??
      nodes[0];

    return html`
      <article>
        <h2>Relationship map</h2>
        <p class="intro">
          Shows how compliance posture connects to risks, remediation actions, Directions and logged
          work. Select a node to inspect the work-to-compliance trail.
        </p>
        <section class="summary" aria-label="Work and compliance summary">
          <div class="metric">
            <strong>${summary.requirements}</strong><span>Requirements</span>
          </div>
          <div class="metric">
            <strong>${summary.complianceGapsWithWork}</strong><span>Gaps with work</span>
          </div>
          <div class="metric">
            <strong>${summary.complianceGapsWithoutWork}</strong><span>Gaps without work</span>
          </div>
          <div class="metric">
            <strong>${summary.blockedOrOverdueActions}</strong><span>Blocked/overdue actions</span>
          </div>
          <div class="metric">
            <strong>${summary.directionsNeedingResponse}</strong
            ><span>Directions needing response</span>
          </div>
        </section>

        <div class="toolbar" role="group" aria-label="Visible node kinds">
          <label class="row">
            <input
              type="checkbox"
              ?checked=${this.showRequirements}
              @change=${(e: Event): void => {
                this.showRequirements = (e.target as HTMLInputElement).checked;
              }}
            />
            Requirements
          </label>
          <label class="row">
            <input
              type="checkbox"
              ?checked=${this.showRisks}
              @change=${(e: Event): void => {
                this.showRisks = (e.target as HTMLInputElement).checked;
              }}
            />
            Risks
          </label>
          <label class="row">
            <input
              type="checkbox"
              ?checked=${this.showActions}
              @change=${(e: Event): void => {
                this.showActions = (e.target as HTMLInputElement).checked;
              }}
            />
            Actions
          </label>
          <label class="row">
            <input
              type="checkbox"
              ?checked=${this.showDirections}
              @change=${(e: Event): void => {
                this.showDirections = (e.target as HTMLInputElement).checked;
              }}
            />
            Directions
          </label>
          <label class="row">
            <input
              data-testid="unlinked-gaps-only"
              type="checkbox"
              ?checked=${this.unlinkedGapsOnly}
              @change=${(e: Event): void => {
                this.unlinkedGapsOnly = (e.target as HTMLInputElement).checked;
                this.selectedNodeId = '';
              }}
            />
            Unlinked gaps only
          </label>
          <button
            type="button"
            data-testid="copy-map-summary"
            @click=${(): void => void this.#copyText(formatRelationshipMapSummary(graph))}
          >
            Copy map summary
          </button>
          <button
            type="button"
            data-testid="toggle-filters"
            aria-expanded=${this.showFilters ? 'true' : 'false'}
            @click=${(): void => {
              this.showFilters = !this.showFilters;
            }}
          >
            ${this.showFilters ? 'Hide filters' : 'Show filters'}${this.#activeFilterCount() > 0
              ? ` (${this.#activeFilterCount()})`
              : ''}
          </button>
          <div role="group" aria-label="View mode" class="mode-toggle">
            <button
              type="button"
              data-testid="map-mode-graph"
              class=${this.viewMode === 'graph' ? 'active' : ''}
              aria-pressed=${this.viewMode === 'graph' ? 'true' : 'false'}
              @click=${(): void => {
                this.viewMode = 'graph';
              }}
            >
              Graph
            </button>
            <button
              type="button"
              data-testid="map-mode-board"
              class=${this.viewMode === 'board' ? 'active' : ''}
              aria-pressed=${this.viewMode === 'board' ? 'true' : 'false'}
              @click=${(): void => {
                this.viewMode = 'board';
              }}
            >
              Board
            </button>
          </div>
          ${this.copyStatus
            ? html`<span class="copy-status" role="status">${this.copyStatus}</span>`
            : ''}
          <span
            data-testid="counts"
            style="margin-left:auto; color: var(--colour-fg-muted); font-size: var(--text-sm);"
          >
            ${nodes.length} nodes · ${edges.length} edges
          </span>
        </div>

        ${this.#renderViewControls(nodes)} ${this.showFilters ? this.#renderFilters() : ''}
        ${this.#renderLegend()}

        <div class="map-layout">
          ${this.viewMode === 'graph'
            ? html`<div class="stage">
                ${nodes.length === 0
                  ? html`<div class="empty" data-testid="empty">
                      No work-to-compliance links to display. Link risks, actions or Directions to
                      requirements, or log work against a requirement.
                    </div>`
                  : html`<div
                      class="canvas"
                      data-testid="map-canvas"
                      ${ref(this.#onCanvasRef)}
                    ></div>`}
                ${nodes.length > 0 && this.layoutName === 'lanes'
                  ? html`<div class="lane-headers" aria-hidden="true">
                      <span class="lane-header">Requirements</span>
                      <span class="lane-header">Risks</span>
                      <span class="lane-header">Actions</span>
                      <span class="lane-header">Directions</span>
                    </div>`
                  : ''}
                ${this.#renderHoverTooltip(nodes)}
              </div>`
            : this.#renderBoard(graph)}
          ${this.#renderInspector(selected, nodes)}
        </div>

        <details class="fallback" ?open=${nodes.length > 0 && nodes.length <= 40}>
          <summary>Connection list (text fallback)</summary>
          <table aria-label="Connection list">
            <thead>
              <tr>
                <th>From</th>
                <th>Connection</th>
                <th>To</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody data-testid="adjacency">
              ${edges.map((e) => {
                const src = nodes.find((n) => n.id === e.source);
                const tgt = nodes.find((n) => n.id === e.target);
                return html`<tr>
                  <td>${src?.label ?? e.source}</td>
                  <td>${e.label}</td>
                  <td>${tgt?.label ?? e.target}</td>
                  <td>${src?.detail ?? ''}${tgt?.detail ? html` → ${tgt.detail}` : ''}</td>
                </tr>`;
              })}
            </tbody>
          </table>
        </details>
      </article>
    `;
  }

  #onCanvasRef = (el: Element | undefined): void => {
    if (!(el instanceof HTMLDivElement)) {
      // Canvas was removed from the DOM (e.g. switching to board mode).
      // Tear down Cytoscape so the next mount rebuilds cleanly.
      if (this.#cy) {
        this.#cy.destroy();
        this.#cy = null;
        this.#graphSignature = '';
      }
      this.#canvas = null;
      return;
    }
    this.#canvas = el;
    void this.#renderCytoscape();
  };

  async #renderCytoscape(): Promise<void> {
    const canvas = this.#canvas;
    if (!canvas) return;
    const { nodes, edges } = this.#graph();
    const signature = this.#cytoscapeSignature({ nodes, edges });
    if (nodes.length === 0) {
      this.#cy?.destroy();
      this.#cy = null;
      this.#graphSignature = '';
      return;
    }
    if (this.#cy && signature === this.#graphSignature) {
      this.#applySelectionHighlight();
      return;
    }

    const cytoscapeModule = await import('cytoscape');
    const cytoscape = cytoscapeModule.default;
    // The canvas can be unmounted while Cytoscape is still loading.
    // Bail out if the original mount target is no longer valid.
    if (this.#canvas !== canvas || !canvas.isConnected || this.viewMode !== 'graph') return;
    this.#cy?.destroy();
    this.#graphSignature = signature;

    const elements = [
      ...nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          complianceState: n.complianceState,
          riskBand: n.riskBand,
          actionStatus: n.actionStatus,
          actionOverdue: n.actionOverdue ? 'true' : 'false',
          directionResponseState: n.directionResponseState,
        },
      })),
      ...edges.map((e) => {
        // Visually orient arrows toward the requirement (the asset being
        // assured). The underlying graph data is unchanged; we only flip
        // source/target on the rendered Cytoscape edge.
        const flip =
          e.kind === 'requirement-risk' ||
          e.kind === 'requirement-action' ||
          e.kind === 'requirement-direction';
        const renderedSource = flip ? e.target : e.source;
        const renderedTarget = flip ? e.source : e.target;
        return {
          data: {
            id: e.id,
            source: renderedSource,
            target: renderedTarget,
            kind: e.kind,
            label: e.label,
          },
        };
      }),
    ];

    const tokens = this.#resolveStyleTokens();
    this.#cy = cytoscape({
      container: canvas,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': tokens.statusNotSet,
            label: 'data(label)',
            color: tokens.fg,
            'font-size': 11,
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'text-outline-color': tokens.bg,
            'text-outline-width': 2,
            width: 22,
            height: 22,
            'border-width': 1,
            'border-color': tokens.nodeStroke,
            'border-opacity': 0.4,
          },
        },
        {
          selector: 'node[kind = "requirement"]',
          style: {
            'background-color': tokens.statusNotSet,
            shape: 'hexagon',
            width: 26,
            height: 26,
            'border-width': 2,
            'border-color': tokens.nodeStroke,
            'border-opacity': 0.7,
          },
        },
        {
          selector: 'node[kind = "requirement"][complianceState = "yes"]',
          style: { 'background-color': tokens.statusYes },
        },
        {
          selector: 'node[kind = "requirement"][complianceState = "no"]',
          style: { 'background-color': tokens.statusNo },
        },
        {
          selector: 'node[kind = "requirement"][complianceState = "risk-managed"]',
          style: { 'background-color': tokens.statusRiskManaged },
        },
        {
          selector: 'node[kind = "requirement"][complianceState = "not-applicable"]',
          style: { 'background-color': tokens.statusNotApplicable },
        },
        {
          selector: 'node[kind = "risk"]',
          style: {
            'background-color': tokens.riskMedium,
            shape: 'triangle',
            width: 24,
            height: 24,
          },
        },
        {
          selector: 'node[kind = "risk"][riskBand = "extreme"]',
          style: { 'background-color': tokens.riskExtreme, width: 32, height: 32 },
        },
        {
          selector: 'node[kind = "risk"][riskBand = "high"]',
          style: { 'background-color': tokens.riskHigh, width: 28, height: 28 },
        },
        {
          selector: 'node[kind = "risk"][riskBand = "medium"]',
          style: { 'background-color': tokens.riskMedium },
        },
        {
          selector: 'node[kind = "risk"][riskBand = "low"]',
          style: { 'background-color': tokens.riskLow },
        },
        {
          selector: 'node[kind = "action"]',
          style: {
            'background-color': tokens.actionTodo,
            shape: 'round-rectangle',
            width: 30,
            height: 22,
          },
        },
        {
          selector: 'node[kind = "action"][actionStatus = "todo"]',
          style: { 'background-color': tokens.actionTodo },
        },
        {
          selector: 'node[kind = "action"][actionStatus = "in-progress"]',
          style: { 'background-color': tokens.actionInProgress },
        },
        {
          selector: 'node[kind = "action"][actionStatus = "blocked"]',
          style: { 'background-color': tokens.actionBlocked, width: 28, height: 20 },
        },
        {
          selector: 'node[kind = "action"][actionStatus = "done"]',
          style: { 'background-color': tokens.actionDone },
        },
        {
          selector: 'node[kind = "action"][actionStatus = "cancelled"]',
          style: { 'background-color': tokens.actionCancelled },
        },
        {
          selector: 'node[kind = "action"][actionOverdue = "true"]',
          style: {
            'background-color': tokens.actionBlocked,
            'border-color': tokens.statusNo,
            'border-width': 3,
          },
        },
        {
          selector: 'node[kind = "direction"]',
          style: {
            'background-color': tokens.directionNotSet,
            shape: 'round-tag',
            width: 30,
            height: 22,
          },
        },
        {
          selector: 'node[kind = "direction"][directionResponseState = "not-set"]',
          style: { 'background-color': tokens.directionNotSet, width: 28, height: 28 },
        },
        {
          selector: 'node[kind = "direction"][directionResponseState = "no"]',
          style: { 'background-color': tokens.directionNo, width: 28, height: 28 },
        },
        {
          selector: 'node[kind = "direction"][directionResponseState = "risk-managed"]',
          style: { 'background-color': tokens.directionRiskManaged },
        },
        {
          selector: 'node[kind = "direction"][directionResponseState = "yes"]',
          style: { 'background-color': tokens.directionYes },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': tokens.edgeDefault,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': tokens.edgeDefault,
            'arrow-scale': 0.9,
          },
        },
        {
          selector: 'edge[kind = "requirement-risk"]',
          style: {
            'line-color': tokens.edgeRequirementRisk,
            'target-arrow-color': tokens.edgeRequirementRisk,
          },
        },
        {
          selector: 'edge[kind = "requirement-action"]',
          style: {
            'line-color': tokens.edgeRequirementAction,
            'target-arrow-color': tokens.edgeRequirementAction,
          },
        },
        {
          selector: 'edge[kind = "risk-action"]',
          style: {
            'line-color': tokens.edgeRiskAction,
            'target-arrow-color': tokens.edgeRiskAction,
          },
        },
        {
          selector: 'edge[kind = "requirement-direction"]',
          style: {
            'line-color': tokens.edgeRequirementDirection,
            'target-arrow-color': tokens.edgeRequirementDirection,
          },
        },
        {
          selector: '.dimmed',
          style: { opacity: 0.14, 'text-opacity': 0.14 },
        },
        {
          selector: 'edge.dimmed',
          style: { opacity: 0.08 },
        },
        {
          selector: 'node.highlighted',
          style: { 'border-width': 4, 'border-color': tokens.nodeStroke, 'border-opacity': 1 },
        },
        {
          selector: 'edge.highlighted',
          style: { width: 3, opacity: 0.95 },
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 5, 'border-color': tokens.nodeStroke, 'border-opacity': 1 },
        },
      ],
      layout: this.#buildLayoutOptions(),
    });
    this.#lastLayoutName = this.layoutName;

    this.#cy.on('tap', 'node', (event: EventObjectNode): void => {
      this.selectedNodeId = event.target.id();
    });
    this.#cy.on('mouseover', 'node', (event: EventObjectNode): void => {
      const node = event.target;
      const pos = node.renderedPosition();
      this.#hover = {
        nodeId: node.id(),
        x: pos.x,
        y: pos.y,
      };
      this.requestUpdate();
    });
    this.#cy.on('mouseout', 'node', (): void => {
      this.#hover = null;
      this.requestUpdate();
    });
    this.#cy.on('pan zoom', (): void => {
      if (this.#hover) {
        this.#hover = null;
        this.requestUpdate();
      }
    });
    this.#applySelectionHighlight();
  }

  #resolveStyleTokens(): {
    fg: string;
    bg: string;
    nodeStroke: string;
    statusYes: string;
    statusNo: string;
    statusRiskManaged: string;
    statusNotApplicable: string;
    statusNotSet: string;
    riskExtreme: string;
    riskHigh: string;
    riskMedium: string;
    riskLow: string;
    actionTodo: string;
    actionInProgress: string;
    actionBlocked: string;
    actionDone: string;
    actionCancelled: string;
    directionNotSet: string;
    directionNo: string;
    directionRiskManaged: string;
    directionYes: string;
    edgeDefault: string;
    edgeRequirementRisk: string;
    edgeRequirementAction: string;
    edgeRiskAction: string;
    edgeRequirementDirection: string;
  } {
    const source = this.#canvas ?? this;
    const styles = window.getComputedStyle(source as Element);
    const read = (name: string, fallback: string): string => {
      const value = styles.getPropertyValue(name).trim();
      return value.length > 0 ? value : fallback;
    };
    return {
      fg: read('--colour-fg', '#0f172a'),
      bg: read('--colour-bg', '#f8fafc'),
      nodeStroke: read('--colour-map-node-stroke', '#0f172a'),
      statusYes: read('--colour-status-yes', '#2dd4bf'),
      statusNo: read('--colour-status-no', '#ef4444'),
      statusRiskManaged: read('--colour-status-risk-managed', '#facc15'),
      statusNotApplicable: read('--colour-status-not-applicable', '#94a3b8'),
      statusNotSet: read('--colour-status-not-set', '#475569'),
      riskExtreme: read('--colour-risk-extreme', '#99182c'),
      riskHigh: read('--colour-risk-high', '#d4451f'),
      riskMedium: read('--colour-risk-medium', '#e0903b'),
      riskLow: read('--colour-risk-low', '#2f6f3a'),
      actionTodo: read('--colour-action-todo', '#475569'),
      actionInProgress: read('--colour-action-in-progress', '#2563eb'),
      actionBlocked: read('--colour-action-blocked', '#b34a00'),
      actionDone: read('--colour-action-done', '#2dd4bf'),
      actionCancelled: read('--colour-action-cancelled', '#94a3b8'),
      directionNotSet: read('--colour-direction-not-set', '#ef4444'),
      directionNo: read('--colour-direction-no', '#d4451f'),
      directionRiskManaged: read('--colour-direction-risk-managed', '#facc15'),
      directionYes: read('--colour-direction-yes', '#2dd4bf'),
      edgeDefault: read('--colour-map-edge-default', '#94a3b8'),
      edgeRequirementRisk: read('--colour-map-edge-requirement-risk', '#b34a00'),
      edgeRequirementAction: read('--colour-map-edge-requirement-action', '#059669'),
      edgeRiskAction: read('--colour-map-edge-risk-action', '#2563eb'),
      edgeRequirementDirection: read('--colour-map-edge-requirement-direction', '#7c3aed'),
    };
  }

  #buildLayoutOptions(graph?: RelationshipMapGraph): LayoutOptions {
    const padding = 16;
    switch (this.layoutName) {
      case 'lanes':
        return this.#buildLanesLayout(graph ?? this.#graph(), padding);
      case 'breadthfirst':
        return {
          name: 'breadthfirst',
          animate: false,
          fit: true,
          padding,
          directed: true,
          spacingFactor: 1.1,
        };
      case 'concentric':
        return {
          name: 'concentric',
          animate: false,
          fit: true,
          padding,
          minNodeSpacing: 30,
          concentric: (node): number => {
            const kind = node.data('kind') as string;
            if (kind === 'requirement') return 4;
            if (kind === 'risk') return 3;
            if (kind === 'action') return 2;
            return 1;
          },
          levelWidth: (): number => 1,
        };
      case 'grid':
        return { name: 'grid', animate: false, fit: true, padding, avoidOverlap: true };
      case 'cose':
      default:
        return { name: 'cose', animate: false, fit: true, padding };
    }
  }

  /**
   * Position nodes in four left-to-right lanes by kind so the value chain —
   * requirements → risks → actions → directions — is read at a glance.
   * Within each lane, nodes use the median-of-neighbours order shared with
   * Board mode so connected items align across lanes and edges stay short.
   */
  #buildLanesLayout(graph: RelationshipMapGraph, padding: number): LayoutOptions {
    const ordered = orderRelationshipMapNodes(graph);
    const laneX: Record<MapNode['kind'], number> = {
      requirement: 0,
      risk: 1,
      action: 2,
      direction: 3,
    };
    const laneSize: Record<MapNode['kind'], number> = {
      requirement: ordered.requirements.length,
      risk: ordered.risks.length,
      action: ordered.actions.length,
      direction: ordered.directions.length,
    };
    const tallest = Math.max(1, ...Object.values(laneSize));
    const COL_WIDTH = 240;
    const ROW_HEIGHT = 56;
    // Centre shorter lanes vertically so connections don't bunch at the top.
    return {
      name: 'preset',
      animate: false,
      fit: true,
      padding,
      positions: (node): { x: number; y: number } => {
        const id = node;
        const kind = graph.nodes.find((n) => n.id === node)?.kind ?? 'requirement';
        const row = ordered.positions.get(id) ?? 0;
        const count = laneSize[kind] || 1;
        const offset = (tallest - count) / 2;
        return {
          x: laneX[kind] * COL_WIDTH,
          y: (row + offset) * ROW_HEIGHT,
        };
      },
    };
  }

  override updated(): void {
    void this.#renderCytoscape();
    if (this.#cy && this.#lastLayoutName !== this.layoutName) {
      this.#cy.layout(this.#buildLayoutOptions()).run();
      this.#lastLayoutName = this.layoutName;
    }
    this.#applySelectionHighlight();
    if (this.viewMode !== 'board' && this.#boardEl) {
      this.#teardownBoardObservers();
      this.#boardEl = null;
    }
  }

  #graph(): RelationshipMapGraph {
    const store = this.store;
    if (!store) {
      return {
        nodes: [],
        edges: [],
        summary: {
          requirements: 0,
          complianceGapsWithWork: 0,
          complianceGapsWithoutWork: 0,
          blockedOrOverdueActions: 0,
          directionsNeedingResponse: 0,
        },
      };
    }

    const filters: MapFilters = {};
    if (this.complianceFilter.size > 0) filters.complianceStates = [...this.complianceFilter];
    if (this.riskBandFilter.size > 0) filters.riskBands = [...this.riskBandFilter];
    if (this.actionStatusFilter.size > 0) filters.actionStatuses = [...this.actionStatusFilter];
    if (this.actionOverdueOnly) filters.actionOverdueOnly = true;
    if (this.directionResponseFilter.size > 0)
      filters.directionResponseStates = [...this.directionResponseFilter];

    return buildRelationshipMapGraph({
      compliance: store.compliance.value,
      risks: store.risks.value,
      actions: store.actions.value,
      directions: store.directions.value,
      relationships: store.relationships.value,
      workTracking: store.workTracking.value,
      visibility: {
        requirements: this.showRequirements,
        risks: this.showRisks,
        actions: this.showActions,
        directions: this.showDirections,
        unlinkedGapsOnly: this.unlinkedGapsOnly,
        filters,
      },
    });
  }

  #renderHoverTooltip(nodes: readonly MapNode[]): TemplateResult | '' {
    const hover = this.#hover;
    if (!hover) return '';
    const node = nodes.find((n) => n.id === hover.nodeId);
    if (!node) return '';
    const lines = this.#tooltipLinesFor(node);
    return html`<div
      class="map-tooltip"
      role="tooltip"
      aria-label=${`Map node ${node.label}`}
      data-testid="map-tooltip"
      style=${`left:${hover.x}px; top:${hover.y}px;`}
    >
      <strong>${node.label}</strong>
      <span class="kind">${node.kind} · ${node.id}</span>
      ${lines.map((line) => html`<span>${line}</span>`)}
    </div>`;
  }

  #tooltipLinesFor(node: MapNode): readonly string[] {
    return relationshipMapTooltipLines(node);
  }

  #renderViewControls(nodes: readonly MapNode[]): TemplateResult {
    const query = this.searchQuery.trim().toLowerCase();
    const matches =
      query.length === 0
        ? []
        : nodes
            .filter(
              (node) =>
                node.label.toLowerCase().includes(query) || node.id.toLowerCase().includes(query),
            )
            .slice(0, 6);
    return html`<div class="view-controls" role="group" aria-label="Map view controls">
      <label class="row">
        <span class="control-label">Layout</span>
        <select
          data-testid="map-layout"
          .value=${this.layoutName}
          @change=${(e: Event): void => {
            this.layoutName = (e.target as HTMLSelectElement).value as MapLayoutName;
          }}
        >
          ${MAP_LAYOUT_OPTIONS.map(
            (option) =>
              html`<option value=${option.value} ?selected=${option.value === this.layoutName}>
                ${option.label}
              </option>`,
          )}
        </select>
      </label>
      <label class="row search">
        <span class="control-label">Find node</span>
        <input
          data-testid="map-search"
          type="search"
          placeholder="Search by label or ID"
          .value=${this.searchQuery}
          @input=${(e: Event): void => {
            this.searchQuery = (e.target as HTMLInputElement).value;
          }}
          @keydown=${(e: KeyboardEvent): void => {
            if (e.key === 'Enter') {
              const liveQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
              if (liveQuery.length === 0) return;
              const liveMatch = nodes.find(
                (node) =>
                  node.label.toLowerCase().includes(liveQuery) ||
                  node.id.toLowerCase().includes(liveQuery),
              );
              if (liveMatch) {
                this.selectedNodeId = liveMatch.id;
                this.searchQuery = '';
              }
            } else if (e.key === 'Escape') {
              this.searchQuery = '';
            }
          }}
        />
      </label>
      ${query.length > 0
        ? html`<ul
            class="search-results"
            role="listbox"
            aria-label="Map node search results"
            data-testid="map-search-results"
          >
            ${matches.length === 0
              ? html`<li class="empty">No matches</li>`
              : matches.map(
                  (node) =>
                    html`<li>
                      <button
                        type="button"
                        data-testid=${`map-search-result-${node.id}`}
                        @click=${(): void => {
                          this.selectedNodeId = node.id;
                          this.searchQuery = '';
                        }}
                      >
                        <span class="kind">${node.kind}</span> ${node.label}
                      </button>
                    </li>`,
                )}
          </ul>`
        : ''}
      ${this.selectedNodeId
        ? html`<button
            type="button"
            class="reset-selection"
            data-testid="map-clear-selection"
            @click=${(): void => {
              this.selectedNodeId = '';
            }}
          >
            Clear selection
          </button>`
        : ''}
    </div>`;
  }

  #renderLegend(): TemplateResult {
    const connections = [
      ['#b34a00', 'Risk affects requirement'],
      ['#059669', 'Action remediates requirement'],
      ['#2563eb', 'Action treats risk'],
      ['#7c3aed', 'Direction modifies requirement'],
    ] as const;
    const kinds: readonly { label: string; shape: TemplateResult }[] = [
      {
        label: 'Requirement (hexagon)',
        shape: html`<svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="6,3 18,3 22,12 18,21 6,21 2,12" fill="var(--colour-status-not-set)" />
        </svg>`,
      },
      {
        label: 'Risk (triangle)',
        shape: html`<svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="12,3 22,21 2,21" fill="var(--colour-risk-medium)" />
        </svg>`,
      },
      {
        label: 'Action (rounded rectangle)',
        shape: html`<svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="7" width="18" height="10" rx="3" fill="var(--colour-action-in-progress)" />
        </svg>`,
      },
      {
        label: 'Direction (tag)',
        shape: html`<svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7 h13 l5 5 -5 5 H3 z" fill="var(--colour-direction-yes)" />
        </svg>`,
      },
    ];
    return html`<div class="legend" aria-label="Map legend" data-testid="map-legend">
      <div class="legend-section">
        <strong>Node kinds</strong>
        ${kinds.map(
          (kind) =>
            html`<span class="legend-item legend-kind">
              <span class="legend-glyph">${kind.shape}</span>${kind.label}
            </span>`,
        )}
      </div>
      <div class="legend-section">
        <strong>Connections</strong>
        ${connections.map(
          ([colour, label]) =>
            html`<span class="legend-item">
              <span class="swatch" style=${`--swatch-colour: ${colour}`}></span>${label}
            </span>`,
        )}
      </div>
    </div>`;
  }

  #activeFilterCount(): number {
    return (
      this.complianceFilter.size +
      this.riskBandFilter.size +
      this.actionStatusFilter.size +
      (this.actionOverdueOnly ? 1 : 0) +
      this.directionResponseFilter.size
    );
  }

  #toggleFromSet<T>(current: ReadonlySet<T>, value: T): ReadonlySet<T> {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  #renderFilters(): TemplateResult {
    const complianceOptions: readonly { value: ComplianceState; label: string }[] = [
      { value: 'no', label: 'Not yet implemented' },
      { value: 'risk-managed', label: 'Risk-managed' },
      { value: 'not-set', label: 'Not set' },
      { value: 'yes', label: 'Fully implemented' },
      { value: 'not-applicable', label: 'Not applicable' },
    ];
    const riskBandOptions: readonly { value: RiskBand; label: string }[] = [
      { value: 'extreme', label: 'Extreme' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ];
    const actionStatusOptions: readonly { value: ActionStatus; label: string }[] = [
      { value: 'todo', label: 'To do' },
      { value: 'in-progress', label: 'In progress' },
      { value: 'blocked', label: 'Blocked' },
      { value: 'done', label: 'Done' },
      { value: 'cancelled', label: 'Cancelled' },
    ];
    const directionResponseOptions: readonly { value: DirectionResponseState; label: string }[] = [
      { value: 'not-set', label: 'Needs response' },
      { value: 'no', label: 'Not dealt with' },
      { value: 'risk-managed', label: 'Risk-managed' },
      { value: 'yes', label: 'Dealt with' },
    ];
    const renderChips = <T extends string>(
      groupLabel: string,
      testId: string,
      options: readonly { value: T; label: string }[],
      selected: ReadonlySet<T>,
      onToggle: (value: T) => void,
    ): TemplateResult =>
      html`<fieldset class="filter-group" data-testid=${testId}>
        <legend>${groupLabel}</legend>
        ${options.map(
          (option) =>
            html`<label class="chip">
              <input
                type="checkbox"
                ?checked=${selected.has(option.value)}
                @change=${(): void => onToggle(option.value)}
              />
              ${option.label}
            </label>`,
        )}
      </fieldset>`;
    return html`<section class="filters" data-testid="map-filters" aria-label="Map filters">
      ${renderChips(
        'Compliance state',
        'filter-compliance',
        complianceOptions,
        this.complianceFilter,
        (value) => {
          this.complianceFilter = this.#toggleFromSet(this.complianceFilter, value);
        },
      )}
      ${renderChips(
        'Risk band',
        'filter-risk-band',
        riskBandOptions,
        this.riskBandFilter,
        (value) => {
          this.riskBandFilter = this.#toggleFromSet(this.riskBandFilter, value);
        },
      )}
      ${renderChips(
        'Action status',
        'filter-action-status',
        actionStatusOptions,
        this.actionStatusFilter,
        (value) => {
          this.actionStatusFilter = this.#toggleFromSet(this.actionStatusFilter, value);
        },
      )}
      <fieldset class="filter-group">
        <legend>Action urgency</legend>
        <label class="chip">
          <input
            data-testid="filter-action-overdue"
            type="checkbox"
            ?checked=${this.actionOverdueOnly}
            @change=${(e: Event): void => {
              this.actionOverdueOnly = (e.target as HTMLInputElement).checked;
            }}
          />
          Blocked or overdue only
        </label>
      </fieldset>
      ${renderChips(
        'Direction response',
        'filter-direction-response',
        directionResponseOptions,
        this.directionResponseFilter,
        (value) => {
          this.directionResponseFilter = this.#toggleFromSet(this.directionResponseFilter, value);
        },
      )}
      ${this.#activeFilterCount() > 0
        ? html`<button
            type="button"
            data-testid="filter-clear"
            class="filter-clear"
            @click=${(): void => {
              this.complianceFilter = new Set();
              this.riskBandFilter = new Set();
              this.actionStatusFilter = new Set();
              this.actionOverdueOnly = false;
              this.directionResponseFilter = new Set();
            }}
          >
            Clear filters
          </button>`
        : ''}
    </section>`;
  }

  #applySelectionHighlight(): void {
    const cy = this.#cy;
    if (!cy) return;
    cy.elements().removeClass('highlighted dimmed');
    if (!this.selectedNodeId) return;
    const selected = cy.getElementById(this.selectedNodeId);
    if (selected.empty()) return;
    // Highlight the full reachable subgraph (treating edges as undirected) so
    // a selected action lights the whole chain action -> risk -> requirement
    // -> direction. The 1-hop neighbourhood is too narrow for the common
    // assurance question "what does this connect to in the end?".
    const reachable = cy.collection().union(selected);
    const visited = new Set<string>([selected.id()]);
    const queue: string[] = [selected.id()];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = cy.getElementById(id);
      if (node.empty()) continue;
      const incident = node.connectedEdges();
      reachable.merge(incident);
      const neighbours = node.neighborhood('node');
      for (const next of neighbours) {
        if (next && !visited.has(next.id())) {
          visited.add(next.id());
          reachable.merge(next);
          queue.push(next.id());
        }
      }
    }
    cy.elements().not(reachable).addClass('dimmed');
    reachable.addClass('highlighted');
    if (this.#lastCentredNodeId !== this.selectedNodeId) {
      cy.center(selected);
      this.#lastCentredNodeId = this.selectedNodeId;
    }
  }

  #cytoscapeSignature(graph: Pick<RelationshipMapGraph, 'nodes' | 'edges'>): string {
    const nodes = graph.nodes
      .map((node) =>
        [
          node.id,
          node.kind,
          node.label,
          node.complianceState ?? '',
          node.riskBand ?? '',
          node.actionStatus ?? '',
          node.actionOverdue ? 'overdue' : '',
          node.directionResponseState ?? '',
        ].join(':'),
      )
      .join('|');
    const edges = graph.edges
      .map((edge) => [edge.id, edge.source, edge.target, edge.kind].join(':'))
      .join('|');
    return `${nodes}#${edges}`;
  }

  async #copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus = 'Copied map summary.';
    } catch {
      this.copyStatus = 'Copy failed.';
    }
  }

  #renderBoard(graph: RelationshipMapGraph): TemplateResult {
    const { nodes, edges } = graph;
    if (nodes.length === 0) {
      return html`<div class="board" data-testid="map-board">
        <div class="empty" data-testid="empty">
          No work-to-compliance links to display. Link risks, actions or Directions to requirements,
          or log work against a requirement.
        </div>
      </div>`;
    }
    const focusSet = this.#boardFocusSet();
    const linkedSet = this.#boardLinkedSet(focusSet, edges);
    // Order each lane so connected items line up across columns. When a focus
    // is active, focused + linked items are pulled to the top of every lane
    // so the value-chain fits in a single screenful regardless of overall
    // column length.
    const ordered = orderRelationshipMapNodes(graph, focusSet);
    // The Compliance gaps column intentionally omits requirements that are
    // already met or not applicable, so the board reads as outstanding work.
    const requirements = ordered.requirements.filter(
      (n) => n.complianceState !== 'yes' && n.complianceState !== 'not-applicable',
    );
    const hasFocus = focusSet.size > 0;
    return html`<div
      class=${`board${hasFocus ? ' has-focus' : ''}`}
      role="list"
      data-testid="map-board"
      ${ref(this.#onBoardRef)}
    >
      ${this.#renderBoardColumn(
        'Compliance gaps',
        'requirement',
        requirements,
        focusSet,
        linkedSet,
      )}
      ${this.#renderBoardColumn('Risks', 'risk', ordered.risks, focusSet, linkedSet)}
      ${this.#renderBoardColumn('Actions', 'action', ordered.actions, focusSet, linkedSet)}
      ${this.#renderBoardColumn('Directions', 'direction', ordered.directions, focusSet, linkedSet)}
      ${this.#renderBoardEdges(edges, focusSet, linkedSet)}
    </div>`;
  }

  #renderBoardColumn(
    title: string,
    kind: MapNode['kind'],
    items: readonly MapNode[],
    focusSet: ReadonlySet<string>,
    linkedSet: ReadonlySet<string>,
  ): TemplateResult {
    return html`<section
      class="board-column"
      data-testid=${`board-column-${kind}`}
      role="listitem"
      aria-label=${title}
    >
      <h3>${title} <span class="count">(${items.length})</span></h3>
      ${items.length === 0
        ? html`<p class="board-empty">No items.</p>`
        : items.map((node) => this.#renderBoardCard(node, focusSet, linkedSet))}
    </section>`;
  }

  #renderBoardCard(
    node: MapNode,
    focusSet: ReadonlySet<string>,
    linkedSet: ReadonlySet<string>,
  ): TemplateResult {
    const accent = this.#cardAccent(node);
    const meta = this.#cardMeta(node);
    const selected = this.selectedNodeId === node.id;
    const focused = focusSet.has(node.id);
    const linked = linkedSet.has(node.id);
    const dimmed = focusSet.size > 0 && !linked;
    const classes = [
      'board-card',
      selected ? 'selected' : '',
      focused ? 'focused' : '',
      linked && !focused ? 'linked' : '',
      dimmed ? 'dimmed' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return html`<button
      type="button"
      class=${classes}
      data-testid=${`board-card-${node.id}`}
      data-node-id=${node.id}
      style=${`--card-accent: ${accent};`}
      aria-pressed=${focused ? 'true' : 'false'}
      @click=${(e: MouseEvent): void => this.#onBoardCardClick(e, node.id)}
    >
      <span class="card-title">${node.label}</span>
      ${meta ? html`<span class="card-meta">${meta}</span>` : ''}
    </button>`;
  }

  #boardFocusSet(): ReadonlySet<string> {
    if (this.focusedNodeIds.size > 0) return this.focusedNodeIds;
    return this.selectedNodeId ? new Set([this.selectedNodeId]) : new Set();
  }

  #boardLinkedSet(
    focus: ReadonlySet<string>,
    edges: readonly { source: string; target: string }[],
  ): ReadonlySet<string> {
    if (focus.size === 0) return new Set();
    const linked = new Set<string>(focus);
    for (const edge of edges) {
      if (focus.has(edge.source)) linked.add(edge.target);
      if (focus.has(edge.target)) linked.add(edge.source);
    }
    return linked;
  }

  #onBoardCardClick(event: MouseEvent, nodeId: string): void {
    const multi = event.metaKey || event.ctrlKey || event.shiftKey;
    if (multi) {
      event.preventDefault();
      const next = new Set(this.focusedNodeIds);
      // Seed multi-selection with the current single selection so a plain click
      // followed by a Ctrl-click extends the focus rather than starting fresh.
      if (next.size === 0 && this.selectedNodeId) next.add(this.selectedNodeId);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      this.focusedNodeIds = next;
      this.selectedNodeId = next.has(nodeId) ? nodeId : (next.values().next().value ?? '');
      return;
    }
    this.focusedNodeIds = new Set();
    this.selectedNodeId = nodeId;
  }

  #onBoardRef = (el: Element | undefined): void => {
    if (!(el instanceof HTMLDivElement)) {
      this.#teardownBoardObservers();
      this.#boardEl = null;
      return;
    }
    if (this.#boardEl === el) return;
    this.#teardownBoardObservers();
    this.#boardEl = el;
    this.#setupBoardObservers(el);
    this.#scheduleBoardEdgesUpdate();
  };

  #setupBoardObservers(board: HTMLDivElement): void {
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.#scheduleBoardEdgesUpdate());
      ro.observe(board);
      for (const col of board.querySelectorAll('.board-column')) ro.observe(col);
      this.#boardResizeObserver = ro;
    }
    const onScroll = (): void => this.#scheduleBoardEdgesUpdate();
    const cols = Array.from(board.querySelectorAll<HTMLElement>('.board-column'));
    for (const col of cols) col.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    this.#boardScrollCleanup = (): void => {
      for (const col of cols) col.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }

  #teardownBoardObservers(): void {
    this.#boardResizeObserver?.disconnect();
    this.#boardResizeObserver = null;
    this.#boardScrollCleanup?.();
    this.#boardScrollCleanup = null;
    if (this.#boardRafId) {
      cancelAnimationFrame(this.#boardRafId);
      this.#boardRafId = 0;
    }
  }

  #scheduleBoardEdgesUpdate(): void {
    if (this.#boardRafId) return;
    this.#boardRafId = requestAnimationFrame(() => {
      this.#boardRafId = 0;
      this.boardLayoutVersion = (this.boardLayoutVersion + 1) & 0xffff;
    });
  }

  #renderBoardEdges(
    edges: readonly { id: string; source: string; target: string; label: string }[],
    focusSet: ReadonlySet<string>,
    linkedSet: ReadonlySet<string>,
  ): TemplateResult {
    void this.boardLayoutVersion;
    const board = this.#boardEl;
    if (!board) return html`<svg class="board-edges" aria-hidden="true"></svg>`;
    const boardRect = board.getBoundingClientRect();
    const cardRects = new Map<string, DOMRect>();
    const colRects = new Map<HTMLElement, DOMRect>();
    for (const card of board.querySelectorAll<HTMLElement>('.board-card')) {
      const id = card.dataset.nodeId;
      if (!id) continue;
      const col = card.closest<HTMLElement>('.board-column');
      if (!col) continue;
      let colRect = colRects.get(col);
      if (!colRect) {
        colRect = col.getBoundingClientRect();
        colRects.set(col, colRect);
      }
      const r = card.getBoundingClientRect();
      // Skip cards scrolled out of view inside their column (the sticky header
      // occupies ~18px at the top, so allow a small inset).
      if (r.bottom <= colRect.top + 18 || r.top >= colRect.bottom - 4) continue;
      cardRects.set(id, r);
    }
    const hasFocus = focusSet.size > 0;
    const lines: { key: string; d: string; cls: string }[] = [];
    for (const edge of edges) {
      const a = cardRects.get(edge.source);
      const b = cardRects.get(edge.target);
      if (!a || !b) continue;
      const aLeft = a.right < b.left;
      const x1 = (aLeft ? a.right : a.left) - boardRect.left;
      const x2 = (aLeft ? b.left : b.right) - boardRect.left;
      const y1 = a.top + a.height / 2 - boardRect.top;
      const y2 = b.top + b.height / 2 - boardRect.top;
      const dx = Math.abs(x2 - x1);
      const cx1 = x1 + (aLeft ? dx * 0.45 : -dx * 0.45);
      const cx2 = x2 + (aLeft ? -dx * 0.45 : dx * 0.45);
      const highlighted = hasFocus && linkedSet.has(edge.source) && linkedSet.has(edge.target);
      const dimmed = hasFocus && !highlighted;
      const cls = ['edge', highlighted ? 'edge-highlighted' : '', dimmed ? 'edge-dimmed' : '']
        .filter(Boolean)
        .join(' ');
      lines.push({
        key: edge.id,
        d: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
        cls,
      });
    }
    return html`<svg
      class="board-edges"
      width=${boardRect.width}
      height=${boardRect.height}
      aria-hidden="true"
    >
      ${lines.map((l) => svg`<path class=${l.cls} d=${l.d}></path>`)}
    </svg>`;
  }

  #cardAccent(node: MapNode): string {
    switch (node.kind) {
      case 'requirement':
        return `var(--colour-status-${node.complianceState ?? 'not-set'})`;
      case 'risk':
        return `var(--colour-risk-${node.riskBand ?? 'medium'})`;
      case 'action':
        return `var(--colour-action-${node.actionStatus ?? 'todo'})`;
      case 'direction':
        return `var(--colour-direction-${node.directionResponseState ?? 'not-set'})`;
    }
  }

  #cardMeta(node: MapNode): string {
    switch (node.kind) {
      case 'requirement': {
        const state = mapComplianceLabel(node.complianceState ?? 'not-set');
        const work = node.work;
        if (!work) return state;
        return `${state} · ${work.activeActionCount} action${work.activeActionCount === 1 ? '' : 's'} · ${work.openRiskCount} open risk${work.openRiskCount === 1 ? '' : 's'}`;
      }
      case 'risk': {
        const parts = [`${node.riskBand} band`, node.riskStatus ?? ''];
        const t = node.riskTreatment;
        if (t) parts.push(`${t.activeActionsTreating}/${t.actionsTreating} actions`);
        return parts.filter(Boolean).join(' · ');
      }
      case 'action': {
        const parts: string[] = [node.actionStatus ?? 'unknown'];
        if (node.actionOverdue) parts.push('overdue');
        const v = node.actionValue;
        if (v) {
          parts.push(
            `${v.requirementsAddressed} req${v.requirementsAddressed === 1 ? '' : 's'} · ${v.risksTreated} risk${v.risksTreated === 1 ? '' : 's'}`,
          );
        }
        return parts.join(' · ');
      }
      case 'direction': {
        const response = mapDirectionResponseLabel(node.directionResponseState ?? 'not-set');
        const i = node.directionImpact;
        return i
          ? `${response} · ${i.requirementsModified} requirement${i.requirementsModified === 1 ? '' : 's'} affected`
          : response;
      }
    }
  }

  #renderInspector(node: MapNode | undefined, nodes: readonly MapNode[]): TemplateResult {
    if (!node) {
      return html`<aside class="inspector" aria-label="Selected map item">
        <h3>Selection</h3>
        <p>Select a node to inspect compliance and connected work.</p>
      </aside>`;
    }
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    return html`<aside class="inspector" aria-label="Selected map item" data-testid="map-inspector">
      <h3>${node.label}</h3>
      <p>${node.detail}</p>
      <div class="pill-row">${this.#nodePills(node)}</div>
      ${this.#renderNodeBody(node, nodesById)}
      <p><a href=${node.href}>Open source record</a></p>
    </aside>`;
  }

  #renderNodeBody(node: MapNode, nodesById: Map<string, MapNode>): TemplateResult {
    switch (node.kind) {
      case 'requirement':
        return this.#requirementDetails(node);
      case 'action':
        return this.#actionDetails(node, nodesById);
      case 'risk':
        return this.#riskDetails(node, nodesById);
      case 'direction':
        return this.#directionDetails(node, nodesById);
    }
  }

  #nodePills(node: MapNode): TemplateResult {
    if (node.kind === 'requirement') {
      return html`<span class="pill"
        >${mapComplianceLabel(node.complianceState ?? 'not-set')}</span
      >`;
    }
    if (node.kind === 'risk') {
      return html`<span class="pill">${node.riskStatus}</span
        ><span class="pill">${node.riskBand}</span>`;
    }
    if (node.kind === 'action') {
      return html`<span class="pill">${node.actionStatus}</span>${node.actionOverdue
          ? html`<span class="pill">Overdue</span>`
          : ''}`;
    }
    return html`<span class="pill"
      >${mapDirectionResponseLabel(node.directionResponseState ?? 'not-set')}</span
    >`;
  }

  #requirementDetails(node: MapNode): TemplateResult {
    const work = node.work;
    if (!work) return html``;
    return html`<dl>
      <dt>Risks</dt>
      <dd>${work.openRiskCount} open / ${work.riskCount} total</dd>
      <dt>Actions</dt>
      <dd>${work.activeActionCount} active / ${work.actionCount} total</dd>
      <dt>Blocked/overdue</dt>
      <dd>${work.blockedOrOverdueActionCount}</dd>
      <dt>Directions</dt>
      <dd>
        ${work.directionsNeedingResponseCount} needing response / ${work.directionCount} total
      </dd>
      <dt>Work log</dt>
      <dd>${work.workLogCount} entries</dd>
      <dt>Evidence</dt>
      <dd>${work.evidenceCount} items</dd>
    </dl>`;
  }

  #actionDetails(node: MapNode, nodesById: Map<string, MapNode>): TemplateResult {
    const value = node.actionValue;
    const conns = node.connections;
    return html`${value
      ? html`<dl data-testid="action-value">
          <dt>Requirements addressed</dt>
          <dd>${value.requirementsAddressed} (${value.requirementsWithGap} currently a gap)</dd>
          <dt>Uniquely covered</dt>
          <dd>
            ${value.uniquelyCoveredRequirements}
            ${value.uniquelyCoveredRequirements === 1 ? 'requirement' : 'requirements'} would be
            uncovered without this action
          </dd>
          <dt>Risks treated</dt>
          <dd>
            ${value.risksTreated} (${value.openRisksTreated} open,
            ${value.highOrExtremeRisksTreated} high or extreme)
          </dd>
        </dl>`
      : ''}
    ${this.#renderConnectedRequirements(conns, nodesById)}
    ${this.#renderConnectedRisks(conns, nodesById)}`;
  }

  #riskDetails(node: MapNode, nodesById: Map<string, MapNode>): TemplateResult {
    const treatment = node.riskTreatment;
    const conns = node.connections;
    return html`${treatment
      ? html`<dl data-testid="risk-treatment">
          <dt>Requirements affected</dt>
          <dd>
            ${treatment.requirementsAffected} (${treatment.requirementsWithGap} currently a gap)
          </dd>
          <dt>Actions treating</dt>
          <dd>${treatment.activeActionsTreating} active / ${treatment.actionsTreating} total</dd>
          <dt>Blocked or overdue</dt>
          <dd>${treatment.blockedOrOverdueActionsTreating}</dd>
        </dl>`
      : ''}
    ${this.#renderConnectedRequirements(conns, nodesById)}
    ${this.#renderConnectedActions(conns, nodesById)}`;
  }

  #directionDetails(node: MapNode, nodesById: Map<string, MapNode>): TemplateResult {
    const impact = node.directionImpact;
    const conns = node.connections;
    return html`${impact
      ? html`<dl data-testid="direction-impact">
          <dt>Requirements modified</dt>
          <dd>${impact.requirementsModified} (${impact.requirementsWithGap} currently a gap)</dd>
        </dl>`
      : ''}
    ${this.#renderConnectedRequirements(conns, nodesById)}`;
  }

  #renderConnectedRequirements(
    conns: MapNode['connections'],
    nodesById: Map<string, MapNode>,
  ): TemplateResult {
    const ids = conns?.requirementIds ?? [];
    if (ids.length === 0) return html``;
    return html`<section class="connections" data-testid="connected-requirements">
      <h4>Linked requirements</h4>
      <ul>
        ${ids.map((id) => {
          const reqNode = nodesById.get(id);
          const label = reqNode?.label ?? id;
          const stateLabel = mapComplianceLabel(reqNode?.complianceState ?? 'not-set');
          return html`<li>
            <a href=${`#/requirement/${id}`}>${label}</a>
            <span class="pill">${stateLabel}</span>
          </li>`;
        })}
      </ul>
    </section>`;
  }

  #renderConnectedRisks(
    conns: MapNode['connections'],
    nodesById: Map<string, MapNode>,
  ): TemplateResult {
    const ids = conns?.riskIds ?? [];
    if (ids.length === 0) return html``;
    return html`<section class="connections" data-testid="connected-risks">
      <h4>Linked risks</h4>
      <ul>
        ${ids.map((id) => {
          const riskNode = nodesById.get(id);
          if (!riskNode) return html`<li>${id}</li>`;
          return html`<li>
            <a href=${riskNode.href}>${riskNode.label}</a>
            <span class="pill">${riskNode.riskBand ?? 'unknown'}</span>
            <span class="pill">${riskNode.riskStatus ?? 'unknown'}</span>
          </li>`;
        })}
      </ul>
    </section>`;
  }

  #renderConnectedActions(
    conns: MapNode['connections'],
    nodesById: Map<string, MapNode>,
  ): TemplateResult {
    const ids = conns?.actionIds ?? [];
    if (ids.length === 0) return html``;
    return html`<section class="connections" data-testid="connected-actions">
      <h4>Linked actions</h4>
      <ul>
        ${ids.map((id) => {
          const actionNode = nodesById.get(id);
          if (!actionNode) return html`<li>${id}</li>`;
          return html`<li>
            <a href=${actionNode.href}>${actionNode.label}</a>
            <span class="pill">${actionNode.actionStatus ?? 'unknown'}</span>
            ${actionNode.actionOverdue ? html`<span class="pill">Overdue</span>` : ''}
          </li>`;
        })}
      </ul>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-relationship-map-view': RelationshipMapView;
  }
}
