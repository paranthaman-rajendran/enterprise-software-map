import { contextKey, type EdgeType, type GraphEdge, type GraphIndex, type GraphMap, type GraphNode, type NodeType, type ValidationIssue, type ViewMode } from '@map/shared';
import { type MapSummary } from './api.js';
import { type Filters, type ViewSpec } from './graph/viewModel.js';
export type Selection = {
    kind: 'node';
    id: string;
} | {
    kind: 'edge';
    id: string;
} | null;
/**
 * True when the loaded map is read-only. The server is the authority — it refuses writes
 * regardless — but the UI reads this so it can hide editing affordances rather than offer
 * actions that are guaranteed to fail.
 */
export declare function useIsReadOnly(): boolean;
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
    pathHighlight: {
        nodes: string[];
        edges: string[];
    } | null;
    undoStack: UndoEntry[];
    redoStack: UndoEntry[];
    init: () => Promise<void>;
    loadMap: (mapId: string) => Promise<void>;
    refresh: () => Promise<void>;
    setNotice: (notice: Notice | null) => void;
    drillInto: (nodeId: string) => void;
    drillUp: () => void;
    setContext: (nodeId: string | null) => void;
    toggleExpanded: (nodeId: string) => void;
    setViewMode: (mode: ViewMode) => void;
    setFocus: (nodeId: string | null) => void;
    setFocusDepth: (depth: number) => void;
    setImpact: (nodeId: string | null) => void;
    setImpactOptions: (options: {
        depth?: number;
        direction?: ViewSpec['impactDirection'];
    }) => void;
    setFilters: (patch: Partial<Filters>) => void;
    clearFilters: () => void;
    select: (selection: Selection) => void;
    setMultiSelection: (ids: string[]) => void;
    /** FR-41: reveal a node wherever it sits, drilling to its level first. */
    revealNode: (nodeId: string) => void;
    showPath: (fromId: string, toId: string) => Promise<void>;
    clearPath: () => void;
    addNode: (input: {
        label: string;
        type: NodeType;
        view: 'functional' | 'technical';
        parent: string | null;
        description?: string;
    }) => Promise<void>;
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
/** FR-57: the view is reproducible from the URL, which is what makes a link shareable. */
export declare function specToSearchParams(spec: ViewSpec, selection: Selection): string;
export declare function specFromSearchParams(params: URLSearchParams): {
    spec: ViewSpec;
    selection: Selection;
};
export declare const useStore: import("zustand").UseBoundStore<import("zustand").StoreApi<State>>;
/** FR-4: the breadcrumb trail for the current context. */
export declare function useBreadcrumb(): GraphNode[];
export { contextKey };
//# sourceMappingURL=store.d.ts.map