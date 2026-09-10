/** FR-16: the key to the shapes and colours, plus the FR-15 coverage gaps. */
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { BADGE_EXPANDED, BADGE_MORE_INSIDE, VIEW_COLORS } from '../graph/style.js';
import { useStore } from '../store.js';

interface Gap {
  id: string;
  label: string;
  level: number;
  type: string;
}

export function Legend(): JSX.Element {
  const mapId = useStore((s) => s.mapId);
  const map = useStore((s) => s.map);
  const revealNode = useStore((s) => s.revealNode);
  const [gaps, setGaps] = useState<{ unimplementedFunctional: Gap[]; untracedTechnical: Gap[] } | null>(null);
  const [showGaps, setShowGaps] = useState(false);

  useEffect(() => {
    if (!mapId || !showGaps) return;
    let cancelled = false;
    void api.coverage(mapId).then((result) => {
      if (!cancelled) setGaps(result);
    });
    return () => {
      cancelled = true;
    };
    // `map` is a dependency so the panel refreshes after an edit changes traceability.
  }, [mapId, showGaps, map]);

  return (
    <section className="panel legend-panel">
      <details>
        <summary>Legend</summary>
        <ul className="legend-list">
          <li>
            <span className="swatch" style={{ background: VIEW_COLORS.functional.fill, borderColor: VIEW_COLORS.functional.border }} />
            Functional — what the product does
          </li>
          <li>
            <span className="swatch" style={{ background: VIEW_COLORS.technical.fill, borderColor: VIEW_COLORS.technical.border }} />
            Technical — how it is built
          </li>
          <li>
            <img className="swatch-badge" src={BADGE_MORE_INSIDE} alt="" />
            Chevron and double border — there is more inside; double-click to go in
          </li>
          <li>
            <img className="swatch-badge" src={BADGE_EXPANDED} alt="" />
            Up chevron — already opened in place; collapse it from the details panel
          </li>
          <li>
            <span className="swatch swatch-plain" />
            No chevron, thin border — nothing deeper is recorded
          </li>
          <li>
            <span className="line line-dashed" />
            Dashed line with a count — several relationships rolled into one
          </li>
          <li>
            <span className="line line-dotted" />
            Dotted line — traceability between the two views
          </li>
        </ul>
      </details>

      {/* FR-15 */}
      <details onToggle={(e) => setShowGaps((e.target as HTMLDetailsElement).open)}>
        <summary>Blind spots</summary>
        {!gaps && <p className="empty">Checking…</p>}
        {gaps && (
          <>
            <h4>Capabilities nothing implements ({gaps.unimplementedFunctional.length})</h4>
            {gaps.unimplementedFunctional.length === 0 && <p className="empty">None — every capability is traced.</p>}
            <ul className="gap-list">
              {gaps.unimplementedFunctional.map((gap) => (
                <li key={gap.id}>
                  <button type="button" className="link" onClick={() => revealNode(gap.id)}>
                    {gap.label}
                  </button>
                  <span className="hit-level">L{gap.level}</span>
                </li>
              ))}
            </ul>

            <h4>Technical nodes tied to no capability ({gaps.untracedTechnical.length})</h4>
            {gaps.untracedTechnical.length === 0 && <p className="empty">None.</p>}
            <ul className="gap-list">
              {gaps.untracedTechnical.map((gap) => (
                <li key={gap.id}>
                  <button type="button" className="link" onClick={() => revealNode(gap.id)}>
                    {gap.label}
                  </button>
                  <span className="hit-level">L{gap.level}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}
