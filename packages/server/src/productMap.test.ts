import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { FastifyInstance } from 'fastify';
import { coverageGaps, buildIndex, validateGraph } from '@map/shared';

import { buildApp } from './app.ts';
import { PRODUCT_MAP_ID, ensureProductMap, productMapContents } from './productMap.ts';
import type { MapRepository } from './repository.ts';
import { seedDemoMap } from './seed.ts';

let app: FastifyInstance;
let repo: MapRepository;

before(async () => {
  const built = await buildApp({ databasePath: ':memory:' });
  app = built.app;
  repo = built.repo;
  seedDemoMap(repo);
  ensureProductMap(repo);
});

after(async () => {
  await app.close();
});

async function call(method: string, url: string, payload?: unknown) {
  const response = await app.inject({ method: method as 'GET', url, payload: payload as object });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
}

const productUrl = `/api/maps/${PRODUCT_MAP_ID}`;

test('the product map is a valid graph covering both views and four levels', () => {
  const contents = productMapContents();
  const result = validateGraph(contents);
  assert.equal(result.ok, true, JSON.stringify(result.errors));

  assert.ok(contents.nodes.length > 60, 'it is a substantial map');
  assert.ok(contents.nodes.some((n) => n.view === 'functional'));
  assert.ok(contents.nodes.some((n) => n.view === 'technical'));
  assert.deepEqual(
    [...new Set(contents.nodes.map((n) => n.level))].sort(),
    [0, 1, 2, 3],
    'levels L0 to L3 are populated',
  );
});

test('the product map records traceability between what it does and how it is built', () => {
  const contents = productMapContents();
  const traceability = contents.edges.filter(
    (e) => e.type === 'realizes' || e.type === 'implemented-by',
  );
  assert.ok(traceability.length > 20, 'the two sides are genuinely joined');

  const byId = new Map(contents.nodes.map((n) => [n.id, n]));
  for (const edge of traceability) {
    assert.equal(byId.get(edge.source)?.view, 'functional', `${edge.id} starts functional`);
    assert.equal(byId.get(edge.target)?.view, 'technical', `${edge.id} ends technical`);
  }
});

test('the planned-but-unbuilt features show up as blind spots, which is the honest answer', () => {
  const gaps = coverageGaps(buildIndex(productMapContents()));
  const unimplemented = gaps.unimplementedFunctional.map((n) => n.id);
  assert.ok(unimplemented.includes('feature:minimap'));
  assert.ok(unimplemented.includes('feature:image-export'));
  assert.equal(unimplemented.includes('cap:global-search'), false, 'built capabilities are not gaps');
});

test('it is listed first, so it is the map that opens by default', async () => {
  const { body } = await call('GET', '/api/maps');
  assert.equal(body.maps[0].id, PRODUCT_MAP_ID);
  assert.equal(body.maps[0].locked, true);
  assert.equal(body.maps.some((m: { id: string }) => m.id === 'orion-commerce'), true, 'the demo map is still there');
});

test('the map reports itself as locked so the client can reflect it', async () => {
  const { body } = await call('GET', productUrl);
  assert.equal(body.locked, true);

  const demo = await call('GET', '/api/maps/orion-commerce');
  assert.equal(demo.body.locked, false);
});

test('every content write against it is refused with 403', async () => {
  const node = productMapContents().nodes[0]!;
  const edge = productMapContents().edges[0]!;

  const attempts: Array<[string, string, unknown?]> = [
    ['POST', `${productUrl}/nodes`, { label: 'Sneaky', view: 'technical', type: 'service', level: 0, parent: null }],
    ['PATCH', `${productUrl}/nodes/${encodeURIComponent(node.id)}`, { label: 'Renamed' }],
    ['DELETE', `${productUrl}/nodes/${encodeURIComponent(node.id)}`],
    ['POST', `${productUrl}/nodes/${encodeURIComponent(node.id)}/reparent`, { parent: null }],
    ['PUT', `${productUrl}/nodes/${encodeURIComponent(node.id)}/position`, { context: null, x: 1, y: 2 }],
    ['POST', `${productUrl}/edges`, { source: node.id, target: node.id, type: 'calls' }],
    ['PATCH', `${productUrl}/edges/${encodeURIComponent(edge.id)}`, { weight: 9 }],
    ['DELETE', `${productUrl}/edges/${encodeURIComponent(edge.id)}`],
    ['PATCH', productUrl, { name: 'Renamed map' }],
    ['DELETE', productUrl],
  ];

  for (const [method, url, payload] of attempts) {
    const { status, body } = await call(method, url, payload);
    assert.equal(status, 403, `${method} ${url} should be refused`);
    assert.equal(body.error, 'MapLocked');
    assert.match(body.message, /read-only/);
  }
});

test('markdown import and JSON replace cannot get around the lock either', async () => {
  const markdown = await call('POST', `${productUrl}/import/markdown`, { path: process.cwd() });
  assert.equal(markdown.status, 403);

  const exported = await call('GET', `${productUrl}/export`);
  const replaced = await call('POST', '/api/maps/import', {
    map: { ...exported.body.map, nodes: [], edges: [] },
    mode: 'replace',
    targetMapId: PRODUCT_MAP_ID,
  });
  assert.equal(replaced.status, 403);
});

test('nothing actually changed after all those attempts', async () => {
  const { body } = await call('GET', productUrl);
  assert.equal(body.nodes.length, productMapContents().nodes.length);
  assert.equal(body.edges.length, productMapContents().edges.length);
});

test('reading, querying and exporting it all still work', async () => {
  const validation = await call('GET', `${productUrl}/validate`);
  assert.equal(validation.body.ok, true);

  const search = await call('GET', `${productUrl}/search?q=import`);
  assert.ok(search.body.hits.length > 0);

  const coverage = await call('GET', `${productUrl}/coverage`);
  assert.equal(coverage.status, 200);

  const exported = await call('GET', `${productUrl}/export`);
  assert.equal(exported.status, 200);
  assert.ok(exported.body.map.nodes.length > 60);
});

test('a saved view is allowed on a locked map — it is the reader own working state', async () => {
  const { status } = await call('POST', `${productUrl}/views`, {
    name: 'The technical side',
    state: { viewMode: 'technical' },
  });
  assert.equal(status, 201);
});

test('the demo map is still fully writable', async () => {
  const { status } = await call('POST', '/api/maps/orion-commerce/nodes', {
    label: 'Still Editable', view: 'technical', type: 'service', level: 1, parent: 'system:oms',
  });
  assert.equal(status, 201);
});

test('re-seeding is idempotent and re-locks the map', () => {
  const before = repo.getMap(PRODUCT_MAP_ID);
  const summary = ensureProductMap(repo);
  const after = repo.getMap(PRODUCT_MAP_ID);

  assert.equal(summary.locked, true);
  assert.equal(after.nodes.length, before.nodes.length);
  assert.equal(after.edges.length, before.edges.length);
  assert.equal(repo.listMaps().filter((m) => m.id === PRODUCT_MAP_ID).length, 1, 'not duplicated');
});
