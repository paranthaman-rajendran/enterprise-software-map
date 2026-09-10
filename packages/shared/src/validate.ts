/**
 * The model constraints from §5, enforced on every write (FR-38) and on import (FR-53).
 *
 * Errors block the write. Warnings do not: NFR-7 says the map should degrade honestly rather
 * than refuse to hold something a real architecture actually contains.
 */
import { MAX_LEVEL, NODE_TYPE_VIEW, isTraceabilityEdge } from './model.js';
import type { GraphEdge, GraphMap, GraphNode, Level } from './model.js';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** Stable code so callers can react to a specific violation rather than parse messages. */
  code:
    | 'duplicate-node-id'
    | 'duplicate-edge-id'
    | 'missing-parent'
    | 'root-with-parent'
    | 'orphan-below-root'
    | 'level-mismatch'
    | 'level-out-of-range'
    | 'parent-cycle'
    | 'self-parent'
    | 'dangling-edge'
    | 'self-edge'
    | 'view-type-mismatch'
    | 'cross-view-edge';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function result(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validates a whole map. Callers that mutate one node or edge should build the prospective
 * state and validate that, rather than validating the change in isolation — a level change is
 * only legal in the context of its parent and its children.
 */
export function validateGraph(map: Pick<GraphMap, 'nodes' | 'edges'>): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, GraphNode>();

  for (const node of map.nodes) {
    if (byId.has(node.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-node-id',
        message: `Duplicate node id "${node.id}".`,
        nodeId: node.id,
      });
      continue;
    }
    byId.set(node.id, node);
  }

  for (const node of map.nodes) {
    if (node.level < 0 || node.level > MAX_LEVEL) {
      issues.push({
        severity: 'error',
        code: 'level-out-of-range',
        message: `Node "${node.label}" has level ${node.level}; levels run 0..${MAX_LEVEL}.`,
        nodeId: node.id,
      });
    }

    if (NODE_TYPE_VIEW[node.type] !== node.view) {
      issues.push({
        severity: 'error',
        code: 'view-type-mismatch',
        message: `Node "${node.label}" is typed ${node.type} (a ${NODE_TYPE_VIEW[node.type]} type) but sits in the ${node.view} view.`,
        nodeId: node.id,
      });
    }

    if (node.parent === node.id) {
      issues.push({
        severity: 'error',
        code: 'self-parent',
        message: `Node "${node.label}" is its own parent.`,
        nodeId: node.id,
      });
      continue;
    }

    if (node.parent === null) {
      if (node.level !== 0) {
        issues.push({
          severity: 'error',
          code: 'orphan-below-root',
          message: `Node "${node.label}" is at L${node.level} but has no parent; only L0 nodes may be parentless.`,
          nodeId: node.id,
        });
      }
      continue;
    }

    if (node.level === 0) {
      issues.push({
        severity: 'error',
        code: 'root-with-parent',
        message: `Node "${node.label}" is at L0 but has a parent.`,
        nodeId: node.id,
      });
      continue;
    }

    const parent = byId.get(node.parent);
    if (!parent) {
      issues.push({
        severity: 'error',
        code: 'missing-parent',
        message: `Node "${node.label}" references parent "${node.parent}", which does not exist.`,
        nodeId: node.id,
      });
      continue;
    }

    if (node.level !== parent.level + 1) {
      issues.push({
        severity: 'error',
        code: 'level-mismatch',
        message: `Node "${node.label}" is at L${node.level} but its parent "${parent.label}" is at L${parent.level}; a child must be exactly one level deeper.`,
        nodeId: node.id,
      });
    }
  }

  issues.push(...findParentCycles(byId));

  const edgeIds = new Set<string>();
  for (const edge of map.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-edge-id',
        message: `Duplicate edge id "${edge.id}".`,
        edgeId: edge.id,
      });
      continue;
    }
    edgeIds.add(edge.id);

    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) {
      const missing = !source ? edge.source : edge.target;
      issues.push({
        severity: 'error',
        code: 'dangling-edge',
        message: `Edge "${edge.id}" references node "${missing}", which does not exist.`,
        edgeId: edge.id,
      });
      continue;
    }

    if (edge.source === edge.target) {
      issues.push({
        severity: 'warning',
        code: 'self-edge',
        message: `Edge "${edge.id}" connects "${source.label}" to itself.`,
        edgeId: edge.id,
      });
    }

    if (source.view !== target.view && !isTraceabilityEdge(edge.type)) {
      issues.push({
        severity: 'warning',
        code: 'cross-view-edge',
        message: `Edge "${edge.id}" (${edge.type}) crosses between the functional and technical views; normally only realizes/implemented-by do.`,
        edgeId: edge.id,
      });
    }
  }

  return result(issues);
}

