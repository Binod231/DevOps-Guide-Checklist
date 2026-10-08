import type { Progress } from '../state/portalState';

interface ProgressIndicatorProps {
  /** Describes what is being counted, e.g. a category or phase heading. */
  label: string;
  progress: Progress;
  /** Renders a compact inline form for use inside list headers. */
  compact?: boolean;
  /**
   * Announces changes to assistive tech. Enable on the primary indicator of a
   * page only, so ticking a box does not trigger several announcements.
   */
  live?: boolean;
}

/**
 * Total / completed / remaining / percentage, computed from live checkbox
 * state. Reads `Not Started` at zero, which is also the initial state.
 */
export function ProgressIndicator({
  label,
  progress,
  compact = false,
  live = false,
}: ProgressIndicatorProps) {
  const { total, completed, remaining, percent } = progress;
  const summary =
    completed === 0
      ? `Not Started \u2014 0 of ${total} complete`
      : `${completed} of ${total} complete, ${remaining} remaining`;

  if (compact) {
    return (
      <span className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="tabular-nums">
          {completed}/{total}
        </span>
        <Bar percent={percent} />
        <span className="tabular-nums">{percent}%</span>
        <span className="sr-only">{`${label}: ${summary}`}</span>
      </span>
    );
  }

  return (
    <div className="border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</h2>
        <p className="text-sm font-semibold text-ink tabular-nums">
          {percent}%
          {completed === 0 && (
            <span className="ml-2 font-normal text-ink-muted">Not Started</span>
          )}
        </p>
      </div>

      <div className="mt-3">
        <Bar percent={percent} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Total" value={total} />
        <Stat label="Completed" value={completed} />
        <Stat label="Remaining" value={remaining} />
      </dl>

      {/* Single polite region per page, so progress changes are announced once. */}
      <p className="sr-only" aria-live={live ? 'polite' : undefined}>
        {`${label}: ${summary}`}
      </p>
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full min-w-16 overflow-hidden border border-edge bg-sunken"
      // The textual summary alongside carries the same information, so the bar
      // itself is decorative.
      aria-hidden="true"
    >
      <div
        className="h-full bg-accent"
        style={{ width: `${percent}%` }}
      />
    </div>
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
