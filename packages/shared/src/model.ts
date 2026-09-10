/**
 * The vocabulary of the map: levels, views, node and edge types.
 *
 * OQ-1 is resolved in favour of the spec's own vocabulary (§5) rather than adopting C4 or
 * ArchiMate wholesale. The five levels line up with C4 closely enough that a C4 diagram maps
 * onto L0..L3 without translation, but the type list stays ours so the functional side
 * (capability, journey, business rule) has first-class types that C4 does not offer.
 * See DECISIONS.md.
 */

/** L0 Landscape .. L4 Deep dive. A child's level is always exactly parent.level + 1. */
export const LEVELS = [0, 1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_NAMES: Record<Level, string> = {
  0: 'Landscape',
  1: 'Domain',
  2: 'Building block',
  3: 'Detail',
  4: 'Deep dive',
};

export const MAX_LEVEL = 4 satisfies Level;

/** Which side of the product a node belongs to. */
export const VIEWS = ['functional', 'technical'] as const;
export type View = (typeof VIEWS)[number];

/** The view a user is looking at. `combined` shows both sides plus traceability edges (FR-12). */
export const VIEW_MODES = ['functional', 'technical', 'combined'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const FUNCTIONAL_NODE_TYPES = [
  'capability',
  'feature',
  'journey',
  'journey-step',
  'business-rule',
  'actor',
] as const;

export const TECHNICAL_NODE_TYPES = [
  'system',
  'service',
  'application',
  'datastore',
  'component',
  'api',
  'endpoint',
  'table',
  'integration',
  'infrastructure',
] as const;

export const NODE_TYPES = [...FUNCTIONAL_NODE_TYPES, ...TECHNICAL_NODE_TYPES] as const;

export type FunctionalNodeType = (typeof FUNCTIONAL_NODE_TYPES)[number];
export type TechnicalNodeType = (typeof TECHNICAL_NODE_TYPES)[number];
export type NodeType = (typeof NODE_TYPES)[number];

/** Which view each node type belongs to. Used to reject `view`/`type` mismatches. */
export const NODE_TYPE_VIEW: Record<NodeType, View> = {
  capability: 'functional',
  feature: 'functional',
  journey: 'functional',
  'journey-step': 'functional',
  'business-rule': 'functional',
  actor: 'functional',
  system: 'technical',
  service: 'technical',
  application: 'technical',
  datastore: 'technical',
  component: 'technical',
  api: 'technical',
  endpoint: 'technical',
  table: 'technical',
  integration: 'technical',
  infrastructure: 'technical',
};

export const EDGE_TYPES = [
  'depends-on',
  'calls',
  'reads',
  'writes',
  'publishes',
  'subscribes',
  'realizes',
  'implemented-by',
  'contains',
  'precedes',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

/**
 * The only edge types expected to cross between the functional and technical views (§5).
 * Anything else crossing views is reported as a warning, not an error — real maps have
 * exceptions, and NFR-7 says we show what is there rather than refusing it.
 */
export const TRACEABILITY_EDGE_TYPES = ['realizes', 'implemented-by'] as const;
export type TraceabilityEdgeType = (typeof TRACEABILITY_EDGE_TYPES)[number];

export function isTraceabilityEdge(type: EdgeType): type is TraceabilityEdgeType {
  return (TRACEABILITY_EDGE_TYPES as readonly string[]).includes(type);
}

/** Edge types that imply a dependency direction, used for upstream/downstream traversal (FR-17). */
export const DEPENDENCY_EDGE_TYPES: readonly EdgeType[] = [
  'depends-on',
  'calls',
  'reads',
  'writes',
  'publishes',
  'subscribes',
];

export const LIFECYCLE_STATUSES = ['planned', 'active', 'deprecated', 'retired'] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type PropertyValue = string | number | boolean | null;

export interface Position {
  x: number;
  y: number;
}

export interface SourceRef {
  /** OQ-6: `markdown` is the only importer in v1; the field exists so OQ-5/FR-50 stay open. */
  kind: 'markdown' | 'openapi' | 'manual' | string;
  path: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  view: View;
  type: NodeType;
  level: Level;
  /** null only at L0. */
  parent: string | null;
  description: string;
  properties: Record<string, PropertyValue>;
  /**
   * Manual positions (FR-25), keyed by context. A node is laid out once per context it can
   * appear in, so a node dragged inside its parent's drill-down keeps that position
   * independently of where it sits in a focus view. See `contextKey()`.
   */
  positions: Record<string, Position>;
  source: SourceRef;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  properties: Record<string, PropertyValue>;
  sourceRef: SourceRef;
}

export interface GraphMap {
  id: string;
  name: string;
  description: string;
  /**
   * A locked map is a reference: the server refuses every write to it, and the UI hides the
   * editing affordances. Used for the map of the product itself, which ships with the app and
   * should read the same for everyone.
   */
  locked: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * The key under which a manual position is stored. A node's position is meaningful relative
 * to the set of siblings it is drawn with, which is exactly "the children of context C".
 * Root context (the L0 level) is keyed `root`.
 */
export function contextKey(contextNodeId: string | null): string {
  return contextNodeId ?? 'root';
}
