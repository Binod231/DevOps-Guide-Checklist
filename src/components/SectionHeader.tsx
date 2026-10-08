import type { ReactNode } from 'react';
import { InlineMarkdown } from './InlineMarkdown';

interface SectionHeaderProps {
  /** Rendered as the page's single `h1`. */
  heading: string;
  /** Small label above the heading, e.g. the owning document title. */
  eyebrow?: string;
  /** Lead-in prose from the source document. */
  intro?: string;
  children?: ReactNode;
}

/** Page heading block. The `h1` of each route. */
export function SectionHeader({ heading, eyebrow, intro, children }: SectionHeaderProps) {
  return (
    <div className="border-b border-edge pb-5">
      {eyebrow && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {eyebrow}
        </p>
      )}
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{heading}</h1>
      {intro && (
        <p className="portal-measure mt-3 text-ink-secondary">
          <InlineMarkdown text={intro} />
        </p>
      )}
      {children}
    </div>
  );
}
