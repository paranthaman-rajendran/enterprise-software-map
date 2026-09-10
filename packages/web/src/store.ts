/**
 * Application state. One store owns the map, the view spec, and the undo stack, because almost
 * every interaction touches at least two of them (drilling clears focus, deleting clears the
 * selection, a search jump changes context and selection together).
 *
 * Edits go to the server first and the local map is updated from the response, so the client
 * never holds a state the server rejected (FR-38).
 */
import { create } from 'zustand';

import {
  ancestorPath,
  buildIndex,
  contextKey,
  type EdgeType,
  type GraphEdge,
  type GraphIndex,
  type GraphMap,
  type GraphNode,
  type Level,
  type NodeType,
  type ValidationIssue,
  type ViewMode,
} from '@map/shared';

import { ApiError, api, type MapSummary } from './api.js';
import { defaultViewSpec, emptyFilters, type Filters, type ViewSpec } from './graph/viewModel.js';

export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null;

/**
 * True when the loaded map is read-only. The server is the authority — it refuses writes
 * regardless — but the UI reads this so it can hide editing affordances rather than offer
 * actions that are guaranteed to fail.
 */
export function useIsReadOnly(): boolean {
  return useStore((s) => s.map?.locked ?? false);
}

export interface Notice {
  tone: 'error' | 'info' | 'success';
  message: string;
  issues?: ValidationIssue[];
}

/** FR-37: an undo entry is the inverse call, not a diff — simpler and always exactly reversible. */
interface UndoEntry {
  label: string;
  undo: () => Promise<void>;
}

interface State {
  maps: MapSummary[];
  mapId: string | null;
  map: GraphMap | null;
  index: GraphIndex | null;
  loading: boolean;
  notice: Notice | null;

  spec: ViewSpec;
  selection: Selection;
  /** FR-30: multi-select for bulk operations. */
  multiSelection: string[];
  /** FR-18: the two-node path currently drawn, if any. */
  pathHighlight: { nodes: string[]; edges: string[] } | null;

  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // --- lifecycle
  init: () => Promise<void>;
  loadMap: (mapId: string) => Promise<void>;
  refresh: () => Promise<void>;
  setNotice: (notice: Notice | null) => void;

