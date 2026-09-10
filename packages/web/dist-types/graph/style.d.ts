/**
 * Canvas styling. FR-16 asks that a node's type be readable at a glance, so shape carries the
 * broad category (capability vs journey vs store vs interface) and hue carries the view:
 * functional nodes are warm, technical nodes cool. That way the combined view stays legible
 * without the reader consulting the legend for every node.
 */
import type { StylesheetStyle } from 'cytoscape';
import type { NodeType } from '@map/shared';
export declare const VIEW_COLORS: {
    readonly functional: {
        readonly fill: "#f5e6d3";
        readonly border: "#b5762e";
        readonly text: "#4a2f10";
    };
    readonly technical: {
        readonly fill: "#dde8f5";
        readonly border: "#2c5f95";
        readonly text: "#12283f";
    };
};
/** Shape says what kind of thing it is; the mapping is deliberately small enough to remember. */
export declare const NODE_SHAPES: Record<NodeType, string>;
/** Edge types that are structural rather than runtime get a lighter, dashed treatment. */
export declare const EDGE_COLORS: Record<string, string>;
export declare const BADGE_MORE_INSIDE: string;
export declare const BADGE_EXPANDED: string;
export declare function buildStylesheet(): StylesheetStyle[];
//# sourceMappingURL=style.d.ts.map