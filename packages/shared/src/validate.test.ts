import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildIndex, ancestorPath, projectEdges, traverse, shortestPath, coverageGaps } from './graph.ts';
import type { GraphEdge, GraphNode, Level, NodeType, View } from './model.ts';
import { reparent, validateGraph } from './validate.ts';
import { searchNodes } from './search.ts';

function node(
  id: string,
  level: Level,
  parent: string | null,
  overrides: Partial<GraphNode> = {},
): GraphNode {
  const type: NodeType = overrides.type ?? 'service';
  const view: View = overrides.view ?? (type === 'capability' ? 'functional' : 'technical');
  return {
    id,
    label: id,
    view,
    type,
    level,
    parent,
    description: '',
    properties: {},
    positions: {},
    source: { kind: 'manual', path: null },
    ...overrides,
  };
}

function edge(id: string, source: string, target: string, type: GraphEdge['type'] = 'depends-on'): GraphEdge {
  return {
    id,
    source,
    target,
    type,
    weight: 1,
    properties: {},
    sourceRef: { kind: 'manual', path: null },
  };
}

test('a well-formed map validates', () => {
  const map = {
    nodes: [node('a', 0, null, { type: 'system' }), node('b', 1, 'a'), node('c', 1, 'a')],
    edges: [edge('e1', 'b', 'c')],
  };
  const result = validateGraph(map);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('a child must be exactly one level below its parent', () => {
  const map = { nodes: [node('a', 0, null, { type: 'system' }), node('b', 3, 'a')], edges: [] };
  const result = validateGraph(map);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'level-mismatch');
});

test('a non-L0 node without a parent is an orphan', () => {
  const result = validateGraph({ nodes: [node('a', 2, null)], edges: [] });
  assert.equal(result.errors[0]?.code, 'orphan-below-root');
});

test('an L0 node may not have a parent', () => {
  const map = { nodes: [node('a', 0, null, { type: 'system' }), node('b', 0, 'a', { type: 'system' })], edges: [] };
  assert.equal(validateGraph(map).errors[0]?.code, 'root-with-parent');
});

test('a cycle in the parent hierarchy is rejected and reported once per member', () => {
  const map = {
    nodes: [node('a', 1, 'c'), node('b', 2, 'a'), node('c', 3, 'b')],
    edges: [],
  };
  const result = validateGraph(map);
  assert.equal(result.ok, false);
  const cycleErrors = result.errors.filter((e) => e.code === 'parent-cycle');
  assert.equal(cycleErrors.length, 3);
});

test('a dangling edge cannot be saved', () => {
  const map = { nodes: [node('a', 0, null, { type: 'system' })], edges: [edge('e1', 'a', 'ghost')] };
  const result = validateGraph(map);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'dangling-edge');
});

test('a node typed against the wrong view is rejected', () => {
  const map = {
    nodes: [node('a', 0, null, { type: 'capability', view: 'technical' })],
    edges: [],
  };
  assert.equal(validateGraph(map).errors[0]?.code, 'view-type-mismatch');
});

test('a non-traceability edge crossing views warns but still saves', () => {
  const map = {
    nodes: [
      node('cap', 0, null, { type: 'capability', view: 'functional' }),
      node('svc', 0, null, { type: 'system', view: 'technical' }),
    ],
    edges: [edge('e1', 'cap', 'svc', 'calls')],
  };
  const result = validateGraph(map);
  assert.equal(result.ok, true);
  assert.equal(result.warnings[0]?.code, 'cross-view-edge');
});

test('duplicate node ids are rejected', () => {
  const map = { nodes: [node('a', 0, null, { type: 'system' }), node('a', 0, null, { type: 'system' })], edges: [] };
  assert.equal(validateGraph(map).errors[0]?.code, 'duplicate-node-id');
});

test('breadcrumb runs root-first from L0 to the context node', () => {
  const map = {
    nodes: [node('a', 0, null, { type: 'system' }), node('b', 1, 'a'), node('c', 2, 'b')],
    edges: [],
  };
  const path = ancestorPath(buildIndex(map), 'c').map((n) => n.id);
  assert.deepEqual(path, ['a', 'b', 'c']);
});

test('edges between subtrees roll up into one aggregated edge', () => {
  const map = {
    nodes: [
      node('d1', 0, null, { type: 'system' }),
      node('d2', 0, null, { type: 'system' }),
      node('s1', 1, 'd1'),
      node('s2', 1, 'd1'),
      node('t1', 1, 'd2'),
      node('t2', 1, 'd2'),
    ],
    edges: [edge('e1', 's1', 't1'), edge('e2', 's2', 't2'), edge('e3', 's1', 's2')],
  };
  const index = buildIndex(map);
  const projected = projectEdges(index, new Set(['d1', 'd2']));
  assert.equal(projected.length, 1, 'the two cross-domain edges roll into one, the internal one drops');
  assert.equal(projected[0]?.count, 2);
  assert.equal(projected[0]?.aggregated, true);
  assert.equal(projected[0]?.underlying.length, 2);
});

test('an edge internal to one visible subtree is not drawn', () => {
  const map = {
    nodes: [node('d1', 0, null, { type: 'system' }), node('s1', 1, 'd1'), node('s2', 1, 'd1')],
    edges: [edge('e1', 's1', 's2')],
  };
  assert.equal(projectEdges(buildIndex(map), new Set(['d1'])).length, 0);
});

