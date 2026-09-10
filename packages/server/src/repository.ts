/**
 * The map repository: every write funnels through here so that no route can commit a state
 * that breaks the model (FR-38). The pattern throughout is read -> apply -> validate -> commit.
 */
import {
  contextKey,
  deterministicId,
  edgeId as makeEdgeId,
  levelForParent,
  reparent,
  validateGraph,
  type EdgeCreate,
  type EdgePatch,
  type GraphEdge,
  type GraphMap,
  type GraphNode,
  type Level,
  type NodeCreate,
  type NodePatch,
  type Position,
  type ValidationIssue,
  type ViewState,
} from '@map/shared';

import { nowIso, transact, type Db } from './db.js';

export class MapNotFound extends Error {
  constructor(id: string) {
    super(`Map "${id}" not found.`);
    this.name = 'MapNotFound';
  }
}

export class NodeNotFound extends Error {
  constructor(id: string) {
    super(`Node "${id}" not found.`);
    this.name = 'NodeNotFound';
  }
}

export class EdgeNotFound extends Error {
  constructor(id: string) {
    super(`Edge "${id}" not found.`);
    this.name = 'EdgeNotFound';
  }
}

/**
 * Thrown when a write targets a locked map. Locked maps are reference material that ships with
 * the app — the map of the product itself — so they must read the same for everyone.
 */
export class MapLocked extends Error {
  constructor(readonly mapId: string) {
    super('This map is read-only.');
    this.name = 'MapLocked';
  }
}

/** Thrown when a write would leave the map invalid. Carries the issues for the client to show. */
export class InvalidGraph extends Error {
  constructor(
    readonly issues: ValidationIssue[],
    message = 'The change would leave the map invalid.',
  ) {
    super(message);
    this.name = 'InvalidGraph';
  }
}

export interface MapSummary {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface NodeRow {
  id: string;
  label: string;
  view: string;
  type: string;
  level: number;
  parent: string | null;
  description: string;
  properties: string;
  positions: string;
  source_kind: string;
  source_path: string | null;
}

interface EdgeRow {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  properties: string;
  source_kind: string;
  source_path: string | null;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    label: row.label,
    view: row.view as GraphNode['view'],
    type: row.type as GraphNode['type'],
    level: row.level as Level,
    parent: row.parent,
    description: row.description,
    properties: parseJson(row.properties, {}),
    positions: parseJson(row.positions, {}),
    source: { kind: row.source_kind, path: row.source_path },
  };
}

function toEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    type: row.type as GraphEdge['type'],
    weight: row.weight,
    properties: parseJson(row.properties, {}),
    sourceRef: { kind: row.source_kind, path: row.source_path },
  };
}

export class MapRepository {
  constructor(private readonly db: Db) {}

  listMaps(): MapSummary[] {
    const rows = this.db
      .prepare(
        `SELECT m.id, m.name, m.description, m.locked, m.created_at, m.updated_at,
                (SELECT COUNT(*) FROM nodes n WHERE n.map_id = m.id) AS node_count,
                (SELECT COUNT(*) FROM edges e WHERE e.map_id = m.id) AS edge_count
         FROM maps m
         -- Locked reference maps sort first, which is what makes the map of the product
         -- itself the one the client opens by default.
         ORDER BY m.locked DESC, m.updated_at DESC`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description),
      locked: Number(r.locked) === 1,
      nodeCount: Number(r.node_count),
      edgeCount: Number(r.edge_count),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  }

