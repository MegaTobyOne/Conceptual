import { consume } from '@lit/context';
import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { designTokens } from '../app/design-tokens.ts';
import {
  buildConnectedView3dLayout,
  connectedNodeIds,
} from '../domain/connected-view-3d-layouts.ts';
import {
  cityBuildingProfile,
  cityNodeCriticalReasons,
  cityNodeHasThroughRoute,
  cityRoadProfile,
  type CityBuildingProfile,
  type CityRoadProfile,
} from '../domain/connected-view-3d-layouts.ts';
import {
  buildRelationshipMapGraph,
  type MapNode,
  type RelationshipMapGraph,
} from '../domain/relationship-map.ts';
import type { AppStore } from '../state/app-store.ts';
import { appStoreContext } from '../state/contexts.ts';
import { SignalWatcher } from '../state/signal-watcher.ts';

type CityEnvironment = 'day' | 'night';

const CITY_ENVIRONMENT_STORAGE_KEY = 'pspf-connected-city-environment';

const SAMPLE_GRAPH: RelationshipMapGraph = {
  nodes: [
    {
      id: 'DIR-01',
      label: 'Direction 01',
      detail: 'Protect critical operations · GOV',
      kind: 'direction',
      href: '',
      directionImpact: { requirementsModified: 3, requirementsWithGap: 2 },
    },
    {
      id: 'DIR-02',
      label: 'Direction 02',
      detail: 'Improve incident readiness · GOV',
      kind: 'direction',
      href: '',
      directionImpact: { requirementsModified: 2, requirementsWithGap: 1 },
    },
    {
      id: 'GOV-001',
      label: 'GOV-001',
      detail: 'Security governance · GOV',
      kind: 'requirement',
      href: '',
      complianceState: 'risk-managed',
      work: {
        riskCount: 2,
        openRiskCount: 2,
        actionCount: 2,
        activeActionCount: 2,
        blockedOrOverdueActionCount: 1,
        directionCount: 1,
        directionsNeedingResponseCount: 1,
        workLogCount: 2,
        evidenceCount: 3,
        hasWork: true,
      },
    },
    {
      id: 'PHY-014',
      label: 'PHY-014',
      detail: 'Facility access controls · PHY',
      kind: 'requirement',
      href: '',
      complianceState: 'no',
      work: {
        riskCount: 1,
        openRiskCount: 1,
        actionCount: 1,
        activeActionCount: 1,
        blockedOrOverdueActionCount: 1,
        directionCount: 1,
        directionsNeedingResponseCount: 0,
        workLogCount: 1,
        evidenceCount: 1,
        hasWork: true,
      },
    },
    {
      id: 'INF-006',
      label: 'INF-006',
      detail: 'Information handling · INF',
      kind: 'requirement',
      href: '',
      complianceState: 'yes',
    },
    {
      id: 'PER-009',
      label: 'PER-009',
      detail: 'Personnel suitability · PER',
      kind: 'requirement',
      href: '',
      complianceState: 'not-set',
    },
    {
      id: 'RSK-21',
      label: 'Credential exposure',
      detail: 'Privileged access is not reviewed · GOV',
      kind: 'risk',
      href: '',
      riskBand: 'extreme',
      riskTreatment: {
        requirementsAffected: 2,
        requirementsWithGap: 2,
        actionsTreating: 2,
        activeActionsTreating: 2,
        blockedOrOverdueActionsTreating: 1,
      },
    },
    {
      id: 'RSK-34',
      label: 'Unverified visitors',
      detail: 'Visitor records are incomplete · PHY',
      kind: 'risk',
      href: '',
      riskBand: 'high',
    },
    {
      id: 'RSK-08',
      label: 'Handling drift',
      detail: 'Local handling practices diverge · INF',
      kind: 'risk',
      href: '',
      riskBand: 'medium',
    },
    {
      id: 'ACT-17',
      label: 'Review privileged access',
      detail: 'Quarterly access review · GOV',
      kind: 'action',
      href: '',
      actionStatus: 'blocked',
      actionOverdue: true,
      actionValue: {
        requirementsAddressed: 2,
        requirementsWithGap: 2,
        uniquelyCoveredRequirements: 1,
        risksTreated: 1,
        openRisksTreated: 1,
        highOrExtremeRisksTreated: 1,
      },
    },
    {
      id: 'ACT-22',
      label: 'Replace visitor register',
      detail: 'Digital visitor workflow · PHY',
      kind: 'action',
      href: '',
      actionStatus: 'in-progress',
      actionValue: {
        requirementsAddressed: 1,
        requirementsWithGap: 1,
        uniquelyCoveredRequirements: 1,
        risksTreated: 1,
        openRisksTreated: 1,
        highOrExtremeRisksTreated: 1,
      },
    },
    {
      id: 'ACT-31',
      label: 'Publish handling guide',
      detail: 'Updated handling guide · INF',
      kind: 'action',
      href: '',
      actionStatus: 'done',
    },
  ],
  edges: [
    {
      id: 'e01',
      source: 'DIR-01',
      target: 'GOV-001',
      kind: 'requirement-direction',
      label: 'modifies',
    },
    {
      id: 'e02',
      source: 'DIR-01',
      target: 'PHY-014',
      kind: 'requirement-direction',
      label: 'modifies',
    },
    {
      id: 'e03',
      source: 'DIR-02',
      target: 'PER-009',
      kind: 'requirement-direction',
      label: 'modifies',
    },
    {
      id: 'e04',
      source: 'GOV-001',
      target: 'RSK-21',
      kind: 'requirement-risk',
      label: 'affected by',
    },
    {
      id: 'e05',
      source: 'PHY-014',
      target: 'RSK-34',
      kind: 'requirement-risk',
      label: 'affected by',
    },
    {
      id: 'e06',
      source: 'INF-006',
      target: 'RSK-08',
      kind: 'requirement-risk',
      label: 'affected by',
    },
    { id: 'e07', source: 'RSK-21', target: 'ACT-17', kind: 'risk-action', label: 'treated by' },
    { id: 'e08', source: 'RSK-34', target: 'ACT-22', kind: 'risk-action', label: 'treated by' },
    { id: 'e09', source: 'RSK-08', target: 'ACT-31', kind: 'risk-action', label: 'treated by' },
    {
      id: 'e10',
      source: 'GOV-001',
      target: 'ACT-22',
      kind: 'requirement-action',
      label: 'remediated by',
    },
  ],
  summary: {
    requirements: 4,
    complianceGapsWithWork: 2,
    complianceGapsWithoutWork: 1,
    blockedOrOverdueActions: 1,
    directionsNeedingResponse: 1,
  },
};

