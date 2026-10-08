import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { InlineMarkdown } from '../components/InlineMarkdown';
import { ROUTES, checklist, guide, tracker, totalPhaseItems } from '../content/registry';
import { displayTitle } from '../content/displayTitle';

/**
 * Overview.
 *
 * Renders the guide's `Objective` section exactly as authored: the lead
 * paragraph, the `Operating principles` list, and the closing paragraph. The
 * source repeats itself slightly across the two paragraphs; both are shown
 * because both are in the document.
 */
export function OverviewPage() {
  const { objective } = guide;

  return (
    <PageShell>
      <SectionHeader
        eyebrow={guide.title}
        heading={objective.heading}
        intro={objective.leadParagraph}
      />

      <section aria-labelledby="operating-principles" className="mt-8">
        <h2
          id="operating-principles"
          className="text-sm font-semibold uppercase tracking-wide text-ink-muted"
        >
          {objective.principlesLabel}
        </h2>

        <dl className="mt-3 divide-y divide-edge border border-edge bg-surface">
          {objective.principles.map((principle) => (
            <div
              key={principle.id}
              className="grid gap-1 px-4 py-3 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="font-semibold text-ink">{principle.term}</dt>
              <dd className="text-ink-secondary">
                <InlineMarkdown text={principle.detail} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="portal-measure mt-8 text-ink-secondary">
        <InlineMarkdown text={objective.closingParagraph} />
      </p>

      <nav aria-labelledby="portal-contents" className="mt-10 border-t border-edge pt-6">
        <h2 id="portal-contents" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Contents
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {guide.categories.map((category) => (
            <li key={category.id}>
              <Link
                to={ROUTES.guideCategory(category.id)}
                title={category.heading}
                className="flex items-baseline justify-between gap-3 border border-edge bg-surface px-3 py-2 text-sm text-ink-secondary hover:border-accent-border hover:bg-accent-subtle"
              >
                <span>{displayTitle(category.heading)}</span>
                <span aria-hidden="true" className="shrink-0 text-xs text-ink-muted tabular-nums">
                  {category.practices.length}
                </span>
                <span className="sr-only">{`, ${category.practices.length} practices`}</span>
              </Link>
            </li>
          ))}

          <li>
            <Link
              to={ROUTES.implementationOrder}
              className="flex items-baseline justify-between gap-3 border border-edge bg-surface px-3 py-2 text-sm text-ink-secondary hover:border-accent-border hover:bg-accent-subtle"
            >
              <span>{checklist.implementationOrderHeading}</span>
              <span aria-hidden="true" className="shrink-0 text-xs text-ink-muted tabular-nums">
                {totalPhaseItems()}
              </span>
              <span className="sr-only">{`, ${totalPhaseItems()} items`}</span>
            </Link>
          </li>
          <li>
            <Link
              to={ROUTES.productionReadiness}
              className="flex items-baseline justify-between gap-3 border border-edge bg-surface px-3 py-2 text-sm text-ink-secondary hover:border-accent-border hover:bg-accent-subtle"
            >
              <span>{checklist.readinessGate.heading}</span>
              <span aria-hidden="true" className="shrink-0 text-xs text-ink-muted tabular-nums">
                {checklist.readinessGate.criteria.length}
              </span>
              <span className="sr-only">
                {`, ${checklist.readinessGate.criteria.length} criteria`}
              </span>
            </Link>
          </li>
          <li>
            <Link
              to={ROUTES.tracker}
              className="flex items-baseline justify-between gap-3 border border-edge bg-surface px-3 py-2 text-sm text-ink-secondary hover:border-accent-border hover:bg-accent-subtle"
            >
              <span>{checklist.trackerLinkLabel}</span>
              <span aria-hidden="true" className="shrink-0 text-xs text-ink-muted tabular-nums">
                {tracker.rows.length}
              </span>
              <span className="sr-only">{`, ${tracker.rows.length} rows`}</span>
            </Link>
          </li>
          <li>
            <Link
              to={ROUTES.notes}
              className="flex items-baseline justify-between gap-3 border border-edge bg-surface px-3 py-2 text-sm text-ink-secondary hover:border-accent-border hover:bg-accent-subtle"
            >
              <span>{checklist.notes.heading}</span>
            </Link>
          </li>
        </ul>
      </nav>
    </PageShell>
  );
}
