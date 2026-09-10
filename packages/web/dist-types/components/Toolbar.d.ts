import type { LayoutName } from './GraphCanvas.js';
export interface ToolbarProps {
    layout: LayoutName;
    onLayoutChange: (layout: LayoutName) => void;
    onRelayout: () => void;
    onFit: () => void;
    filtersOpen: boolean;
    onToggleFilters: () => void;
}
export declare function Toolbar({ layout, onLayoutChange, onRelayout, onFit, filtersOpen, onToggleFilters, }: ToolbarProps): JSX.Element;
//# sourceMappingURL=Toolbar.d.ts.map