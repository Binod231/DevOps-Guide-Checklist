import type { ReactNode } from 'react';
import type { Practice } from '../content/types';
import { FieldBlock } from './FieldBlock';

interface PracticeEntryProps {
  practice: Practice;
  /** Checkbox control, supplied once checklist state is wired in. */
  control?: ReactNode;
  /** Metadata strip, e.g. the linked tracker row's S.N and priority. */
  meta?: ReactNode;
}

/**
 * One practice rendered as a single panel of labelled fields.
 *
 * Deliberately not tabbed: a five-field entry reads better whole, and splitting
 * it would hide the verification gate behind a click.
 *
 * Field labels mirror the source bullets exactly, in source order.
 */
export function PracticeEntry({ practice, control, meta }: PracticeEntryProps) {
  return (
    <article
      id={practice.id}
      aria-labelledby={`${practice.id}-heading`}
      className="border border-edge bg-surface"
    >
      <div className="border-b border-edge bg-sunken px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h3
            id={`${practice.id}-heading`}
            className="text-base font-semibold leading-snug text-ink"
          >
            <span className="mr-2 font-mono text-xs font-normal text-ink-muted tabular-nums">
              {practice.sourceOrder}
            </span>
            {practice.heading}
          </h3>
          <a
            href={`#${practice.id}`}
            className="mt-0.5 shrink-0 text-xs text-ink-muted hover:text-accent hover:underline"
          >
            <span aria-hidden="true">#</span>
            <span className="sr-only">Link to {practice.heading}</span>
          </a>
        </div>

        {meta}
        {control && <div className="mt-3">{control}</div>}
      </div>

      {/* The five labelled fields, in source order. Identified so the metadata
          strip above cannot be mistaken for part of the field list. */}
      <dl
        id={`${practice.id}-fields`}
        data-practice-fields=""
        className="space-y-4 px-4 py-4 sm:px-5 sm:py-5"
      >
        <FieldBlock label="Description" value={practice.description} />
        <FieldBlock label="Why it matters" value={practice.whyItMatters} />
        <FieldBlock label="Key concepts" items={practice.keyConcepts} />
        <FieldBlock label="Recommended tools" value={practice.recommendedTools} />
        <FieldBlock label="Verification gate" value={practice.verificationGate} />
      </dl>
    </article>
  );
}
