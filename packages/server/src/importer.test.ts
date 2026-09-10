import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import type { FastifyInstance } from 'fastify';

import { buildApp } from './app.ts';

let app: FastifyInstance;
let root: string;

/**
 * A small documentation tree exercising every convention the importer supports: folder index
 * documents, the sibling-file form, frontmatter relationships, wikilinks under typed headings,
 * traceability across the two views, and one deliberately broken document.
 */
const FILES: Record<string, string> = {
  'index.md': `---
type: system
label: Acme Platform
owner: Platform
---

The whole thing.
`,

  'business/index.md': `---
type: capability
label: Selling
owner: Commerce
---
`,

  'business/checkout.md': `---
type: capability
label: Checkout
owner: Orders
criticality: critical
realizes: "[[Order Service]]"
---

Turning a basket into an order.
`,

  'business/returns.md': `---
type: capability
label: Returns
owner: Care
---

Nothing implements this yet.
`,

  'platform/index.md': `---
type: system
label: Runtime
---
`,

  // The sibling-file form: orders.md is the index for the orders/ folder next to it.
  'platform/orders.md': `---
type: system
label: Orders System
---
`,

  'platform/orders/order-service.md': `---
type: service
label: Order Service
technology: Java
calls:
  - "[[Payments API]]"
---

# Order Service

## Writes

- [[Orders DB]]

## Notes

Some prose mentioning [[Catalog Service]] loosely.
`,

  'platform/orders/orders-db.md': `---
type: datastore
label: Orders DB
technology: PostgreSQL
---
`,

  'platform/payments.md': `---
type: system
label: Payments System
---
`,

  'platform/payments/payments-api.md': `---
type: api
label: Payments API
---
`,

  'platform/catalog-service.md': `---
type: service
label: Catalog Service
---
`,

  'broken.md': `---
label: "unterminated
---

This document cannot be parsed.
`,
};

before(async () => {
  const built = await buildApp({ databasePath: ':memory:' });
  app = built.app;
  built.repo.createMap({ id: 'docs', name: 'From docs' });

  root = await mkdtemp(join(tmpdir(), 'map-import-'));
  for (const [relativePath, text] of Object.entries(FILES)) {
    const full = join(root, relativePath);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, text, 'utf8');
  }
  // Noise that must be ignored.
  await mkdir(join(root, 'node_modules', 'junk'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'junk', 'readme.md'), '# ignore me', 'utf8');
  await writeFile(join(root, 'notes.txt'), 'not markdown', 'utf8');
});

after(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});

async function call(method: string, url: string, payload?: unknown) {
  const response = await app.inject({ method: method as 'GET', url, payload: payload as object });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
}

const importDocs = (extra: Record<string, unknown> = {}) =>
  call('POST', '/api/maps/docs/import/markdown', { path: root, ...extra });

test('FR-53: a dry run reports what would happen and writes nothing', async () => {
  const { status, body } = await importDocs({ dryRun: true });
  assert.equal(status, 200);
  assert.equal(body.dryRun, true);
  assert.equal(body.report.created.length, 11, 'every parseable document would become a node');
  assert.equal(body.report.failed.length, 1, 'the broken document is reported');

  const map = await call('GET', '/api/maps/docs');
  assert.equal(map.body.nodes.length, 0, 'nothing was written');
});

test('the import builds the map, and the result is a valid graph', async () => {
  const { status, body } = await importDocs();
  assert.equal(status, 200);
  assert.equal(body.report.created.length, 11);

  const validation = await call('GET', '/api/maps/docs/validate');
  assert.equal(validation.body.ok, true, JSON.stringify(validation.body.errors));
});

test('FR-49: folder nesting and the sibling-file form both establish the hierarchy', async () => {
  const { body } = await call('GET', '/api/maps/docs');
  const byLabel = new Map(body.nodes.map((n: { label: string }) => [n.label, n]));

  const level = (label: string) => (byLabel.get(label) as { level: number } | undefined)?.level;
  const parentOf = (label: string) => (byLabel.get(label) as { parent: string } | undefined)?.parent;

  assert.equal(level('Acme Platform'), 0);
  assert.equal(level('Runtime'), 1);
  assert.equal(level('Orders System'), 2, 'platform/orders.md sits under platform/index.md');
  assert.equal(level('Order Service'), 3, 'and the orders/ folder hangs off its sibling file');
  assert.equal(parentOf('Order Service'), parentOf('Orders DB'));
  assert.equal(level('Payments API'), 3);
});

