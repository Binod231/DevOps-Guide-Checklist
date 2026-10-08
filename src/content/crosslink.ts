/**
 * Guide practice <-> tracker row mapping. (ADDITION 3, see `src/config/uiFlags.ts`.)
 *
 * Neither document states this relationship. Guide headings and tracker item
 * names are worded differently — `Automated Secret Scanning in CI & Pre-Commit
 * Hooks` against `Automated Secret Scanning` — so any link between them is an
 * assertion rather than a quotation.
 *
 * WHY THIS TABLE IS WRITTEN OUT BY HAND
 *
 * Deriving the mapping from position was the obvious approach and it is wrong.
 * The two documents list the same 24 practices in the same six categories, but
 * two categories order their members differently:
 *
 *   Security           guide: ... 2FA, then Container Scanning
 *                      tracker: ST-13 Container Scanning, ST-14 2FA
 *   Disaster Recovery  guide: Database Backups & PITR, then Rollback
 *                      tracker: ST-22 Rollback, ST-23 Database Backups & PITR
 *
 * A positional join silently mislabels those four rows. Fuzzy name matching was
 * rejected for the same reason it is rejected everywhere else in this project:
 * it would quietly invent a correspondence. So the pairs are declared
 * explicitly below, and validated at generation time.
 *
 * ON SOURCE CHANGES
 *
 * `buildGuideTrackerLinks` fails loudly if the table stops covering the
 * documents exactly — an unknown id, a missing practice, a missing row, or a
 * pair that crosses a category boundary. Editing a source document therefore
 * surfaces as a generation error naming what to update, never as a wrong label
 * in the UI.
 */
import type { GuideDocument, GuideTrackerLink, TrackerDocument, TrackerRow } from './types';
import { fail } from './parsers/markdown';

/**
 * The asserted pairs: guide practice slug -> tracker rowKey.
 *
 * Ordered by guide source order. Each pair was read off both documents by hand.
 */
const DECLARED_PAIRS: ReadonlyArray<readonly [practiceId: string, rowKey: string]> = [
  // 1. Source Code Management & CI/CD  <->  SCM & CI/CD
  ['branch-protections-single-pr-approvals', 'st-01--scm-ci-cd'],
  ['automated-ci-pipelines-for-main-pull-requests', 'st-02--scm-ci-cd'],
  ['automated-secret-scanning-in-ci-pre-commit-hooks', 'st-03--scm-ci-cd'],
  ['backward-compatible-database-migrations-expand-and-contract', 'st-04--scm-ci-cd'],
  ['progressive-delivery-canary-deployments-optional-for-startup', 'st-05--scm-ci-cd'],

  // 2. Infrastructure  <->  Infrastructure
  ['managed-application-platforms', 'st-06--infrastructure'],
  ['infrastructure-as-code', 'st-07--infrastructure'],
  [
    'isolated-staging-production-environments-staging-env-is-optional-for-the-startup-or-small-company',
    'st-08--infrastructure',
  ],
  ['edge-security-waf-ingress-rate-limiting-optional-for-startup', 'st-09--infrastructure'],
  ['cloud-finops-guardrails-budget-ceilings', 'st-10--infrastructure'],

  // 3. Testing & Quality  <->  Testing & Quality
  ['automated-core-integration-api-tests', 'st-10--testing-quality'],
  ['pinned-dependencies-automated-security-audits-optional-for-startup', 'st-11--testing-quality'],

  // 4. Security  <->  Security
  // The documents order the middle two in opposite sequence; paired by subject.
  [
    'centralized-secret-environment-variable-management-implement-in-startup-if-they-want-more-security',
    'st-12--security',
  ],
  ['enforced-two-factor-authentication', 'st-14--security'],
  ['automated-container-binary-vulnerability-scanning', 'st-13--security'],
  ['secure-container-registries-access-control', 'st-15--security'],

  // 5. Observability (Optional For Startup)  <->  Observability
  ['centralized-application-exception-tracking', 'st-16--observability'],
  ['structured-log-aggregation-search', 'st-17--observability'],
  ['uptime-monitoring-basic-paging-alerts', 'st-18--observability'],
  ['golden-signals-slis-slo-tracking', 'st-19--observability'],
  ['distributed-apm-opentelemetry-tracing', 'st-20--observability'],
  ['on-call-rotation-and-incident-routing-optional-for-startups', 'st-21--observability'],

  // 6. Disaster Recovery(Optional For Startup)  <->  Disaster Recovery
  // Also ordered in opposite sequence between the documents.
  ['automated-database-backups-point-in-time-recovery', 'st-23--disaster-recovery'],
  ['documented-rollback-procedure-one-click-reverts', 'st-22--disaster-recovery'],
];

