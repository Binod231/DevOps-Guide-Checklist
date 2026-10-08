import { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { ChecklistGroup } from '../components/ChecklistGroup';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ChecklistItemModal } from '../components/ChecklistItemModal';
import { checklist } from '../content/registry';
import type { ChecklistItem, Phase } from '../content/types';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';

/**
 * Suggested Implementation Order.
 *
 * The four phases and their 23 items, in source order, with progress scoped
 * per phase and rolled up across the section.
 *
 * This checklist is tracked separately from the guide's `Implementation
 * complete` boxes and from the Production Readiness Gate. The three sets are
 * worded differently in the source documents, so they are never merged or
 * cross-mapped — ticking an item here changes nothing elsewhere.
 */
export function ImplementationOrderPage() {
  const {
    allPhaseItems,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    restoreChecklistItems,
    hasDeletedChecklistItems,
    progressForIds,
  } = usePortalState();
  const { isAdmin } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [targetPhase, setTargetPhase] = useState<Phase | null>(null);

  const phaseItemMap = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const phase of checklist.phases) {
      map.set(phase.id, allPhaseItems(phase));
    }
    return map;
  }, [allPhaseItems]);

  const allItemIds = useMemo(() => {
    const ids: string[] = [];
    for (const items of phaseItemMap.values()) {
      for (const item of items) ids.push(item.id);
    }
    return ids;
  }, [phaseItemMap]);

  const overall = progressForIds(allItemIds);

  const handleAddItem = (phase: Phase) => {
    setTargetPhase(phase);
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEditItem = (phase: Phase, item: ChecklistItem) => {
    setTargetPhase(phase);
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDeleteItem = (itemId: string, phaseId: string) => {
    deleteChecklistItem(itemId, phaseId);
  };

  const handleSaveItem = (text: string) => {
    if (editingItem) {
      updateChecklistItem(editingItem.id, text);
    } else if (targetPhase) {
      addChecklistItem(targetPhase.id, text);
    }
  };

  const hasAnyDeleted = hasDeletedChecklistItems('phase-') || hasDeletedChecklistItems();

  return (
    <PageShell>
      <SectionHeader
        eyebrow={checklist.title}
        heading={checklist.implementationOrderHeading}
      />

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-edge bg-surface px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-xs border border-accent-border bg-accent-subtle px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
              Admin Mode
            </span>
            <span className="text-ink-muted">
              Full CRUD enabled: add new items to any phase, edit wording, or remove checklist items.
            </span>
          </div>
          {hasAnyDeleted && (
            <button
              type="button"
              onClick={() => restoreChecklistItems('phase-')}
              className="border border-edge bg-surface px-2.5 py-1 text-ink-secondary hover:bg-sunken"
            >
              Restore Deleted Items
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        <ProgressIndicator label="Implementation order progress" progress={overall} live />
      </div>

      <div className="mt-6 space-y-5">
        {checklist.phases.map((phase) => {
          const items = phaseItemMap.get(phase.id) ?? phase.items;
          return (
            <ChecklistGroup
              key={phase.id}
              id={phase.id}
              heading={phase.heading}
              items={items}
              onAddItem={isAdmin ? () => handleAddItem(phase) : undefined}
              onEditItem={isAdmin ? (item) => handleEditItem(phase, item) : undefined}
              onDeleteItem={isAdmin ? (itemId) => handleDeleteItem(itemId, phase.id) : undefined}
            />
          );
        })}
      </div>

      <ChecklistItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? 'Edit Implementation Item (Admin)'
            : `Add Item to ${targetPhase?.heading ?? 'Phase'} (Admin)`
        }
        initialText={editingItem?.text ?? ''}
        onSave={handleSaveItem}
      />
    </PageShell>
  );
}
