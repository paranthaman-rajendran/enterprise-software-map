/**
 * FR-27..FR-29 and FR-36: what a selected node or edge is, and everything it connects to, with
 * every relationship clickable so a reader can walk the graph without touching the canvas.
 */
import { useEffect, useState } from 'react';

import {
  EDGE_TYPES,
  LEVEL_NAMES,
  NODE_TYPES,
  NODE_TYPE_VIEW,
  ancestorPath,
  type GraphEdge,
  type GraphNode,
  type NodeType,
} from '@map/shared';

import { useIsReadOnly, useStore } from '../store.js';

function RelationshipRow({
  edge,
  otherId,
  direction,
}: {
  edge: GraphEdge;
  otherId: string;
  direction: 'out' | 'in';
}): JSX.Element {
  const index = useStore((s) => s.index);
  const revealNode = useStore((s) => s.revealNode);
  const select = useStore((s) => s.select);
  const other = index?.nodes.get(otherId);

  return (
    <li className="rel-row">
      <span className={`rel-arrow rel-${direction}`}>{direction === 'out' ? '→' : '←'}</span>
      <button type="button" className="rel-type" onClick={() => select({ kind: 'edge', id: edge.id })}>
        {edge.type}
      </button>
      {/* FR-29: jump to the node at the other end, even when it sits on another level. */}
      <button type="button" className="rel-target" onClick={() => revealNode(otherId)}>
        {other?.label ?? otherId}
      </button>
      {other && <span className="rel-level">L{other.level}</span>}
    </li>
  );
}

