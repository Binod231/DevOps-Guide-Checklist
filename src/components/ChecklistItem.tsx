import { useState, type ReactNode } from 'react';
import { InlineMarkdown } from './InlineMarkdown';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';
import { ChecklistAcknowledgementModal } from './ChecklistAcknowledgementModal';

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
 * Checkboxes can be toggled by all users (administrators and normal users).
 * Completed items reflect user acknowledgement and administrator verification status.
 */
export function ChecklistItem({ id, text, trailing, dense = false }: ChecklistItemProps) {
  const { isChecked, toggleChecked, checklistAcknowledgement, checklistVerification } = usePortalState();
  const { isVerifiedUser, isAdmin, username } = useAuth();
  const checked = isChecked(id);
  const ack = checklistAcknowledgement(id);
  const verification = checklistVerification(id);
  const [ackModalOpen, setAckModalOpen] = useState(false);
  const inputId = `check-${id}`;

  const isManagedUser =
    Boolean(username) &&
    username !== 'Self-Learner' &&
    username !== 'Normal User' &&
    (isVerifiedUser || isAdmin);

  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={inputId}
        checked={checked}
        onChange={() => toggleChecked(id, isManagedUser ? username : undefined)}
        // 1rem box inside a 1.5rem touch area keeps the target comfortable
        // without inflating the visual weight.
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--portal-accent)]"
      />
      <div className="min-w-0 flex-1">
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

        {checked && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {verification?.verified ? (
              <span
                className="inline-flex items-center gap-1 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                title={`Verified by ${verification.verifiedBy}${verification.notes ? `: ${verification.notes}` : ''}`}
              >
                <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
                Verified by {verification.verifiedBy}
              </span>
            ) : ack?.completedBy ? (
              <span className="inline-flex items-center gap-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                Pending Verification ({ack.completedBy})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-edge bg-surface px-1.5 py-0.5 text-[11px] text-ink-muted">
                Self-Tracked
              </span>
            )}

            {ack?.completedBy ? (
              <button
                type="button"
                onClick={() => setAckModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline hover:text-accent-hover"
                title="View or edit sign-off details"
              >
                Sign-off: {ack.completedBy}
                <span aria-hidden="true">✎</span>
              </button>
            ) : isManagedUser ? (
              <button
                type="button"
                onClick={() => setAckModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline hover:text-accent-hover"
                title="Request administrator verification for this item"
              >
                Request Verification &rarr;
              </button>
            ) : null}
          </div>
        )}
      </div>

      {trailing}

      <ChecklistAcknowledgementModal
        open={ackModalOpen}
        onClose={() => setAckModalOpen(false)}
        itemId={id}
        itemText={text}
      />
    </div>
  );
}
