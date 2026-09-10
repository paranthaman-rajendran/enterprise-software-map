/**
 * Decides what is on screen. Given the whole map and the current view state, it returns the
 * exact node and edge set to draw, plus which of those should be dimmed.
 *
 * This is where progressive disclosure lives: the canvas draws whatever this returns and knows
 * nothing about levels, focus, or filters. Keeping it a pure function means the interesting
 * behaviour is testable without a browser.
 */
import { type AggregatedEdge, type EdgeType, type GraphIndex, type GraphMap, type GraphNode, type Level, type NodeType, type ViewMode } from '@map/shared';
export interface Filters {
    nodeTypes: NodeType[];
    edgeTypes: EdgeType[];
    maxLevel: Level | null;
    properties: Array<{
        key: string;
        value: string;
    }>;
    weightMin: number | null;
    weightMax: number | null;
}
export declare const emptyFilters: Filters;
export interface ViewSpec {
    /** The node whose children are on screen; null means L0. */
    contextId: string | null;
    viewMode: ViewMode;
    /** FR-6: nodes expanded in place, drawn as compound nodes containing their children. */
    expandedIds: string[];
    /** FR-7: when set, only this node, its descendants, and its neighbours are drawn. */
    focusId: string | null;
    /** FR-8: how many hops of neighbours focus mode includes. */
    focusDepth: number;
    /** FR-17: the node whose blast radius is highlighted, if any. */
    impactId: string | null;
    impactDepth: number;
    impactDirection: 'upstream' | 'downstream' | 'both';
    filters: Filters;
}
export declare const defaultViewSpec: ViewSpec;
export interface RenderNode {
    node: GraphNode;
    /** FR-5: whether drilling into this node would show anything. */
    isLeaf: boolean;
    /** True when this node is drawn as a container around its children (FR-6). */
    isExpanded: boolean;
    /** The compound parent to draw this node inside, or null when it sits at the top of the canvas. */
    compoundParent: string | null;
    /** FR-19: dimmed rather than hidden, so context is kept. */
    dimmed: boolean;
    /** Hops from the impact origin, when impact highlighting is on. */
    impactHops: number | null;
}
export interface RenderModel {
    nodes: RenderNode[];
    edges: AggregatedEdge[];
    visibleIds: Set<string>;
    /** True when the current context genuinely has no children — NFR-7 wants this said out loud. */
    contextIsEmpty: boolean;
    index: GraphIndex;
}
export declare function buildRenderModel(map: Pick<GraphMap, 'nodes' | 'edges'>, spec: ViewSpec, index?: GraphIndex): RenderModel;
/** FR-41: the ids that must be expanded/entered for `nodeId` to be on screen. */
export declare function contextForNode(index: GraphIndex, nodeId: string): string | null;
//# sourceMappingURL=viewModel.d.ts.map