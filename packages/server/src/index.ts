import { resolve } from 'node:path';

import { buildApp } from './app.js';
import { ensureProductMap } from './productMap.js';
import { seedDemoMap } from './seed.js';

const port = Number(process.env.PORT ?? 5174);
const host = process.env.HOST ?? '127.0.0.1';
const databasePath = process.env.MAP_DB ?? resolve(process.cwd(), 'data/map.db');

const { app, repo } = await buildApp({ databasePath, logger: true });

// First run on an empty database gets the demo map, so the UI has something to play with.
if (repo.listMaps().length === 0) {
  const summary = seedDemoMap(repo);
  app.log.info(`Seeded demo map "${summary.id}" (${summary.nodeCount} nodes, ${summary.edgeCount} edges).`);
}

// The map of the product itself ships with the app: refreshed on every start so it cannot drift,
// locked so it reads the same for everyone, and listed first so it is what opens by default.
const product = ensureProductMap(repo);
app.log.info(`Product map "${product.id}" ready (${product.nodeCount} nodes, ${product.edgeCount} edges, read-only).`);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
