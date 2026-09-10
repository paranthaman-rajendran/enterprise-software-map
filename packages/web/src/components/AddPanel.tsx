/**
 * FR-32/FR-33: adding a node at the current context, and drawing a relationship between two
 * nodes. Kept as an explicit form rather than a canvas gesture — the relationship type has to
 * be chosen anyway, and a form makes the parenting rule visible instead of implicit.
 */
import { useState } from 'react';

import { EDGE_TYPES, NODE_TYPES, NODE_TYPE_VIEW, type EdgeType, type NodeType } from '@map/shared';

import { useIsReadOnly, useStore } from '../store.js';

export function AddPanel(): JSX.Element {
  const spec = useStore((s) => s.spec);
  const index = useStore((s) => s.index);
  const selection = useStore((s) => s.selection);
  const addNode = useStore((s) => s.addNode);
  const addEdge = useStore((s) => s.addEdge);
  const showPath = useStore((s) => s.showPath);
  const clearPath = useStore((s) => s.clearPath);
  const pathHighlight = useStore((s) => s.pathHighlight);

  const readOnly = useIsReadOnly();

  const [label, setLabel] = useState('');
  const [type, setType] = useState<NodeType>('service');
  const [edgeType, setEdgeType] = useState<EdgeType>('depends-on');
  const [edgeFrom, setEdgeFrom] = useState('');
  const [edgeTo, setEdgeTo] = useState('');
  const [pathFrom, setPathFrom] = useState('');
  const [pathTo, setPathTo] = useState('');

  const contextLabel = spec.contextId
    ? (index?.nodes.get(spec.contextId)?.label ?? spec.contextId)
    : 'the landscape (L0)';

  // Every node in the map is offerable as an endpoint — a relationship may cross levels.
  const allNodes = [...(index?.nodes.values() ?? [])].sort((a, b) => a.label.localeCompare(b.label));

  const selectedId = selection?.kind === 'node' ? selection.id : '';

  return (
    <section className="panel add-panel">
      {/* Editing forms have nothing to offer on a read-only map; tracing below still does. */}
      {!readOnly && (
        <>
      <details open>
        <summary>Add a node</summary>
        <p className="hint">It will be created inside {contextLabel}.</p>
        <div className="stack">
          <input placeholder="Name" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value as NodeType)}>
            <optgroup label="Functional">
              {NODE_TYPES.filter((t) => NODE_TYPE_VIEW[t] === 'functional').map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </optgroup>
            <optgroup label="Technical">
              {NODE_TYPES.filter((t) => NODE_TYPE_VIEW[t] === 'technical').map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            className="chip"
            disabled={label.trim() === ''}
            onClick={() => {
              void addNode({
                label: label.trim(),
                type,
                view: NODE_TYPE_VIEW[type],
                parent: spec.contextId,
              });
              setLabel('');
            }}
          >
            Add node
          </button>
        </div>
      </details>

      <details>
        <summary>Add a relationship</summary>
        <div className="stack">
          <label className="field">
            <span>From</span>
            <select value={edgeFrom || selectedId} onChange={(e) => setEdgeFrom(e.target.value)}>
              <option value="">choose…</option>
              {allNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} (L{n.level})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select value={edgeType} onChange={(e) => setEdgeType(e.target.value as EdgeType)}>
              {EDGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>To</span>
            <select value={edgeTo} onChange={(e) => setEdgeTo(e.target.value)}>
              <option value="">choose…</option>
              {allNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} (L{n.level})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="chip"
            disabled={!(edgeFrom || selectedId) || !edgeTo}
            onClick={() => {
              void addEdge(edgeFrom || selectedId, edgeTo, edgeType);
              setEdgeTo('');
            }}
          >
            Add relationship
          </button>
        </div>
      </details>
        </>
      )}

      {/* FR-18 */}
      <details>
        <summary>How are two things connected?</summary>
        <div className="stack">
          <select value={pathFrom} onChange={(e) => setPathFrom(e.target.value)} aria-label="Path from">
            <option value="">from…</option>
            {allNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
          <select value={pathTo} onChange={(e) => setPathTo(e.target.value)} aria-label="Path to">
            <option value="">to…</option>
            {allNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
          <div className="row">
            <button
              type="button"
              className="chip"
              disabled={!pathFrom || !pathTo}
              onClick={() => void showPath(pathFrom, pathTo)}
            >
              Trace
            </button>
            {pathHighlight && (
              <button type="button" className="chip" onClick={clearPath}>
                Clear
              </button>
            )}
          </div>
          {pathHighlight && (
            <p className="hint">
              {pathHighlight.nodes
                .map((id) => index?.nodes.get(id)?.label ?? id)
                .join(' → ')}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
