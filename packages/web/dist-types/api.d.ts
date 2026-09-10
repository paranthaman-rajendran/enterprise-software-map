/** Typed client for the map API. Shapes come from @map/shared, so drift is a compile error. */
import type { ImportReport, EdgeCreate, EdgePatch, GraphEdge, GraphMap, GraphNode, NodeCreate, NodePatch, SearchHit, ValidationIssue, ViewState } from '@map/shared';
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
export declare class ApiError extends Error {
    readonly status: number;
    readonly issues: ValidationIssue[];
    constructor(status: number, message: string, issues?: ValidationIssue[]);
}
export declare const api: {
    listMaps: () => Promise<MapSummary[]>;
    createMap: (input: {
        name: string;
        description?: string;
    }) => Promise<MapSummary>;
    getMap: (mapId: string) => Promise<GraphMap>;
    addNode: (mapId: string, input: NodeCreate) => Promise<GraphNode>;
    updateNode: (mapId: string, nodeId: string, patch: NodePatch) => Promise<GraphNode>;
    deleteNode: (mapId: string, nodeId: string, descendants: "delete" | "promote") => Promise<{
        deletedNodes: string[];
        deletedEdges: string[];
        promotedNodes: GraphNode[];
    }>;
    reparentNode: (mapId: string, nodeId: string, parent: string | null) => Promise<{
        nodes: GraphNode[];
    }>;
    setPosition: (mapId: string, nodeId: string, context: string | null, x: number, y: number) => Promise<GraphNode>;
    addEdge: (mapId: string, input: EdgeCreate) => Promise<GraphEdge>;
    updateEdge: (mapId: string, edgeId: string, patch: EdgePatch) => Promise<GraphEdge>;
    deleteEdge: (mapId: string, edgeId: string) => Promise<void>;
    search: (mapId: string, q: string, limit?: number) => Promise<SearchHit[]>;
    coverage: (mapId: string) => Promise<{
        unimplementedFunctional: Array<{
            id: string;
            label: string;
            level: number;
            type: string;
        }>;
        untracedTechnical: Array<{
            id: string;
            label: string;
            level: number;
            type: string;
        }>;
    }>;
    facets: (mapId: string) => Promise<{
        key: string;
        values: string[];
    }[]>;
    path: (mapId: string, from: string, to: string) => Promise<{
        nodes: string[];
        edges: GraphEdge[];
    } | null>;
    exportMap: (mapId: string) => Promise<{
        version: number;
        exportedAt: string;
        map: GraphMap;
    }>;
    importMap: (map: GraphMap, mode: "create" | "replace", targetMapId?: string) => Promise<GraphMap>;
    /** FR-47..FR-54. `dryRun` returns the same report without writing anything. */
    importMarkdown: (mapId: string, input: {
        path: string;
        dryRun?: boolean;
        prune?: boolean;
    }) => Promise<{
        root: string;
        documentsFound: number;
        dryRun: boolean;
        report: ImportReport;
    }>;
    listViews: (mapId: string) => Promise<SavedView[]>;
    saveView: (mapId: string, name: string, state: ViewState) => Promise<SavedView>;
    deleteView: (mapId: string, viewId: string) => Promise<void>;
};
//# sourceMappingURL=api.d.ts.map