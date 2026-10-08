import type { ReactNode } from 'react';
import type { ChecklistItem as ChecklistItemData } from '../content/types';
import { ChecklistItem } from './ChecklistItem';
import { ProgressIndicator } from './ProgressIndicator';
import { usePortalState } from '../state/PortalStateProvider';

interface ChecklistGroupProps {
  /** Anchor id for deep-linking, taken from the content registry. */
  id: string;
  /** Group heading as authored, e.g. a phase heading. */
  heading: string;
  /** Short label above the heading, e.g. `Phase 1`. */
  eyebrow?: string;
  items: ChecklistItemData[];
  /** Heading level to render, keeping the page hierarchy correct. */
  level?: 2 | 3;
  /** Renders per-item trailing content, e.g. a badge. */
  renderTrailing?: (item: ChecklistItemData) => ReactNode;
}

/**
 * A heading plus its checklist items, with a compact progress read-out scoped
 * to that group alone.
 */
export function ChecklistGroup({
  id,
  heading,
  eyebrow,
  items,
  level = 2,
  renderTrailing,
}: ChecklistGroupProps) {
  const { progressForIds } = usePortalState();
  const progress = progressForIds(items.map((i) => i.id));
  const headingId = `${id}-heading`;
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <section id={id} aria-labelledby={headingId} className="border border-edge bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-edge bg-sunken px-4 py-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {eyebrow}
            </p>
          )}
          <Heading id={headingId} className="text-base font-semibold leading-snug text-ink">
            {heading}
          </Heading>
        </div>
        <ProgressIndicator label={heading} progress={progress} compact />
      </div>

      <ul className="space-y-2.5 px-4 py-4">
        {items.map((item) => (
          <li key={item.id}>
            <ChecklistItem
              id={item.id}
              text={item.text}
              dense
              trailing={renderTrailing?.(item)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
