import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GraphEdge, GraphNode, Level, NodeType, View } from '@map/shared';

import { buildRenderModel, defaultViewSpec, emptyFilters, type ViewSpec } from './viewModel.ts';

function node(id: string, level: Level, parent: string | null, overrides: Partial<GraphNode> = {}): GraphNode {
  const type: NodeType = overrides.type ?? 'service';
  const view: View = overrides.view ?? (type === 'capability' ? 'functional' : 'technical');
  return {
    id, label: id, view, type, level, parent,
    description: '', properties: {}, positions: {},
    source: { kind: 'manual', path: null },
    ...overrides,
  };
}

function edge(source: string, target: string, type: GraphEdge['type'] = 'depends-on'): GraphEdge {
  return {
    id: `${source}|${type}|${target}`,
    source, target, type, weight: 1, properties: {},
    sourceRef: { kind: 'manual', path: null },
  };
}

/**
 * A small two-domain map:
 *   d1 (L0) -> s1, s2 (L1) -> c1 (L2, under s1)
 *   d2 (L0) -> t1 (L1)
 *   cap (L0, functional) realizes s1
 */
const map = {
  nodes: [
    node('d1', 0, null, { type: 'system' }),
    node('d2', 0, null, { type: 'system' }),
    node('s1', 1, 'd1'),
    node('s2', 1, 'd1'),
    node('c1', 2, 's1', { type: 'component' }),
    node('t1', 1, 'd2'),
    node('cap', 0, null, { type: 'capability', view: 'functional' }),
  ],
  edges: [
    edge('s1', 't1', 'calls'),
    edge('s2', 't1', 'calls'),
    edge('s1', 's2', 'calls'),
    edge('c1', 't1', 'calls'),
    edge('cap', 's1', 'realizes'),
  ],
};

const spec = (patch: Partial<ViewSpec> = {}): ViewSpec => ({ ...defaultViewSpec, filters: emptyFilters, ...patch });

test('FR-1: the map opens showing only L0 nodes', () => {
  const model = buildRenderModel(map, spec());
  assert.deepEqual(model.nodes.map((n) => n.node.id).sort(), ['cap', 'd1', 'd2']);
});

test('FR-2: drilling into a node shows its children, not the whole map', () => {
  const model = buildRenderModel(map, spec({ contextId: 'd1' }));
  assert.deepEqual(model.nodes.map((n) => n.node.id).sort(), ['s1', 's2']);
});

test('FR-5: a node with children is marked as expandable, a leaf is not', () => {
  const model = buildRenderModel(map, spec({ contextId: 'd1' }));
  const byId = new Map(model.nodes.map((n) => [n.node.id, n]));
  assert.equal(byId.get('s1')?.isLeaf, false);
  assert.equal(byId.get('s2')?.isLeaf, true);
});

test('FR-6: expanding in place adds the children inside their parent, siblings kept', () => {
  const model = buildRenderModel(map, spec({ contextId: 'd1', expandedIds: ['s1'] }));
  const byId = new Map(model.nodes.map((n) => [n.node.id, n]));
  assert.deepEqual([...byId.keys()].sort(), ['c1', 's1', 's2']);
  assert.equal(byId.get('c1')?.compoundParent, 's1', 'the child is drawn inside its parent');
  assert.equal(byId.get('s1')?.isExpanded, true);
});

test('FR-9/FR-10: edges from deeper nodes roll up onto the visible level with a count', () => {
  // At L0 the s1->t1, s2->t1 and c1->t1 edges all collapse onto d1 -> d2.
  const model = buildRenderModel(map, spec());
  const rolled = model.edges.find((e) => e.source === 'd1' && e.target === 'd2');
  assert.ok(rolled, 'the cross-domain edge is drawn');
  assert.equal(rolled.count, 3);
  assert.equal(rolled.aggregated, true);
  assert.equal(model.edges.some((e) => e.source === 'd1' && e.target === 'd1'), false, 'internal edges are not drawn');
});

test('FR-7: focus shows the node, its descendants, and its neighbours only', () => {
  const model = buildRenderModel(map, spec({ focusId: 's1', focusDepth: 1 }));
  const ids = model.nodes.map((n) => n.node.id).sort();
  assert.deepEqual(ids, ['c1', 'cap', 's1', 's2', 't1']);
  assert.equal(ids.includes('d2'), false, 'an unrelated domain stays out of the way');
});