/** Tracker categories in first-appearance order. */
export function trackerCategoryOrder(tracker: TrackerDocument): string[] {
  const order: string[] = [];
  for (const row of tracker.rows) {
    if (!order.includes(row.category)) order.push(row.category);
  }
  return order;
}

/** Tracker rows for one tracker category, in canonical file order. */
export function trackerRowsForCategory(tracker: TrackerDocument, category: string): TrackerRow[] {
  return tracker.rows.filter((row) => row.category === category);
}

/**
 * Validates {@link DECLARED_PAIRS} against the parsed documents and returns it
 * as the link list.
 */
export function buildGuideTrackerLinks(
  guide: GuideDocument,
  tracker: TrackerDocument,
): GuideTrackerLink[] {
  const practices = guide.categories.flatMap((c) => c.practices);
  const practiceIds = new Set(practices.map((p) => p.id));
  const rowKeys = new Set(tracker.rows.map((r) => r.rowKey));

  // Guide category index per practice, and tracker category per row, so pairs
  // can be checked for crossing a category boundary.
  const guideCategoryOf = new Map<string, number>();
  guide.categories.forEach((category, index) => {
    for (const practice of category.practices) guideCategoryOf.set(practice.id, index);
  });

  const trackerCategories = trackerCategoryOrder(tracker);
  const trackerCategoryOf = new Map(
    tracker.rows.map((row) => [row.rowKey, trackerCategories.indexOf(row.category)]),
  );

  if (trackerCategories.length !== guide.categories.length) {
    fail(
      `crosslink: guide has ${guide.categories.length} categories but the tracker has ` +
        `${trackerCategories.length}; update DECLARED_PAIRS in src/content/crosslink.ts`,
    );
  }

  const seenPractices = new Set<string>();
  const seenRows = new Set<string>();
  const links: GuideTrackerLink[] = [];

  for (const [practiceId, rowKey] of DECLARED_PAIRS) {
    if (!practiceIds.has(practiceId)) {
      fail(
        `crosslink: declared practice "${practiceId}" is not in the guide; ` +
          `update DECLARED_PAIRS in src/content/crosslink.ts`,
      );
    }
    if (!rowKeys.has(rowKey)) {
      fail(
        `crosslink: declared tracker row "${rowKey}" is not in the tracker; ` +
          `update DECLARED_PAIRS in src/content/crosslink.ts`,
      );
    }
    if (seenPractices.has(practiceId)) {
      fail(`crosslink: practice "${practiceId}" is declared more than once`);
    }
    if (seenRows.has(rowKey)) {
      fail(`crosslink: tracker row "${rowKey}" is declared more than once`);
    }

    const guideIndex = guideCategoryOf.get(practiceId)!;
    const trackerIndex = trackerCategoryOf.get(rowKey)!;
    if (guideIndex !== trackerIndex) {
      fail(
        `crosslink: "${practiceId}" sits in guide category ${guideIndex + 1} but ` +
          `"${rowKey}" sits in tracker category ${trackerIndex + 1}; ` +
          `a pair must not cross a category boundary`,
      );
    }

    seenPractices.add(practiceId);
    seenRows.add(rowKey);
    links.push({ practiceId, rowKey });
  }

  const unlinkedPractices = practices.filter((p) => !seenPractices.has(p.id)).map((p) => p.id);
  if (unlinkedPractices.length > 0) {
    fail(
      `crosslink: ${unlinkedPractices.length} guide practice(s) have no tracker pair: ` +
        `${unlinkedPractices.join(', ')}`,
    );
  }

  const unlinkedRows = tracker.rows.filter((r) => !seenRows.has(r.rowKey)).map((r) => r.rowKey);
  if (unlinkedRows.length > 0) {
    fail(
      `crosslink: ${unlinkedRows.length} tracker row(s) have no guide pair: ` +
        `${unlinkedRows.join(', ')}`,
    );
  }

  return links;
}

/** Exposed for tests that check the table itself rather than its validation. */
export const declaredPairCount = DECLARED_PAIRS.length;