  createMap(input: { id?: string; name: string; description?: string; locked?: boolean }): MapSummary {
    const taken = new Set(this.listMaps().map((m) => m.id));
    const id = input.id ?? deterministicId('map', input.name, taken);
    const ts = nowIso();
    this.db
      .prepare(
        'INSERT INTO maps (id, name, description, locked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.name, input.description ?? '', input.locked ? 1 : 0, ts, ts);
    return {
      id,
      name: input.name,
      description: input.description ?? '',
      locked: input.locked ?? false,
      nodeCount: 0,
      edgeCount: 0,
      createdAt: ts,
      updatedAt: ts,
    };
  }

  isLocked(mapId: string): boolean {
    const row = this.db.prepare('SELECT locked FROM maps WHERE id = ?').get(mapId) as
      | { locked: number }
      | undefined;
    if (!row) throw new MapNotFound(mapId);
    return Number(row.locked) === 1;
  }

  /**
   * The gate every write goes through. Placed here rather than in the routes so that no future
   * caller can reach a write path without passing it.
   */
  private assertWritable(mapId: string): void {
    if (this.isLocked(mapId)) throw new MapLocked(mapId);
  }

  /**
   * Sets or clears the lock. Deliberately not exposed over HTTP: the lock exists to keep shipped
   * reference maps intact, so letting a client clear it would defeat the point. Seeding uses it.
   */
  setLocked(mapId: string, locked: boolean): void {
    const info = this.db.prepare('UPDATE maps SET locked = ? WHERE id = ?').run(locked ? 1 : 0, mapId);
    if (info.changes === 0) throw new MapNotFound(mapId);
  }

  deleteMap(mapId: string): void {
    this.assertWritable(mapId);
    const info = this.db.prepare('DELETE FROM maps WHERE id = ?').run(mapId);
    if (info.changes === 0) throw new MapNotFound(mapId);
  }

  renameMap(mapId: string, patch: { name?: string; description?: string }): MapSummary {
    this.assertWritable(mapId);
    const existing = this.listMaps().find((m) => m.id === mapId);
    if (!existing) throw new MapNotFound(mapId);
    this.db
      .prepare('UPDATE maps SET name = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(patch.name ?? existing.name, patch.description ?? existing.description, nowIso(), mapId);
    return { ...existing, ...patch, updatedAt: nowIso() };
  }

  /** The whole map. At the scale this app targets, partial loading buys nothing. */
  getMap(mapId: string): GraphMap {
    const meta = this.db
      .prepare('SELECT id, name, description, locked FROM maps WHERE id = ?')
      .get(mapId) as { id: string; name: string; description: string; locked: number } | undefined;
    if (!meta) throw new MapNotFound(mapId);

    const nodeRows = this.db
      .prepare('SELECT * FROM nodes WHERE map_id = ? ORDER BY level, label')
      .all(mapId) as unknown as NodeRow[];
    const edgeRows = this.db
      .prepare('SELECT * FROM edges WHERE map_id = ? ORDER BY id')
      .all(mapId) as unknown as EdgeRow[];

    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      locked: Number(meta.locked) === 1,
      nodes: nodeRows.map(toNode),
      edges: edgeRows.map(toEdge),
    };
  }

  private touch(mapId: string): void {
    this.db.prepare('UPDATE maps SET updated_at = ? WHERE id = ?').run(nowIso(), mapId);
  }

  private assertValid(map: Pick<GraphMap, 'nodes' | 'edges'>): void {
    const result = validateGraph(map);
    if (!result.ok) throw new InvalidGraph(result.errors);
  }

  private writeNode(mapId: string, node: GraphNode): void {
    this.db
      .prepare(
        `INSERT INTO nodes (map_id, id, label, view, type, level, parent, description, properties, positions, source_kind, source_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (map_id, id) DO UPDATE SET
           label = excluded.label, view = excluded.view, type = excluded.type,
           level = excluded.level, parent = excluded.parent, description = excluded.description,
           properties = excluded.properties, positions = excluded.positions,
           source_kind = excluded.source_kind, source_path = excluded.source_path`,
      )
      .run(
        mapId,
        node.id,
        node.label,
        node.view,
        node.type,
        node.level,
        node.parent,
        node.description,
        JSON.stringify(node.properties),
        JSON.stringify(node.positions),
        node.source.kind,
        node.source.path,
      );
  }

  private writeEdge(mapId: string, edge: GraphEdge): void {
    this.db
      .prepare(
        `INSERT INTO edges (map_id, id, source, target, type, weight, properties, source_kind, source_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (map_id, id) DO UPDATE SET
           source = excluded.source, target = excluded.target, type = excluded.type,
           weight = excluded.weight, properties = excluded.properties,
           source_kind = excluded.source_kind, source_path = excluded.source_path`,
      )
      .run(
        mapId,
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        edge.weight,
        JSON.stringify(edge.properties),
        edge.sourceRef.kind,
        edge.sourceRef.path,
      );
  }

  /**
   * FR-32. The level is derived from the parent rather than trusted from the client, so a node
   * cannot be created at a level its parent contradicts.
   */
  addNode(mapId: string, input: NodeCreate): GraphNode {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const map = this.getMap(mapId);
      const parentId = input.parent ?? null;
      const parent = parentId === null ? null : map.nodes.find((n) => n.id === parentId);
      if (parentId !== null && !parent) throw new NodeNotFound(parentId);

      const level = levelForParent(parent ?? null);
      if (level === null) {
        throw new InvalidGraph([
          {
            severity: 'error',
            code: 'level-out-of-range',
            message: `"${parent?.label}" is at the deepest level and cannot have children.`,
          },
        ]);
      }

      const taken = new Set(map.nodes.map((n) => n.id));
      const node: GraphNode = {
        id: input.id ?? deterministicId(input.type, input.label, taken),
        label: input.label,
        view: input.view,
        type: input.type,
        level,
        parent: parentId,
        description: input.description ?? '',
        properties: (input.properties ?? {}) as GraphNode['properties'],
        positions: (input.positions ?? {}) as GraphNode['positions'],
        source: { kind: input.source?.kind ?? 'manual', path: input.source?.path ?? null },
      };

      if (taken.has(node.id)) {
        throw new InvalidGraph([
          {
            severity: 'error',
            code: 'duplicate-node-id',
            message: `A node with id "${node.id}" already exists in this map.`,
            nodeId: node.id,
          },
        ]);
      }

      this.assertValid({ nodes: [...map.nodes, node], edges: map.edges });
      this.writeNode(mapId, node);
      this.touch(mapId);
      return node;
    });
  }

  /** FR-36. `parent` changes are refused here; use `reparentNode`, which moves the subtree. */
  updateNode(mapId: string, nodeId: string, patch: NodePatch): GraphNode {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const map = this.getMap(mapId);
      const existing = map.nodes.find((n) => n.id === nodeId);
      if (!existing) throw new NodeNotFound(nodeId);

      const { parent: _ignoredParent, level: _ignoredLevel, ...safe } = patch;
      const updated: GraphNode = { ...existing, ...safe } as GraphNode;

      const nodes = map.nodes.map((n) => (n.id === nodeId ? updated : n));
      this.assertValid({ nodes, edges: map.edges });
      this.writeNode(mapId, updated);
      this.touch(mapId);
      return updated;
    });
  }

  /** FR-34. Moves the node and its whole subtree, re-levelling as it goes. */
  reparentNode(mapId: string, nodeId: string, newParentId: string | null): GraphNode[] {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const map = this.getMap(mapId);
      const moved = reparent(map, nodeId, newParentId);
      if (!moved.ok) {
        throw new InvalidGraph([
          { severity: 'error', code: 'parent-cycle', message: moved.reason, nodeId },
        ]);
      }

      const byId = new Map(moved.nodes.map((n) => [n.id, n]));
      const nodes = map.nodes.map((n) => byId.get(n.id) ?? n);
      this.assertValid({ nodes, edges: map.edges });
      for (const node of moved.nodes) this.writeNode(mapId, node);
      this.touch(mapId);
      return moved.nodes;
    });
  }

  /**
   * FR-35. `descendants` decides what happens to the subtree: delete it wholesale, or promote
   * the children to the deleted node's parent (which re-levels them, so it can still fail).
   */
  deleteNode(
    mapId: string,
    nodeId: string,
    descendants: 'delete' | 'promote' = 'delete',
  ): { deletedNodes: string[]; deletedEdges: string[]; promotedNodes: GraphNode[] } {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const map = this.getMap(mapId);
      const target = map.nodes.find((n) => n.id === nodeId);
      if (!target) throw new NodeNotFound(nodeId);

      const childrenOf = new Map<string, GraphNode[]>();
      for (const n of map.nodes) {
        if (n.parent === null) continue;
        const bucket = childrenOf.get(n.parent);
        if (bucket) bucket.push(n);
        else childrenOf.set(n.parent, [n]);
      }

      let nodes = map.nodes;
      const deletedNodes: string[] = [];
      const promotedNodes: GraphNode[] = [];

      if (descendants === 'delete') {
        const doomed = new Set<string>();
        const stack = [nodeId];
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (doomed.has(current)) continue;
          doomed.add(current);
          for (const child of childrenOf.get(current) ?? []) stack.push(child.id);
        }
        deletedNodes.push(...doomed);
        nodes = nodes.filter((n) => !doomed.has(n.id));
      } else {
        deletedNodes.push(nodeId);
        const survivors = nodes.filter((n) => n.id !== nodeId);
        let working = survivors;
        for (const child of childrenOf.get(nodeId) ?? []) {
          const moved = reparent({ nodes: working }, child.id, target.parent);
          if (!moved.ok) {
            throw new InvalidGraph([
              { severity: 'error', code: 'level-mismatch', message: moved.reason, nodeId: child.id },
            ]);
          }
          const byId = new Map(moved.nodes.map((n) => [n.id, n]));
          working = working.map((n) => byId.get(n.id) ?? n);
          promotedNodes.push(...moved.nodes);
        }
        nodes = working;
      }

      const surviving = new Set(nodes.map((n) => n.id));
      const deletedEdges = map.edges
        .filter((e) => !surviving.has(e.source) || !surviving.has(e.target))
        .map((e) => e.id);
      const edges = map.edges.filter((e) => !deletedEdges.includes(e.id));

      this.assertValid({ nodes, edges });

      const deleteNodeStmt = this.db.prepare('DELETE FROM nodes WHERE map_id = ? AND id = ?');
      for (const id of deletedNodes) deleteNodeStmt.run(mapId, id);
      const deleteEdgeStmt = this.db.prepare('DELETE FROM edges WHERE map_id = ? AND id = ?');
      for (const id of deletedEdges) deleteEdgeStmt.run(mapId, id);
      for (const node of promotedNodes) this.writeNode(mapId, node);
      this.touch(mapId);

      return { deletedNodes, deletedEdges, promotedNodes };
    });
  }

  /** FR-25. Positions are stored per context, so a node keeps a position per level it appears in. */
  setPosition(mapId: string, nodeId: string, context: string | null, position: Position): GraphNode {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const row = this.db
        .prepare('SELECT * FROM nodes WHERE map_id = ? AND id = ?')
        .get(mapId, nodeId) as unknown as NodeRow | undefined;
      if (!row) throw new NodeNotFound(nodeId);
      const node = toNode(row);
      node.positions = { ...node.positions, [contextKey(context)]: position };
      this.writeNode(mapId, node);
      this.touch(mapId);
      return node;
    });
  }

  addEdge(mapId: string, input: EdgeCreate): GraphEdge {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const map = this.getMap(mapId);
      const edge: GraphEdge = {
        id: input.id ?? makeEdgeId(input.source, input.target, input.type),
        source: input.source,
        target: input.target,
        type: input.type,
        weight: input.weight ?? 1,
        properties: (input.properties ?? {}) as GraphEdge['properties'],
        sourceRef: { kind: input.sourceRef?.kind ?? 'manual', path: input.sourceRef?.path ?? null },
      };

      if (map.edges.some((e) => e.id === edge.id)) {
        throw new InvalidGraph([
          {
            severity: 'error',
            code: 'duplicate-edge-id',
            message: `An edge of type "${edge.type}" already connects these two nodes.`,
            edgeId: edge.id,
          },
        ]);
      }

      this.assertValid({ nodes: map.nodes, edges: [...map.edges, edge] });
      this.writeEdge(mapId, edge);
      this.touch(mapId);
      return edge;
    });
  }

  updateEdge(mapId: string, edgeId: string, patch: EdgePatch): GraphEdge {
    return transact(this.db, () => {
      this.assertWritable(mapId);
      const map = this.getMap(mapId);
      const existing = map.edges.find((e) => e.id === edgeId);
      if (!existing) throw new EdgeNotFound(edgeId);
      const updated: GraphEdge = { ...existing, ...patch } as GraphEdge;
      const edges = map.edges.map((e) => (e.id === edgeId ? updated : e));
      this.assertValid({ nodes: map.nodes, edges });
      this.writeEdge(mapId, updated);
      this.touch(mapId);
      return updated;
    });
  }

  deleteEdge(mapId: string, edgeId: string): void {
    this.assertWritable(mapId);
    const info = this.db.prepare('DELETE FROM edges WHERE map_id = ? AND id = ?').run(mapId, edgeId);
    if (info.changes === 0) throw new EdgeNotFound(edgeId);
    this.touch(mapId);
  }

  /**
   * FR-59 / FR-52. Replaces a map's contents wholesale. Used by JSON import and by undo when a
   * single operation touched many nodes; validated as one state before anything is written.
   */
  replaceContents(
    mapId: string,
    next: Pick<GraphMap, 'nodes' | 'edges'>,
    options: { allowLocked?: boolean } = {},
  ): GraphMap {
    return transact(this.db, () => {
      // Seeding writes a locked map's contents before locking it; nothing reachable from HTTP
      // passes this flag.
      if (!options.allowLocked) this.assertWritable(mapId);
      this.getMap(mapId); // existence check
      this.assertValid(next);
      this.db.prepare('DELETE FROM edges WHERE map_id = ?').run(mapId);
      this.db.prepare('DELETE FROM nodes WHERE map_id = ?').run(mapId);
      for (const node of next.nodes) this.writeNode(mapId, node);
      for (const edge of next.edges) this.writeEdge(mapId, edge);
      this.touch(mapId);
      return this.getMap(mapId);
    });
  }

  listSavedViews(mapId: string): Array<{ id: string; name: string; state: ViewState; createdAt: string }> {
    const rows = this.db
      .prepare('SELECT id, name, state, created_at FROM saved_views WHERE map_id = ? ORDER BY created_at DESC')
      .all(mapId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      state: parseJson(String(r.state), {} as ViewState),
      createdAt: String(r.created_at),
    }));
  }

  /** Saved views are the reader's own working state, so they are allowed on a locked map. */
  saveView(mapId: string, name: string, state: ViewState): { id: string; name: string; state: ViewState; createdAt: string } {
    const taken = new Set(this.listSavedViews(mapId).map((v) => v.id));
    const id = deterministicId('view', name, taken);
    const createdAt = nowIso();
    this.db
      .prepare('INSERT INTO saved_views (id, map_id, name, state, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, mapId, name, JSON.stringify(state), createdAt);
    return { id, name, state, createdAt };
  }

  deleteSavedView(mapId: string, viewId: string): void {
    this.db.prepare('DELETE FROM saved_views WHERE map_id = ? AND id = ?').run(mapId, viewId);
  }
}
