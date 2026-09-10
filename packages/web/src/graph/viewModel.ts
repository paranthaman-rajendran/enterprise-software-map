/**
 * Decides what is on screen. Given the whole map and the current view state, it returns the
 * exact node and edge set to draw, plus which of those should be dimmed.
 *
 * This is where progressive disclosure lives: the canvas draws whatever this returns and knows
 * nothing about levels, focus, or filters. Keeping it a pure function means the interesting
 * behaviour is testable without a browser.
 */
import {
  buildIndex,
  childrenOf,
  descendantIds,
  edgeMatchesViewMode,
  hasChildren,
  matchesPropertyFilters,
  nodeMatchesViewMode,
  projectEdges,
  traverse,
  type AggregatedEdge,
  type EdgeType,
  type GraphIndex,
  type GraphMap,
  type GraphNode,
  type Level,
  type NodeType,
  type ViewMode,
} from '@map/shared';

export interface Filters {
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
  maxLevel: Level | null;
  properties: Array<{ key: string; value: string }>;
  weightMin: number | null;
  weightMax: number | null;
}

export const emptyFilters: Filters = {
  nodeTypes: [],
  edgeTypes: [],
  maxLevel: null,
  properties: [],
  weightMin: null,
  weightMax: null,
};

export interface ViewSpec {
  /** The node whose children are on screen; null means L0. */
  contextId: string | null;
  viewMode: ViewMode;
  /** FR-6: nodes expanded in place, drawn as compound nodes containing their children. */
  expandedIds: string[];
  /** FR-7: when set, only this node, its descendants, and its neighbours are drawn. */
  focusId: string | null;
  /** FR-8: how many hops of neighbours focus mode includes. */
  focusDepth: number;
  /** FR-17: the node whose blast radius is highlighted, if any. */
  impactId: string | null;
  impactDepth: number;
  impactDirection: 'upstream' | 'downstream' | 'both';
  filters: Filters;
}

export const defaultViewSpec: ViewSpec = {
  contextId: null,
  viewMode: 'combined',
  expandedIds: [],
  focusId: null,
  focusDepth: 1,
  impactId: null,
  impactDepth: 2,
  impactDirection: 'both',
  filters: emptyFilters,
};

export interface RenderNode {
  node: GraphNode;
  /** FR-5: whether drilling into this node would show anything. */
  isLeaf: boolean;
  /** True when this node is drawn as a container around its children (FR-6). */
  isExpanded: boolean;
  /** The compound parent to draw this node inside, or null when it sits at the top of the canvas. */
  compoundParent: string | null;
  /** FR-19: dimmed rather than hidden, so context is kept. */
  dimmed: boolean;
  /** Hops from the impact origin, when impact highlighting is on. */
  impactHops: number | null;
}

export interface RenderModel {
  nodes: RenderNode[];
  edges: AggregatedEdge[];
  visibleIds: Set<string>;
  /** True when the current context genuinely has no children — NFR-7 wants this said out loud. */
  contextIsEmpty: boolean;
  index: GraphIndex;
}

function passesNodeFilters(node: GraphNode, filters: Filters): boolean {
  if (filters.nodeTypes.length > 0 && !filters.nodeTypes.includes(node.type)) return false;
  if (filters.maxLevel !== null && node.level > filters.maxLevel) return false;
  if (filters.properties.length > 0 && !matchesPropertyFilters(node, filters.properties)) return false;
  return true;
}

function passesEdgeFilters(edge: AggregatedEdge, filters: Filters): boolean {
  if (filters.edgeTypes.length > 0) {
    const types = edge.underlying.map((e) => e.type);
    if (!types.some((t) => filters.edgeTypes.includes(t))) return false;
  }
  if (filters.weightMin !== null && edge.weight < filters.weightMin) return false;
  if (filters.weightMax !== null && edge.weight > filters.weightMax) return false;
  return true;
}

/**
 * The node set before filtering: the current level, plus the children of anything expanded in
 * place, or — in focus mode — one node's own world.
 */
function collectCandidates(index: GraphIndex, spec: ViewSpec): Map<string, string | null> {
  /** id -> the compound parent to draw it inside (null = top level of the canvas). */
  const candidates = new Map<string, string | null>();

  if (spec.focusId !== null && index.nodes.has(spec.focusId)) {
    // FR-7: the focused node, everything under it, and its neighbours to `focusDepth` hops.
    const inFocus = descendantIds(index, spec.focusId);
    for (const id of inFocus) {
      const node = index.nodes.get(id)!;
      const parent = node.parent;
      candidates.set(id, parent !== null && inFocus.has(parent) ? parent : null);
    }
    for (const neighbourId of traverse(index, spec.focusId, { depth: spec.focusDepth }).keys()) {
      if (!candidates.has(neighbourId)) candidates.set(neighbourId, null);
    }
    return candidates;
  }

  const expanded = new Set(spec.expandedIds);
  const walk = (parentId: string | null, compoundParent: string | null): void => {
    for (const child of childrenOf(index, parentId)) {
      candidates.set(child.id, compoundParent);
      // FR-6: an expanded node draws its own children inside it, at mixed depth.
      if (expanded.has(child.id) && hasChildren(index, child.id)) walk(child.id, child.id);
    }
  };
  walk(spec.contextId, null);
  return candidates;
}

export function buildRenderModel(
  map: Pick<GraphMap, 'nodes' | 'edges'>,
  spec: ViewSpec,
  index: GraphIndex = buildIndex(map),
): RenderModel {
  const candidates = collectCandidates(index, spec);

  // FR-13 and FR-42/43/44: view mode and filters remove nodes from the canvas outright.
  const visibleIds = new Set<string>();
  for (const [id] of candidates) {
    const node = index.nodes.get(id);
    if (!node) continue;
    if (!nodeMatchesViewMode(node, spec.viewMode)) continue;
    if (!passesNodeFilters(node, spec.filters)) continue;
    visibleIds.add(id);
  }

  // FR-17/FR-19: impact dims, it does not hide.
  let impactHops: Map<string, number> | null = null;
  if (spec.impactId !== null && index.nodes.has(spec.impactId)) {
    impactHops = traverse(index, spec.impactId, {
      depth: spec.impactDepth,
      direction: spec.impactDirection,
    });
  }

  const expanded = new Set(spec.expandedIds);
  const nodes: RenderNode[] = [];
  for (const id of visibleIds) {
    const node = index.nodes.get(id)!;
    // A compound parent that got filtered out cannot contain anything; promote the child.
    const declaredParent = candidates.get(id) ?? null;
    const compoundParent = declaredParent !== null && visibleIds.has(declaredParent) ? declaredParent : null;
    const hops = impactHops?.get(id) ?? null;
    nodes.push({
      node,
      isLeaf: !hasChildren(index, id),
      isExpanded: expanded.has(id) && hasChildren(index, id),
      compoundParent,
      dimmed: impactHops !== null && hops === null,
      impactHops: hops,
    });
  }

  nodes.sort((a, b) => a.node.label.localeCompare(b.node.label));

  const relevantEdges = [...index.edges.values()].filter((e) => edgeMatchesViewMode(e, spec.viewMode));
  const edges = projectEdges(index, visibleIds, relevantEdges).filter((e) =>
    passesEdgeFilters(e, spec.filters),
  );

  return {
    nodes,
    edges,
    visibleIds,
    contextIsEmpty: candidates.size === 0,
    index,
  };
}

/** FR-41: the ids that must be expanded/entered for `nodeId` to be on screen. */
export function contextForNode(index: GraphIndex, nodeId: string): string | null {
  return index.nodes.get(nodeId)?.parent ?? null;
}
