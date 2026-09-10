/** Zod schemas for the wire/storage format. The server validates every write against these. */
import { z } from 'zod';
import {
  EDGE_TYPES,
  NODE_TYPES,
  VIEWS,
  VIEW_MODES,
  type GraphEdge,
  type GraphMap,
  type GraphNode,
} from './model.js';

const id = z.string().min(1).max(200);

export const propertyValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const propertiesSchema = z.record(propertyValueSchema).default({});

export const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

export const sourceRefSchema = z.object({
  kind: z.string().min(1).default('manual'),
  path: z.string().nullable().default(null),
});

export const levelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const nodeSchema = z.object({
  id,
  label: z.string().min(1).max(300),
  view: z.enum(VIEWS),
  type: z.enum(NODE_TYPES),
  level: levelSchema,
  parent: id.nullable(),
  description: z.string().default(''),
  properties: propertiesSchema,
  positions: z.record(positionSchema).default({}),
  source: sourceRefSchema.default({ kind: 'manual', path: null }),
}) satisfies z.ZodType<GraphNode, z.ZodTypeDef, unknown>;

export const edgeSchema = z.object({
  id,
  source: id,
  target: id,
  type: z.enum(EDGE_TYPES),
  weight: z.number().finite().default(1),
  properties: propertiesSchema,
  sourceRef: sourceRefSchema.default({ kind: 'manual', path: null }),
}) satisfies z.ZodType<GraphEdge, z.ZodTypeDef, unknown>;

export const graphMapSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  description: z.string().default(''),
  locked: z.boolean().default(false),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
}) satisfies z.ZodType<GraphMap, z.ZodTypeDef, unknown>;

/** Payloads for creating and patching, where the client may omit server-defaulted fields. */
export const nodeCreateSchema = nodeSchema.partial({
  id: true,
  description: true,
  properties: true,
  positions: true,
  source: true,
});

export const nodePatchSchema = nodeSchema
  .omit({ id: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'patch must change at least one field' });

export const edgeCreateSchema = edgeSchema.partial({
  id: true,
  weight: true,
  properties: true,
  sourceRef: true,
});

export const edgePatchSchema = edgeSchema
  .omit({ id: true, source: true, target: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'patch must change at least one field' });

/** A named or shareable view (FR-57): everything needed to reproduce what is on screen. */
export const viewStateSchema = z.object({
  contextId: z.string().nullable().default(null),
  viewMode: z.enum(VIEW_MODES).default('combined'),
  focusId: z.string().nullable().default(null),
  focusDepth: z.number().int().min(0).max(5).default(1),
  expandedIds: z.array(z.string()).default([]),
  selectedIds: z.array(z.string()).default([]),
  filters: z
    .object({
      nodeTypes: z.array(z.enum(NODE_TYPES)).default([]),
      edgeTypes: z.array(z.enum(EDGE_TYPES)).default([]),
      maxLevel: levelSchema.nullable().default(null),
      properties: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
      weightMin: z.number().nullable().default(null),
      weightMax: z.number().nullable().default(null),
      search: z.string().default(''),
    })
    .default({}),
});

export type ViewState = z.infer<typeof viewStateSchema>;
export type NodeCreate = z.input<typeof nodeCreateSchema>;
export type NodePatch = z.input<typeof nodePatchSchema>;
export type EdgeCreate = z.input<typeof edgeCreateSchema>;
export type EdgePatch = z.input<typeof edgePatchSchema>;
