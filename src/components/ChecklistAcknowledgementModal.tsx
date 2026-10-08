import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';
import { useFocusTrap } from '../state/useFocusTrap';

interface ChecklistAcknowledgementModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemText: string;
}

export function ChecklistAcknowledgementModal({
  open,
  onClose,
  itemId,
  itemText,
}: ChecklistAcknowledgementModalProps) {
  const {
    checklistAcknowledgement,
    setChecklistAcknowledgement,
    checklistVerification,
    verifyChecklistItem,
    unverifyChecklistItem,
  } = usePortalState();
  const { isAdmin, username } = useAuth();

  const ack = checklistAcknowledgement(itemId);
  const verification = checklistVerification(itemId);

  const [completedBy, setCompletedBy] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, modalRef);

  useEffect(() => {
    if (open) {
      setCompletedBy(ack?.completedBy || (isAdmin ? 'Administrator' : 'DevOps Contributor'));
      setCompletedAt(
        ack?.completedAt
          ? new Date(ack.completedAt).toISOString().split('T')[0]!
          : new Date().toISOString().split('T')[0]!,
      );
      setNotes(ack?.notes || '');
      setAdminNotes(verification?.notes || '');
    }
  }, [open, ack, verification, isAdmin]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setChecklistAcknowledgement(itemId, {
      completedBy: completedBy.trim() || 'DevOps Contributor',
      completedAt: completedAt || new Date().toISOString(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    onClose();
  };

  const handleAdminVerify = () => {
    verifyChecklistItem(itemId, username || 'Administrator', adminNotes.trim());
    onClose();
  };

  const handleAdminUnverify = () => {
    unverifyChecklistItem(itemId);
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ack-modal-title"
        className="relative w-full max-w-lg border border-edge bg-surface p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <h2 id="ack-modal-title" className="text-base font-semibold text-ink">
            Checklist Item Sign-off &amp; Verification
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-ink-muted hover:text-ink text-sm px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 border-l-2 border-accent bg-accent-subtle/40 p-2.5 text-xs text-ink-secondary">
          <p className="font-semibold text-ink">Item:</p>
          <p className="mt-0.5 line-clamp-3">{itemText}</p>
        </div>

        {/* Verification Status Banner */}
        <div className="mt-3">
          {verification?.verified ? (
            <div className="rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <svg className="size-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified by {verification.verifiedBy}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  {new Date(verification.verifiedAt).toLocaleDateString()}
                </span>
              </div>
              {verification.notes && (
                <p className="mt-1 text-emerald-700 dark:text-emerald-300 italic">
                  &ldquo;{verification.notes}&rdquo;
                </p>
              )}
              {isAdmin && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleAdminUnverify}
                    className="text-[11px] font-medium text-rose-600 hover:text-rose-700 underline"
                  >
                    Revoke Verification
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                Pending Administrator Verification
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">Awaiting review</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label htmlFor="ack-completed-by" className="block font-medium text-ink">
              Completed / Implemented By:
            </label>
            <input
              type="text"
              id="ack-completed-by"
              value={completedBy}
              onChange={(e) => setCompletedBy(e.target.value)}
              placeholder="e.g. John Doe, DevOps Team, Platform Eng"
              className="mt-1 w-full border border-edge bg-canvas px-2.5 py-1.5 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor="ack-completed-at" className="block font-medium text-ink">
              Completion Date:
            </label>
            <input
              type="date"
              id="ack-completed-at"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="mt-1 w-full border border-edge bg-canvas px-2.5 py-1.5 text-xs text-ink"
            />
          </div>

          <div>
            <label htmlFor="ack-notes" className="block font-medium text-ink">
              Contributor Notes &amp; Implementation Details:
            </label>
            <textarea
              id="ack-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Configured in GitHub repo settings, CI workflow running."
              className="mt-1 w-full border border-edge bg-canvas px-2.5 py-1.5 text-xs text-ink"
            />
          </div>

          {/* Admin Verification Controls inside modal if viewing as Admin */}
          {isAdmin && !verification?.verified && (
            <div className="border-t border-edge pt-3">
              <label htmlFor="ack-admin-notes" className="block font-semibold text-accent">
                Admin Verification Sign-off Notes (Optional):
              </label>
              <textarea
                id="ack-admin-notes"
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g. Verified branch protections active and tested."
                className="mt-1 w-full border border-edge bg-canvas px-2.5 py-1.5 text-xs text-ink"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-edge pt-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-edge px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="border border-edge bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sunken"
            >
              Save Sign-off
            </button>
            {isAdmin && !verification?.verified && (
              <button
                type="button"
                onClick={handleAdminVerify}
                className="border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                Verify &amp; Sign Off
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
