import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { FastifyInstance } from 'fastify';

import { buildApp } from './app.ts';
import type { MapRepository } from './repository.ts';
import { seedDemoMap } from './seed.ts';

let app: FastifyInstance;
let repo: MapRepository;

before(async () => {
  const built = await buildApp({ databasePath: ':memory:' });
  app = built.app;
  repo = built.repo;
  seedDemoMap(repo);
});

after(async () => {
  await app.close();
});

async function call(method: string, url: string, payload?: unknown) {
  const response = await app.inject({ method: method as 'GET', url, payload: payload as object });
  return { status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
}

test('the seeded demo map loads and is internally valid', async () => {
  const { status, body } = await call('GET', '/api/maps/orion-commerce');
  assert.equal(status, 200);
  assert.ok(body.nodes.length > 50, 'demo map is substantial');
  const validation = await call('GET', '/api/maps/orion-commerce/validate');
  assert.equal(validation.body.ok, true, JSON.stringify(validation.body.errors));
});

test('a node is created at the level its parent dictates, not the level the client claims', async () => {
  const { status, body } = await call('POST', '/api/maps/orion-commerce/nodes', {
    label: 'Fraud Screening',
    view: 'technical',
    type: 'service',
    level: 0, // deliberately wrong; the parent puts it at L2
    parent: 'system:payments-platform',
  });
  assert.equal(status, 201);
  assert.equal(body.level, 2);
  assert.equal(body.id, 'service:fraud-screening');
});

test('creating a node under a nonexistent parent 404s', async () => {
  const { status } = await call('POST', '/api/maps/orion-commerce/nodes', {
    label: 'Nowhere',
    view: 'technical',
    type: 'service',
    level: 1,
    parent: 'system:does-not-exist',
  });
  assert.equal(status, 404);
});

test('an edge to a nonexistent node is refused with 422 and the reason', async () => {
  const { status, body } = await call('POST', '/api/maps/orion-commerce/edges', {
    source: 'service:order-service',
    target: 'service:ghost',
    type: 'calls',
  });
  assert.equal(status, 422);
  assert.equal(body.issues[0].code, 'dangling-edge');
});

test('re-parenting moves the whole subtree and re-levels it', async () => {
  const { status, body } = await call(
    'POST',
    '/api/maps/orion-commerce/nodes/service:catalog-service/reparent',
    { parent: 'system:storefront' },
  );
  assert.equal(status, 200);
  type MovedNode = { id: string; level: number; parent: string | null };
  const moved = new Map<string, MovedNode>(
    (body.nodes as MovedNode[]).map((n) => [n.id, n]),
  );
  assert.equal(moved.get('service:catalog-service')?.parent, 'system:storefront');
  assert.equal(moved.get('service:catalog-service')?.level, 2);
  assert.equal(moved.get('api:catalog-api')?.level, 3, 'the child moved with it');

  // put it back so later assertions see the original shape
  await call('POST', '/api/maps/orion-commerce/nodes/service:catalog-service/reparent', {
    parent: 'system:catalog-platform',
  });
});

test('re-parenting a node beneath its own descendant is refused', async () => {
  const { status } = await call(
    'POST',
    '/api/maps/orion-commerce/nodes/system:catalog-platform/reparent',
    { parent: 'api:catalog-api' },
  );
  assert.equal(status, 422);
});

test('deleting a node removes its incident edges and, by default, its subtree', async () => {
  const before = await call('GET', '/api/maps/orion-commerce');
  const { status, body } = await call(
    'DELETE',
    '/api/maps/orion-commerce/nodes/service:legacy-promo-engine?descendants=delete',
  );
  assert.equal(status, 200);
  assert.deepEqual(body.deletedNodes, ['service:legacy-promo-engine']);

  const after = await call('GET', '/api/maps/orion-commerce');
  assert.equal(after.body.nodes.length, before.body.nodes.length - 1);
  assert.equal(
    after.body.edges.some((e: { source: string; target: string }) =>
      e.source === 'service:legacy-promo-engine' || e.target === 'service:legacy-promo-engine',
    ),
    false,
  );
  const validation = await call('GET', '/api/maps/orion-commerce/validate');
  assert.equal(validation.body.ok, true);
});

test('promote-on-delete lifts children to the deleted node parent', async () => {
  await call('POST', '/api/maps/orion-commerce/nodes', {
    label: 'Doomed Layer', view: 'technical', type: 'system', level: 1, parent: 'system:orion-platform',
  });
  await call('POST', '/api/maps/orion-commerce/nodes', {
    label: 'Survivor', view: 'technical', type: 'service', level: 2, parent: 'system:doomed-layer',
  });

  const { status, body } = await call(
    'DELETE',
    '/api/maps/orion-commerce/nodes/system:doomed-layer?descendants=promote',
  );
  assert.equal(status, 200);
  assert.equal(body.promotedNodes[0].parent, 'system:orion-platform');
  assert.equal(body.promotedNodes[0].level, 1);

  await call('DELETE', '/api/maps/orion-commerce/nodes/service:survivor');
});

test('positions are stored per context', async () => {
  await call('PUT', '/api/maps/orion-commerce/nodes/service:order-service/position', {
    context: 'system:oms', x: 120, y: 40,
  });
  const { body } = await call('PUT', '/api/maps/orion-commerce/nodes/service:order-service/position', {
    context: null, x: 5, y: 7,
  });
  assert.deepEqual(body.positions['system:oms'], { x: 120, y: 40 });
  assert.deepEqual(body.positions.root, { x: 5, y: 7 });
});

test('search reaches nodes at every level and reports their path', async () => {
  const { body } = await call('GET', '/api/maps/orion-commerce/search?q=order');
  const hit = body.hits.find((h: { node: { id: string } }) => h.node.id === 'api:orders-api');
  assert.ok(hit, 'a level-3 API is found by a global search');
  assert.deepEqual(
    hit.path.map((n: { id: string }) => n.id),
    ['system:orion-platform', 'system:oms', 'service:order-service', 'api:orders-api'],
    'the path runs L0 down to the node itself, which is what disambiguates same-named nodes',
  );
});

test('impact traversal reports hop distance downstream', async () => {
  const { body } = await call(
    'GET',
    '/api/maps/orion-commerce/nodes/service:order-orchestrator/impact?direction=downstream&depth=2',
  );
  const reached = new Map<string, number>(
    (body.reached as Array<{ id: string; hops: number }>).map((r) => [r.id, r.hops]),
  );
  assert.equal(reached.get('api:payments-api'), 1);
  assert.equal(reached.get('component:psp-adapter'), 2);
});

test('path finding connects the storefront to the payment provider', async () => {
  const { body } = await call(
    'GET',
    '/api/maps/orion-commerce/path?from=service:web-bff&to=system:stripe',
  );
  assert.ok(body.path, 'a route exists');
  assert.equal(body.path.nodes[0], 'service:web-bff');
  assert.equal(body.path.nodes.at(-1), 'system:stripe');
});

test('coverage reports capabilities nothing implements', async () => {
  const { body } = await call('GET', '/api/maps/orion-commerce/coverage');
  const ids = body.unimplementedFunctional.map((n: { id: string }) => n.id);
  assert.ok(ids.includes('feature:recommendations'));
  assert.ok(ids.includes('cap:case-management'));
  assert.equal(ids.includes('cap:checkout'), false, 'checkout is realized, so it is not a gap');
});

test('export round-trips through import without loss', async () => {
  const exported = await call('GET', '/api/maps/orion-commerce/export');
  const imported = await call('POST', '/api/maps/import', { map: exported.body.map, mode: 'create' });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.nodes.length, exported.body.map.nodes.length);
  assert.equal(imported.body.edges.length, exported.body.map.edges.length);
  assert.deepEqual(
    imported.body.nodes.map((n: { id: string }) => n.id).sort(),
    exported.body.map.nodes.map((n: { id: string }) => n.id).sort(),
  );
});

test('a saved view is stored and listed', async () => {
  const created = await call('POST', '/api/maps/orion-commerce/views', {
    name: 'Payments deep dive',
    state: { contextId: 'system:payments-platform', viewMode: 'technical', focusId: 'service:payment-service', focusDepth: 2 },
  });
  assert.equal(created.status, 201);
  const { body } = await call('GET', '/api/maps/orion-commerce/views');
  assert.equal(body.views[0].name, 'Payments deep dive');
  assert.equal(body.views[0].state.focusId, 'service:payment-service');
});
