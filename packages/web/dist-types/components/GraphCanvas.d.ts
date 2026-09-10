/**
 * The canvas. Cytoscape owns the rendering; React owns the state. The bridge between them is
 * deliberately one-way: a change in the render model rebuilds the elements, and Cytoscape
 * events call back into the store. Cytoscape's own internal state is never read as truth,
 * except for positions, which only it knows.
 */
import { type Core } from 'cytoscape';
export type LayoutName = 'dagre' | 'fcose' | 'concentric' | 'grid';
export interface GraphCanvasProps {
    layout: LayoutName;
    /** Bumped by the toolbar to force a re-layout of the current level. */
    layoutNonce: number;
    onReady?: (cy: Core) => void;
}
export declare function GraphCanvas({ layout, layoutNonce, onReady }: GraphCanvasProps): JSX.Element;
//# sourceMappingURL=GraphCanvas.d.ts.map