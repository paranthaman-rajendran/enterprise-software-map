import type { Core } from 'cytoscape';
import { useCallback, useEffect, useState } from 'react';

import { AddPanel } from './components/AddPanel.js';
import { Breadcrumb } from './components/Breadcrumb.js';
import { DetailsPanel } from './components/DetailsPanel.js';
import { GraphCanvas, type LayoutName } from './components/GraphCanvas.js';
import { ImportPanel } from './components/ImportPanel.js';
import { Legend } from './components/Legend.js';
import { SearchPanel } from './components/SearchPanel.js';
import { Toolbar } from './components/Toolbar.js';
import { useIsReadOnly, useStore } from './store.js';

export function App(): JSX.Element {
  const init = useStore((s) => s.init);
  const map = useStore((s) => s.map);
  const maps = useStore((s) => s.maps);
  const mapId = useStore((s) => s.mapId);
  const loading = useStore((s) => s.loading);
  const notice = useStore((s) => s.notice);
  const setNotice = useStore((s) => s.setNotice);
  const loadMap = useStore((s) => s.loadMap);
  const readOnly = useIsReadOnly();

  const [layout, setLayout] = useState<LayoutName>('dagre');
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cy, setCy] = useState<Core | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  // NFR-5: the core navigation is reachable without the mouse.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const store = useStore.getState();

      if (event.key === 'Escape') {
        if (store.spec.focusId) store.setFocus(null);
        else store.select(null);
      } else if (event.key === 'Backspace' && store.spec.contextId !== null) {
        event.preventDefault();
        store.drillUp();
      } else if (event.key === 'Enter' && store.selection?.kind === 'node') {
        store.drillInto(store.selection.id);
      } else if (event.key === 'Delete' && store.selection) {
        event.preventDefault();
        // The store refuses these on a locked map anyway; checking here keeps the keystroke quiet.
        if (store.map?.locked) return;
        if (store.selection.kind === 'edge') void store.deleteEdge(store.selection.id);
        else void store.deleteSelection('delete');
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        void store.undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A notice is transient; errors stay until dismissed so their detail can be read.
  useEffect(() => {
    if (!notice || notice.tone === 'error') return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  const handleFit = useCallback(() => cy?.fit(undefined, 40), [cy]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Enterprise Software Map</h1>
        <select
          value={mapId ?? ''}
          onChange={(event) => void loadMap(event.target.value)}
          aria-label="Map"
          disabled={maps.length === 0}
        >
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.nodeCount} nodes
            </option>
          ))}
        </select>
        {readOnly && (
          <span className="read-only-badge" title="This map ships with the app and cannot be changed">
            Read-only
          </span>
        )}
      </header>

      <Toolbar
        layout={layout}
        onLayoutChange={setLayout}
        onRelayout={() => setLayoutNonce((n) => n + 1)}
        onFit={handleFit}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
      />

      <Breadcrumb />

      <div className="app-body">
        <div className="sidebar sidebar-left">
          <SearchPanel />
          <AddPanel />
          <ImportPanel />
          <Legend />
        </div>

        <main className="stage">
          {loading && <div className="stage-overlay">Loading…</div>}
          {!loading && !map && (
            <div className="stage-overlay">
              No map yet. Start the API and reload — the first run seeds a demo map.
            </div>
          )}
          {map && <GraphCanvas layout={layout} layoutNonce={layoutNonce} onReady={setCy} />}
        </main>

        <DetailsPanel />
      </div>

      {notice && (
        <div className={`notice notice-${notice.tone}`} role="status">
          <div>
            <strong>{notice.message}</strong>
            {notice.issues && notice.issues.length > 0 && (
              <ul>
                {notice.issues.map((issue, i) => (
                  <li key={`${issue.code}-${i}`}>{issue.message}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
