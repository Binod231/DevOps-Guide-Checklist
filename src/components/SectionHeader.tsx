import type { ReactNode } from 'react';
import { InlineMarkdown } from './InlineMarkdown';
import { displayTitle, stageQualifier } from '../content/displayTitle';

interface SectionHeaderProps {
  /**
   * Rendered as the page's single `h1`.
   *
   * Pass the source heading; any trailing company-stage qualifier is moved out
   * of the title and shown as a separate note.
   */
  heading: string;
  /** Small label above the heading, e.g. the owning document title. */
  eyebrow?: string;
  /** Lead-in prose from the source document. */
  intro?: string;
  children?: ReactNode;
}

/** Page heading block. The `h1` of each route. */
export function SectionHeader({ heading, eyebrow, intro, children }: SectionHeaderProps) {
  const title = displayTitle(heading);
  const qualifier = stageQualifier(heading);

  return (
    <div className="border-b border-edge pb-5">
      {eyebrow && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {eyebrow}
        </p>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl" title={heading}>
          {title}
        </h1>
        {qualifier && (
          // The applicability note the heading carried. The same information is
          // a column in the tracker, so it reads as metadata, not as title text.
          <span className="border border-edge bg-sunken px-1.5 py-0.5 text-xs font-medium text-ink-muted">
            {qualifier}
          </span>
        )}
      </div>

      {intro && (
        <p className="portal-measure mt-3 text-ink-secondary">
          <InlineMarkdown text={intro} />
        </p>
      )}
      {children}
    </div>
  );
}
