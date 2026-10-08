import type { ReactNode } from 'react';
import { InlineMarkdown } from './InlineMarkdown';

interface FieldBlockProps {
  /** Field label as written in the source, e.g. `Description`. */
  label: string;
  /** Prose value, rendered with inline markdown. */
  value?: string;
  /** List value, used for `Key concepts`. */
  items?: string[];
  children?: ReactNode;
}

/**
 * One labelled field of a practice.
 *
 * Labels come from the source bullets (`Description`, `Why it matters`,
 * `Key concepts`, `Recommended tools`, `Verification gate`). The source spells
 * some of them `**Label:**` and others `**Label**:`; the stored label drops the
 * colon and the emphasis markers, which are syntax rather than content.
 */
export function FieldBlock({ label, value, items, children }: FieldBlockProps) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted sm:pt-0.5">
        {label}
      </dt>
      <dd className="portal-measure text-ink-secondary">
        {value && <InlineMarkdown text={value} />}

        {items && items.length > 0 && (
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li key={`${index}-${item}`} className="flex gap-2">
                <span aria-hidden="true" className="select-none text-edge-strong">
                  &bull;
                </span>
                <span>
                  <InlineMarkdown text={item} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {children}
      </dd>
    </div>
  );
}
