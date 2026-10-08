import { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { ChecklistItem } from '../components/ChecklistItem';
import { ReadinessGatePanel } from '../components/ReadinessGatePanel';
import { ChecklistItemModal } from '../components/ChecklistItemModal';
import { checklist } from '../content/registry';
import type { ChecklistItem as ChecklistItemType } from '../content/types';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';

/**
 * Production Readiness Gate.
 *
 * The document's lead-in sentence followed by its 16 criteria, verbatim and in
 * source order. Readiness is computed from these 16 criteria alone — the guide
 * practices and the implementation-order phases are tracked separately and are
 * never folded into this figure.
 */
export function ProductionReadinessPage() {
  const {
    allReadinessCriteria,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    restoreChecklistItems,
    hasDeletedChecklistItems,
    progressForIds,
  } = usePortalState();
  const { isAdmin } = useAuth();
  const { readinessGate } = checklist;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<ChecklistItemType | null>(null);

  const criteria = useMemo(
    () => allReadinessCriteria(readinessGate.criteria),
    [allReadinessCriteria, readinessGate.criteria],
  );

  const progress = progressForIds(criteria.map((c) => c.id));

  const handleAddCriterion = () => {
    setEditingCriterion(null);
    setModalOpen(true);
  };

  const handleEditCriterion = (criterion: ChecklistItemType) => {
    setEditingCriterion(criterion);
    setModalOpen(true);
  };

  const handleDeleteCriterion = (id: string) => {
    deleteChecklistItem(id, 'readiness');
  };

  const handleSaveCriterion = (text: string) => {
    if (editingCriterion) {
      updateChecklistItem(editingCriterion.id, text);
    } else {
      addChecklistItem('readiness', text);
    }
  };

  return (
    <PageShell>
      <SectionHeader
        eyebrow={checklist.title}
        heading={readinessGate.heading}
        intro={readinessGate.intro}
      />

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-edge bg-surface px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-xs border border-accent-border bg-accent-subtle px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
              Admin Mode
            </span>
            <span className="text-ink-muted">
              Full CRUD enabled: create readiness criteria, update standards, or remove criteria.
            </span>
          </div>
          {hasDeletedChecklistItems('readiness') && (
            <button
              type="button"
              onClick={() => restoreChecklistItems('readiness')}
              className="border border-edge bg-surface px-2.5 py-1 text-ink-secondary hover:bg-sunken"
            >
              Restore Deleted Criteria
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        <ReadinessGatePanel progress={progress} />
      </div>

      <section aria-labelledby="readiness-criteria" className="mt-6 border border-edge bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-sunken px-4 py-3">
          <h2
            id="readiness-criteria"
            className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
          >
            Criteria ({criteria.length})
          </h2>
          {isAdmin && (
            <button
              type="button"
              onClick={handleAddCriterion}
              className="border border-accent-border bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-subtle/80"
            >
              + Add Criterion
            </button>
          )}
        </div>

        <ol className="divide-y divide-edge">
          {criteria.map((criterion, index) => (
            <li key={criterion.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 w-5 shrink-0 text-right font-mono text-xs text-ink-muted tabular-nums"
                >
                  {index + 1}
                </span>
                <ChecklistItem id={criterion.id} text={criterion.text} dense />
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditCriterion(criterion)}
                    aria-label={`Edit criterion ${index + 1}`}
                    className="border border-edge bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:border-accent hover:bg-sunken"
                    title="Edit criterion"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCriterion(criterion.id)}
                    aria-label={`Delete criterion ${index + 1}`}
                    className="border border-rose-200 bg-rose-50/50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400"
                    title="Delete criterion"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <ChecklistItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingCriterion
            ? 'Edit Readiness Criterion (Admin)'
            : 'Add New Readiness Criterion (Admin)'
        }
        initialText={editingCriterion?.text ?? ''}
        onSave={handleSaveCriterion}
      />
    </PageShell>
  );
}
