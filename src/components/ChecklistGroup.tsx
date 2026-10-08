import type { ReactNode } from 'react';
import type { ChecklistItem as ChecklistItemData } from '../content/types';
import { ChecklistItem } from './ChecklistItem';
import { ProgressIndicator } from './ProgressIndicator';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';

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
  onAddItem?: () => void;
  onEditItem?: (item: ChecklistItemData) => void;
  onDeleteItem?: (itemId: string) => void;
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
  onAddItem,
  onEditItem,
  onDeleteItem,
}: ChecklistGroupProps) {
  const { progressForIds } = usePortalState();
  const { isAdmin } = useAuth();
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
        <div className="flex items-center gap-3">
          {isAdmin && onAddItem && (
            <button
              type="button"
              onClick={onAddItem}
              className="border border-accent-border bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-subtle/80"
            >
              + Add Item
            </button>
          )}
          <ProgressIndicator label={heading} progress={progress} compact />
        </div>
      </div>

      <ul className="space-y-2.5 px-4 py-4">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <ChecklistItem
                id={item.id}
                text={item.text}
                dense
                trailing={renderTrailing?.(item)}
              />
            </div>
            {isAdmin && (onEditItem || onDeleteItem) && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditItem?.(item)}
                  aria-label={`Edit item ${item.text}`}
                  className="border border-edge bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:border-accent hover:bg-sunken"
                  title="Edit item"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteItem?.(item.id)}
                  aria-label={`Delete item ${item.text}`}
                  className="border border-rose-200 bg-rose-50/50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400"
                  title="Delete item"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
