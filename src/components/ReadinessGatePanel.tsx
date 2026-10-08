import type { Progress } from '../state/portalState';

interface ReadinessGatePanelProps {
  /**
   * Progress across the Production Readiness Gate criteria only.
   *
   * Never a blend with the guide or phase checklists: the gate is the
   * document's own list of conditions, and mixing other counts in would
   * misstate readiness.
   */
  progress: Progress;
}

/**
 * Readiness summary for the Production Readiness Gate.
 *
 * Reports confirmed-against-total and states plainly that the gate is met only
 * when every criterion is confirmed. The thresholds are the document's own:
 * it asks the reader to confirm all of its criteria, so there is no partial
 * pass to report.
 */
export function ReadinessGatePanel({ progress }: ReadinessGatePanelProps) {
  const { total, completed, remaining, percent } = progress;
  const met = total > 0 && completed === total;

  const statusLabel = met ? 'All criteria confirmed' : 'Not Started';
  const summary = met
    ? `All ${total} criteria confirmed.`
    : completed === 0
      ? `Not Started \u2014 0 of ${total} criteria confirmed.`
      : `${completed} of ${total} criteria confirmed, ${remaining} outstanding.`;

  return (
    <section
      aria-labelledby="readiness-status"
      className={[
        'border bg-surface p-4',
        met ? 'border-status-done' : 'border-edge',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="readiness-status"
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Readiness status
        </h2>
        <p
          className={[
            'border px-2 py-0.5 text-sm font-semibold',
            met
              ? 'border-status-done bg-status-done-surface text-status-done'
              : 'border-edge bg-status-neutral-surface text-status-neutral',
          ].join(' ')}
        >
          {completed === 0 ? statusLabel : met ? statusLabel : 'In review'}
        </p>
      </div>

      <p className="mt-3 text-2xl font-semibold text-ink tabular-nums">
        {completed}
        <span className="text-ink-muted"> / {total}</span>
        <span className="ml-3 text-base font-normal text-ink-muted">{percent}%</span>
      </p>

      <div
        aria-hidden="true"
        className="mt-3 h-1.5 w-full overflow-hidden border border-edge bg-sunken"
      >
        <div
          className={met ? 'h-full bg-status-done' : 'h-full bg-accent'}
          style={{ width: `${percent}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Criteria" value={total} />
        <Stat label="Confirmed" value={completed} />
        <Stat label="Outstanding" value={remaining} />
      </dl>

      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-edge bg-sunken px-2 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-base font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
