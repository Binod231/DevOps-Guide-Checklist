import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TrackerRow } from '../content/types';
import { useFocusTrap } from '../state/useFocusTrap';
import { guide } from '../content/registry';

interface TrackerRowModalProps {
  open: boolean;
  onClose: () => void;
  initialRow?: TrackerRow | null;
  onSave: (row: TrackerRow) => void;
}

const CATEGORIES = guide.categories.map((c) => c.title);

export function TrackerRowModal({
  open,
  onClose,
  initialRow,
  onSave,
}: TrackerRowModalProps) {
  const isEditing = Boolean(initialRow);

  const [sn, setSn] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0] ?? 'SCM & CI/CD');
  const [implementationItem, setImplementationItem] = useState('');
  const [implementationBy, setImplementationBy] = useState('');
  const [companyStage, setCompanyStage] = useState('For All');
  const [priority, setPriority] = useState('P1');
  const [status, setStatus] = useState('Not Started');
  const [targetDate, setTargetDate] = useState('');
  const [verificationGate, setVerificationGate] = useState('');
  const [verified, setVerified] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (open) {
      if (initialRow) {
        setSn(initialRow.sn);
        setCategory(initialRow.category);
        setImplementationItem(initialRow.implementationItem);
        setImplementationBy(initialRow.implementationBy);
        setCompanyStage(initialRow.companyStage);
        setPriority(initialRow.priority);
        setStatus(initialRow.status || 'Not Started');
        setTargetDate(initialRow.targetDate);
        setVerificationGate(initialRow.verificationGate);
        setVerified(initialRow.verified);
        setVerifiedBy(initialRow.verifiedBy);
      } else {
        setSn(`ST-${Math.floor(25 + Math.random() * 70)}`);
        setCategory(CATEGORIES[0] ?? 'SCM & CI/CD');
        setImplementationItem('');
        setImplementationBy('');
        setCompanyStage('For All');
        setPriority('P1');
        setStatus('Not Started');
        setTargetDate('');
        setVerificationGate('');
        setVerified('');
        setVerifiedBy('');
      }
    }
  }, [open, initialRow]);

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
    if (!implementationItem.trim()) return;

    const rowKey =
      initialRow?.rowKey ??
      `${sn.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom'}-${Date.now()}`;

    const savedRow: TrackerRow = {
      rowKey,
      sn: sn.trim() || 'ST-CUSTOM',
      category: category.trim(),
      implementationItem: implementationItem.trim(),
      implementationBy: implementationBy.trim(),
      companyStage,
      priority,
      status,
      targetDate,
      verificationGate: verificationGate.trim(),
      verified: verified.trim(),
      verifiedBy: verifiedBy.trim(),
      sourceOrder: initialRow?.sourceOrder ?? 999,
    };

    onSave(savedRow);
    onClose();
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracker-modal-title"
        className="relative my-8 w-full max-w-2xl border border-edge bg-surface p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <h2 id="tracker-modal-title" className="text-base font-semibold text-ink">
            {isEditing ? 'Edit Tracker Item (Admin)' : 'Add New Tracker Item (Admin)'}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-sn" className="block font-medium text-ink-secondary">
                S.N Identifier
              </label>
              <input
                type="text"
                id="modal-sn"
                value={sn}
                onChange={(e) => setSn(e.target.value)}
                required
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>

            <div>
              <label htmlFor="modal-category" className="block font-medium text-ink-secondary">
                Category
              </label>
              <select
                id="modal-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="modal-item" className="block font-medium text-ink-secondary">
              Implementation Item (Required)
            </label>
            <textarea
              id="modal-item"
              value={implementationItem}
              onChange={(e) => setImplementationItem(e.target.value)}
              rows={2}
              required
              placeholder="e.g. Automated smoke test execution on production deployments"
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="modal-priority" className="block font-medium text-ink-secondary">
                Priority
              </label>
              <select
                id="modal-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              >
                <option value="P0">P0 (Critical)</option>
                <option value="P1">P1 (High)</option>
                <option value="P2">P2 (Medium)</option>
              </select>
            </div>

            <div>
              <label htmlFor="modal-stage" className="block font-medium text-ink-secondary">
                Company Stage
              </label>
              <select
                id="modal-stage"
                value={companyStage}
                onChange={(e) => setCompanyStage(e.target.value)}
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              >
                <option value="For All">For All</option>
                <option value="Optional For Startup">Optional For Startup</option>
              </select>
            </div>

            <div>
              <label htmlFor="modal-status" className="block font-medium text-ink-secondary">
                Status
              </label>
              <select
                id="modal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-owner" className="block font-medium text-ink-secondary">
                Implementation By
              </label>
              <input
                type="text"
                id="modal-owner"
                value={implementationBy}
                onChange={(e) => setImplementationBy(e.target.value)}
                placeholder="Team or individual owner"
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>

            <div>
              <label htmlFor="modal-deadline" className="block font-medium text-ink-secondary">
                Target Date / Verify Deadline
              </label>
              <input
                type="date"
                id="modal-deadline"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modal-gate" className="block font-medium text-ink-secondary">
              Verification Gate
            </label>
            <textarea
              id="modal-gate"
              value={verificationGate}
              onChange={(e) => setVerificationGate(e.target.value)}
              rows={2}
              placeholder="What evidence or checks verify this item is complete?"
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-verified" className="block font-medium text-ink-secondary">
                Verified
              </label>
              <input
                type="text"
                id="modal-verified"
                value={verified}
                onChange={(e) => setVerified(e.target.value)}
                placeholder="e.g. Yes / Pending / Verified"
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>

            <div>
              <label htmlFor="modal-verified-by" className="block font-medium text-ink-secondary">
                Verified By
              </label>
              <input
                type="text"
                id="modal-verified-by"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value)}
                placeholder="Verifier name / role"
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>
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
              {isEditing ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