test('traverse respects direction and hop depth', () => {
  const map = {
    nodes: [node('a', 0, null, { type: 'system' }), node('b', 0, null, { type: 'system' }), node('c', 0, null, { type: 'system' })],
    edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
  };
  const index = buildIndex(map);
  const oneHop = traverse(index, 'a', { depth: 1, direction: 'downstream' });
  assert.deepEqual([...oneHop.keys()].sort(), ['a', 'b']);
  const twoHops = traverse(index, 'a', { depth: 2, direction: 'downstream' });
  assert.deepEqual([...twoHops.keys()].sort(), ['a', 'b', 'c']);
  const upstream = traverse(index, 'a', { depth: 5, direction: 'upstream' });
  assert.deepEqual([...upstream.keys()], ['a']);
});

test('traverse does not walk hierarchy edges', () => {
  const map = {
    nodes: [node('a', 0, null, { type: 'system' }), node('b', 1, 'a')],
    edges: [edge('e1', 'a', 'b', 'contains')],
  };
  const reached = traverse(buildIndex(map), 'a', { depth: 3 });
  assert.deepEqual([...reached.keys()], ['a']);
});

test('shortest path finds a route and reports none when disconnected', () => {
  const map = {
    nodes: [
      node('a', 0, null, { type: 'system' }),
      node('b', 0, null, { type: 'system' }),
      node('c', 0, null, { type: 'system' }),
      node('lonely', 0, null, { type: 'system' }),
    ],
    edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
  };
  const index = buildIndex(map);
  assert.deepEqual(shortestPath(index, 'a', 'c')?.nodes, ['a', 'b', 'c']);
  assert.equal(shortestPath(index, 'a', 'lonely'), null);
});

test('coverage gaps list capabilities nothing implements', () => {
  const map = {
    nodes: [
      node('cap1', 0, null, { type: 'capability', view: 'functional' }),
      node('cap2', 0, null, { type: 'capability', view: 'functional' }),
      node('svc', 0, null, { type: 'system', view: 'technical' }),
    ],
    edges: [edge('e1', 'cap1', 'svc', 'realizes')],
  };
  const gaps = coverageGaps(buildIndex(map));
  assert.deepEqual(gaps.unimplementedFunctional.map((n) => n.id), ['cap2']);
  assert.deepEqual(gaps.untracedTechnical.map((n) => n.id), []);
});

test('a parent counts as covered when its subtree is traced', () => {
  const map = {
    nodes: [
      node('domain', 0, null, { type: 'capability', view: 'functional' }),
      node('cap', 1, 'domain', { type: 'capability', view: 'functional' }),
      node('svc', 0, null, { type: 'system', view: 'technical' }),
    ],
    edges: [edge('e1', 'cap', 'svc', 'realizes')],
  };
  const gaps = coverageGaps(buildIndex(map));
  assert.deepEqual(gaps.unimplementedFunctional.map((n) => n.id), []);
});

test('re-parenting shifts the whole subtree', () => {
  const map = {
    nodes: [
      node('a', 0, null, { type: 'system' }),
      node('b', 1, 'a'),
      node('c', 2, 'b'),
      node('newRoot', 0, null, { type: 'system' }),
    ],
  };
  const moved = reparent(map, 'b', 'newRoot');
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.deepEqual(
    moved.nodes.map((n) => [n.id, n.level, n.parent]).sort(),
    [
      ['b', 1, 'newRoot'],
      ['c', 2, 'b'],
    ].sort(),
  );
});

test('re-parenting into your own descendant is refused', () => {
  const map = { nodes: [node('a', 0, null, { type: 'system' }), node('b', 1, 'a'), node('c', 2, 'b')] };
  const moved = reparent(map, 'a', 'c');
  assert.equal(moved.ok, false);
});

test('re-parenting that would push a descendant past L4 is refused', () => {
  const map = {
    nodes: [
      node('a', 0, null, { type: 'system' }),
      node('b', 1, 'a'),
      node('c', 2, 'b'),
      node('deep0', 0, null, { type: 'system' }),
      node('deep1', 1, 'deep0'),
      node('deep2', 2, 'deep1'),
      node('deep3', 3, 'deep2'),
    ],
  };
  const moved = reparent(map, 'b', 'deep3');
  assert.equal(moved.ok, false);
});

test('search spans every level and ranks exact labels first', () => {
  const map = {
    nodes: [
      node('a', 0, null, { type: 'system', label: 'Reorder point rule' }),
      node('b', 1, 'a', { label: 'Order' }),
      node('c', 2, 'b', { label: 'Order history', properties: { owner: 'payments' } }),
    ],
    edges: [],
  };
  const hits = searchNodes(map, 'order');
  assert.equal(hits[0]?.node.label, 'Order');
  assert.equal(hits.length, 3, 'a deep L2 node is still found');
  assert.deepEqual(hits[0]?.path.map((n) => n.id), ['a', 'b']);
});

test('search matches property values', () => {
  const map = {
    nodes: [node('a', 0, null, { type: 'system', label: 'Ledger', properties: { owner: 'payments' } })],
    edges: [],
  };
  assert.equal(searchNodes(map, 'payments')[0]?.matchedOn, 'property');
});
