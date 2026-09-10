import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { openDatabase, type Db } from './db.js';
import { MapRepository } from './repository.js';
import { registerRoutes } from './routes.js';

export interface BuildOptions {
  /** File path, or ':memory:' for tests. */
  databasePath?: string;
  logger?: boolean;
  /** Dev origins allowed to call the API. Vite runs on 5173. */
  corsOrigins?: string[];
}

export interface BuiltApp {
  app: FastifyInstance;
  db: Db;
  repo: MapRepository;
}

export async function buildApp(options: BuildOptions = {}): Promise<BuiltApp> {
  const db = openDatabase(options.databasePath ?? ':memory:');
  const repo = new MapRepository(db);
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, {
    origin: options.corsOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  registerRoutes(app, repo);
  app.addHook('onClose', async () => db.close());

  return { app, db, repo };
}
