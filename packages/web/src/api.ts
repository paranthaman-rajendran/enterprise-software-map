/** Typed client for the map API. Shapes come from @map/shared, so drift is a compile error. */
import type {
  ImportReport,
  EdgeCreate,
  EdgePatch,
  GraphEdge,
  GraphMap,
  GraphNode,
  NodeCreate,
  NodePatch,
  SearchHit,
  ValidationIssue,
  ViewState,
} from '@map/shared';

export interface MapSummary {
  id: string;
  name: string;
  description: string;
  /** A locked map is reference material: the server refuses every write to it. */
  locked: boolean;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedView {
  id: string;
  name: string;
  state: ViewState;
  createdAt: string;
}

/** A rejected write. `issues` carries the model violations so the UI can name them (FR-38). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = body as { message?: string; issues?: ValidationIssue[] } | null;
    throw new ApiError(
      response.status,
      detail?.message ?? `Request failed with ${response.status}.`,
      detail?.issues ?? [],
    );
  }

  return body as T;
}

export const api = {
  listMaps: () => request<{ maps: MapSummary[] }>('/maps').then((r) => r.maps),

  createMap: (input: { name: string; description?: string }) =>
    request<MapSummary>('/maps', { method: 'POST', body: JSON.stringify(input) }),

  getMap: (mapId: string) => request<GraphMap>(`/maps/${encodeURIComponent(mapId)}`),

  addNode: (mapId: string, input: NodeCreate) =>
    request<GraphNode>(`/maps/${encodeURIComponent(mapId)}/nodes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateNode: (mapId: string, nodeId: string, patch: NodePatch) =>
    request<GraphNode>(`/maps/${encodeURIComponent(mapId)}/nodes/${encodeURIComponent(nodeId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteNode: (mapId: string, nodeId: string, descendants: 'delete' | 'promote') =>
    request<{ deletedNodes: string[]; deletedEdges: string[]; promotedNodes: GraphNode[] }>(
      `/maps/${encodeURIComponent(mapId)}/nodes/${encodeURIComponent(nodeId)}?descendants=${descendants}`,
      { method: 'DELETE' },
    ),

  reparentNode: (mapId: string, nodeId: string, parent: string | null) =>
    request<{ nodes: GraphNode[] }>(
      `/maps/${encodeURIComponent(mapId)}/nodes/${encodeURIComponent(nodeId)}/reparent`,
      { method: 'POST', body: JSON.stringify({ parent }) },
    ),

  setPosition: (mapId: string, nodeId: string, context: string | null, x: number, y: number) =>
    request<GraphNode>(
      `/maps/${encodeURIComponent(mapId)}/nodes/${encodeURIComponent(nodeId)}/position`,
      { method: 'PUT', body: JSON.stringify({ context, x, y }) },
    ),

  addEdge: (mapId: string, input: EdgeCreate) =>
    request<GraphEdge>(`/maps/${encodeURIComponent(mapId)}/edges`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateEdge: (mapId: string, edgeId: string, patch: EdgePatch) =>
    request<GraphEdge>(`/maps/${encodeURIComponent(mapId)}/edges/${encodeURIComponent(edgeId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteEdge: (mapId: string, edgeId: string) =>
    request<void>(`/maps/${encodeURIComponent(mapId)}/edges/${encodeURIComponent(edgeId)}`, {
      method: 'DELETE',
    }),

  search: (mapId: string, q: string, limit = 30) =>
    request<{ hits: SearchHit[] }>(
      `/maps/${encodeURIComponent(mapId)}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ).then((r) => r.hits),

  coverage: (mapId: string) =>
    request<{
      unimplementedFunctional: Array<{ id: string; label: string; level: number; type: string }>;
      untracedTechnical: Array<{ id: string; label: string; level: number; type: string }>;
    }>(`/maps/${encodeURIComponent(mapId)}/coverage`),

  facets: (mapId: string) =>
    request<{ properties: Array<{ key: string; values: string[] }> }>(
      `/maps/${encodeURIComponent(mapId)}/facets`,
    ).then((r) => r.properties),

  path: (mapId: string, from: string, to: string) =>
    request<{ path: { nodes: string[]; edges: GraphEdge[] } | null }>(
      `/maps/${encodeURIComponent(mapId)}/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ).then((r) => r.path),

  exportMap: (mapId: string) =>
    request<{ version: number; exportedAt: string; map: GraphMap }>(
      `/maps/${encodeURIComponent(mapId)}/export`,
    ),

  importMap: (map: GraphMap, mode: 'create' | 'replace', targetMapId?: string) =>
    request<GraphMap>('/maps/import', {
      method: 'POST',
      body: JSON.stringify({ map, mode, targetMapId }),
    }),

  /** FR-47..FR-54. `dryRun` returns the same report without writing anything. */
  importMarkdown: (
    mapId: string,
    input: { path: string; dryRun?: boolean; prune?: boolean },
  ) =>
    request<{ root: string; documentsFound: number; dryRun: boolean; report: ImportReport }>(
      `/maps/${encodeURIComponent(mapId)}/import/markdown`,
      { method: 'POST', body: JSON.stringify(input) },
    ),

  listViews: (mapId: string) =>
    request<{ views: SavedView[] }>(`/maps/${encodeURIComponent(mapId)}/views`).then((r) => r.views),

  saveView: (mapId: string, name: string, state: ViewState) =>
    request<SavedView>(`/maps/${encodeURIComponent(mapId)}/views`, {
      method: 'POST',
      body: JSON.stringify({ name, state }),
    }),

  deleteView: (mapId: string, viewId: string) =>
    request<void>(`/maps/${encodeURIComponent(mapId)}/views/${encodeURIComponent(viewId)}`, {
      method: 'DELETE',
    }),
};
