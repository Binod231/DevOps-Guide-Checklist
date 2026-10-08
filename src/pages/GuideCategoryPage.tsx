import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { PracticeEntry } from '../components/PracticeEntry';
import { PracticeTrackerMeta } from '../components/PracticeTrackerMeta';
import { ChecklistItem } from '../components/ChecklistItem';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { Tabs, type TabDefinition } from '../components/Tabs';
import { TrackerTable } from '../components/TrackerTable';
import { UI_FLAGS } from '../config/uiFlags';
import {
  ROUTES,
  categoryById,
  guide,
  tracker,
  trackerRowForPractice,
  trackerRowsForGuideCategory,
} from '../content/registry';
import type { GuideCategory } from '../content/types';
import { usePortalState } from '../state/PortalStateProvider';

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
  const { progressForIds } = usePortalState();

  if (!category) {
    return <Navigate to={ROUTES.guideCategory(guide.categories[0]!.id)} replace />;
  }

  const index = guide.categories.findIndex((c) => c.id === category.id);
  const previous = index > 0 ? guide.categories[index - 1] : undefined;
  const next = index < guide.categories.length - 1 ? guide.categories[index + 1] : undefined;
  const progress = progressForIds(category.practices.map((p) => p.id));

  const trackerRows = trackerRowsForGuideCategory(category.id);

  const tabs: TabDefinition[] = [
    {
      id: 'practices',
      label: 'Practices',
      count: category.practices.length,
      panel: <PracticeList category={category} />,
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

      <div className="mt-6">
        <ProgressIndicator label="Implementation progress" progress={progress} live />
      </div>

      <div className="mt-6">
        {tabs.length > 1 ? (
          <Tabs label={`${category.title} views`} tabs={tabs} />
        ) : (
          <PracticeList category={category} />
        )}
      </div>

      <nav aria-label="Adjacent categories" className="mt-10 border-t border-edge pt-5">
        <ul className="flex flex-wrap justify-between gap-3">
          <li>
            {previous && (
              <Link
                to={ROUTES.guideCategory(previous.id)}
                className="text-sm text-accent hover:underline"
              >
                <span aria-hidden="true">&larr; </span>
                {previous.heading}
              </Link>
            )}
          </li>
          <li>
            {next && (
              <Link
                to={ROUTES.guideCategory(next.id)}
                className="text-sm text-accent hover:underline"
              >
                {next.heading}
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </PageShell>
  );
}

function PracticeList({ category }: { category: GuideCategory }) {
  return (
    <section aria-label={`Practices in ${category.title}`} className="space-y-5">
      {category.practices.map((practice) => {
        const row = trackerRowForPractice(practice.id);
        return (
          <PracticeEntry
            key={practice.id}
            practice={practice}
            control={<ChecklistItem id={practice.id} text={practice.checkboxLabel} dense />}
            meta={row ? <PracticeTrackerMeta row={row} /> : undefined}
          />
        );
      })}
    </section>
  );
}
