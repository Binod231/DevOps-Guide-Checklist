import type { ReactNode } from 'react';
import { isUiOnlyStatus } from '../config/uiFlags';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

function Badge({ children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-block whitespace-nowrap border px-1.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Priority badge.
 *
 * `P0`, `P1` and `P2` are the only values in the source; anything else renders
 * in a neutral style rather than being coerced into a known bucket.
 */
export function PriorityBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    P0: 'border-p0 bg-p0-surface text-p0',
    P1: 'border-p1 bg-p1-surface text-p1',
    P2: 'border-p2 bg-p2-surface text-p2',
  };
  if (!value) return <EmptyCell />;
  return <Badge className={styles[value] ?? 'border-edge bg-sunken text-ink-muted'}>{value}</Badge>;
}

/**
 * Status badge.
 *
 * `Not Started` is the only status value present in the source. `In Progress`
 * and `Completed` come from the reader and are marked as UI-added vocabulary
 * via their tooltip.
 */
export function StatusBadge({ value }: { value: string }) {
  if (!value) {
    // ST-20 has an empty Status cell. Shown as blank, not defaulted.
    return <EmptyCell label="No status recorded in the source" />;
  }

  const styles: Record<string, string> = {
    'Not Started': 'border-edge bg-status-neutral-surface text-status-neutral',
    'In Progress': 'border-accent-border bg-status-active-surface text-status-active',
    Completed: 'border-status-done bg-status-done-surface text-status-done',
  };

  return (
    <Badge
      className={styles[value] ?? 'border-edge bg-sunken text-ink-muted'}
      title={isUiOnlyStatus(value) ? 'Status value added by this portal' : undefined}
    >
      {value}
    </Badge>
  );
}

/** Company stage badge. Source values are `For All` and `Optional For Startup`. */
export function StageBadge({ value }: { value: string }) {
  if (!value) return <EmptyCell />;
  const isForAll = value === 'For All';
  return (
    <Badge
      className={
        isForAll
          ? 'border-accent-border bg-accent-subtle text-stage-all'
          : 'border-edge bg-sunken text-stage-optional'
      }
    >
      {value}
    </Badge>
  );
}

/** Verified badge. Source value is `No` on every row. */
export function VerifiedBadge({ value }: { value: string }) {
  if (!value) return <EmptyCell />;
  const isYes = /^y/i.test(value);
  return (
    <Badge
      className={
        isYes
          ? 'border-status-done bg-status-done-surface text-status-done'
          : 'border-edge bg-status-neutral-surface text-status-neutral'
      }
    >
      {value}
    </Badge>
  );
}

/**
 * An empty cell.
 *
 * The source leaves `Implementation By`, `Target Date` and `Verified By` blank
 * on all 24 rows, and `Status` blank on one. Blank is shown as blank.
 */
export function EmptyCell({ label = 'Empty in the source document' }: { label?: string }) {
  return (
    <span className="text-ink-muted" title={label}>
      <span aria-hidden="true">&mdash;</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