/**
 * Walks each node's parent chain. Nodes proven acyclic are memoised, so this stays linear in
 * the number of nodes rather than re-walking every chain from scratch.
 */
function findParentCycles(byId: Map<string, GraphNode>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const safe = new Set<string>();
  const reported = new Set<string>();

  for (const start of byId.keys()) {
    if (safe.has(start)) continue;
    const path: string[] = [];
    const onPath = new Set<string>();
    let cursor: string | null = start;

    while (cursor !== null && !safe.has(cursor)) {
      if (onPath.has(cursor)) {
        const cycle = path.slice(path.indexOf(cursor));
        for (const id of cycle) {
          if (reported.has(id)) continue;
          reported.add(id);
          issues.push({
            severity: 'error',
            code: 'parent-cycle',
            message: `Parent hierarchy contains a cycle: ${cycle.map((c) => byId.get(c)?.label ?? c).join(' -> ')}.`,
            nodeId: id,
          });
        }
        break;
      }
      path.push(cursor);
      onPath.add(cursor);
      const node: GraphNode | undefined = byId.get(cursor);
      if (!node) break; // missing-parent is reported separately
      cursor = node.parent;
    }

    // Everything on a chain that terminated cleanly is proven acyclic.
    if (cursor === null || safe.has(cursor ?? '')) for (const id of path) safe.add(id);
  }

  return issues;
}

/** The level a node must sit at, given where it is being parented. */
export function levelForParent(parent: GraphNode | null): Level | null {
  if (parent === null) return 0;
  const next = parent.level + 1;
  return next > MAX_LEVEL ? null : (next as Level);
}

/**
 * FR-34: re-parenting shifts a node and its whole subtree by the same delta. Returns the
 * updated nodes, or an error when the subtree would run past L4.
 */
export function reparent(
  map: Pick<GraphMap, 'nodes'>,
  nodeId: string,
  newParentId: string | null,
): { ok: true; nodes: GraphNode[] } | { ok: false; reason: string } {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return { ok: false, reason: `Node "${nodeId}" does not exist.` };

  const parent = newParentId === null ? null : byId.get(newParentId);
  if (newParentId !== null && !parent) {
    return { ok: false, reason: `Parent "${newParentId}" does not exist.` };
  }

  // Re-parenting into your own subtree is the cycle case FR-38 has to refuse.
  if (parent) {
    let cursor: string | null = parent.id;
    while (cursor) {
      if (cursor === nodeId) {
        return { ok: false, reason: `Cannot move "${node.label}" beneath its own descendant.` };
      }
      cursor = byId.get(cursor)?.parent ?? null;
    }
  }

  const newLevel = levelForParent(parent ?? null);
  if (newLevel === null) {
    return { ok: false, reason: `"${parent?.label}" is at L${MAX_LEVEL}; it cannot have children.` };
  }

  const delta = newLevel - node.level;
  const childrenOf = new Map<string, GraphNode[]>();
  for (const n of map.nodes) {
    if (n.parent === null) continue;
    const bucket = childrenOf.get(n.parent);
    if (bucket) bucket.push(n);
    else childrenOf.set(n.parent, [n]);
  }

  const moved: GraphNode[] = [];
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const level = current.level + delta;
    if (level > MAX_LEVEL) {
      return {
        ok: false,
        reason: `Moving "${node.label}" here would push "${current.label}" past L${MAX_LEVEL}.`,
      };
    }
    moved.push({
      ...current,
      level: level as Level,
      parent: current.id === nodeId ? newParentId : current.parent,
    });
    for (const child of childrenOf.get(current.id) ?? []) stack.push(child);
  }

  return { ok: true, nodes: moved };
}