  // --- navigation
  drillInto: (nodeId: string) => void;
  drillUp: () => void;
  setContext: (nodeId: string | null) => void;
  toggleExpanded: (nodeId: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setFocus: (nodeId: string | null) => void;
  setFocusDepth: (depth: number) => void;
  setImpact: (nodeId: string | null) => void;
  setImpactOptions: (options: { depth?: number; direction?: ViewSpec['impactDirection'] }) => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  select: (selection: Selection) => void;
  setMultiSelection: (ids: string[]) => void;
  /** FR-41: reveal a node wherever it sits, drilling to its level first. */
  revealNode: (nodeId: string) => void;
  showPath: (fromId: string, toId: string) => Promise<void>;
  clearPath: () => void;

  // --- editing
  addNode: (input: { label: string; type: NodeType; view: 'functional' | 'technical'; parent: string | null; description?: string }) => Promise<void>;
  updateNode: (nodeId: string, patch: Partial<GraphNode>) => Promise<void>;
  deleteNode: (nodeId: string, descendants: 'delete' | 'promote') => Promise<void>;
  deleteSelection: (descendants: 'delete' | 'promote') => Promise<void>;
  addEdge: (source: string, target: string, type: EdgeType) => Promise<void>;
  updateEdge: (edgeId: string, patch: Partial<GraphEdge>) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;
  savePosition: (nodeId: string, x: number, y: number) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const READ_ONLY_NOTICE: Notice = {
  tone: 'info',
  message: 'This map is read-only. Switch to another map to make changes.',
};

function toNotice(error: unknown): Notice {
  if (error instanceof ApiError) {
    return { tone: 'error', message: error.message, issues: error.issues };
  }
  return { tone: 'error', message: error instanceof Error ? error.message : String(error) };
}

/** FR-57: the view is reproducible from the URL, which is what makes a link shareable. */
export function specToSearchParams(spec: ViewSpec, selection: Selection): string {
  const params = new URLSearchParams();
  if (spec.contextId) params.set('at', spec.contextId);
  if (spec.viewMode !== 'combined') params.set('view', spec.viewMode);
  if (spec.focusId) {
    params.set('focus', spec.focusId);
    params.set('depth', String(spec.focusDepth));
  }
  if (spec.expandedIds.length > 0) params.set('open', spec.expandedIds.join(','));
  if (spec.impactId) params.set('impact', spec.impactId);
  if (spec.filters.nodeTypes.length > 0) params.set('types', spec.filters.nodeTypes.join(','));
  if (spec.filters.edgeTypes.length > 0) params.set('rels', spec.filters.edgeTypes.join(','));
  if (spec.filters.maxLevel !== null) params.set('maxLevel', String(spec.filters.maxLevel));
  // One `prop` parameter per clause. Splitting on the first `=` keeps values containing `=` intact.
  for (const clause of spec.filters.properties) params.append('prop', `${clause.key}=${clause.value}`);
  if (spec.filters.weightMin !== null) params.set('wmin', String(spec.filters.weightMin));
  if (spec.filters.weightMax !== null) params.set('wmax', String(spec.filters.weightMax));
  if (selection?.kind === 'node') params.set('sel', selection.id);
  return params.toString();
}

export function specFromSearchParams(params: URLSearchParams): { spec: ViewSpec; selection: Selection } {
  const spec: ViewSpec = {
    ...defaultViewSpec,
    contextId: params.get('at'),
    viewMode: (params.get('view') as ViewMode) ?? 'combined',
    focusId: params.get('focus'),
    focusDepth: Number(params.get('depth') ?? 1) || 1,
    impactId: params.get('impact'),
    expandedIds: params.get('open')?.split(',').filter(Boolean) ?? [],
    filters: {
      ...emptyFilters,
      nodeTypes: (params.get('types')?.split(',').filter(Boolean) ?? []) as NodeType[],
      edgeTypes: (params.get('rels')?.split(',').filter(Boolean) ?? []) as EdgeType[],
      maxLevel: params.get('maxLevel') === null ? null : (Number(params.get('maxLevel')) as Level),
      properties: params
        .getAll('prop')
        .map((raw) => {
          const at = raw.indexOf('=');
          return at === -1 ? null : { key: raw.slice(0, at), value: raw.slice(at + 1) };
        })
        .filter((clause): clause is { key: string; value: string } => clause !== null),
      weightMin: params.get('wmin') === null ? null : Number(params.get('wmin')),
      weightMax: params.get('wmax') === null ? null : Number(params.get('wmax')),
    },
  };
  const sel = params.get('sel');
  return { spec, selection: sel ? { kind: 'node', id: sel } : null };
}

export const useStore = create<State>((set, get) => {
  /** Applies a patch to the loaded map without a round trip for the whole document. */
  const patchMap = (mutate: (map: GraphMap) => GraphMap): void => {
    const current = get().map;
    if (!current) return;
    const next = mutate(current);
    set({ map: next, index: buildIndex(next) });
  };

  const pushUndo = (entry: UndoEntry): void => {
    set({ undoStack: [...get().undoStack, entry].slice(-50), redoStack: [] });
  };

  const syncUrl = (): void => {
    const { spec, selection, mapId } = get();
    const query = specToSearchParams(spec, selection);
    const hash = mapId ? `#/${encodeURIComponent(mapId)}${query ? `?${query}` : ''}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
  };

  /** Every navigation action funnels through here so URL sync is never forgotten. */
  const updateSpec = (patch: Partial<ViewSpec>, extra: Partial<State> = {}): void => {
    set({ spec: { ...get().spec, ...patch }, ...extra });
    syncUrl();
  };

  return {
    maps: [],
    mapId: null,
    map: null,
    index: null,
    loading: false,
    notice: null,
    spec: defaultViewSpec,
    selection: null,
    multiSelection: [],
    pathHighlight: null,
    undoStack: [],
    redoStack: [],

    setNotice: (notice) => set({ notice }),

    init: async () => {
      set({ loading: true });
      try {
        const maps = await api.listMaps();
        set({ maps });

        const hash = window.location.hash.replace(/^#\/?/, '');
        const [urlMapId, queryString] = hash.split('?');
        const targetId = (urlMapId && decodeURIComponent(urlMapId)) || maps[0]?.id;
        if (!targetId) {
          set({ loading: false });
          return;
        }

        if (queryString) {
          const { spec, selection } = specFromSearchParams(new URLSearchParams(queryString));
          set({ spec, selection });
        }
        await get().loadMap(targetId);
      } catch (error) {
        set({ notice: toNotice(error), loading: false });
      }
    },

    loadMap: async (mapId) => {
      set({ loading: true });
      try {
        const map = await api.getMap(mapId);
        set({ mapId, map, index: buildIndex(map), loading: false, undoStack: [], redoStack: [] });
        syncUrl();
      } catch (error) {
        set({ notice: toNotice(error), loading: false });
      }
    },

    refresh: async () => {
      const { mapId } = get();
      if (mapId) await get().loadMap(mapId);
    },

    // --- navigation ---------------------------------------------------------

    drillInto: (nodeId) => {
      // FR-2: entering a node makes it the context and clears the focus we were in.
      updateSpec({ contextId: nodeId, focusId: null, expandedIds: [] }, { selection: null, pathHighlight: null });
    },

    drillUp: () => {
      const { index, spec } = get();
      if (!index || spec.contextId === null) return;
      const parent = index.nodes.get(spec.contextId)?.parent ?? null;
      updateSpec({ contextId: parent, focusId: null, expandedIds: [] }, { selection: null });
    },

    setContext: (nodeId) => {
      updateSpec({ contextId: nodeId, focusId: null, expandedIds: [] }, { selection: null });
    },

    toggleExpanded: (nodeId) => {
      const { spec } = get();
      const expandedIds = spec.expandedIds.includes(nodeId)
        ? spec.expandedIds.filter((id) => id !== nodeId)
        : [...spec.expandedIds, nodeId];
      updateSpec({ expandedIds });
    },

    setViewMode: (viewMode) => updateSpec({ viewMode }),
    setFocus: (focusId) => updateSpec({ focusId }, { pathHighlight: null }),
    setFocusDepth: (focusDepth) => updateSpec({ focusDepth }),
    setImpact: (impactId) => updateSpec({ impactId }),
    setImpactOptions: (options) =>
      updateSpec({
        impactDepth: options.depth ?? get().spec.impactDepth,
        impactDirection: options.direction ?? get().spec.impactDirection,
      }),

    setFilters: (patch) => updateSpec({ filters: { ...get().spec.filters, ...patch } }),
    clearFilters: () => updateSpec({ filters: emptyFilters }),

    select: (selection) => {
      set({ selection });
      syncUrl();
    },

    setMultiSelection: (ids) => set({ multiSelection: ids }),

    /**
     * FR-41. A search result can be anywhere in the tree, so we set the context to the node's
     * parent — which is exactly the level the node is drawn at — and select it there.
     */
    revealNode: (nodeId) => {
      const { index } = get();
      if (!index) return;
      const node = index.nodes.get(nodeId);
      if (!node) {
        set({ notice: { tone: 'error', message: `Node "${nodeId}" is not in this map.` } });
        return;
      }
      updateSpec(
        { contextId: node.parent, focusId: null, expandedIds: [] },
        { selection: { kind: 'node', id: nodeId }, pathHighlight: null },
      );
    },

    showPath: async (fromId, toId) => {
      const { mapId } = get();
      if (!mapId) return;
      try {
        const path = await api.path(mapId, fromId, toId);
        if (!path) {
          set({
            pathHighlight: null,
            notice: { tone: 'info', message: 'These two are not connected by any relationship.' },
          });
          return;
        }
        set({
          pathHighlight: { nodes: path.nodes, edges: path.edges.map((e) => e.id) },
          notice: { tone: 'success', message: `Connected in ${path.edges.length} hop(s).` },
        });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    clearPath: () => set({ pathHighlight: null }),

    // --- editing ------------------------------------------------------------

    addNode: async (input) => {
      const { mapId, map } = get();
      if (!mapId) return;
      if (map?.locked) return set({ notice: READ_ONLY_NOTICE });
      try {
        const node = await api.addNode(mapId, {
          label: input.label,
          type: input.type,
          view: input.view,
          parent: input.parent,
          description: input.description ?? '',
          // The server derives the real level from the parent; this satisfies the schema.
          level: 0,
        });
        patchMap((map) => ({ ...map, nodes: [...map.nodes, node] }));
        pushUndo({
          label: `Add "${node.label}"`,
          undo: async () => {
            await api.deleteNode(mapId, node.id, 'delete');
            await get().refresh();
          },
        });
        set({ selection: { kind: 'node', id: node.id }, notice: { tone: 'success', message: `Added "${node.label}".` } });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    updateNode: async (nodeId, patch) => {
      const { mapId, map } = get();
      if (!mapId || !map) return;
      if (map.locked) return set({ notice: READ_ONLY_NOTICE });
      const before = map.nodes.find((n) => n.id === nodeId);
      if (!before) return;
      try {
        const updated = await api.updateNode(mapId, nodeId, patch as never);
        patchMap((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === nodeId ? updated : n)) }));
        pushUndo({
          label: `Edit "${before.label}"`,
          undo: async () => {
            await api.updateNode(mapId, nodeId, {
              label: before.label,
              description: before.description,
              type: before.type,
              view: before.view,
              properties: before.properties,
            } as never);
            await get().refresh();
          },
        });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    deleteNode: async (nodeId, descendants) => {
      const { mapId, map } = get();
      if (!mapId || !map) return;
      if (map.locked) return set({ notice: READ_ONLY_NOTICE });
      // Snapshot before the delete so undo can restore the subtree and its edges wholesale.
      const snapshot = { nodes: map.nodes, edges: map.edges };
      const label = map.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
      try {
        const result = await api.deleteNode(mapId, nodeId, descendants);
        await get().refresh();
        set({
          selection: null,
          notice: {
            tone: 'success',
            message: `Deleted "${label}" (${result.deletedNodes.length} node(s), ${result.deletedEdges.length} relationship(s)).`,
          },
        });
        pushUndo({
          label: `Delete "${label}"`,
          undo: async () => {
            await api.importMap({ ...map, ...snapshot }, 'replace', mapId);
            await get().refresh();
          },
        });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    /** FR-31: bulk delete over the whole selection, as one undoable step. */
    deleteSelection: async (descendants) => {
      const { mapId, map, multiSelection, selection } = get();
      if (!mapId || !map) return;
      if (map.locked) return set({ notice: READ_ONLY_NOTICE });
      const ids = multiSelection.length > 0 ? multiSelection : selection?.kind === 'node' ? [selection.id] : [];
      if (ids.length === 0) return;
      const snapshot = { nodes: map.nodes, edges: map.edges };
      try {
        for (const id of ids) {
          // A node may already be gone as a descendant of an earlier delete; that is fine.
          try {
            await api.deleteNode(mapId, id, descendants);
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 404) throw error;
          }
        }
        await get().refresh();
        set({
          selection: null,
          multiSelection: [],
          notice: { tone: 'success', message: `Deleted ${ids.length} node(s).` },
        });
        pushUndo({
          label: `Delete ${ids.length} node(s)`,
          undo: async () => {
            await api.importMap({ ...map, ...snapshot }, 'replace', mapId);
            await get().refresh();
          },
        });
      } catch (error) {
        set({ notice: toNotice(error) });
        await get().refresh();
      }
    },

    addEdge: async (source, target, type) => {
      const { mapId, map } = get();
      if (!mapId) return;
      if (map?.locked) return set({ notice: READ_ONLY_NOTICE });
      try {
        const edge = await api.addEdge(mapId, { source, target, type });
        patchMap((map) => ({ ...map, edges: [...map.edges, edge] }));
        pushUndo({
          label: 'Add relationship',
          undo: async () => {
            await api.deleteEdge(mapId, edge.id);
            await get().refresh();
          },
        });
        set({ selection: { kind: 'edge', id: edge.id }, notice: { tone: 'success', message: `Added ${type} relationship.` } });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    updateEdge: async (edgeId, patch) => {
      const { mapId, map } = get();
      if (!mapId || !map) return;
      if (map.locked) return set({ notice: READ_ONLY_NOTICE });
      const before = map.edges.find((e) => e.id === edgeId);
      if (!before) return;
      try {
        const updated = await api.updateEdge(mapId, edgeId, patch as never);
        patchMap((m) => ({ ...m, edges: m.edges.map((e) => (e.id === edgeId ? updated : e)) }));
        pushUndo({
          label: 'Edit relationship',
          undo: async () => {
            await api.updateEdge(mapId, edgeId, { type: before.type, weight: before.weight } as never);
            await get().refresh();
          },
        });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    deleteEdge: async (edgeId) => {
      const { mapId, map } = get();
      if (!mapId || !map) return;
      if (map.locked) return set({ notice: READ_ONLY_NOTICE });
      const before = map.edges.find((e) => e.id === edgeId);
      if (!before) return;
      try {
        await api.deleteEdge(mapId, edgeId);
        patchMap((m) => ({ ...m, edges: m.edges.filter((e) => e.id !== edgeId) }));
        pushUndo({
          label: 'Delete relationship',
          undo: async () => {
            await api.addEdge(mapId, before);
            await get().refresh();
          },
        });
        set({ selection: null });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    /** FR-25. Positions save silently — a drag is not something to confirm or undo through the stack. */
    savePosition: async (nodeId, x, y) => {
      const { mapId, spec, map } = get();
      if (!mapId) return;
      // A drag on a read-only map is allowed to move the node on screen; it just is not saved.
      // Failing loudly on every drag would be noise, not information.
      if (map?.locked) return;
      try {
        const updated = await api.setPosition(mapId, nodeId, spec.contextId, x, y);
        patchMap((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === nodeId ? updated : n)) }));
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    undo: async () => {
      const { undoStack, map } = get();
      if (map?.locked) return set({ notice: READ_ONLY_NOTICE });
      const entry = undoStack.at(-1);
      if (!entry) return;
      set({ undoStack: undoStack.slice(0, -1) });
      try {
        await entry.undo();
        set({ notice: { tone: 'info', message: `Undid: ${entry.label}.` } });
      } catch (error) {
        set({ notice: toNotice(error) });
      }
    },

    // Redo is not wired up yet — the undo entries are inverse calls, and capturing their
    // inverses in turn needs the post-undo state. Tracked in README as a known gap.
    redo: async () => {
      set({ notice: { tone: 'info', message: 'Redo is not implemented yet.' } });
    },
  };
});

/** FR-4: the breadcrumb trail for the current context. */
export function useBreadcrumb(): GraphNode[] {
  const index = useStore((s) => s.index);
  const contextId = useStore((s) => s.spec.contextId);
  if (!index || contextId === null) return [];
  return ancestorPath(index, contextId);
}

export { contextKey };