function NodeDetails({ node }: { node: GraphNode }): JSX.Element {
  const readOnly = useIsReadOnly();
  const index = useStore((s) => s.index);
  const updateNode = useStore((s) => s.updateNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const drillInto = useStore((s) => s.drillInto);
  const revealNode = useStore((s) => s.revealNode);
  const setFocus = useStore((s) => s.setFocus);
  const toggleExpanded = useStore((s) => s.toggleExpanded);
  const expandedIds = useStore((s) => s.spec.expandedIds);

  const [draft, setDraft] = useState({ label: node.label, description: node.description, type: node.type });
  const [propKey, setPropKey] = useState('');
  const [propValue, setPropValue] = useState('');

  useEffect(() => {
    setDraft({ label: node.label, description: node.description, type: node.type });
  }, [node.id, node.label, node.description, node.type]);

  const outgoing = index?.outgoing.get(node.id) ?? [];
  const incoming = index?.incoming.get(node.id) ?? [];
  const children = index?.children.get(node.id) ?? [];
  const path = index ? ancestorPath(index, node.parent) : [];

  const dirty =
    draft.label !== node.label || draft.description !== node.description || draft.type !== node.type;

  const commit = (): void => {
    if (!dirty) return;
    void updateNode(node.id, {
      label: draft.label,
      description: draft.description,
      type: draft.type,
      // The view is implied by the type; keeping them in step avoids a validation error.
      view: NODE_TYPE_VIEW[draft.type],
    });
  };

  const setProperty = (key: string, value: string | null): void => {
    const properties = { ...node.properties };
    if (value === null) delete properties[key];
    else properties[key] = value;
    void updateNode(node.id, { properties });
  };

  return (
    <>
      <header className="details-header">
        <span className={`pill pill-${node.view}`}>{node.type}</span>
        <span className="details-level">
          L{node.level} · {LEVEL_NAMES[node.level]}
        </span>
      </header>

      <label className="field">
        <span>Name</span>
        <input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          onBlur={commit}
          readOnly={readOnly}
        />
      </label>

      <label className="field">
        <span>Type</span>
        <select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value as NodeType })}
          onBlur={commit}
          disabled={readOnly}
        >
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
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          rows={3}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          onBlur={commit}
          readOnly={readOnly}
          placeholder={readOnly ? '' : 'What is this, in one or two sentences?'}
        />
      </label>

      {path.length > 0 && (
        <div className="field">
          <span>Parent</span>
          <div className="path-line">
            {path.map((ancestor, i) => (
              <span key={ancestor.id}>
                {i > 0 && ' › '}
                <button type="button" className="link" onClick={() => revealNode(ancestor.id)}>
                  {ancestor.label}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* FR-54: provenance, so an imported node says where it came from. */}
      {node.source.path && (
        <div className="field">
          <span>Source</span>
          <code className="source-path">{node.source.path}</code>
        </div>
      )}

      <div className="details-actions">
        <button type="button" className="chip" onClick={() => drillInto(node.id)} disabled={children.length === 0}>
          {children.length > 0 ? `Drill in (${children.length})` : 'No detail inside'}
        </button>
        {/* FR-6: reveal the children inside this node without leaving the level, so siblings at
            mixed depth can be compared side by side. */}
        {children.length > 0 && (
          <button
            type="button"
            className={expandedIds.includes(node.id) ? 'chip chip-on' : 'chip'}
            onClick={() => toggleExpanded(node.id)}
            title="Show this node's children inside it, without leaving this level"
          >
            {expandedIds.includes(node.id) ? 'Collapse' : 'Expand here'}
          </button>
        )}
        <button type="button" className="chip" onClick={() => setFocus(node.id)}>
          Focus
        </button>
        {!readOnly && (
        <button
          type="button"
          className="chip chip-danger"
          onClick={() => {
            const mode = children.length > 0
              ? window.confirm(
                  `"${node.label}" has ${children.length} child node(s).\n\nOK: delete them too.\nCancel: keep them, moving them up one level.`,
                )
                ? 'delete'
                : 'promote'
              : 'delete';
            void deleteNode(node.id, mode);
          }}
        >
          Delete
        </button>
        )}
      </div>

      <section className="details-section">
        <h4>Properties</h4>
        {Object.entries(node.properties).length === 0 && <p className="empty">None recorded.</p>}
        <ul className="prop-list">
          {Object.entries(node.properties).map(([key, value]) => (
            <li key={key}>
              <span className="prop-key">{key}</span>
              <input
                className="prop-value"
                defaultValue={value === null ? '' : String(value)}
                onBlur={(e) => setProperty(key, e.target.value)}
                readOnly={readOnly}
              />
              {!readOnly && (
                <button type="button" className="icon-button" onClick={() => setProperty(key, null)} aria-label={`Remove ${key}`}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
        <div className="prop-add">
          <input placeholder="key" value={propKey} onChange={(e) => setPropKey(e.target.value)} />
          <input placeholder="value" value={propValue} onChange={(e) => setPropValue(e.target.value)} />
          <button
            type="button"
            className="chip"
            disabled={propKey.trim() === ''}
            onClick={() => {
              setProperty(propKey.trim(), propValue);
              setPropKey('');
              setPropValue('');
            }}
          >
            Add
          </button>
        </div>
        )}
      </section>

      <section className="details-section">
        <h4>Outgoing ({outgoing.length})</h4>
        {outgoing.length === 0 && <p className="empty">Nothing recorded.</p>}
        <ul className="rel-list">
          {outgoing.map((edge) => (
            <RelationshipRow key={edge.id} edge={edge} otherId={edge.target} direction="out" />
          ))}
        </ul>
      </section>

      <section className="details-section">
        <h4>Incoming ({incoming.length})</h4>
        {incoming.length === 0 && <p className="empty">Nothing recorded.</p>}
        <ul className="rel-list">
          {incoming.map((edge) => (
            <RelationshipRow key={edge.id} edge={edge} otherId={edge.source} direction="in" />
          ))}
        </ul>
      </section>
    </>
  );
}

function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element {
  const readOnly = useIsReadOnly();
  const index = useStore((s) => s.index);
  const updateEdge = useStore((s) => s.updateEdge);
  const deleteEdge = useStore((s) => s.deleteEdge);
  const revealNode = useStore((s) => s.revealNode);

  const source = index?.nodes.get(edge.source);
  const target = index?.nodes.get(edge.target);

  return (
    <>
      <header className="details-header">
        <span className="pill pill-edge">relationship</span>
      </header>

      <div className="field">
        <span>From → to</span>
        <div className="path-line">
          <button type="button" className="link" onClick={() => revealNode(edge.source)}>
            {source?.label ?? edge.source}
          </button>
          {' → '}
          <button type="button" className="link" onClick={() => revealNode(edge.target)}>
            {target?.label ?? edge.target}
          </button>
        </div>
      </div>

      <label className="field">
        <span>Type</span>
        <select
          value={edge.type}
          disabled={readOnly}
          onChange={(e) => void updateEdge(edge.id, { type: e.target.value as GraphEdge['type'] })}
        >
          {EDGE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Weight</span>
        <input
          type="number"
          step="0.5"
          defaultValue={edge.weight}
          readOnly={readOnly}
          onBlur={(e) => void updateEdge(edge.id, { weight: Number(e.target.value) })}
        />
      </label>

      {!readOnly && (
        <div className="details-actions">
          <button type="button" className="chip chip-danger" onClick={() => void deleteEdge(edge.id)}>
            Delete relationship
          </button>
        </div>
      )}
    </>
  );
}

/** FR-11: an aggregated edge is not a real edge — it stands for several, so list them. */
function AggregateDetails({ edgeId }: { edgeId: string }): JSX.Element {
  const index = useStore((s) => s.index);
  const select = useStore((s) => s.select);
  const revealNode = useStore((s) => s.revealNode);

  const [, endpoints] = edgeId.split(':');
  const [sourceId, targetId] = (endpoints ?? '').split('->');

  const underlying = [...(index?.edges.values() ?? [])].filter((edge) => {
    const climb = (id: string, target: string): boolean => {
      let cursor: string | null = id;
      while (cursor) {
        if (cursor === target) return true;
        cursor = index?.nodes.get(cursor)?.parent ?? null;
      }
      return false;
    };
    return climb(edge.source, sourceId ?? '') && climb(edge.target, targetId ?? '');
  });

  return (
    <>
      <header className="details-header">
        <span className="pill pill-edge">rolled-up relationship</span>
      </header>
      <p className="hint">
        This one line stands for {underlying.length} relationship{underlying.length === 1 ? '' : 's'} between the
        two subtrees. They are drawn as one because their real endpoints are deeper than this level.
      </p>
      <ul className="rel-list">
        {underlying.map((edge) => (
          <li key={edge.id} className="rel-row">
            <button type="button" className="rel-target" onClick={() => revealNode(edge.source)}>
              {index?.nodes.get(edge.source)?.label ?? edge.source}
            </button>
            <button type="button" className="rel-type" onClick={() => select({ kind: 'edge', id: edge.id })}>
              {edge.type}
            </button>
            <button type="button" className="rel-target" onClick={() => revealNode(edge.target)}>
              {index?.nodes.get(edge.target)?.label ?? edge.target}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function DetailsPanel(): JSX.Element {
  const selection = useStore((s) => s.selection);
  const index = useStore((s) => s.index);

  if (!selection || !index) {
    return (
      <aside className="panel details-panel">
        <p className="empty">Select a node or a relationship to see its details.</p>
      </aside>
    );
  }

  if (selection.kind === 'node') {
    const node = index.nodes.get(selection.id);
    return (
      <aside className="panel details-panel">
        {node ? <NodeDetails node={node} /> : <p className="empty">That node is no longer in the map.</p>}
      </aside>
    );
  }

  if (selection.id.startsWith('agg:')) {
    return (
      <aside className="panel details-panel">
        <AggregateDetails edgeId={selection.id} />
      </aside>
    );
  }

  const edge = index.edges.get(selection.id);
  return (
    <aside className="panel details-panel">
      {edge ? <EdgeDetails edge={edge} /> : <p className="empty">That relationship is no longer in the map.</p>}
    </aside>
  );
}
