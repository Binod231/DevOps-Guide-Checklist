import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { PracticeEntry } from '../components/PracticeEntry';
import { PracticeTrackerMeta } from '../components/PracticeTrackerMeta';
import { ChecklistItem } from '../components/ChecklistItem';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { Tabs, type TabDefinition } from '../components/Tabs';
import { TrackerTable } from '../components/TrackerTable';
import { PracticeModal } from '../components/PracticeModal';
import { UI_FLAGS } from '../config/uiFlags';
import {
  ROUTES,
  categoryById,
  guide,
  tracker,
  trackerRowForPractice,
  trackerRowsForGuideCategory,
} from '../content/registry';
import type { GuideCategory, Practice } from '../content/types';
import { displayTitle } from '../content/displayTitle';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';

/**
 * One guide category.
 *
 * Shows its practices in source order, each with the `Implementation complete`
 * checkbox the source provides.
 *
 * When the guide-to-tracker cross-link is enabled, a second tab lists the
 * tracker rows for the same category. Both tabs are non-empty for all six
 * categories; with the flag off, the tab strip is dropped entirely rather than
 * leaving an empty tab behind.
 */
export function GuideCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categoryId ? categoryById.get(categoryId) : undefined;
  const {
    allCategoryPractices,
    addPractice,
    updatePractice,
    deletePractice,
    restorePractices,
    hasDeletedPractices,
    progressForIds,
  } = usePortalState();
  const { isAdmin } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);

  const practices = useMemo(
    () => (category ? allCategoryPractices(category) : []),
    [allCategoryPractices, category],
  );

  if (!category) {
    return <Navigate to={ROUTES.guideCategory(guide.categories[0]!.id)} replace />;
  }

  const index = guide.categories.findIndex((c) => c.id === category.id);
  const previous = index > 0 ? guide.categories[index - 1] : undefined;
  const next = index < guide.categories.length - 1 ? guide.categories[index + 1] : undefined;
  const progress = progressForIds(practices.map((p) => p.id));

  const trackerRows = trackerRowsForGuideCategory(category.id);

  const handleAddPractice = () => {
    setEditingPractice(null);
    setModalOpen(true);
  };

  const handleEditPractice = (practice: Practice) => {
    setEditingPractice(practice);
    setModalOpen(true);
  };

  const handleDeletePractice = (practiceId: string) => {
    deletePractice(practiceId);
  };

  const handleSavePractice = (saved: Practice) => {
    if (editingPractice) {
      updatePractice(saved.id, saved);
    } else {
      addPractice(saved);
    }
  };

  const tabs: TabDefinition[] = [
    {
      id: 'practices',
      label: 'Practices',
      count: practices.length,
      panel: (
        <PracticeList
          category={category}
          practices={practices}
          onEditPractice={isAdmin ? handleEditPractice : undefined}
          onDeletePractice={isAdmin ? handleDeletePractice : undefined}
        />
      ),
    },
  ];

  if (UI_FLAGS.guideTrackerCrossLink && trackerRows.length > 0) {
    tabs.push({
      id: 'tracker-rows',
      label: 'Tracker rows',
      count: trackerRows.length,
      panel: (
        <div className="space-y-3">
          <TrackerTable
            columns={tracker.columns}
            rows={trackerRows}
            sort={null}
            onSortChange={() => {}}
            caption={`Implementation Tracker rows for ${category.title}`}
          />
          <p className="text-xs text-ink-muted">
            Rows are matched to this category by the portal&rsquo;s guide-to-tracker mapping. The
            source documents name these items differently.
          </p>
        </div>
      ),
    });
  }

  return (
    <PageShell>
      <SectionHeader eyebrow={guide.title} heading={category.heading} />

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-edge bg-surface px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-xs border border-accent-border bg-accent-subtle px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
              Admin Mode
            </span>
            <span className="text-ink-muted">
              Full CRUD enabled: create practices, edit attributes, or delete items in this category.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddPractice}
              className="border border-accent-border bg-accent-subtle px-3 py-1 font-semibold text-accent hover:bg-accent-subtle/80"
            >
              + Add Practice
            </button>
            {hasDeletedPractices(category.id) && (
              <button
                type="button"
                onClick={() => restorePractices(category.id)}
                className="border border-edge bg-surface px-2.5 py-1 text-ink-secondary hover:bg-sunken"
              >
                Restore Deleted Practices
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <ProgressIndicator label="Implementation progress" progress={progress} live />
      </div>

      <div className="mt-6">
        {tabs.length > 1 ? (
          <Tabs label={`${category.title} views`} tabs={tabs} />
        ) : (
          <PracticeList
            category={category}
            practices={practices}
            onEditPractice={isAdmin ? handleEditPractice : undefined}
            onDeletePractice={isAdmin ? handleDeletePractice : undefined}
          />
        )}
      </div>

      <nav aria-label="Adjacent categories" className="mt-10 border-t border-edge pt-5">
        <ul className="flex flex-wrap justify-between gap-3">
          <li>
            {previous && (
              <Link
                to={ROUTES.guideCategory(previous.id)}
                title={previous.heading}
                className="text-sm text-accent hover:underline"
              >
                <span aria-hidden="true">&larr; </span>
                {displayTitle(previous.heading)}
              </Link>
            )}
          </li>
          <li>
            {next && (
              <Link
                to={ROUTES.guideCategory(next.id)}
                title={next.heading}
                className="text-sm text-accent hover:underline"
              >
                {displayTitle(next.heading)}
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            )}
          </li>
        </ul>
      </nav>

      <PracticeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPractice={editingPractice}
        categoryId={category.id}
        onSave={handleSavePractice}
      />
    </PageShell>
  );
}

function PracticeList({
  category,
  practices,
  onEditPractice,
  onDeletePractice,
}: {
  category: GuideCategory;
  practices: Practice[];
  onEditPractice?: (practice: Practice) => void;
  onDeletePractice?: (practiceId: string) => void;
}) {
  return (
    <section aria-label={`Practices in ${category.title}`} className="space-y-5">
      {practices.map((practice) => {
        const row = trackerRowForPractice(practice.id);
        return (
          <PracticeEntry
            key={practice.id}
            practice={practice}
            control={<ChecklistItem id={practice.id} text={practice.checkboxLabel} dense />}
            meta={row ? <PracticeTrackerMeta row={row} /> : undefined}
            onEdit={onEditPractice}
            onDelete={onDeletePractice}
          />
        );
      })}
    </section>
  );
}
