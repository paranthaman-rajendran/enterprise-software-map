/**
 * FR-47..FR-54: pull the map out of a folder of architecture documents.
 *
 * The panel leads with **Preview**, not Import, because an import rewrites the map and the report
 * is the only way to know what it is about to do (FR-53). The report is shown the same way in
 * both cases, so a preview and a real run read identically.
 */
import { useState } from 'react';

import type { ImportReport } from '@map/shared';

import { ApiError, api } from '../api.js';
import { useIsReadOnly, useStore } from '../store.js';

interface Outcome {
  root: string;
  documentsFound: number;
  dryRun: boolean;
  report: ImportReport;
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: 'bad' | 'warn';
  children: React.ReactNode;
}): JSX.Element | null {
  if (count === 0) return null;
  return (
    <details className={tone ? `report-section report-${tone}` : 'report-section'}>
      <summary>
        {title} ({count})
      </summary>
      {children}
    </details>
  );
}

export function ImportPanel(): JSX.Element {
  const mapId = useStore((s) => s.mapId);
  const refresh = useStore((s) => s.refresh);
  const setNotice = useStore((s) => s.setNotice);

  const readOnly = useIsReadOnly();

  const [path, setPath] = useState('');
  const [prune, setPrune] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const run = async (dryRun: boolean): Promise<void> => {
    if (!mapId || path.trim() === '') return;
    setBusy(true);
    try {
      const result = await api.importMarkdown(mapId, { path: path.trim(), dryRun, prune });
      setOutcome(result);
      if (!dryRun) {
        await refresh();
        const { created, updated, pruned } = result.report;
        setNotice({
          tone: 'success',
          message: `Imported ${result.documentsFound} document(s): ${created.length} new, ${updated.length} updated${pruned.length > 0 ? `, ${pruned.length} removed` : ''}.`,
        });
      }
    } catch (error) {
      setOutcome(null);
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : String(error),
        issues: error instanceof ApiError ? error.issues : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const report = outcome?.report;
  const problemCount =
    (report?.failed.length ?? 0) + (report?.skipped.length ?? 0) + (report?.unresolvedLinks.length ?? 0);

  // Import rewrites the whole map, so there is nothing meaningful to offer on a locked one.
  if (readOnly) return <></>;

  return (
    <section className="panel import-panel">
      <details>
        <summary>Import from markdown</summary>

        <div className="stack">
          <label className="field">
            <span>Folder on the server</span>
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="C:\docs\architecture"
              spellCheck={false}
            />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={prune} onChange={(event) => setPrune(event.target.checked)} />
            Remove nodes whose document has gone
          </label>

          <div className="row">
            <button type="button" className="chip" disabled={busy || path.trim() === ''} onClick={() => void run(true)}>
              {busy ? 'Working…' : 'Preview'}
            </button>
            <button
              type="button"
              className="chip chip-on"
              disabled={busy || path.trim() === ''}
              onClick={() => void run(false)}
            >
              Import
            </button>
          </div>

          <p className="hint">
            One file becomes one node. Frontmatter supplies type, parent, and properties;
            <code>[[wikilinks]]</code> become relationships. Your positions and hand-made edits are kept.
          </p>
        </div>

        {outcome && report && (
          <div className="import-report">
            <p className={outcome.dryRun ? 'report-headline report-preview' : 'report-headline'}>
              {outcome.dryRun ? 'Preview — nothing was written.' : 'Imported.'}{' '}
              {outcome.documentsFound} document{outcome.documentsFound === 1 ? '' : 's'} found
              {problemCount > 0 ? `, ${problemCount} needing attention` : ''}.
            </p>

            <ul className="report-counts">
              <li>
                <strong>{report.created.length}</strong> created
              </li>
              <li>
                <strong>{report.updated.length}</strong> updated
              </li>
              <li>
                <strong>{report.edgesCreated}</strong> relationships added
              </li>
              {report.edgesRemoved > 0 && (
                <li>
                  <strong>{report.edgesRemoved}</strong> relationships removed
                </li>
              )}
              {report.manualNodesPreserved > 0 && (
                <li>
                  <strong>{report.manualNodesPreserved}</strong> hand-made nodes kept
                </li>
              )}
            </ul>

            <Section title="Could not be read" count={report.failed.length} tone="bad">
              <ul className="report-list">
                {report.failed.map((item) => (
                  <li key={item.path}>
                    <code>{item.path}</code>
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Skipped" count={report.skipped.length} tone="bad">
              <ul className="report-list">
                {report.skipped.map((item) => (
                  <li key={item.path}>
                    <code>{item.path}</code>
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Links that went nowhere" count={report.unresolvedLinks.length} tone="warn">
              <ul className="report-list">
                {report.unresolvedLinks.map((item, i) => (
                  <li key={`${item.from}-${item.target}-${i}`}>
                    <code>{item.from}</code>
                    <span>
                      <strong>[[{item.target}]]</strong> ({item.type}) — {item.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Warnings" count={report.warnings.length} tone="warn">
              <ul className="report-list">
                {report.warnings.map((item, i) => (
                  <li key={`${item.path}-${i}`}>
                    <code>{item.path}</code>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title={prune ? 'Removed — document gone' : 'Kept, but the document has gone'}
              count={prune ? report.pruned.length : report.orphaned.length}
              tone="warn"
            >
              <ul className="report-list">
                {report.orphaned.map((item) => (
                  <li key={item.id}>
                    <code>{item.path ?? item.id}</code>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
              {!prune && report.orphaned.length > 0 && (
                <p className="hint">Tick the box above and run again to remove these.</p>
              )}
            </Section>
          </div>
        )}
      </details>
    </section>
  );
}
