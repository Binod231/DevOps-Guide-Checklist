import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useFocusTrap } from '../state/useFocusTrap';

interface ChecklistItemModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialText?: string;
  onSave: (text: string) => void;
}

export function ChecklistItemModal({
  open,
  onClose,
  title,
  initialText = '',
  onSave,
}: ChecklistItemModalProps) {
  const [text, setText] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (open) {
      setText(initialText);
    }
  }, [open, initialText]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSave(text.trim());
    onClose();
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-item-modal-title"
        className="relative my-8 w-full max-w-lg border border-edge bg-surface p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <h2 id="checklist-item-modal-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="border border-edge p-1 text-ink-muted hover:bg-sunken hover:text-ink"
            aria-label="Close dialog"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label htmlFor="modal-item-text" className="block font-medium text-ink-secondary">
              Checklist Item Description *
            </label>
            <textarea
              id="modal-item-text"
              required
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Ensure all secrets are rotated quarterly and managed via KMS..."
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-sm text-ink"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-edge pt-4">
            <button
              type="button"
              onClick={onClose}
              className="border border-edge bg-surface px-3 py-1.5 text-xs text-ink-secondary hover:bg-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="border border-accent-border bg-accent px-4 py-1.5 text-xs font-medium text-ink-inverse hover:opacity-90"
            >
              Save Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
