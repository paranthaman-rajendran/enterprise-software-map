/**
 * The top bar: view switching (FR-12), focus mode and its depth (FR-7/FR-8), impact
 * highlighting (FR-17), layout choice, filters (FR-42..FR-46), and export (FR-58).
 */
import { useEffect, useState } from 'react';

import { EDGE_TYPES, LEVELS, NODE_TYPES, type EdgeType, type Level, type NodeType } from '@map/shared';

import type { LayoutName } from './GraphCanvas.js';
import { api } from '../api.js';
import { useIsReadOnly, useStore } from '../store.js';

export interface ToolbarProps {
  layout: LayoutName;
  onLayoutChange: (layout: LayoutName) => void;
  onRelayout: () => void;
  onFit: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

export function Toolbar({
  layout,
  onLayoutChange,
  onRelayout,
  onFit,
  filtersOpen,
  onToggleFilters,
}: ToolbarProps): JSX.Element {
  const spec = useStore((s) => s.spec);
  const map = useStore((s) => s.map);
  const selection = useStore((s) => s.selection);
  const setViewMode = useStore((s) => s.setViewMode);
  const setFocus = useStore((s) => s.setFocus);
  const setFocusDepth = useStore((s) => s.setFocusDepth);
  const setImpact = useStore((s) => s.setImpact);
  const setImpactOptions = useStore((s) => s.setImpactOptions);
  const setFilters = useStore((s) => s.setFilters);
  const clearFilters = useStore((s) => s.clearFilters);
  const undo = useStore((s) => s.undo);
  const undoStack = useStore((s) => s.undoStack);
  const readOnly = useIsReadOnly();

  /**
   * FR-44: the property filter is driven by what is actually in the map, so the dropdowns only
   * ever offer values that exist. Fetched when the sheet opens rather than on every load.
   */
  const [facets, setFacets] = useState<Array<{ key: string; values: string[] }>>([]);
  useEffect(() => {
    if (!filtersOpen || !map) return;
    let cancelled = false;
    void api
      .facets(map.id)
      .then((result) => {
        if (!cancelled) setFacets(result);
      })
      .catch(() => {
        if (!cancelled) setFacets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [filtersOpen, map]);

  const selectedNodeId = selection?.kind === 'node' ? selection.id : null;

  /** One clause per key: choosing a new value replaces the old one rather than stacking. */
  const setPropertyFilter = (key: string, value: string): void => {
    const others = spec.filters.properties.filter((clause) => clause.key !== key);
    setFilters({ properties: value === '' ? others : [...others, { key, value }] });
  };

  const activeFilterCount =
    spec.filters.nodeTypes.length +
    spec.filters.edgeTypes.length +
    spec.filters.properties.length +
    (spec.filters.maxLevel === null ? 0 : 1) +
    (spec.filters.weightMin === null ? 0 : 1) +
    (spec.filters.weightMax === null ? 0 : 1);

  const exportMap = (): void => {
    if (!map) return;
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), map }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${map.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(window.location.href);
    useStore.getState().setNotice({ tone: 'success', message: 'Link to this exact view copied.' });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group" role="radiogroup" aria-label="View">
        {(['functional', 'technical', 'combined'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={spec.viewMode === mode}
            className={spec.viewMode === mode ? 'chip chip-on' : 'chip'}
            onClick={() => setViewMode(mode)}
          >
            {mode === 'combined' ? 'Both' : mode[0]!.toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={spec.focusId ? 'chip chip-on' : 'chip'}
          disabled={!selectedNodeId && !spec.focusId}
          onClick={() => setFocus(spec.focusId ? null : selectedNodeId)}
          title="Show only this node, its descendants, and its neighbours"
        >
          {spec.focusId ? 'Clear focus' : 'Focus'}
        </button>
        {spec.focusId && (
          <label className="inline-field">
            hops
            <select
              value={spec.focusDepth}
              onChange={(event) => setFocusDepth(Number(event.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={spec.impactId ? 'chip chip-on' : 'chip'}
          disabled={!selectedNodeId && !spec.impactId}
          onClick={() => setImpact(spec.impactId ? null : selectedNodeId)}
          title="Dim everything outside this node's blast radius"
        >
          {spec.impactId ? 'Clear impact' : 'Impact'}
        </button>
        {spec.impactId && (
          <>
            <select
              value={spec.impactDirection}
              onChange={(event) => setImpactOptions({ direction: event.target.value as 'both' })}
              aria-label="Impact direction"
            >
              <option value="both">both ways</option>
              <option value="downstream">downstream</option>
              <option value="upstream">upstream</option>
            </select>
            <select
              value={spec.impactDepth}
              onChange={(event) => setImpactOptions({ depth: Number(event.target.value) })}
              aria-label="Impact depth"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} hop{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button
          type="button"
          className={filtersOpen || activeFilterCount > 0 ? 'chip chip-on' : 'chip'}
          onClick={onToggleFilters}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <select value={layout} onChange={(event) => onLayoutChange(event.target.value as LayoutName)} aria-label="Layout">
          <option value="dagre">Flow layout</option>
          <option value="fcose">Organic layout</option>
          <option value="concentric">Concentric</option>
          <option value="grid">Grid</option>
        </select>
        <button type="button" className="chip" onClick={onRelayout} title="Re-run the layout for this level">
          Re-layout
        </button>
        <button type="button" className="chip" onClick={onFit} title="Frame everything visible">
          Fit
        </button>
        {!readOnly && (
          <button type="button" className="chip" onClick={() => void undo()} disabled={undoStack.length === 0}>
            Undo
          </button>
        )}
        <button type="button" className="chip" onClick={() => void copyLink()} title="Copy a link that reopens this exact view">
          Share
        </button>
        <button type="button" className="chip" onClick={exportMap} title="Download the whole map as JSON">
          Export
        </button>
      </div>

      {filtersOpen && (
        <div className="filter-sheet">
          <div className="filter-block">
            <h4>Node types</h4>
            <div className="filter-chips">
              {NODE_TYPES.map((type) => {
                const on = spec.filters.nodeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={on ? 'chip chip-tiny chip-on' : 'chip chip-tiny'}
                    onClick={() =>
                      setFilters({
                        nodeTypes: on
                          ? spec.filters.nodeTypes.filter((t) => t !== type)
                          : [...spec.filters.nodeTypes, type as NodeType],
                      })
                    }
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="filter-block">
            <h4>Relationship types</h4>
            <div className="filter-chips">
              {EDGE_TYPES.map((type) => {
                const on = spec.filters.edgeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={on ? 'chip chip-tiny chip-on' : 'chip chip-tiny'}
                    onClick={() =>
                      setFilters({
                        edgeTypes: on
                          ? spec.filters.edgeTypes.filter((t) => t !== type)
                          : [...spec.filters.edgeTypes, type as EdgeType],
                      })
                    }
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="filter-block">
            <h4>Deepest level shown</h4>
            <div className="filter-chips">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={spec.filters.maxLevel === level ? 'chip chip-tiny chip-on' : 'chip chip-tiny'}
                  onClick={() =>
                    setFilters({ maxLevel: spec.filters.maxLevel === level ? null : (level as Level) })
                  }
                >
                  L{level}
                </button>
              ))}
            </div>
          </div>

          {/* FR-44 */}
          {facets.length > 0 && (
            <div className="filter-block">
              <h4>Properties</h4>
              <div className="filter-properties">
                {facets.map((facet) => (
                  <label key={facet.key} className="filter-property">
                    <span>{facet.key}</span>
                    <select
                      value={spec.filters.properties.find((c) => c.key === facet.key)?.value ?? ''}
                      onChange={(event) => setPropertyFilter(facet.key, event.target.value)}
                    >
                      <option value="">any</option>
                      {facet.values.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* FR-45: the numeric half of the relationship filter. */}
          <div className="filter-block">
            <h4>Relationship weight</h4>
            <div className="filter-range">
              <label className="inline-field">
                min
                <input
                  type="number"
                  step="0.5"
                  value={spec.filters.weightMin ?? ''}
                  onChange={(event) =>
                    setFilters({ weightMin: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </label>
              <label className="inline-field">
                max
                <input
                  type="number"
                  step="0.5"
                  value={spec.filters.weightMax ?? ''}
                  onChange={(event) =>
                    setFilters({ weightMax: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </div>

          <button type="button" className="chip" onClick={clearFilters} disabled={activeFilterCount === 0}>
            Clear all filters
          </button>
          <p className="hint">Filters only change what is drawn. Clearing them brings everything back.</p>
        </div>
      )}
    </div>
  );
}
