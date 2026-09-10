/**
 * REST surface. Every payload is parsed with the shared zod schemas, so the client and server
 * agree on the model by construction rather than by convention.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  buildIndex,
  coverageGaps,
  edgeCreateSchema,
  edgePatchSchema,
  graphMapSchema,
  nodeCreateSchema,
  nodePatchSchema,
  positionSchema,
  propertyFacets,
  searchNodes,
  shortestPath,
  traverse,
  validateGraph,
  viewStateSchema,
  NODE_TYPES,
  VIEWS,
} from '@map/shared';

import { ImportPathError, importMarkdownFolder } from './importer.js';
import {
  EdgeNotFound,
  InvalidGraph,
  MapLocked,
  MapNotFound,
  MapRepository,
  NodeNotFound,
} from './repository.js';

const mapParams = z.object({ mapId: z.string().min(1) });
const nodeParams = mapParams.extend({ nodeId: z.string().min(1) });
const edgeParams = mapParams.extend({ edgeId: z.string().min(1) });

export function registerRoutes(app: FastifyInstance, repo: MapRepository): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof MapNotFound || error instanceof NodeNotFound || error instanceof EdgeNotFound) {
      return reply.status(404).send({ error: error.name, message: error.message });
    }
    if (error instanceof MapLocked) {
      return reply
        .status(403)
        .send({ error: error.name, message: 'This map is read-only and cannot be changed.' });
    }
    if (error instanceof InvalidGraph) {
      return reply.status(422).send({ error: error.name, message: error.message, issues: error.issues });
    }
    if (error instanceof ImportPathError) {
      return reply.status(400).send({ error: error.name, message: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Invalid payload.', issues: error.issues });
    }
    app.log.error(error);
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return reply.status(500).send({ error: 'InternalError', message });
  });

  app.get('/api/health', async () => ({ ok: true }));

  // --- maps -----------------------------------------------------------------

  app.get('/api/maps', async () => ({ maps: repo.listMaps() }));

  app.post('/api/maps', async (request, reply) => {
    const body = z
      .object({ id: z.string().min(1).optional(), name: z.string().min(1), description: z.string().optional() })
      .parse(request.body);
    return reply.status(201).send(repo.createMap(body));
  });

  app.get('/api/maps/:mapId', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    return repo.getMap(mapId);
  });

  app.patch('/api/maps/:mapId', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    const body = z.object({ name: z.string().min(1).optional(), description: z.string().optional() }).parse(request.body);
    return repo.renameMap(mapId, body);
  });

  app.delete('/api/maps/:mapId', async (request, reply) => {
    const { mapId } = mapParams.parse(request.params);
    repo.deleteMap(mapId);
    return reply.status(204).send();
  });

  // --- nodes ----------------------------------------------------------------

  app.post('/api/maps/:mapId/nodes', async (request, reply) => {
    const { mapId } = mapParams.parse(request.params);
    const body = nodeCreateSchema.parse(request.body);
    return reply.status(201).send(repo.addNode(mapId, body));
  });

  app.patch('/api/maps/:mapId/nodes/:nodeId', async (request) => {
    const { mapId, nodeId } = nodeParams.parse(request.params);
    return repo.updateNode(mapId, nodeId, nodePatchSchema.parse(request.body));
  });

  app.delete('/api/maps/:mapId/nodes/:nodeId', async (request) => {
    const { mapId, nodeId } = nodeParams.parse(request.params);
    const { descendants } = z
      .object({ descendants: z.enum(['delete', 'promote']).default('delete') })
      .parse(request.query);
    return repo.deleteNode(mapId, nodeId, descendants);
  });

  app.post('/api/maps/:mapId/nodes/:nodeId/reparent', async (request) => {
    const { mapId, nodeId } = nodeParams.parse(request.params);
    const { parent } = z.object({ parent: z.string().min(1).nullable() }).parse(request.body);
    return { nodes: repo.reparentNode(mapId, nodeId, parent) };
  });

  app.put('/api/maps/:mapId/nodes/:nodeId/position', async (request) => {
    const { mapId, nodeId } = nodeParams.parse(request.params);
    const body = z.object({ context: z.string().nullable().default(null) }).merge(positionSchema).parse(request.body);
    return repo.setPosition(mapId, nodeId, body.context, { x: body.x, y: body.y });
  });

  // --- edges ----------------------------------------------------------------

  app.post('/api/maps/:mapId/edges', async (request, reply) => {
    const { mapId } = mapParams.parse(request.params);
    return reply.status(201).send(repo.addEdge(mapId, edgeCreateSchema.parse(request.body)));
  });

  app.patch('/api/maps/:mapId/edges/:edgeId', async (request) => {
    const { mapId, edgeId } = edgeParams.parse(request.params);
    return repo.updateEdge(mapId, edgeId, edgePatchSchema.parse(request.body));
  });

  app.delete('/api/maps/:mapId/edges/:edgeId', async (request, reply) => {
    const { mapId, edgeId } = edgeParams.parse(request.params);
    repo.deleteEdge(mapId, edgeId);
    return reply.status(204).send();
  });

  // --- queries --------------------------------------------------------------

  app.get('/api/maps/:mapId/search', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    const query = z
      .object({
        q: z.string().default(''),
        limit: z.coerce.number().int().min(1).max(500).default(50),
        view: z.enum(VIEWS).optional(),
        type: z.enum(NODE_TYPES).optional(),
      })
      .parse(request.query);

    const map = repo.getMap(mapId);
    const hits = searchNodes(map, query.q, {
      limit: query.limit,
      views: query.view ? [query.view] : undefined,
      types: query.type ? [query.type] : undefined,
    });
    return { hits };
  });

  /** FR-17: blast radius for a node. */
  app.get('/api/maps/:mapId/nodes/:nodeId/impact', async (request) => {
    const { mapId, nodeId } = nodeParams.parse(request.params);
    const query = z
      .object({
        depth: z.coerce.number().int().min(1).max(10).default(2),
        direction: z.enum(['upstream', 'downstream', 'both']).default('both'),
      })
      .parse(request.query);

    const index = buildIndex(repo.getMap(mapId));
    if (!index.nodes.has(nodeId)) throw new NodeNotFound(nodeId);
    const reached = traverse(index, nodeId, { depth: query.depth, direction: query.direction });
    return {
      nodeId,
      direction: query.direction,
      depth: query.depth,
      reached: [...reached.entries()].map(([id, hops]) => ({ id, hops })),
    };
  });

  /** FR-18: how, if at all, two nodes are connected. */
  app.get('/api/maps/:mapId/path', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    const query = z
      .object({ from: z.string().min(1), to: z.string().min(1), directed: z.coerce.boolean().default(false) })
      .parse(request.query);

    const index = buildIndex(repo.getMap(mapId));
    if (!index.nodes.has(query.from)) throw new NodeNotFound(query.from);
    if (!index.nodes.has(query.to)) throw new NodeNotFound(query.to);
    return { path: shortestPath(index, query.from, query.to, { directed: query.directed }) };
  });

  /** FR-15: the map's blind spots. */
  app.get('/api/maps/:mapId/coverage', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    const gaps = coverageGaps(buildIndex(repo.getMap(mapId)));
    return {
      unimplementedFunctional: gaps.unimplementedFunctional.map((n) => ({ id: n.id, label: n.label, level: n.level, type: n.type })),
      untracedTechnical: gaps.untracedTechnical.map((n) => ({ id: n.id, label: n.label, level: n.level, type: n.type })),
    };
  });

  /** Populates the property filter UI (FR-44). */
  app.get('/api/maps/:mapId/facets', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    return { properties: propertyFacets(repo.getMap(mapId)) };
  });

  app.get('/api/maps/:mapId/validate', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    return validateGraph(repo.getMap(mapId));
  });

  // --- import / export ------------------------------------------------------

  /** FR-58. The response is the same shape FR-59 accepts back. */
  app.get('/api/maps/:mapId/export', async (request, reply) => {
    const { mapId } = mapParams.parse(request.params);
    const map = repo.getMap(mapId);
    reply.header('content-disposition', `attachment; filename="${mapId}.json"`);
    return { version: 1, exportedAt: new Date().toISOString(), map };
  });

  /**
   * FR-59. `mode: replace` overwrites the target map; `mode: create` makes a new one. Round-trips
   * losslessly because the export carries ids, positions, and provenance.
   */
  app.post('/api/maps/import', async (request, reply) => {
    const body = z
      .object({
        map: graphMapSchema,
        mode: z.enum(['create', 'replace']).default('create'),
        targetMapId: z.string().min(1).optional(),
      })
      .parse(request.body);

    const result = validateGraph(body.map);
    if (!result.ok) throw new InvalidGraph(result.errors, 'The imported map is not valid.');

    if (body.mode === 'replace') {
      const targetId = body.targetMapId ?? body.map.id;
      return repo.replaceContents(targetId, body.map);
    }

    const taken = new Set(repo.listMaps().map((m) => m.id));
    const id = taken.has(body.map.id) ? `${body.map.id}-${Date.now().toString(36)}` : body.map.id;
    repo.createMap({ id, name: body.map.name, description: body.map.description });
    return reply.status(201).send(repo.replaceContents(id, body.map));
  });

  /**
   * FR-47..FR-54: build the map from a folder of markdown documents. `dryRun` returns the report
   * without writing, which is how a user checks what an import would do before doing it (FR-53).
   */
  app.post('/api/maps/:mapId/import/markdown', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    const body = z
      .object({
        path: z.string().min(1),
        dryRun: z.boolean().default(false),
        prune: z.boolean().default(false),
      })
      .parse(request.body);

    return importMarkdownFolder(repo, mapId, body);
  });

  // --- saved views ----------------------------------------------------------

  app.get('/api/maps/:mapId/views', async (request) => {
    const { mapId } = mapParams.parse(request.params);
    return { views: repo.listSavedViews(mapId) };
  });

  app.post('/api/maps/:mapId/views', async (request, reply) => {
    const { mapId } = mapParams.parse(request.params);
    const body = z.object({ name: z.string().min(1), state: viewStateSchema }).parse(request.body);
    return reply.status(201).send(repo.saveView(mapId, body.name, body.state));
  });

  app.delete('/api/maps/:mapId/views/:viewId', async (request, reply) => {
    const { mapId, viewId } = mapParams.extend({ viewId: z.string().min(1) }).parse(request.params);
    repo.deleteSavedView(mapId, viewId);
    return reply.status(204).send();
  });
}
