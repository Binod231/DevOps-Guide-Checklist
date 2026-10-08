import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Practice } from '../content/types';
import { useFocusTrap } from '../state/useFocusTrap';

interface PracticeModalProps {
  open: boolean;
  onClose: () => void;
  initialPractice?: Practice | null;
  categoryId: string;
  onSave: (practice: Practice) => void;
}

export function PracticeModal({
  open,
  onClose,
  initialPractice,
  categoryId,
  onSave,
}: PracticeModalProps) {
  const isEditing = Boolean(initialPractice);

  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [recommendedTools, setRecommendedTools] = useState('');
  const [verificationGate, setVerificationGate] = useState('');
  const [keyConcepts, setKeyConcepts] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (open) {
      if (initialPractice) {
        setHeading(initialPractice.heading);
        setDescription(initialPractice.description);
        setWhyItMatters(initialPractice.whyItMatters);
        setRecommendedTools(initialPractice.recommendedTools);
        setVerificationGate(initialPractice.verificationGate);
        setKeyConcepts(initialPractice.keyConcepts.join(', '));
      } else {
        setHeading('');
        setDescription('');
        setWhyItMatters('');
        setRecommendedTools('');
        setVerificationGate('');
        setKeyConcepts('');
      }
    }
  }, [open, initialPractice]);

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
    if (!heading.trim()) return;

    const id =
      initialPractice?.id ??
      `${categoryId}-practice-${Date.now()}`;

    const concepts = keyConcepts
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const saved: Practice = {
      id,
      categoryId,
      heading: heading.trim(),
      headingRaw: heading.trim(),
      checkboxLabel: 'Implementation complete',
      description: description.trim(),
      whyItMatters: whyItMatters.trim(),
      keyConcepts: concepts.length > 0 ? concepts : ['Best Practices'],
      recommendedTools: recommendedTools.trim(),
      verificationGate: verificationGate.trim(),
      sourceOrder: initialPractice?.sourceOrder ?? 999,
      orderInCategory: initialPractice?.orderInCategory ?? 999,
      sourceLine: initialPractice?.sourceLine ?? 0,
    };

    onSave(saved);
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
        aria-labelledby="practice-modal-title"
        className="relative my-8 w-full max-w-xl border border-edge bg-surface p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-edge pb-3">
          <h2 id="practice-modal-title" className="text-base font-semibold text-ink">
            {isEditing ? 'Edit Practice (Admin)' : 'Add New Practice (Admin)'}
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
            <label htmlFor="modal-practice-heading" className="block font-medium text-ink-secondary">
              Practice Title / Heading *
            </label>
            <input
              type="text"
              id="modal-practice-heading"
              required
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g. Multi-Environment Promotion Pipelines"
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
            />
          </div>

          <div>
            <label htmlFor="modal-practice-description" className="block font-medium text-ink-secondary">
              Description
            </label>
            <textarea
              id="modal-practice-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this practice entails..."
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
            />
          </div>

          <div>
            <label htmlFor="modal-practice-why" className="block font-medium text-ink-secondary">
              Why it matters
            </label>
            <textarea
              id="modal-practice-why"
              rows={2}
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              placeholder="Business value, reliability impact..."
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-practice-tools" className="block font-medium text-ink-secondary">
                Recommended Tools
              </label>
              <input
                type="text"
                id="modal-practice-tools"
                value={recommendedTools}
                onChange={(e) => setRecommendedTools(e.target.value)}
                placeholder="e.g. Terraform, ArgoCD"
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>
            <div>
              <label htmlFor="modal-practice-concepts" className="block font-medium text-ink-secondary">
                Key Concepts (comma-separated)
              </label>
              <input
                type="text"
                id="modal-practice-concepts"
                value={keyConcepts}
                onChange={(e) => setKeyConcepts(e.target.value)}
                placeholder="e.g. GitOps, Drift Detection"
                className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modal-practice-gate" className="block font-medium text-ink-secondary">
              Verification Gate
            </label>
            <textarea
              id="modal-practice-gate"
              rows={2}
              value={verificationGate}
              onChange={(e) => setVerificationGate(e.target.value)}
              placeholder="How this practice is audited or gate-checked..."
              className="mt-1 w-full border border-edge bg-surface px-2.5 py-1.5 text-ink"
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
              {isEditing ? 'Save Changes' : 'Create Practice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
