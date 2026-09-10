/** FR-3/FR-4: where you are, and the way back up. Every segment is clickable. */
import { LEVEL_NAMES } from '@map/shared';

import { useBreadcrumb, useStore } from '../store.js';

export function Breadcrumb(): JSX.Element {
  const trail = useBreadcrumb();
  const setContext = useStore((s) => s.setContext);
  const drillUp = useStore((s) => s.drillUp);
  const contextId = useStore((s) => s.spec.contextId);

  const currentLevel = trail.length; // children of the context sit one level below it

  return (
    <nav className="breadcrumb" aria-label="Location">
      <button
        type="button"
        className="crumb-up"
        onClick={drillUp}
        disabled={contextId === null}
        title="Go up one level"
        aria-label="Go up one level"
      >
        ↑
      </button>

      <button
        type="button"
        className={contextId === null ? 'crumb crumb-current' : 'crumb'}
        onClick={() => setContext(null)}
      >
        Landscape
      </button>

      {trail.map((node) => (
        <span key={node.id} className="crumb-group">
          <span className="crumb-sep" aria-hidden="true">
            ›
          </span>
          <button
            type="button"
            className={node.id === contextId ? 'crumb crumb-current' : 'crumb'}
            onClick={() => setContext(node.id)}
            title={node.description || node.label}
          >
            {node.label}
          </button>
        </span>
      ))}

      <span className="crumb-level">
        showing L{currentLevel} · {LEVEL_NAMES[Math.min(currentLevel, 4) as 0 | 1 | 2 | 3 | 4]}
      </span>
    </nav>
  );
}
