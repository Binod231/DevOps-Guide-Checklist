import type { ReactNode } from 'react';
import { InlineMarkdown } from './InlineMarkdown';
import { usePortalState } from '../state/PortalStateProvider';

interface ChecklistItemProps {
  /** Stable id from the content generator. */
  id: string;
  /** Item text as authored. */
  text: string;
  /** Extra content shown beside the label, e.g. tracker metadata. */
  trailing?: ReactNode;
  /** Renders the label in a denser style, for long lists. */
  dense?: boolean;
}

/**
 * A real `<input type="checkbox">` tied to its `<label>`.
 *
 * Deliberately not a styled `div` with a click handler: native checkboxes bring
 * keyboard operation, the correct role, and the right announcement for free.
 */
export function ChecklistItem({ id, text, trailing, dense = false }: ChecklistItemProps) {
  const { isChecked, toggleChecked } = usePortalState();
  const checked = isChecked(id);
  const inputId = `check-${id}`;

  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={inputId}
        checked={checked}
        onChange={() => toggleChecked(id)}
        // 1rem box inside a 1.5rem touch area keeps the target comfortable
        // without inflating the visual weight.
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--portal-accent)]"
      />
      <label
        htmlFor={inputId}
        className={[
          'cursor-pointer',
          dense ? 'text-sm' : '',
          checked ? 'text-ink-muted' : 'text-ink-secondary',
        ].join(' ')}
      >
        <InlineMarkdown text={text} />
      </label>
      {trailing}
    </div>
  );
}