test('FR-8: focus depth controls how far the neighbourhood reaches', () => {
  const chain = {
    nodes: [node('a', 0, null, { type: 'system' }), node('b', 0, null, { type: 'system' }), node('c', 0, null, { type: 'system' })],
    edges: [edge('a', 'b', 'calls'), edge('b', 'c', 'calls')],
  };
  assert.deepEqual(
    buildRenderModel(chain, spec({ focusId: 'a', focusDepth: 1 })).nodes.map((n) => n.node.id).sort(),
    ['a', 'b'],
  );
  assert.deepEqual(
    buildRenderModel(chain, spec({ focusId: 'a', focusDepth: 2 })).nodes.map((n) => n.node.id).sort(),
    ['a', 'b', 'c'],
  );
});

test('FR-12/FR-13: a single-sided view drops the other side and its traceability edges', () => {
  const technical = buildRenderModel(map, spec({ viewMode: 'technical' }));
  assert.equal(technical.nodes.some((n) => n.node.id === 'cap'), false);
  assert.equal(technical.edges.some((e) => e.underlying.some((u) => u.type === 'realizes')), false);

  const functional = buildRenderModel(map, spec({ viewMode: 'functional' }));
  assert.deepEqual(functional.nodes.map((n) => n.node.id), ['cap']);

  const combined = buildRenderModel(map, spec());
  assert.equal(
    combined.edges.some((e) => e.underlying.some((u) => u.type === 'realizes')),
    true,
    'the combined view is where traceability shows up',
  );
});

test('FR-19: impact highlighting dims what is out of scope rather than removing it', () => {
  const model = buildRenderModel(map, spec({ impactId: 'd1', impactDepth: 1, impactDirection: 'downstream' }));
  const byId = new Map(model.nodes.map((n) => [n.node.id, n]));
  assert.equal(byId.size, 3, 'nothing is removed');
  assert.equal(byId.get('d1')?.dimmed, false);
  assert.equal(byId.get('d2')?.dimmed, true, 'd2 is not reached by an edge from d1 itself');
  assert.equal(byId.get('d1')?.impactHops, 0);
});

test('FR-42: a node type filter removes non-matching nodes', () => {
  const model = buildRenderModel(map, spec({ filters: { ...emptyFilters, nodeTypes: ['capability'] } }));
  assert.deepEqual(model.nodes.map((n) => n.node.id), ['cap']);
});

test('FR-43: a level filter hides anything deeper than the chosen level', () => {
  const model = buildRenderModel(map, spec({ contextId: 'd1', expandedIds: ['s1'], filters: { ...emptyFilters, maxLevel: 1 } }));
  assert.equal(model.nodes.some((n) => n.node.id === 'c1'), false, 'the L2 component is filtered out');
});

test('FR-44: a property filter narrows to matching nodes only', () => {
  const owned = {
    nodes: [
      node('a', 0, null, { type: 'system', properties: { owner: 'Payments' } }),
      node('b', 0, null, { type: 'system', properties: { owner: 'Orders' } }),
    ],
    edges: [],
  };
  const model = buildRenderModel(owned, spec({ filters: { ...emptyFilters, properties: [{ key: 'owner', value: 'payments' }] } }));
  assert.deepEqual(model.nodes.map((n) => n.node.id), ['a'], 'property matching is case-insensitive');
});

test('FR-45: an edge type filter restricts which relationships are drawn', () => {
  const model = buildRenderModel(map, spec({ filters: { ...emptyFilters, edgeTypes: ['realizes'] } }));
  assert.equal(model.edges.every((e) => e.underlying.some((u) => u.type === 'realizes')), true);
});

test('a child whose compound parent was filtered out is promoted, not orphaned', () => {
  const model = buildRenderModel(
    map,
    spec({ contextId: 'd1', expandedIds: ['s1'], filters: { ...emptyFilters, nodeTypes: ['component'] } }),
  );
  const c1 = model.nodes.find((n) => n.node.id === 'c1');
  assert.ok(c1);
  assert.equal(c1.compoundParent, null, 'it is drawn at the top level rather than inside a missing box');
});

test('NFR-7: a context with no children reports itself as empty', () => {
  assert.equal(buildRenderModel(map, spec({ contextId: 's2' })).contextIsEmpty, true);
  assert.equal(buildRenderModel(map, spec({ contextId: 'd1' })).contextIsEmpty, false);
});
