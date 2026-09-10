import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GraphEdge, GraphNode, Level, NodeType, View } from './model.ts';
import { NODE_TYPE_VIEW } from './model.ts';
import { idForPath, parseDocument, planImport, type ParsedDocument } from './markdown.ts';

function parse(text: string, path: string): ParsedDocument {
  const result = parseDocument(text, path);
  assert.ok(!('reason' in result), `expected ${path} to parse, got: ${(result as { reason?: string }).reason}`);
  return result;
}

const empty = { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };

function node(id: string, level: Level, parent: string | null, overrides: Partial<GraphNode> = {}): GraphNode {
  const type: NodeType = overrides.type ?? 'service';
  const view: View = overrides.view ?? NODE_TYPE_VIEW[type];
  return {
    id, label: id, view, type, level, parent,
    description: '', properties: {}, positions: {},
    source: { kind: 'manual', path: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Parsing one document
// ---------------------------------------------------------------------------

test('FR-47: frontmatter supplies identity, type and properties', () => {
  const doc = parse(
    `---
label: Payments API
type: api
owner: Payments
criticality: critical
---

The public payment interface.
`,
    'payments/api.md',
  );

  assert.equal(doc.label, 'Payments API');
  assert.equal(doc.type, 'api');
  assert.equal(doc.view, 'technical', 'the view follows from the type');
  assert.deepEqual(doc.properties, { owner: 'Payments', criticality: 'critical' });
  assert.equal(doc.description, 'The public payment interface.');
});

test('a document with no frontmatter still yields a node, with a warning', () => {
  const doc = parse('# Order Service\n\nHandles orders.\n', 'order-service.md');
  assert.equal(doc.label, 'Order Service', 'the H1 is the label');
  assert.equal(doc.type, 'system', 'the default type');
  assert.equal(doc.description, 'Handles orders.');
  assert.match(doc.warnings.join(' '), /No `type`/);
});

test('the label falls back from frontmatter to H1 to the filename', () => {
  assert.equal(parse('body only', 'billing-engine.md').label, 'Billing engine');
  assert.equal(parse('# From Heading', 'x.md').label, 'From Heading');
  assert.equal(parse('---\nlabel: From Frontmatter\n---\n# From Heading', 'x.md').label, 'From Frontmatter');
});

test('an unknown type fails that one document with a usable reason', () => {
  const result = parseDocument('---\ntype: microservice\n---\n', 'x.md');
  assert.ok('reason' in result);
  assert.match(result.reason, /Unknown type "microservice"/);
});

test('invalid YAML fails that one document rather than the import', () => {
  const result = parseDocument('---\nlabel: "unterminated\n---\n', 'x.md');
  assert.ok('reason' in result);
  assert.match(result.reason, /not valid YAML/);
});

test('a view that disagrees with the type warns, and the type wins', () => {
  const doc = parse('---\ntype: capability\nview: technical\n---\n', 'x.md');
  assert.equal(doc.view, 'functional');
  assert.match(doc.warnings.join(' '), /disagrees with type/);
});

// ---------------------------------------------------------------------------
// Wikilinks
// ---------------------------------------------------------------------------

test('FR-48: frontmatter keys named after a relationship type become typed links', () => {
  const doc = parse(
    `---
type: service
calls:
  - "[[Payments DB]]"
  - "[[Orders API]]"
realizes: "[[Checkout]]"
---
`,
    'x.md',
  );

  assert.deepEqual(
    doc.links.map((l) => [l.type, l.target]).sort(),
    [['calls', 'Orders API'], ['calls', 'Payments DB'], ['realizes', 'Checkout']].sort(),
  );
});

test('unquoted wikilinks in frontmatter work too, despite YAML reading them as nested lists', () => {
  const doc = parse('---\ntype: service\ncalls: [[Payments DB]]\n---\n', 'x.md');
  assert.deepEqual(doc.links.map((l) => [l.type, l.target]), [['calls', 'Payments DB']]);
});

test('FR-48: a wikilink takes its type from the heading it sits under', () => {
  const doc = parse(
    `---
type: service
---

# Order Service

## Calls

- [[Payment Service]]

## Reads

- [[Catalog DB]]

## Notes

- [[Something Else]]
`,
    'x.md',
  );

  const byTarget = new Map(doc.links.map((l) => [l.target, l.type]));
  assert.equal(byTarget.get('Payment Service'), 'calls');
  assert.equal(byTarget.get('Catalog DB'), 'reads');
  assert.equal(byTarget.get('Something Else'), 'depends-on', 'an unrecognised heading gives the default type');
});

test('a link can be typed inline, and a plain alias is still just an alias', () => {
  const doc = parse('---\ntype: service\n---\nSee [[Ledger|writes]] and [[Catalog|the catalogue]].', 'x.md');
  const byTarget = new Map(doc.links.map((l) => [l.target, l.type]));
  assert.equal(byTarget.get('Ledger'), 'writes');
  assert.equal(byTarget.get('Catalog'), 'depends-on');
});

test('wikilinks inside code fences are not relationships', () => {
  const doc = parse('---\ntype: service\n---\n\n```\n[[Not A Link]]\n```\n\nBut [[Real Link]] is.', 'x.md');
  assert.deepEqual(doc.links.map((l) => l.target), ['Real Link']);
});

// ---------------------------------------------------------------------------
// Hierarchy
// ---------------------------------------------------------------------------

test('FR-49: folder nesting establishes the hierarchy', () => {
  const docs = [
    parse('---\ntype: system\nlabel: Platform\n---\n', 'index.md'),
    parse('---\ntype: system\nlabel: Payments\n---\n', 'payments/index.md'),
    parse('---\ntype: service\nlabel: Payment Service\n---\n', 'payments/payment-service.md'),
    parse('---\ntype: api\nlabel: Payments API\n---\n', 'payments/payment-service/api.md'),
  ];
  const plan = planImport(docs, empty);
  const byLabel = new Map(plan.nodes.map((n) => [n.label, n]));

  assert.equal(byLabel.get('Platform')?.level, 0);
  assert.equal(byLabel.get('Payments')?.level, 1);
  assert.equal(byLabel.get('Payments')?.parent, idForPath('index.md'));
  assert.equal(byLabel.get('Payment Service')?.level, 2);
  assert.equal(byLabel.get('Payments API')?.level, 3);
  assert.equal(plan.report.failed.length + plan.report.skipped.length, 0);
});

test('FR-49: an explicit parent in frontmatter overrides the folder structure', () => {
  const docs = [
    parse('---\ntype: system\nlabel: Platform\n---\n', 'index.md'),
    parse('---\ntype: system\nlabel: Payments\n---\n', 'payments/index.md'),
    parse('---\ntype: service\nlabel: Stray\nparent: "[[Payments]]"\n---\n', 'elsewhere/stray.md'),
  ];
  const plan = planImport(docs, empty);
  const stray = plan.nodes.find((n) => n.label === 'Stray');
  assert.equal(stray?.parent, idForPath('payments/index.md'));
  assert.equal(stray?.level, 2);
});

test('nesting deeper than L4 skips those documents and says why', () => {
  const docs = [
    parse('---\ntype: system\n---\n', 'a/index.md'),
    parse('---\ntype: system\n---\n', 'a/b/index.md'),
    parse('---\ntype: system\n---\n', 'a/b/c/index.md'),
    parse('---\ntype: system\n---\n', 'a/b/c/d/index.md'),
    parse('---\ntype: system\n---\n', 'a/b/c/d/e/index.md'),
    parse('---\ntype: service\n---\n', 'a/b/c/d/e/too-deep.md'),
  ];
  const plan = planImport(docs, empty);
  assert.equal(plan.nodes.length, 5, 'L0 through L4 are imported');
  assert.equal(plan.report.skipped.length, 1);
  assert.match(plan.report.skipped[0]!.reason, /stops at L4/);
});

test('a level in frontmatter that disagrees with the tree warns, and the tree wins', () => {
  const docs = [
    parse('---\ntype: system\n---\n', 'index.md'),
    parse('---\ntype: service\nlevel: 4\n---\n', 'child.md'),
  ];
  const plan = planImport(docs, empty);
  assert.equal(plan.nodes.find((n) => n.id === idForPath('child.md'))?.level, 1);
  assert.match(plan.report.warnings.map((w) => w.message).join(' '), /disagrees with the hierarchy/);
});

// ---------------------------------------------------------------------------
// Link resolution
// ---------------------------------------------------------------------------

test('links resolve by label, by path, and by filename', () => {
  const docs = [
    parse('---\ntype: system\nlabel: Root\n---\n', 'index.md'),
    parse('---\ntype: datastore\nlabel: Orders DB\n---\n', 'stores/orders-db.md'),
    parse(
      `---
type: service
label: Order Service
calls: "[[Orders DB]]"
reads: "[[stores/orders-db.md]]"
writes: "[[orders-db]]"
---
`,
      'order-service.md',
    ),
  ];
  const plan = planImport(docs, empty);
  const target = idForPath('stores/orders-db.md');
  const from = idForPath('order-service.md');

  for (const type of ['calls', 'reads', 'writes']) {
    assert.ok(
      plan.edges.some((e) => e.source === from && e.target === target && e.type === type),
      `${type} resolved`,
    );
  }
  assert.equal(plan.report.unresolvedLinks.length, 0);
});

test('an unresolved link is reported, not silently dropped, and never dangles', () => {
  const docs = [parse('---\ntype: service\ncalls: "[[Ghost Service]]"\n---\n', 'x.md')];
  const plan = planImport(docs, empty);
  assert.equal(plan.edges.length, 0);
  assert.equal(plan.report.unresolvedLinks.length, 1);
  assert.equal(plan.report.unresolvedLinks[0]!.target, 'Ghost Service');
  assert.match(plan.report.unresolvedLinks[0]!.reason, /Nothing named/);
});

test('an ambiguous link is reported as ambiguous rather than guessed', () => {
  const docs = [
    parse('---\ntype: service\nlabel: Gateway\n---\n', 'a/gateway.md'),
    parse('---\ntype: service\nlabel: Gateway\n---\n', 'b/gateway.md'),
    parse('---\ntype: service\ncalls: "[[Gateway]]"\n---\n', 'caller.md'),
  ];
  const plan = planImport(docs, empty);
  assert.equal(plan.report.unresolvedLinks.length, 1);
  assert.match(plan.report.unresolvedLinks[0]!.reason, /ambiguous/);
});

test('two documents claiming the same id skips the second and names the first', () => {
  const docs = [
    parse('---\ntype: service\nid: shared\n---\n', 'a.md'),
    parse('---\ntype: service\nid: shared\n---\n', 'b.md'),
  ];
  const plan = planImport(docs, empty);
  assert.equal(plan.nodes.length, 1);
  assert.match(plan.report.skipped[0]!.reason, /already used by a\.md/);
});

// ---------------------------------------------------------------------------
// Re-import: FR-51 and FR-52
// ---------------------------------------------------------------------------

test('FR-51: re-importing updates in place instead of duplicating', () => {
  const first = planImport([parse('---\ntype: service\nlabel: Order Service\n---\n', 'order.md')], empty);
  assert.equal(first.report.created.length, 1);

  const second = planImport(
    [parse('---\ntype: service\nlabel: Order Service (renamed)\n---\n', 'order.md')],
    first,
  );

  assert.equal(second.nodes.length, 1, 'still one node');
  assert.equal(second.report.created.length, 0);
  assert.equal(second.report.updated.length, 1);
  assert.equal(second.nodes[0]!.label, 'Order Service (renamed)');
  assert.equal(second.nodes[0]!.id, first.nodes[0]!.id, 'the id is stable across re-import');
});

test('FR-52: a manual position survives re-import', () => {
  const first = planImport([parse('---\ntype: service\n---\n', 'order.md')], empty);
  const positioned = first.nodes.map((n) => ({ ...n, positions: { root: { x: 42, y: 99 } } }));

  const second = planImport([parse('---\ntype: service\nlabel: Changed\n---\n', 'order.md')], {
    nodes: positioned,
    edges: first.edges,
  });

  assert.deepEqual(second.nodes[0]!.positions, { root: { x: 42, y: 99 } });
  assert.equal(second.nodes[0]!.label, 'Changed', 'while the document still updates the label');
});

test('FR-52: a hand-added property survives, and the document wins for its own keys', () => {
  const first = planImport([parse('---\ntype: service\nowner: Orders\n---\n', 'order.md')], empty);
  const annotated = first.nodes.map((n) => ({
    ...n,
    properties: { ...n.properties, 'on-call': 'team-b', owner: 'edited by hand' },
  }));

  const second = planImport([parse('---\ntype: service\nowner: Payments\n---\n', 'order.md')], {
    nodes: annotated,
    edges: [],
  });

  assert.equal(second.nodes[0]!.properties['on-call'], 'team-b', 'a key the document does not mention is kept');
  assert.equal(second.nodes[0]!.properties.owner, 'Payments', 'a key the document owns is refreshed');
});

test('FR-52: hand-made nodes and relationships are left alone by an import', () => {
  const existing = {
    nodes: [node('manual:a', 0, null, { type: 'system' }), node('manual:b', 0, null, { type: 'system' })],
    edges: [
      {
        id: 'manual:a|calls|manual:b',
        source: 'manual:a',
        target: 'manual:b',
        type: 'calls' as const,
        weight: 1,
        properties: {},
        sourceRef: { kind: 'manual', path: null },
      },
    ],
  };

  const plan = planImport([parse('---\ntype: service\n---\n', 'imported.md')], existing);

  assert.equal(plan.report.manualNodesPreserved, 2);
  assert.equal(plan.report.manualEdgesPreserved, 1);
  assert.ok(plan.nodes.some((n) => n.id === 'manual:a'));
  assert.ok(plan.edges.some((e) => e.id === 'manual:a|calls|manual:b'));
});

test('a link removed from a document removes the relationship it created', () => {
  const first = planImport(
    [
      parse('---\ntype: service\nlabel: A\ncalls: "[[B]]"\n---\n', 'a.md'),
      parse('---\ntype: service\nlabel: B\n---\n', 'b.md'),
    ],
    empty,
  );
  assert.equal(first.edges.length, 1);

  const second = planImport(
    [
      parse('---\ntype: service\nlabel: A\n---\n', 'a.md'),
      parse('---\ntype: service\nlabel: B\n---\n', 'b.md'),
    ],
    first,
  );
  assert.equal(second.edges.length, 0, 'the relationship goes when the link does');
});

test('a document that disappears leaves its node in place unless pruning is asked for', () => {
  const first = planImport(
    [
      parse('---\ntype: service\nlabel: Kept\n---\n', 'kept.md'),
      parse('---\ntype: service\nlabel: Gone\n---\n', 'gone.md'),
    ],
    empty,
  );

  const withoutPrune = planImport([parse('---\ntype: service\nlabel: Kept\n---\n', 'kept.md')], first);
  assert.equal(withoutPrune.nodes.length, 2, 'nothing is deleted by default');
  assert.equal(withoutPrune.report.orphaned.length, 1);
  assert.equal(withoutPrune.report.pruned.length, 0);

  const withPrune = planImport([parse('---\ntype: service\nlabel: Kept\n---\n', 'kept.md')], first, { prune: true });
  assert.equal(withPrune.nodes.length, 1);
  assert.deepEqual(withPrune.report.pruned, [idForPath('gone.md')]);
});

test('pruning never orphans a surviving child', () => {
  const first = planImport(
    [
      parse('---\ntype: system\nlabel: Parent\n---\n', 'parent/index.md'),
      parse('---\ntype: service\nlabel: Child\n---\n', 'parent/child.md'),
    ],
    empty,
  );

  // The parent document vanishes but the child's does not.
  const second = planImport([parse('---\ntype: service\nlabel: Child\n---\n', 'parent/child.md')], first, {
    prune: true,
  });

  const child = second.nodes.find((n) => n.label === 'Child');
  assert.ok(child);
  assert.ok(
    child.parent === null || second.nodes.some((n) => n.id === child.parent),
    'the child either became a root or kept a parent that is still present',
  );
});

test('a document that fails to parse does not destroy the node it made last time', () => {
  const first = planImport([parse('---\ntype: service\nlabel: Important\n---\n', 'x.md')], empty);
  const broken = parseDocument('---\nlabel: "unterminated\n---\n', 'x.md');

  const second = planImport([broken], first);
  assert.equal(second.report.failed.length, 1);
  assert.equal(second.nodes.length, 1, 'the previously imported node is still there');
  assert.equal(second.nodes[0]!.label, 'Important');
});

test('ids come from the path, so they survive a label change', () => {
  assert.equal(idForPath('systems/payments/api.md'), 'systems:payments:api');
  assert.equal(idForPath('payments/index.md'), 'payments', 'an index document stands for its folder');
  assert.equal(idForPath('Order Service.md'), 'order-service');
});

test('the whole plan is a valid map that the repository can commit', async () => {
  const { validateGraph } = await import('./validate.ts');
  const docs = [
    parse('---\ntype: system\nlabel: Platform\n---\n', 'index.md'),
    parse('---\ntype: capability\nlabel: Checkout\n---\n', 'business/index.md'),
    parse('---\ntype: system\nlabel: Payments\n---\n', 'payments/index.md'),
    parse('---\ntype: service\nlabel: Payment Service\ncalls: "[[Payments DB]]"\n---\n', 'payments/service.md'),
    parse('---\ntype: datastore\nlabel: Payments DB\n---\n', 'payments/db.md'),
  ];
  const plan = planImport(docs, empty);
  const result = validateGraph(plan);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
