import type {
  Action,
  ActionStatus,
  ComplianceEntry,
  ComplianceState,
  Direction,
  DirectionResponseState,
  Relationship,
  RequirementId,
  Risk,
  RiskStatus,
  WorkTrackingEntry,
} from '../data/types.ts';
import { requirementById } from '../pspf/index.ts';

export type RiskBand = 'low' | 'medium' | 'high' | 'extreme';

function riskBandOf(score: number): RiskBand {
  if (score >= 16) return 'extreme';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export type MapNodeKind = 'requirement' | 'risk' | 'action' | 'direction';

export interface MapVisibility {
  requirements: boolean;
  risks: boolean;
  actions: boolean;
  directions: boolean;
  unlinkedGapsOnly?: boolean;
  /** Optional filter sets — when present, only matching records are included. */
  filters?: MapFilters;
}

export interface MapFilters {
  /** Compliance states to include for requirements. Empty/undefined = all. */
  complianceStates?: readonly ComplianceState[];
  /** Risk bands to include. Empty/undefined = all. */
  riskBands?: readonly RiskBand[];
  /** Risk statuses to include. Empty/undefined = all. */
  riskStatuses?: readonly RiskStatus[];
  /** Action statuses to include. Empty/undefined = all. */
  actionStatuses?: readonly ActionStatus[];
  /** When true, only include actions that are blocked or overdue. */
  actionOverdueOnly?: boolean;
  /** Direction response states to include. Empty/undefined = all. */
  directionResponseStates?: readonly DirectionResponseState[];
}

export interface RequirementWorkSummary {
  riskCount: number;
  openRiskCount: number;
  actionCount: number;
  activeActionCount: number;
  blockedOrOverdueActionCount: number;
  directionCount: number;
  directionsNeedingResponseCount: number;
  workLogCount: number;
  evidenceCount: number;
  hasWork: boolean;
}

/**
 * Compliance value of a single action — answers "if this action ships, what
 * does the organisation get in return for it?"
 */
export interface ActionValueSummary {
  /** Number of distinct requirements this action remediates. */
  requirementsAddressed: number;
  /** Of those, how many are currently a compliance gap (no/risk-managed/not-set). */
  requirementsWithGap: number;
  /** Requirements where this is the only active action — losing this action uncovers them. */
  uniquelyCoveredRequirements: number;
  /** Risks this action treats. */
  risksTreated: number;
  /** Of those, how many are still open. */
  openRisksTreated: number;
  /** Of those, how many are high or extreme band. */
  highOrExtremeRisksTreated: number;
}

/**
 * Treatment context for a single risk — answers "is this risk being worked on,
 * and on whose behalf?"
 */
export interface RiskTreatmentSummary {
  requirementsAffected: number;
  requirementsWithGap: number;
  actionsTreating: number;
  activeActionsTreating: number;
  blockedOrOverdueActionsTreating: number;
}

/** Compliance scope of a single direction. */
export interface DirectionImpactSummary {
  requirementsModified: number;
  requirementsWithGap: number;
}

/**
 * IDs of nodes connected to this node, grouped by kind. The view uses these
 * to draw the value-chain in the inspector without re-walking edges.
 */
export interface NodeConnections {
  requirementIds: readonly string[];
  riskIds: readonly string[];
  actionIds: readonly string[];
  directionIds: readonly string[];
}

export interface MapNode {
  id: string;
  label: string;
  detail: string;
  kind: MapNodeKind;
  href: string;
  complianceState?: ComplianceState;
  riskStatus?: RiskStatus;
  riskBand?: RiskBand;
  actionStatus?: ActionStatus;
  actionOverdue?: boolean;
  directionResponseState?: DirectionResponseState;
  work?: RequirementWorkSummary;
  /** For action nodes: compliance/risk value of the action. */
  actionValue?: ActionValueSummary;
  /** For risk nodes: treatment progress against the risk. */
  riskTreatment?: RiskTreatmentSummary;
  /** For direction nodes: scope of the direction's compliance impact. */
  directionImpact?: DirectionImpactSummary;
  /** IDs of directly connected nodes, grouped by kind. */
  connections?: NodeConnections;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  kind: Relationship['kind'];
  label: string;
}

export interface RelationshipMapSummary {
  requirements: number;
  complianceGapsWithWork: number;
  complianceGapsWithoutWork: number;
  blockedOrOverdueActions: number;
  directionsNeedingResponse: number;
}

export interface RelationshipMapGraph {
  nodes: readonly MapNode[];
  edges: readonly MapEdge[];
  summary: RelationshipMapSummary;
}

export interface BuildRelationshipMapInput {
  compliance: ReadonlyMap<RequirementId, ComplianceEntry>;
  risks: readonly Risk[];
  actions: readonly Action[];
  directions: readonly Direction[];
  relationships: readonly Relationship[];
  workTracking: readonly WorkTrackingEntry[];
  visibility: MapVisibility;
  now?: number;
}

const DEFAULT_VISIBILITY: MapVisibility = {
  requirements: true,
  risks: true,
  actions: true,
  directions: true,
  unlinkedGapsOnly: false,
};

function isRequirementId(id: string): id is RequirementId {
  return /^[A-Z]+-\d+$/.test(id);
}

function isActionOverdue(action: Action, now: number): boolean {
  if (!action.dueAt) return false;
  if (action.status === 'done' || action.status === 'cancelled') return false;
  return new Date(action.dueAt).getTime() < now;
}

function edgeLabel(kind: Relationship['kind']): string {
  switch (kind) {
    case 'requirement-risk':
      return 'Risk affects requirement';
    case 'requirement-action':
      return 'Action remediates requirement';
    case 'risk-action':
      return 'Action treats risk';
    case 'requirement-direction':
      return 'Direction modifies requirement';
  }
}

function complianceGap(state: ComplianceState): boolean {
  return state === 'no' || state === 'risk-managed' || state === 'not-set';
}

export function buildRelationshipMapGraph(input: BuildRelationshipMapInput): RelationshipMapGraph {
  const visibility = { ...DEFAULT_VISIBILITY, ...input.visibility };
  const now = input.now ?? Date.now();
  const filters = visibility.filters ?? {};

  // Pre-filter source records so downstream graph-building, edge collection
  // and value/treatment summaries all operate on the same filtered universe.
  const includesAll = <T>(allowed: readonly T[] | undefined, value: T): boolean =>
    !allowed || allowed.length === 0 || allowed.includes(value);
  const riskMatches = (risk: Risk): boolean => {
    const band = riskBandOf(risk.likelihood * risk.impact);
    return includesAll(filters.riskBands, band) && includesAll(filters.riskStatuses, risk.status);
  };
  const actionMatches = (action: Action): boolean => {
    const overdue = isActionOverdue(action, now);
    if (filters.actionOverdueOnly && action.status !== 'blocked' && !overdue) return false;
    return includesAll(filters.actionStatuses, action.status);
  };
  const directionMatches = (direction: Direction): boolean =>
    includesAll(filters.directionResponseStates, direction.responseState);
  const complianceMatches = (state: ComplianceState): boolean =>
    includesAll(filters.complianceStates, state);

  const inputRisks = input.risks.filter(riskMatches);
  const inputActions = input.actions.filter(actionMatches);
  const inputDirections = input.directions.filter(directionMatches);
  const filteredCompliance = new Map<RequirementId, ComplianceEntry>();
  for (const [id, entry] of input.compliance) {
    if (complianceMatches(entry.state)) filteredCompliance.set(id, entry);
  }

  const risksById = new Map(inputRisks.map((risk) => [risk.id, risk]));
  const actionsById = new Map(inputActions.map((action) => [action.id, action]));
  const directionsById = new Map(inputDirections.map((direction) => [direction.id, direction]));
  const workByRequirement = new Map<string, WorkTrackingEntry[]>();

  for (const entry of input.workTracking) {
    const list = workByRequirement.get(entry.requirementId) ?? [];
    list.push(entry);
    workByRequirement.set(entry.requirementId, list);
  }

  const relatedRiskIds = new Map<string, Set<string>>();
  const relatedActionIds = new Map<string, Set<string>>();
  const relatedDirectionIds = new Map<string, Set<string>>();
  const addRelated = (
    map: Map<string, Set<string>>,
    requirementId: string,
    workId: string,
  ): void => {
    const set = map.get(requirementId) ?? new Set<string>();
    set.add(workId);
    map.set(requirementId, set);
  };

  for (const risk of inputRisks) {
    for (const requirementId of risk.requirementIds)
      addRelated(relatedRiskIds, requirementId, risk.id);
  }
  for (const action of inputActions) {
    for (const requirementId of action.requirementIds) {
      addRelated(relatedActionIds, requirementId, action.id);
    }
  }
  for (const direction of inputDirections) {
    for (const requirementId of direction.requirementIds) {
      addRelated(relatedDirectionIds, requirementId, direction.id);
    }
  }
  for (const relationship of input.relationships) {
    const [first, second] = relationship.endpoints;
    const requirementId = isRequirementId(first)
      ? first
      : isRequirementId(second)
        ? second
        : undefined;
    const other = requirementId === first ? second : first;
    if (!requirementId) continue;
    switch (relationship.kind) {
      case 'requirement-risk':
        if (risksById.has(other as Risk['id'])) addRelated(relatedRiskIds, requirementId, other);
        break;
      case 'requirement-action':
        if (actionsById.has(other as Action['id']))
          addRelated(relatedActionIds, requirementId, other);
        break;
      case 'requirement-direction':
        if (directionsById.has(other as Direction['id'])) {
          addRelated(relatedDirectionIds, requirementId, other);
        }
        break;
      case 'risk-action':
        break;
    }
  }

  const requirementWorkSummary = (requirementId: string): RequirementWorkSummary => {
    const riskIds = [...(relatedRiskIds.get(requirementId) ?? [])];
    const actionIds = [...(relatedActionIds.get(requirementId) ?? [])];
    const directionIds = [...(relatedDirectionIds.get(requirementId) ?? [])];
    const risks = riskIds
      .map((id) => risksById.get(id as Risk['id']))
      .filter((risk): risk is Risk => Boolean(risk));
    const actions = actionIds
      .map((id) => actionsById.get(id as Action['id']))
      .filter((action): action is Action => Boolean(action));
    const directions = directionIds
      .map((id) => directionsById.get(id as Direction['id']))
      .filter((direction): direction is Direction => Boolean(direction));
    const entry = input.compliance.get(requirementId as RequirementId);
    const workLogCount = workByRequirement.get(requirementId)?.length ?? 0;
    const evidenceCount = entry?.evidence.length ?? 0;
    const blockedOrOverdueActionCount = actions.filter(
      (action) => action.status === 'blocked' || isActionOverdue(action, now),
    ).length;
    const summary: RequirementWorkSummary = {
      riskCount: risks.length,
      openRiskCount: risks.filter((risk) => risk.status !== 'closed').length,
      actionCount: actions.length,
      activeActionCount: actions.filter(
        (action) => action.status !== 'done' && action.status !== 'cancelled',
      ).length,
      blockedOrOverdueActionCount,
      directionCount: directions.length,
      directionsNeedingResponseCount: directions.filter(
        (direction) => direction.responseState === 'not-set' || direction.responseState === 'no',
      ).length,
      workLogCount,
      evidenceCount,
      hasWork: risks.length + actions.length + directions.length + workLogCount + evidenceCount > 0,
    };
    return summary;
  };

  const nodeMap = new Map<string, MapNode>();
  const addNode = (node: MapNode): void => {
    if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
  };
  const visibleRequirement = (requirementId: string): boolean => {
    if (!visibility.requirements) return false;
    const state = input.compliance.get(requirementId as RequirementId)?.state ?? 'not-set';
    const work = requirementWorkSummary(requirementId);
    if (visibility.unlinkedGapsOnly) return complianceGap(state) && !work.hasWork;
    return true;
  };
  const addRequirementNode = (requirementId: string): void => {
    if (!visibleRequirement(requirementId)) return;
    const requirement = requirementById.get(requirementId as RequirementId);
    const state = input.compliance.get(requirementId as RequirementId)?.state ?? 'not-set';
    const work = requirementWorkSummary(requirementId);
    addNode({
      id: requirementId,
      label: requirementId,
      detail: requirement ? `${requirement.title} · ${requirement.domain}` : 'Unknown requirement',
      kind: 'requirement',
      href: `#/requirement/${requirementId}`,
      complianceState: state,
      work,
    });
  };

  if (visibility.risks && !visibility.unlinkedGapsOnly) {
    for (const risk of inputRisks) {
      addNode({
        id: risk.id,
        label: risk.title,
        detail: `${risk.status} · ${risk.likelihood * risk.impact} ${riskBandOf(risk.likelihood * risk.impact)} risk`,
        kind: 'risk',
        href: '#/risks',
        riskStatus: risk.status,
        riskBand: riskBandOf(risk.likelihood * risk.impact),
      });
    }
  }
  if (visibility.actions && !visibility.unlinkedGapsOnly) {
    for (const action of inputActions) {
      const actionOverdue = isActionOverdue(action, now);
      addNode({
        id: action.id,
        label: action.title,
        detail: `${action.status}${actionOverdue ? ' · overdue' : ''} · ${action.type}`,
        kind: 'action',
        href: '#/actions',
        actionStatus: action.status,
        actionOverdue,
      });
    }
  }
  if (visibility.directions && !visibility.unlinkedGapsOnly) {
    for (const direction of inputDirections) {
      addNode({
        id: direction.id,
        label: direction.reference,
        detail: `${direction.responseState} · ${direction.title}`,
        kind: 'direction',
        href: '#/directions',
        directionResponseState: direction.responseState,
      });
    }
  }

  if (visibility.requirements) {
    for (const entry of filteredCompliance.values()) {
      if (complianceGap(entry.state) || workByRequirement.has(entry.requirementId)) {
        addRequirementNode(entry.requirementId);
      }
    }
    // Auto-emit work-only requirements only if no compliance-state filter is
    // active (otherwise the user has explicitly narrowed the view).
    const filteringByState =
      Array.isArray(filters.complianceStates) && filters.complianceStates.length > 0;
    if (!filteringByState) {
      for (const requirementId of workByRequirement.keys()) addRequirementNode(requirementId);
    }
  }

  const edgeMap = new Map<string, MapEdge>();
  const addEdge = (source: string, target: string, kind: Relationship['kind']): void => {
    if (!nodeMap.has(source) || !nodeMap.has(target)) return;
    const [normalSource, normalTarget] = source <= target ? [source, target] : [target, source];
    const id = `${kind}:${normalSource}->${normalTarget}`;
    if (edgeMap.has(id)) return;
    edgeMap.set(id, { id, source, target, kind, label: edgeLabel(kind) });
  };

  if (visibility.risks && !visibility.unlinkedGapsOnly) {
    for (const risk of inputRisks) {
      if (visibility.requirements) {
        for (const requirementId of risk.requirementIds) {
          addRequirementNode(requirementId);
          addEdge(requirementId, risk.id, 'requirement-risk');
        }
      }
      if (visibility.actions) {
        for (const actionId of risk.actionIds) addEdge(risk.id, actionId, 'risk-action');
      }
    }
  }
  if (visibility.actions && !visibility.unlinkedGapsOnly) {
    for (const action of inputActions) {
      if (visibility.requirements) {
        for (const requirementId of action.requirementIds) {
          addRequirementNode(requirementId);
          addEdge(requirementId, action.id, 'requirement-action');
        }
      }
      if (visibility.risks) {
        for (const riskId of action.riskIds) addEdge(riskId, action.id, 'risk-action');
      }
    }
  }
  if (visibility.directions && visibility.requirements && !visibility.unlinkedGapsOnly) {
    for (const direction of inputDirections) {
      for (const requirementId of direction.requirementIds) {
        addRequirementNode(requirementId);
        addEdge(requirementId, direction.id, 'requirement-direction');
      }
    }
  }

  if (!visibility.unlinkedGapsOnly) {
    for (const relationship of input.relationships) {
      const [first, second] = relationship.endpoints;
      if (isRequirementId(first)) addRequirementNode(first);
      if (isRequirementId(second)) addRequirementNode(second);
      addEdge(first, second, relationship.kind);
    }
  }

  const visibleRequirements = [...nodeMap.values()].filter((node) => node.kind === 'requirement');
  const summary: RelationshipMapSummary = {
    requirements: visibleRequirements.length,
    complianceGapsWithWork: visibleRequirements.filter(
      (node) => complianceGap(node.complianceState ?? 'not-set') && node.work?.hasWork,
    ).length,
    complianceGapsWithoutWork: visibleRequirements.filter(
      (node) => complianceGap(node.complianceState ?? 'not-set') && !node.work?.hasWork,
    ).length,
    blockedOrOverdueActions: inputActions.filter(
      (action) => action.status === 'blocked' || isActionOverdue(action, now),
    ).length,
    directionsNeedingResponse: inputDirections.filter(
      (direction) => direction.responseState === 'not-set' || direction.responseState === 'no',
    ).length,
  };

  // -------- Enrich non-requirement nodes with value/treatment/impact summaries --------

  const isActionActive = (action: Action): boolean =>
    action.status !== 'done' && action.status !== 'cancelled';
  const requirementGap = (requirementId: string): boolean =>
    complianceGap(input.compliance.get(requirementId as RequirementId)?.state ?? 'not-set');

  // Active actions per requirement (within the filtered universe) — used to
  // identify uniquely-covered requirements.
  const activeActionsByRequirement = new Map<string, Set<string>>();
  for (const action of inputActions) {
    if (!isActionActive(action)) continue;
    for (const requirementId of action.requirementIds) {
      const set = activeActionsByRequirement.get(requirementId) ?? new Set<string>();
      set.add(action.id);
      activeActionsByRequirement.set(requirementId, set);
    }
  }

  // Build per-node connection sets from the visible edges.
  const connectionsByNode = new Map<
    string,
    { requirements: Set<string>; risks: Set<string>; actions: Set<string>; directions: Set<string> }
  >();
  const ensureConnections = (id: string) => {
    let entry = connectionsByNode.get(id);
    if (!entry) {
      entry = {
        requirements: new Set(),
        risks: new Set(),
        actions: new Set(),
        directions: new Set(),
      };
      connectionsByNode.set(id, entry);
    }
    return entry;
  };
  const recordConnection = (fromId: string, toId: string): void => {
    const toNode = nodeMap.get(toId);
    if (!toNode) return;
    const entry = ensureConnections(fromId);
    if (toNode.kind === 'requirement') entry.requirements.add(toId);
    else if (toNode.kind === 'risk') entry.risks.add(toId);
    else if (toNode.kind === 'action') entry.actions.add(toId);
    else if (toNode.kind === 'direction') entry.directions.add(toId);
  };
  for (const edge of edgeMap.values()) {
    recordConnection(edge.source, edge.target);
    recordConnection(edge.target, edge.source);
  }

  const enrichedNodes: MapNode[] = [...nodeMap.values()].map((node) => {
    const conns = connectionsByNode.get(node.id);
    const connections: NodeConnections = {
      requirementIds: conns ? [...conns.requirements].sort() : [],
      riskIds: conns ? [...conns.risks].sort() : [],
      actionIds: conns ? [...conns.actions].sort() : [],
      directionIds: conns ? [...conns.directions].sort() : [],
    };
    if (node.kind === 'action') {
      const action = actionsById.get(node.id as Action['id']);
      const requirementIds = connections.requirementIds;
      const risks = connections.riskIds
        .map((id) => risksById.get(id as Risk['id']))
        .filter((risk): risk is Risk => Boolean(risk));
      const isThisActionActive = action ? isActionActive(action) : false;
      const uniquelyCoveredRequirements = isThisActionActive
        ? requirementIds.filter((requirementId) => {
            const active = activeActionsByRequirement.get(requirementId);
            return active?.size === 1 && active.has(node.id);
          }).length
        : 0;
      const actionValue: ActionValueSummary = {
        requirementsAddressed: requirementIds.length,
        requirementsWithGap: requirementIds.filter(requirementGap).length,
        uniquelyCoveredRequirements,
        risksTreated: risks.length,
        openRisksTreated: risks.filter((risk) => risk.status === 'open').length,
        highOrExtremeRisksTreated: risks.filter((risk) => {
          const band = riskBandOf(risk.likelihood * risk.impact);
          return band === 'high' || band === 'extreme';
        }).length,
      };
      return { ...node, connections, actionValue };
    }
    if (node.kind === 'risk') {
      const requirementIds = connections.requirementIds;
      const actions = connections.actionIds
        .map((id) => actionsById.get(id as Action['id']))
        .filter((action): action is Action => Boolean(action));
      const riskTreatment: RiskTreatmentSummary = {
        requirementsAffected: requirementIds.length,
        requirementsWithGap: requirementIds.filter(requirementGap).length,
        actionsTreating: actions.length,
        activeActionsTreating: actions.filter(isActionActive).length,
        blockedOrOverdueActionsTreating: actions.filter(
          (action) => action.status === 'blocked' || isActionOverdue(action, now),
        ).length,
      };
      return { ...node, connections, riskTreatment };
    }
    if (node.kind === 'direction') {
      const requirementIds = connections.requirementIds;
      const directionImpact: DirectionImpactSummary = {
        requirementsModified: requirementIds.length,
        requirementsWithGap: requirementIds.filter(requirementGap).length,
      };
      return { ...node, connections, directionImpact };
    }
    return { ...node, connections };
  });

  return { nodes: enrichedNodes, edges: [...edgeMap.values()], summary };
}

export function formatRelationshipMapSummary(graph: RelationshipMapGraph): string {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const requirementNodes = graph.nodes
    .filter((node) => node.kind === 'requirement')
    .sort((left, right) => {
      const leftGap = complianceGap(left.complianceState ?? 'not-set') ? 0 : 1;
      const rightGap = complianceGap(right.complianceState ?? 'not-set') ? 0 : 1;
      return leftGap - rightGap || left.id.localeCompare(right.id);
    });

  if (requirementNodes.length === 0) {
    return 'Relationship map summary\n\nNo visible requirements in the current map view.';
  }

  const lines = [
    'Relationship map summary',
    '',
    `Requirements: ${graph.summary.requirements}`,
    `Gaps with work: ${graph.summary.complianceGapsWithWork}`,
    `Gaps without work: ${graph.summary.complianceGapsWithoutWork}`,
    `Blocked/overdue actions: ${graph.summary.blockedOrOverdueActions}`,
    `Directions needing response: ${graph.summary.directionsNeedingResponse}`,
    '',
  ];

  for (const requirement of requirementNodes) {
    const connected = graph.edges
      .filter((edge) => edge.source === requirement.id || edge.target === requirement.id)
      .map((edge) => nodesById.get(edge.source === requirement.id ? edge.target : edge.source))
      .filter((node): node is MapNode => Boolean(node));
    const risks = connected.filter((node) => node.kind === 'risk');
    const actions = connected.filter((node) => node.kind === 'action');
    const directions = connected.filter((node) => node.kind === 'direction');
    const work = requirement.work;

    lines.push(`${requirement.label}: ${requirement.detail}`);
    lines.push(`Compliance: ${requirement.complianceState ?? 'not-set'}`);
    lines.push(
      `Risks: ${risks.length > 0 ? risks.map((node) => `${node.label} (${node.riskBand ?? 'unknown'}, ${node.riskStatus ?? 'unknown'})`).join('; ') : 'None visible'}`,
    );
    lines.push(
      `Actions: ${actions.length > 0 ? actions.map((node) => `${node.label} (${node.actionStatus ?? 'unknown'}${node.actionOverdue ? ', overdue' : ''})`).join('; ') : 'None visible'}`,
    );
    lines.push(
      `Directions: ${directions.length > 0 ? directions.map((node) => `${node.label} (${node.directionResponseState ?? 'unknown'})`).join('; ') : 'None visible'}`,
    );
    lines.push(`Work log: ${work?.workLogCount ?? 0} entries`);
    lines.push(`Evidence: ${work?.evidenceCount ?? 0} items`);
    lines.push('');
  }

  const actionNodes = graph.nodes
    .filter((node) => node.kind === 'action' && node.actionValue)
    .sort((left, right) => {
      // Most-valuable actions first: prefer those with the most uniquely-covered
      // requirements, then total gaps remediated, then risks treated.
      const leftValue = left.actionValue!;
      const rightValue = right.actionValue!;
      return (
        rightValue.uniquelyCoveredRequirements - leftValue.uniquelyCoveredRequirements ||
        rightValue.requirementsWithGap - leftValue.requirementsWithGap ||
        rightValue.risksTreated - leftValue.risksTreated ||
        left.label.localeCompare(right.label)
      );
    });

  if (actionNodes.length > 0) {
    lines.push('Action compliance value');
    lines.push('');
    for (const action of actionNodes) {
      const value = action.actionValue!;
      lines.push(
        `${action.label}: ${action.actionStatus ?? 'unknown'}${action.actionOverdue ? ' (overdue)' : ''}`,
      );
      lines.push(
        `Requirements addressed: ${value.requirementsAddressed} (${value.requirementsWithGap} currently a gap)`,
      );
      lines.push(
        `Uniquely covered: ${value.uniquelyCoveredRequirements} ${value.uniquelyCoveredRequirements === 1 ? 'requirement' : 'requirements'} would be uncovered without this action`,
      );
      lines.push(
        `Risks treated: ${value.risksTreated} (${value.openRisksTreated} open, ${value.highOrExtremeRisksTreated} high or extreme)`,
      );
      lines.push('');
    }
  }

  const riskNodes = graph.nodes
    .filter((node) => node.kind === 'risk' && node.riskTreatment)
    .sort((left, right) => {
      // Highest exposure first: requirements-with-gap, then blocked/overdue, then label.
      const leftTreatment = left.riskTreatment!;
      const rightTreatment = right.riskTreatment!;
      return (
        rightTreatment.requirementsWithGap - leftTreatment.requirementsWithGap ||
        rightTreatment.blockedOrOverdueActionsTreating -
          leftTreatment.blockedOrOverdueActionsTreating ||
        left.label.localeCompare(right.label)
      );
    });

  if (riskNodes.length > 0) {
    lines.push('Risk treatment progress');
    lines.push('');
    for (const risk of riskNodes) {
      const treatment = risk.riskTreatment!;
      lines.push(`${risk.label} (${risk.riskBand ?? 'unknown'}, ${risk.riskStatus ?? 'unknown'})`);
      lines.push(
        `Requirements affected: ${treatment.requirementsAffected} (${treatment.requirementsWithGap} currently a gap)`,
      );
      lines.push(
        `Actions treating: ${treatment.activeActionsTreating} active / ${treatment.actionsTreating} total (${treatment.blockedOrOverdueActionsTreating} blocked or overdue)`,
      );
      lines.push('');
    }
  }

  const directionNodes = graph.nodes
    .filter((node) => node.kind === 'direction' && node.directionImpact)
    .sort((left, right) => {
      const leftImpact = left.directionImpact!;
      const rightImpact = right.directionImpact!;
      return (
        rightImpact.requirementsWithGap - leftImpact.requirementsWithGap ||
        left.label.localeCompare(right.label)
      );
    });

  if (directionNodes.length > 0) {
    lines.push('Direction impact');
    lines.push('');
    for (const direction of directionNodes) {
      const impact = direction.directionImpact!;
      lines.push(`${direction.label}: ${direction.directionResponseState ?? 'unknown'}`);
      lines.push(
        `Requirements modified: ${impact.requirementsModified} (${impact.requirementsWithGap} currently a gap)`,
      );
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}

/**
 * Layout-friendly ordering of map nodes.
 *
 * Treats the map as four left-to-right lanes — requirements → risks → actions
 * → directions — and sorts each lane so connected items line up vertically
 * with their neighbours (a barycentre / median-of-neighbours sort, the same
 * heuristic used by Sugiyama-style layered graph layouts to reduce edge
 * crossings). The result is used by both Board mode (column ordering) and
 * Graph mode's "Lanes" preset layout, so the two views share a single
 * visual story instead of presenting unrelated arrangements.
 *
 * When `focus` is provided, every lane partitions into [focus ∪ linked,
 * everything else] preserving the barycentre order within each partition.
 * This keeps the focused item and its connections at the top of every lane
 * so a single glance shows the value-chain for the current selection.
 */
export interface OrderedRelationshipMap {
  requirements: readonly MapNode[];
  risks: readonly MapNode[];
  actions: readonly MapNode[];
  directions: readonly MapNode[];
  /** Position (row index) of each node id within its lane. */
  positions: ReadonlyMap<string, number>;
}

export function orderRelationshipMapNodes(
  graph: RelationshipMapGraph,
  focus?: ReadonlySet<string>,
): OrderedRelationshipMap {
  const requirements = graph.nodes.filter((n) => n.kind === 'requirement').slice();
  const risks = graph.nodes.filter((n) => n.kind === 'risk').slice();
  const actions = graph.nodes.filter((n) => n.kind === 'action').slice();
  const directions = graph.nodes.filter((n) => n.kind === 'direction').slice();

  // Anchor lane: requirements ordered by compliance gap urgency, then id, so
  // open gaps lead the value chain in both views.
  requirements.sort((a, b) => {
    const aGap = complianceGap(a.complianceState ?? 'not-set') ? 0 : 1;
    const bGap = complianceGap(b.complianceState ?? 'not-set') ? 0 : 1;
    return aGap - bGap || a.id.localeCompare(b.id);
  });

  const indexOf = (list: readonly MapNode[]): Map<string, number> => {
    const map = new Map<string, number>();
    list.forEach((node, i) => map.set(node.id, i));
    return map;
  };

  const reqIndex = indexOf(requirements);

  // Median of connected neighbour positions; nodes with no usable neighbour
  // sink to the bottom of the lane (Number.POSITIVE_INFINITY) but keep their
  // relative id order for stability.
  const median = (values: readonly number[]): number => {
    if (values.length === 0) return Number.POSITIVE_INFINITY;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };

  const lookup = (ids: readonly string[] | undefined, idx: Map<string, number>): number[] => {
    if (!ids) return [];
    const out: number[] = [];
    for (const id of ids) {
      const v = idx.get(id);
      if (v !== undefined) out.push(v);
    }
    return out;
  };

  const sortByMedian = (list: MapNode[], score: (node: MapNode) => number): void => {
    list.sort((a, b) => {
      const ay = score(a);
      const by = score(b);
      if (ay !== by) return ay - by;
      return a.id.localeCompare(b.id);
    });
  };

  // Risks sit between requirements and actions — anchor them to requirements.
  sortByMedian(risks, (n) => median(lookup(n.connections?.requirementIds, reqIndex)));
  const riskIndex = indexOf(risks);

  // Actions reference both requirements and risks; combining the two yields
  // a position roughly halfway between the two upstream lanes.
  sortByMedian(actions, (n) =>
    median([
      ...lookup(n.connections?.requirementIds, reqIndex),
      ...lookup(n.connections?.riskIds, riskIndex),
    ]),
  );

  // Directions only relate to requirements at the data-model level.
  sortByMedian(directions, (n) => median(lookup(n.connections?.requirementIds, reqIndex)));

  const partitionByFocus = (list: MapNode[]): MapNode[] => {
    if (!focus || focus.size === 0) return list;
    const linked = new Set<string>(focus);
    for (const edge of graph.edges) {
      if (focus.has(edge.source)) linked.add(edge.target);
      if (focus.has(edge.target)) linked.add(edge.source);
    }
    const top: MapNode[] = [];
    const rest: MapNode[] = [];
    for (const n of list) (linked.has(n.id) ? top : rest).push(n);
    return [...top, ...rest];
  };

  const orderedReq = partitionByFocus(requirements);
  const orderedRisk = partitionByFocus(risks);
  const orderedAct = partitionByFocus(actions);
  const orderedDir = partitionByFocus(directions);

  const positions = new Map<string, number>();
  for (const lane of [orderedReq, orderedRisk, orderedAct, orderedDir]) {
    lane.forEach((n, i) => positions.set(n.id, i));
  }

  return {
    requirements: orderedReq,
    risks: orderedRisk,
    actions: orderedAct,
    directions: orderedDir,
    positions,
  };
}