const NODE_COLOURS: Record<MapNode['kind'], number> = {
  direction: 0xffc857,
  requirement: 0x48a9e6,
  risk: 0xef5b5b,
  action: 0x52d273,
};

@customElement('pspf-connected-view-3d-lab')
export class ConnectedView3dLab extends LitElement {
  static override styles = [
    designTokens,
    css`
      :host {
        display: block;
      }
      .lab {
        display: grid;
        gap: var(--space-3);
      }
      .intro {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: var(--space-4);
      }
      h2 {
        margin: 0;
        font-size: var(--text-2xl);
      }
      .intro p,
      .concept-copy p {
        margin: var(--space-1) 0 0;
        color: var(--pspf-muted);
        line-height: 1.5;
      }
      .source {
        flex: 0 0 auto;
        font-size: var(--text-xs);
        color: var(--pspf-muted);
      }
      .scene {
        position: relative;
        min-height: 660px;
        overflow: hidden;
        border-top: 1px solid var(--pspf-border);
        border-bottom: 1px solid var(--pspf-border);
        background: #071015;
      }
      .viewport {
        position: absolute;
        inset: 0;
      }
      .viewport canvas {
        display: block;
        width: 100%;
        height: 100%;
        cursor: grab;
      }
      .viewport canvas:active {
        cursor: grabbing;
      }
      .scene-tools {
        position: absolute;
        top: var(--space-3);
        left: var(--space-3);
        z-index: 2;
        display: flex;
        align-items: end;
        gap: var(--space-2);
      }
      .scene-tools button,
      .scene-tools select {
        min-height: 34px;
        padding: 0 var(--space-3);
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: var(--radius-sm);
        background: rgba(7, 16, 21, 0.84);
        color: #eef7ff;
        backdrop-filter: blur(8px);
      }
      .scene-tools button {
        cursor: pointer;
      }
      .environment-toggle {
        display: flex;
        gap: 1px;
        padding: 2px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: var(--radius-sm);
        background: rgba(7, 16, 21, 0.84);
      }
      .environment-toggle button {
        min-height: 28px;
        border: 0;
        background: transparent;
      }
      .environment-toggle button[aria-pressed='true'] {
        background: var(--pspf-accent);
        color: var(--pspf-accent-ink);
      }
      .focus-control {
        display: grid;
        gap: 2px;
        color: #c8d8e2;
        font-size: var(--text-xs);
      }
      .focus-control select {
        width: 190px;
      }
      .axis {
        position: absolute;
        left: var(--space-3);
        bottom: var(--space-3);
        z-index: 2;
        display: flex;
        gap: var(--space-3);
        color: #c8d8e2;
        font-size: var(--text-xs);
        pointer-events: none;
      }
      .axis span::before {
        content: '';
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 5px;
        border-radius: 50%;
        background: var(--dot);
      }
      .road-legend {
        position: absolute;
        right: var(--space-3);
        bottom: var(--space-3);
        z-index: 2;
        display: flex;
        gap: var(--space-3);
        padding: var(--space-2);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: var(--radius-sm);
        background: rgba(7, 16, 21, 0.82);
        color: #c8d8e2;
        font-size: var(--text-xs);
        pointer-events: none;
      }
      .road-legend span::before {
        content: '';
        display: inline-block;
        width: var(--road-width, 18px);
        height: 3px;
        margin-right: 5px;
        background: var(--road-colour);
        vertical-align: middle;
      }
      .inspector {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        z-index: 2;
        width: min(290px, calc(100% - 1.5rem));
        padding: var(--space-3);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--radius-md);
        background: rgba(7, 16, 21, 0.9);
        color: #eef7ff;
        backdrop-filter: blur(12px);
        box-sizing: border-box;
      }
      .inspector .kind {
        color: #9fb3c2;
        font-size: var(--text-xs);
        text-transform: uppercase;
      }
      .inspector h3 {
        margin: var(--space-1) 0;
        font-size: var(--text-lg);
      }
      .inspector p {
        margin: 0;
        color: #c4d1da;
        font-size: var(--text-sm);
        line-height: 1.45;
      }
      .inspector a {
        display: inline-block;
        margin-top: var(--space-2);
        color: #9ecbff;
      }
      .empty-inspector {
        color: #c4d1da;
        font-size: var(--text-sm);
      }
      .error {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        padding: var(--space-5);
        color: #eef7ff;
        text-align: center;
      }
      .error a {
        color: #9ecbff;
      }
      .concept-copy {
        display: grid;
        grid-template-columns: 1.25fr repeat(3, 1fr);
        gap: var(--space-4);
        padding: var(--space-2) 0 var(--space-4);
      }
      .concept-copy h3,
      .concept-copy h4 {
        margin: 0;
      }
      .concept-copy h4 {
        font-size: var(--text-sm);
      }
      .concept-copy .eyebrow {
        color: var(--pspf-accent);
        font-size: var(--text-xs);
        font-weight: 700;
        text-transform: uppercase;
      }
      @media (max-width: 900px) {
        .scene {
          min-height: 560px;
        }
        .concept-copy {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 560px) {
        .intro {
          display: block;
        }
        .source {
          margin-top: var(--space-2);
        }
        .scene {
          min-height: 620px;
        }
        .inspector {
          top: auto;
          bottom: 84px;
        }
        .scene-tools {
          right: var(--space-3);
          flex-wrap: wrap;
        }
        .focus-control {
          flex-basis: 100%;
        }
        .focus-control select {
          width: 100%;
        }
        .axis {
          bottom: 56px;
          overflow: hidden;
          max-width: calc(100% - 1.5rem);
          white-space: nowrap;
        }
        .road-legend {
          right: auto;
          left: var(--space-3);
          bottom: 12px;
          max-width: calc(100% - 1.5rem);
          overflow: hidden;
          white-space: nowrap;
          box-sizing: border-box;
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

  @state() private accessor environment: CityEnvironment = this.#loadEnvironment();
  @state() private accessor selectedId = '';
  @state() private accessor renderError = '';

  #renderer: THREE.WebGLRenderer | null = null;
  #scene: THREE.Scene | null = null;
  #camera: THREE.PerspectiveCamera | null = null;
  #controls: OrbitControls | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #pickables: THREE.Mesh[] = [];
  #graphSignature = '';

  override firstUpdated(): void {
    this.#initialiseRenderer();
  }

  override updated(): void {
    if (this.#renderer && this.#currentGraphSignature() !== this.#graphSignature) {
      this.#buildScene();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#disposeRenderer();
  }

  override render(): TemplateResult {
    const graph = this.#graph();
    const selected = graph.nodes.find((node) => node.id === this.selectedId);
    const selectedCriticalReasons = selected ? cityNodeCriticalReasons(selected) : [];
    const criticalCount = graph.nodes.filter(
      (node) => cityNodeCriticalReasons(node).length > 0,
    ).length;
    const selectedRouteCount = this.selectedId
      ? graph.edges.filter(
          (edge) => edge.source === this.selectedId || edge.target === this.selectedId,
        ).length
      : 0;
    const selectedHasThroughRoute = this.selectedId
      ? cityNodeHasThroughRoute(graph, this.selectedId)
      : false;
    const selectedRoadProfiles = this.selectedId
      ? graph.edges
          .filter((edge) => edge.source === this.selectedId || edge.target === this.selectedId)
          .map((edge) => cityRoadProfile(graph, edge))
      : [];
    const selectedCongestedRoads = selectedRoadProfiles.filter(
      (profile) => profile.congestion === 'congested',
    ).length;
    const selectedRoadClasses = [
      ...new Set(selectedRoadProfiles.map((profile) => profile.roadClass)),
    ].map((roadClass) => (roadClass === 'local' ? 'local road' : roadClass));
    const usesSample = this.#liveGraph().nodes.length < 4;
    return html` <article class="lab">
      <header class="intro">
        <div>
          <h2>Neon Assurance City</h2>
          <p>
            Explore assurance as a connected city. Buildings express value and condition; local
            roads, arterials and freeways reveal whether work has a viable route through to action.
          </p>
        </div>
        <span class="source"
          >${usesSample
            ? 'Illustrative scenario'
            : `${graph.nodes.length} live records · ${graph.edges.length} links`}</span
        >
      </header>
      <section
        class="scene"
        aria-label="Neon Assurance City interactive view"
        data-environment=${this.environment}
        data-critical-buildings=${criticalCount}
      >
        <div class="viewport" @pointerdown=${this.#selectFromPointer}></div>
        <div class="scene-tools">
          <div class="environment-toggle" role="group" aria-label="City lighting">
            <button
              type="button"
              aria-pressed=${this.environment === 'day' ? 'true' : 'false'}
              @click=${(): void => this.#setEnvironment('day')}
            >
              Day
            </button>
            <button
              type="button"
              aria-pressed=${this.environment === 'night' ? 'true' : 'false'}
              @click=${(): void => this.#setEnvironment('night')}
            >
              Night
            </button>
          </div>
          <label class="focus-control"
            ><span>Focus record</span
            ><select
              .value=${this.selectedId}
              @change=${(event: Event): void => {
                this.selectedId = (event.target as HTMLSelectElement).value;
              }}
            >
              <option value="">Choose a record</option>
              ${graph.nodes.map(
                (node) => html`<option value=${node.id}>${node.label} · ${node.kind}</option>`,
              )}
            </select></label
          >
          <button type="button" @click=${this.#resetCamera}>Reset view</button
          ><button
            type="button"
            @click=${(): void => {
              this.selectedId = '';
            }}
          >
            Clear selection
          </button>
        </div>
        <div class="inspector" aria-live="polite">
          ${selected
            ? html`<span class="kind">${selected.kind}</span>
                <h3>${selected.label}</h3>
                <p>${selected.detail}</p>
                ${selectedCriticalReasons.length > 0
                  ? html`<p><strong>Critical:</strong> ${selectedCriticalReasons.join(' · ')}</p>`
                  : ''}
                <p>
                  ${selectedHasThroughRoute
                    ? `${selectedRouteCount} connecting route${selectedRouteCount === 1 ? '' : 's'} · through route available`
                    : 'No through route to operational action'}
                </p>
                ${selectedRouteCount > 0
                  ? html`<p>
                      ${selectedCongestedRoads > 0
                        ? `${selectedCongestedRoads} congested approach${selectedCongestedRoads === 1 ? '' : 'es'}`
                        : 'Traffic flowing'}
                      · ${selectedRoadClasses.join(' and ')}
                    </p>`
                  : ''}
                ${selected.href ? html`<a href=${selected.href}>Open record</a>` : ''}`
            : html`<span class="empty-inspector"
                >Select a node to reveal its immediate impact chain.</span
              >`}
        </div>
        <div class="axis" aria-hidden="true">
          <span style="--dot:#ffc857">Directions</span
          ><span style="--dot:#48a9e6">Requirements</span><span style="--dot:#ef5b5b">Risks</span
          ><span style="--dot:#52d273">Actions</span>
        </div>
        <div class="road-legend" aria-hidden="true">
          <span style="--road-colour:#38d6ff;--road-width:26px">Freeway</span>
          <span style="--road-colour:#8aa7b8">Arterial</span>
          <span style="--road-colour:#875cff">Local road</span>
          <span style="--road-colour:#ef476f">Congested</span>
        </div>
        ${this.renderError
          ? html`<div class="error">
              <p>${this.renderError}</p>
              <a href="#/map">Open the current 2D Map</a>
            </div>`
          : ''}
      </section>
      <section class="concept-copy">
        <div>
          <span class="eyebrow">Assurance as transport planning</span>
          <h3>Read the city</h3>
          <p>
            Stable districts run from Directions to requirements, risks and actions. Building form
            and height express operational value.
          </p>
        </div>
        <div>
          <h4>Strongest use</h4>
          <p>Trace dependable paths from policy intent to operational action.</p>
        </div>
        <div>
          <h4>Design risk</h4>
          <p>
            A soft glow marks explicit critical conditions only. Road congestion and missing routes
            remain labelled in text.
          </p>
        </div>
        <div>
          <h4>Try in the scene</h4>
          <p>
            Switch between day and night, focus a record, then follow its lit roads to find blocked
            or missing routes.
          </p>
        </div>
      </section>
    </article>`;
  }

  #liveGraph(): RelationshipMapGraph {
    if (!this.store) return { nodes: [], edges: [], summary: SAMPLE_GRAPH.summary };
    return buildRelationshipMapGraph({
      compliance: this.store.compliance.value,
      risks: this.store.risks.value,
      actions: this.store.actions.value,
      directions: this.store.directions.value,
      relationships: this.store.relationships.value,
      workTracking: this.store.workTracking.value,
      visibility: { requirements: true, risks: true, actions: true, directions: true },
    });
  }

  #graph(): RelationshipMapGraph {
    const live = this.#liveGraph();
    if (live.nodes.length < 4) return SAMPLE_GRAPH;
    const nodes = live.nodes.slice(0, 120);
    const ids = new Set(nodes.map((node) => node.id));
    return {
      ...live,
      nodes,
      edges: live.edges
        .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        .slice(0, 240),
    };
  }

  #currentGraphSignature(): string {
    const graph = this.#graph();
    return `${this.environment}|${this.selectedId}|${graph.nodes.map((node) => node.id).join(',')}|${graph.edges.map((edge) => edge.id).join(',')}`;
  }

  #loadEnvironment(): CityEnvironment {
    try {
      return localStorage.getItem(CITY_ENVIRONMENT_STORAGE_KEY) === 'day' ? 'day' : 'night';
    } catch {
      return 'night';
    }
  }

  #setEnvironment(environment: CityEnvironment): void {
    this.environment = environment;
    try {
      localStorage.setItem(CITY_ENVIRONMENT_STORAGE_KEY, environment);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }

  #initialiseRenderer(): void {
    const viewport = this.renderRoot.querySelector<HTMLElement>('.viewport');
    if (!viewport) return;
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.renderError =
          'The 3D graphics context was lost. Your data is unchanged and the current 2D Map remains available.';
      });
      viewport.append(renderer.domElement);
      this.#renderer = renderer;
      this.#camera = new THREE.PerspectiveCamera(48, 1, 0.1, 250);
      this.#controls = new OrbitControls(this.#camera, renderer.domElement);
      this.#controls.enableDamping = true;
      this.#controls.dampingFactor = 0.08;
      this.#controls.minDistance = 12;
      this.#controls.maxDistance = 100;
      this.#resizeObserver = new ResizeObserver(() => this.#resize());
      this.#resizeObserver.observe(viewport);
      renderer.setAnimationLoop(() => {
        this.#controls?.update();
        if (this.#scene && this.#camera) renderer.render(this.#scene, this.#camera);
      });
      this.#resize();
      this.#buildScene();
    } catch {
      this.renderError =
        'This browser could not start the 3D wireframe. The current 2D Map remains available.';
    }
  }

  #buildScene(): void {
    if (!this.#renderer || !this.#camera) return;
    this.#disposeScene();
    const graph = this.#graph();
    if (this.selectedId && !graph.nodes.some((node) => node.id === this.selectedId))
      this.selectedId = '';
    const scene = new THREE.Scene();
    this.#scene = scene;
    this.#addCityEnvironment(scene);

    const positions = buildConnectedView3dLayout(graph, 'city', this.selectedId);
    const connected = this.selectedId
      ? connectedNodeIds(graph, this.selectedId)
      : new Set(graph.nodes.map((node) => node.id));
    const meshes = new Map<string, THREE.Mesh>();
    const roadAnchors = new Map<string, THREE.Vector3>();
    this.#pickables = [];

    for (const node of graph.nodes) {
      const position = positions.get(node.id);
      if (!position) continue;
      const cityProfile = cityBuildingProfile(node);
      const criticalReasons = cityNodeCriticalReasons(node);
      const critical = criticalReasons.length > 0;
      const selected = node.id === this.selectedId;
      const material = new THREE.MeshStandardMaterial({
        color: this.environment === 'night' ? 0x111b29 : 0xd8e3e8,
        emissive: NODE_COLOURS[node.kind],
        emissiveIntensity: critical
          ? this.environment === 'night'
            ? 1.05
            : 0.24
          : this.environment === 'night'
            ? 0.58
            : 0.08,
        roughness: this.environment === 'night' ? 0.22 : 0.62,
        metalness: this.environment === 'night' ? 0.68 : 0.18,
        transparent: true,
        opacity: connected.has(node.id) ? 1 : 0.16,
      });
      const geometry = this.#cityBuildingGeometry(cityProfile);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, cityProfile.height / 2, position.z);
      mesh.userData = { nodeId: node.id };
      scene.add(mesh);
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: selected ? 0xffffff : NODE_COLOURS[node.kind],
          transparent: true,
          opacity: connected.has(node.id) ? 0.92 : 0.12,
        }),
      );
      mesh.add(outline);
      this.#addBuildingAssets(mesh, cityProfile, node);
      roadAnchors.set(node.id, new THREE.Vector3(position.x, 0.12, position.z));
      meshes.set(node.id, mesh);
      this.#pickables.push(mesh);
      if (connected.has(node.id) || graph.nodes.length <= 30) {
        const labelPosition = new THREE.Vector3(position.x, cityProfile.height, position.z);
        scene.add(this.#labelSprite(node.label, labelPosition));
      }
      if (!cityNodeHasThroughRoute(graph, node.id)) {
        this.#addNoRouteMarker(scene, roadAnchors.get(node.id)!);
      }
      if (critical) {
        this.#addCriticalGlow(scene, position.x, cityProfile.height, position.z);
      }
    }

    for (const edge of graph.edges) {
      const source = meshes.get(edge.source);
      const target = meshes.get(edge.target);
      if (!source || !target) continue;
      const highlighted =
        !this.selectedId || (connected.has(edge.source) && connected.has(edge.target));
      const sourceAnchor = roadAnchors.get(edge.source);
      const targetAnchor = roadAnchors.get(edge.target);
      if (sourceAnchor && targetAnchor) {
        this.#addCityRoad(
          scene,
          sourceAnchor,
          targetAnchor,
          cityRoadProfile(graph, edge),
          highlighted,
        );
      }
    }

    this.#graphSignature = this.#currentGraphSignature();
    this.#resetCamera();
  }

  #cityBuildingGeometry(profile: CityBuildingProfile): THREE.BufferGeometry {
    if (profile.shape === 'civic') {
      return new THREE.CylinderGeometry(
        profile.width * 0.48,
        profile.width * 0.62,
        profile.height,
        8,
      );
    }
    if (profile.shape === 'office') {
      return new THREE.BoxGeometry(profile.width, profile.height, profile.depth, 1, 4, 1);
    }
    return new THREE.BoxGeometry(profile.width, profile.height, profile.depth, 1, 3, 1);
  }

  #addBuildingAssets(mesh: THREE.Mesh, profile: CityBuildingProfile, node: MapNode): void {
    const windowColour = this.environment === 'night' ? 0xffd166 : 0x4f7f96;
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: windowColour,
      transparent: true,
      opacity: this.environment === 'night' ? 0.92 : 0.52,
    });
    for (const offset of [-0.22, 0.04, 0.3]) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(profile.width * 0.62, Math.max(0.08, profile.height * 0.055), 0.06),
        windowMaterial.clone(),
      );
      band.position.set(0, profile.height * offset, profile.depth / 2 + 0.04);
      mesh.add(band);
    }
    const rooftop = new THREE.Mesh(
      node.kind === 'direction'
        ? new THREE.CylinderGeometry(0.18, 0.28, 1.4, 8)
        : new THREE.BoxGeometry(profile.width * 0.34, 0.32, profile.depth * 0.34),
      new THREE.MeshStandardMaterial({
        color: this.environment === 'night' ? 0x203040 : 0x8fa4ae,
        roughness: 0.5,
      }),
    );
    rooftop.position.y = profile.height / 2 + (node.kind === 'direction' ? 0.7 : 0.16);
    mesh.add(rooftop);
  }

  #addCriticalGlow(scene: THREE.Scene, x: number, buildingHeight: number, z: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
      gradient.addColorStop(0, 'rgba(255, 214, 102, 0.62)');
      gradient.addColorStop(0.35, 'rgba(255, 126, 72, 0.28)');
      gradient.addColorStop(1, 'rgba(255, 92, 72, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: this.environment === 'night' ? 0.72 : 0.46,
      }),
    );
    halo.position.set(x, buildingHeight + 0.9, z);
    halo.scale.set(5.6, 5.6, 1);
    const light = new THREE.PointLight(0xff8a66, this.environment === 'night' ? 1.8 : 0.65, 10, 2);
    light.position.set(x, buildingHeight + 0.7, z);
    scene.add(halo, light);
  }

  #addCityRoad(
    scene: THREE.Scene,
    source: THREE.Vector3,
    target: THREE.Vector3,
    profile: CityRoadProfile,
    highlighted: boolean,
  ): void {
    const elevation = 0.08;
    const midpointX = (source.x + target.x) / 2;
    const points = [
      new THREE.Vector3(source.x, elevation, source.z),
      new THREE.Vector3(midpointX, elevation, source.z),
      new THREE.Vector3(midpointX, elevation, target.z),
      new THREE.Vector3(target.x, elevation, target.z),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.05);
    const roadWidth =
      profile.roadClass === 'freeway' ? 1.8 : profile.roadClass === 'arterial' ? 1.15 : 0.78;
    const roadColour =
      profile.congestion === 'congested'
        ? 0xef476f
        : profile.congestion === 'busy'
          ? 0xffb703
          : profile.roadClass === 'freeway'
            ? 0x38d6ff
            : profile.roadClass === 'arterial'
              ? 0x8aa7b8
              : 0x875cff;
    const deck = new THREE.Mesh(
      this.#roadRibbonGeometry(curve, roadWidth),
      new THREE.MeshStandardMaterial({
        color: this.environment === 'night' ? 0x101820 : 0x37434a,
        emissive: roadColour,
        emissiveIntensity: highlighted ? (this.environment === 'night' ? 0.52 : 0.12) : 0.04,
        metalness: 0.05,
        roughness: 0.82,
        transparent: true,
        opacity: highlighted ? 0.96 : 0.13,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(deck);

    const centreLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
      new THREE.LineDashedMaterial({
        color: profile.congestion === 'congested' ? 0xffffff : roadColour,
        dashSize: profile.roadClass === 'freeway' ? 0.9 : 0.55,
        gapSize: 0.38,
        transparent: true,
        opacity: highlighted ? 0.95 : 0.12,
      }),
    );
    centreLine.computeLineDistances();
    scene.add(centreLine);

    const trafficCount =
      profile.congestion === 'congested' ? 9 : profile.congestion === 'busy' ? 6 : 3;
    for (let index = 1; index <= trafficCount; index += 1) {
      const point = curve.getPoint(index / (trafficCount + 1));
      const traffic = new THREE.Mesh(
        new THREE.SphereGeometry(profile.roadClass === 'freeway' ? 0.18 : 0.13, 8, 6),
        new THREE.MeshBasicMaterial({
          color: roadColour,
          transparent: true,
          opacity: highlighted ? 1 : 0.1,
        }),
      );
      traffic.position.copy(point).add(new THREE.Vector3(0, 0.18, 0));
      scene.add(traffic);
    }
  }

  #roadRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number): THREE.BufferGeometry {
    const points = curve.getPoints(48);
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      const direction = next.clone().sub(previous).setY(0).normalize();
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(
        width / 2,
      );
      const point = points[index]!;
      const left = point.clone().add(perpendicular);
      const right = point.clone().sub(perpendicular);
      vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
      if (index < points.length - 1) {
        const offset = index * 2;
        indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  #addNoRouteMarker(scene: THREE.Scene, position: THREE.Vector3): void {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.12, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xef476f }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(position).setY(0.2);
    scene.add(ring);
    for (const offset of [-0.8, 0, 0.8]) {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.5, 0.16),
        new THREE.MeshBasicMaterial({ color: offset === 0 ? 0xffffff : 0xef476f }),
      );
      barrier.position.copy(position).add(new THREE.Vector3(0, 0.32, offset));
      scene.add(barrier);
    }
  }

  #labelSprite(label: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle =
        this.environment === 'night' ? 'rgba(7,16,21,.82)' : 'rgba(245,249,251,.88)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = this.environment === 'night' ? '#eef7ff' : '#132734';
      context.font = '600 28px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label.slice(0, 34), 256, 48);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    sprite.position.copy(position).add(new THREE.Vector3(0, 2.45, 0));
    sprite.scale.set(7.6, 1.42, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  #addCityEnvironment(scene: THREE.Scene): void {
    const night = this.environment === 'night';
    const skyColour = night ? 0x030810 : 0x8fc9e8;
    scene.background = new THREE.Color(skyColour);
    scene.fog = new THREE.Fog(skyColour, night ? 58 : 72, night ? 112 : 132);
    scene.add(
      new THREE.HemisphereLight(
        night ? 0x7aa7d8 : 0xdff4ff,
        night ? 0x071015 : 0x698052,
        night ? 1.1 : 2.4,
      ),
    );
    const keyLight = new THREE.DirectionalLight(night ? 0xa9c8ff : 0xfff1c7, night ? 1.5 : 3.8);
    keyLight.position.set(night ? -24 : 20, 34, night ? -18 : 14);
    scene.add(keyLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({
        color: night ? 0x102a22 : 0x4f744b,
        emissive: night ? 0x06140f : 0x000000,
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const grid = new THREE.GridHelper(
      64,
      32,
      night ? 0x1d7598 : 0xd9e1d1,
      night ? 0x103646 : 0x879786,
    );
    grid.position.y = 0.02;
    scene.add(grid);

    const celestial = new THREE.Mesh(
      new THREE.SphereGeometry(night ? 2.4 : 3.2, 24, 16),
      new THREE.MeshBasicMaterial({ color: night ? 0xdcecff : 0xffdf73 }),
    );
    celestial.position.set(night ? -25 : 23, night ? 24 : 28, -34);
    scene.add(celestial);

    if (night) {
      const starPositions: number[] = [];
      for (let index = 0; index < 180; index += 1) {
        starPositions.push(
          ((index * 37) % 100) - 50,
          12 + ((index * 53) % 34),
          -42 + ((index * 29) % 34),
        );
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
      scene.add(
        new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xc9e6ff, size: 0.18 })),
      );
    } else {
      for (const [x, y, z] of [
        [-18, 20, -28],
        [2, 24, -34],
        [20, 18, -24],
      ] as const) {
        const cloud = new THREE.Group();
        for (const offset of [-1.5, 0, 1.5]) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(1.7 - Math.abs(offset) * 0.2, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.72 }),
          );
          puff.position.x = offset;
          cloud.add(puff);
        }
        cloud.position.set(x, y, z);
        scene.add(cloud);
      }
    }

    this.#addStreetAssets(scene, night);
  }

  #addStreetAssets(scene: THREE.Scene, night: boolean): void {
    for (const x of [-11, 0, 11]) {
      for (const z of [-13, -5, 5, 13]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.1, 2.8, 8),
          new THREE.MeshStandardMaterial({ color: 0x27343d, metalness: 0.72, roughness: 0.32 }),
        );
        pole.position.set(x, 1.4, z);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 10, 8),
          new THREE.MeshBasicMaterial({ color: night ? 0xffe8a3 : 0xd7e0e3 }),
        );
        lamp.position.set(x, 2.82, z);
        scene.add(pole, lamp);
        if (night) {
          const light = new THREE.PointLight(0xffd98a, 1.3, 8, 2);
          light.position.copy(lamp.position);
          scene.add(light);
        }
      }
    }
  }

  #selectFromPointer = (event: PointerEvent): void => {
    if (!this.#camera || !this.#renderer) return;
    const rect = this.#renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.#camera);
    const hit = raycaster.intersectObjects(this.#pickables, false)[0];
    const nodeId = hit?.object.userData.nodeId;
    if (typeof nodeId === 'string') this.selectedId = nodeId;
  };

  #resetCamera = (): void => {
    if (!this.#camera || !this.#controls) return;
    this.#camera.position.set(27, 22, 32);
    this.#controls.target.set(0, 3, 0);
    this.#controls.update();
  };

  #resize(): void {
    const viewport = this.renderRoot.querySelector<HTMLElement>('.viewport');
    if (!viewport || !this.#renderer || !this.#camera) return;
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  #disposeScene(): void {
    this.#scene?.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Sprite
      ) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
          material.dispose();
        }
      }
    });
    this.#scene?.clear();
    this.#scene = null;
  }

  #disposeRenderer(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#controls?.dispose();
    this.#controls = null;
    this.#disposeScene();
    this.#renderer?.setAnimationLoop(null);
    this.#renderer?.dispose();
    this.#renderer?.domElement.remove();
    this.#renderer = null;
    this.#camera = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pspf-connected-view-3d-lab': ConnectedView3dLab;
  }
}