test('FR-48: relationships come from frontmatter, typed headings, and loose body links', async () => {
  const { body } = await call('GET', '/api/maps/docs');
  const byLabel = new Map<string, string>(
    body.nodes.map((n: { label: string; id: string }) => [n.label, n.id]),
  );
  const has = (from: string, to: string, type: string) =>
    body.edges.some(
      (e: { source: string; target: string; type: string }) =>
        e.source === byLabel.get(from) && e.target === byLabel.get(to) && e.type === type,
    );

  assert.ok(has('Order Service', 'Payments API', 'calls'), 'from frontmatter');
  assert.ok(has('Order Service', 'Orders DB', 'writes'), 'from the "## Writes" heading');
  assert.ok(has('Order Service', 'Catalog Service', 'depends-on'), 'a loose body link gets the default type');
  assert.ok(has('Checkout', 'Order Service', 'realizes'), 'traceability crosses the two views');
});

test('every imported node records the document it came from', async () => {
  const { body } = await call('GET', '/api/maps/docs');
  const orderService = body.nodes.find((n: { label: string }) => n.label === 'Order Service');
  assert.equal(orderService.source.kind, 'markdown');
  assert.equal(orderService.source.path, 'platform/orders/order-service.md');
});

test('FR-15 still works on an imported map: Returns has nothing implementing it', async () => {
  const { body } = await call('GET', '/api/maps/docs/coverage');
  const labels = body.unimplementedFunctional.map((n: { label: string }) => n.label);
  assert.ok(labels.includes('Returns'));
  assert.equal(labels.includes('Checkout'), false);
});

test('node_modules, dotfiles and non-markdown files are ignored', async () => {
  const { body } = await importDocs({ dryRun: true });
  assert.equal(body.documentsFound, Object.keys(FILES).length);
});

test('FR-51/FR-52: re-importing updates in place and keeps manual work', async () => {
  const before = await call('GET', '/api/maps/docs');
  const orderService = before.body.nodes.find((n: { label: string }) => n.label === 'Order Service');

  // Someone positions the node, annotates it, and adds a node of their own.
  await call('PUT', `/api/maps/docs/nodes/${encodeURIComponent(orderService.id)}/position`, {
    context: null, x: 250, y: 125,
  });
  await call('PATCH', `/api/maps/docs/nodes/${encodeURIComponent(orderService.id)}`, {
    properties: { ...orderService.properties, 'on-call': 'team-b' },
  });
  const manual = await call('POST', '/api/maps/docs/nodes', {
    label: 'Hand-drawn Note', view: 'technical', type: 'component', level: 0, parent: null,
  });

  // The document changes on disk.
  await writeFile(
    join(root, 'platform/orders/order-service.md'),
    `---
type: service
label: Order Service (renamed)
technology: Java 21
calls:
  - "[[Payments API]]"
---
`,
    'utf8',
  );

  const { body } = await importDocs();
  assert.equal(body.report.created.length, 0, 'nothing is created a second time');
  assert.equal(body.report.updated.length, 11);

  const after = await call('GET', '/api/maps/docs');
  const updated = after.body.nodes.find((n: { id: string }) => n.id === orderService.id);

  assert.equal(updated.label, 'Order Service (renamed)', 'the document is authoritative for its own fields');
  assert.equal(updated.technology, undefined);
  assert.equal(updated.properties.technology, 'Java 21');
  assert.equal(updated.properties['on-call'], 'team-b', 'FR-52: the hand-added property survived');
  assert.deepEqual(updated.positions.root, { x: 250, y: 125 }, 'FR-52: the manual position survived');

  assert.ok(
    after.body.nodes.some((n: { id: string }) => n.id === manual.body.id),
    'FR-52: the hand-drawn node survived',
  );

  assert.equal(
    after.body.edges.some(
      (e: { source: string; type: string }) => e.source === orderService.id && e.type === 'writes',
    ),
    false,
    'the removed "## Writes" link took its relationship with it',
  );
});

test('a document that disappears leaves its node alone unless prune is asked for', async () => {
  await rm(join(root, 'business/returns.md'));

  const kept = await importDocs();
  assert.equal(kept.body.report.orphaned.length, 1);
  assert.equal(kept.body.report.pruned.length, 0);
  let map = await call('GET', '/api/maps/docs');
  assert.ok(map.body.nodes.some((n: { label: string }) => n.label === 'Returns'));

  const pruned = await importDocs({ prune: true });
  assert.equal(pruned.body.report.pruned.length, 1);
  map = await call('GET', '/api/maps/docs');
  assert.equal(map.body.nodes.some((n: { label: string }) => n.label === 'Returns'), false);

  const validation = await call('GET', '/api/maps/docs/validate');
  assert.equal(validation.body.ok, true, 'pruning left a valid map');
});

test('a missing folder is a clear 400, not a crash', async () => {
  const { status, body } = await call('POST', '/api/maps/docs/import/markdown', {
    path: join(root, 'no-such-folder'),
  });
  assert.equal(status, 400);
  assert.match(body.message, /does not exist/);
});
