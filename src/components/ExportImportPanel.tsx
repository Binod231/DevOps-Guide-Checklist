import { useRef, useState } from 'react';
import {
  GUIDE_CHECKLIST,
  PHASE_CHECKLIST,
  READINESS_CHECKLIST,
  checkboxIds,
  checklist,
  tracker,
} from '../content/registry';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';
import {
  type ImportIssue,
  findUnknownIds,
  parseStateImport,
  serialiseState,
  serialiseTrackerCsv,
} from '../state/transfer';

/** Checkbox ids the current documents define, plus the Open Issues rows. */
function knownCheckboxIds(): Set<string> {
  return new Set([
    ...checkboxIds(GUIDE_CHECKLIST),
    ...checkboxIds(PHASE_CHECKLIST),
    ...checkboxIds(READINESS_CHECKLIST),
    ...checklist.notes.openIssues.map((i) => i.id),
  ]);
}

function download(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** `2026-03-04` for use in a filename. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'success'; message: string; issues: ImportIssue[] }
  | { kind: 'error'; message: string; issues: ImportIssue[] };

/**
 * Export and import of the reader's own state.
 *
 * JSON carries everything and reads back into the portal. The tracker CSV keeps
 * the source export's column order and header spelling, so it round-trips into
 * the spreadsheet or Notion database it came from.
 */
export function ExportImportPanel() {
  const { state, replaceState } = usePortalState();
  const { isAdmin } = useAuth();
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [includeAdded, setIncludeAdded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!isAdmin) {
    return null;
  }

  const exportJson = () => {
    download(`devops-portal-state-${today()}.json`, serialiseState(state), 'application/json');
  };

  const exportCsv = () => {
    download(
      `implementation-tracker-${today()}.csv`,
      serialiseTrackerCsv(tracker, state.tracker, { includeAddedColumns: includeAdded }),
      'text/csv',
    );
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const result = parseStateImport(text);

    if (!result.ok) {
      setFeedback({
        kind: 'error',
        message: `Could not import ${file.name}.`,
        issues: result.issues,
      });
      return;
    }

    const unknown = findUnknownIds(
      result.state,
      knownCheckboxIds(),
      new Set(tracker.rows.map((r) => r.rowKey)),
    );

    replaceState(result.state);
    setFeedback({
      kind: 'success',
      message: `Imported ${file.name}.`,
      issues: [...result.issues, ...unknown],
    });
  };

  return (
    <section aria-labelledby="transfer-heading" className="border border-edge bg-surface">
      <div className="border-b border-edge bg-sunken px-4 py-3">
        <h2
          id="transfer-heading"
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Export and import
        </h2>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportJson}
            className="border border-edge bg-surface px-3 py-1.5 text-sm text-ink-secondary hover:bg-sunken"
          >
            Export state (JSON)
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="border border-edge bg-surface px-3 py-1.5 text-sm text-ink-secondary hover:bg-sunken"
          >
            Export tracker (CSV)
          </button>
          <button
            type="button"
            onClick={() => {
              fileInput.current?.click();
            }}
            className="border border-edge bg-surface px-3 py-1.5 text-sm text-ink-secondary hover:bg-sunken"
          >
            Import state (JSON)
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Choose a state file to import"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = '';
            }}
          />
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="csv-include-added"
            checked={includeAdded}
            onChange={() => setIncludeAdded((v) => !v)}
            className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-[var(--portal-accent)]"
          />
          <label
            htmlFor="csv-include-added"
            className="cursor-pointer text-xs text-ink-muted"
          >
            Include the portal&rsquo;s Notes and Evidence columns in the CSV. Leave this off for a
            CSV with the same columns as the source export.
          </label>
        </div>

        <p className="text-xs text-ink-muted">
          Importing replaces everything currently recorded in this browser. Export first if you
          want to keep it.
        </p>

        <div aria-live="polite">
          {feedback.kind !== 'idle' && (
            <div
              className={[
                'border px-3 py-2 text-sm',
                feedback.kind === 'error'
                  ? 'border-p0 bg-p0-surface text-p0'
                  : 'border-status-done bg-status-done-surface text-status-done',
              ].join(' ')}
            >
              <p className="font-semibold">{feedback.message}</p>

              {feedback.issues.length > 0 && (
                <>
                  <p className="mt-1 text-xs">
                    {feedback.issues.length}{' '}
                    {feedback.issues.length === 1 ? 'issue' : 'issues'}:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {feedback.issues.slice(0, 12).map((issue) => (
                      <li key={`${issue.path}-${issue.message}`}>
                        <code className="font-mono">{issue.path}</code> &mdash; {issue.message}
                      </li>
                    ))}
                    {feedback.issues.length > 12 && (
                      <li>{`and ${feedback.issues.length - 12} more`}</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
