/**
 * FR-39..FR-41: search everything, show each hit with the path that disambiguates it, and jump
 * straight to it at its own level. Search runs against the loaded map rather than the API so
 * results appear as you type; the server route exists for callers without the map in hand.
 */
import { useMemo, useState } from 'react';

import { LEVEL_NAMES, searchNodes, type SearchHit } from '@map/shared';

import { useStore } from '../store.js';

export function SearchPanel(): JSX.Element {
  const [query, setQuery] = useState('');
  const map = useStore((s) => s.map);
  const index = useStore((s) => s.index);
  const revealNode = useStore((s) => s.revealNode);

  const hits: SearchHit[] = useMemo(() => {
    if (!map || !index || query.trim().length < 2) return [];
    return searchNodes(map, query, { limit: 25 }, index);
  }, [map, index, query]);

  return (
    <section className="panel search-panel">
      <input
        type="search"
        className="search-input"
        placeholder="Search everything…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search the whole map"
      />

      {query.trim().length >= 2 && (
        <div className="search-results">
          {hits.length === 0 && <p className="empty">Nothing matches “{query}”.</p>}

          {hits.map((hit) => (
            <button
              key={hit.node.id}
              type="button"
              className="search-hit"
              onClick={() => revealNode(hit.node.id)}
              title={hit.node.description || hit.node.label}
            >
              <span className="hit-label">{hit.node.label}</span>
              <span className="hit-meta">
                <span className={`pill pill-${hit.node.view}`}>{hit.node.type}</span>
                <span className="hit-level">
                  L{hit.node.level} {LEVEL_NAMES[hit.node.level]}
                </span>
              </span>
              {/* FR-40: the path is what tells two identically named nodes apart. */}
              <span className="hit-path">
                {hit.path.slice(0, -1).map((n) => n.label).join(' › ') || 'top level'}
              </span>
              {hit.matchedOn !== 'label' && (
                <span className="hit-why">
                  matched on {hit.matchedOn}
                  {hit.matchedKey ? ` “${hit.matchedKey}”` : ''}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
