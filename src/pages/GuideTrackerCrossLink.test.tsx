import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import { main, practiceArticle } from '../test/queries';
import {
  ROUTES,
  allPractices,
  guide,
  guideTrackerLinks,
  practiceForTrackerRow,
  tracker,
  trackerRowForPractice,
  trackerRowsForGuideCategory,
} from '../content/registry';
import type { Practice } from '../content/types';

// `main` and `practiceArticle` come from the shared query helpers.

/** The tracker metadata strip on a practice. */
function metaStrip(practice: Practice): HTMLElement {
  const article = practiceArticle(practice);
  const dl = article.querySelector('dl:not([data-practice-fields])');
  if (!dl) throw new Error(`No metadata strip for "${practice.heading}"`);
  return dl as HTMLElement;
}

/** The label row of a practice's metadata strip. */
function metaLabels(practice: Practice): (string | null)[] {
  return [...metaStrip(practice).querySelectorAll('dt')].map((t) => t.textContent);
}

describe('cross-link mapping — coverage', () => {
  it('links all 24 practices to all 24 rows, with no duplicates', () => {
    expect(guideTrackerLinks).toHaveLength(24);
    expect(new Set(guideTrackerLinks.map((l) => l.practiceId)).size).toBe(24);
    expect(new Set(guideTrackerLinks.map((l) => l.rowKey)).size).toBe(24);
  });

  it('resolves a row for every practice', () => {
    for (const practice of allPractices) {
      expect(trackerRowForPractice(practice.id), practice.heading).toBeDefined();
    }
  });

  it('resolves a practice for every row, leaving no orphans', () => {
    for (const row of tracker.rows) {
      expect(practiceForTrackerRow(row.rowKey), row.sn).toBeDefined();
    }
  });

  it('round-trips in both directions', () => {
    for (const practice of allPractices) {
      const row = trackerRowForPractice(practice.id)!;
      expect(practiceForTrackerRow(row.rowKey)!.id).toBe(practice.id);
    }
  });
});

describe('practice metadata strip', () => {
  it('shows S.N, Priority, Company Stage and Status for every practice', () => {
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      for (const practice of category.practices) {
        expect(metaLabels(practice), practice.heading).toEqual([
          'S.N',
          'Priority',
          'Company Stage',
          'Status',
        ]);
      }
      unmount();
    }
  });

  it('keeps Company Stage in the metadata, even though the title drops it', () => {
    renderApp(ROUTES.guideCategory('5-observability-optional-for-startup'));
    const apm = allPractices.find((p) => p.heading === 'Distributed APM & OpenTelemetry Tracing')!;
    expect(metaStrip(apm)).toHaveTextContent('Optional For Startup');
  });

  it('shows the linked row values, not a neighbouring row', () => {
    renderApp(ROUTES.guideCategory('4-security'));

    const twoFactor = allPractices.find((p) => p.heading === 'Enforced Two-Factor Authentication')!;
    expect(metaStrip(twoFactor)).toHaveTextContent('ST-14');

    const scanning = allPractices.find(
      (p) => p.heading === 'Automated Container & Binary Vulnerability Scanning',
    )!;
    expect(metaStrip(scanning)).toHaveTextContent('ST-13');
  });

  it('handles the Disaster Recovery pair the documents order differently', () => {
    renderApp(ROUTES.guideCategory('6-disaster-recovery-optional-for-startup'));

    const backups = allPractices.find(
      (p) => p.heading === 'Automated Database Backups & Point-in-Time Recovery',
    )!;
    expect(metaStrip(backups)).toHaveTextContent('ST-23');

    const rollback = allPractices.find(
      (p) => p.heading === 'Documented Rollback Procedure & One-Click Reverts',
    )!;
    expect(metaStrip(rollback)).toHaveTextContent('ST-22');
  });

  it('maps each duplicate ST-10 row to its own practice', () => {
    const finops = allPractices.find(
      (p) => p.heading === 'Cloud FinOps Guardrails & Budget Ceilings',
    )!;
    const first = renderApp(ROUTES.guideCategory(finops.categoryId));
    expect(metaStrip(finops)).toHaveTextContent('ST-10');
    expect(metaStrip(finops)).toHaveTextContent('P0');
    first.unmount();

    const coreTests = allPractices.find(
      (p) => p.heading === 'Automated Core Integration & API Tests',
    )!;
    renderApp(ROUTES.guideCategory(coreTests.categoryId));
    expect(metaStrip(coreTests)).toHaveTextContent('ST-10');
  });

  it('shows the priority and stage from the linked row', () => {
    renderApp(ROUTES.guideCategory('5-observability-optional-for-startup'));
    const apm = allPractices.find((p) => p.heading === 'Distributed APM & OpenTelemetry Tracing')!;
    const strip = metaStrip(apm);
    expect(strip).toHaveTextContent('ST-20');
    expect(strip).toHaveTextContent('P2');
    expect(strip).toHaveTextContent('Optional For Startup');
  });

  it("shows ST-20's corrected status on the practice too", () => {
    renderApp(ROUTES.guideCategory('5-observability-optional-for-startup'));
    const apm = allPractices.find((p) => p.heading === 'Distributed APM & OpenTelemetry Tracing')!;
    expect(metaStrip(apm)).toHaveTextContent('Not Started');
    expect(metaStrip(apm)).not.toHaveTextContent('No status recorded in the source');
  });

  it('reflects a status edited on the tracker page', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.tracker);
    await user.selectOptions(
      screen.getByLabelText('Status for ST-07, Infrastructure'),
      'In Progress',
    );
    first.unmount();

    renderApp(ROUTES.guideCategory('2-infrastructure'));
    const iac = allPractices.find((p) => p.heading === 'Infrastructure as Code')!;
    expect(metaStrip(iac)).toHaveTextContent('In Progress');
  });

  it('keeps the practice checkbox separate from the tracker status', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory('2-infrastructure'));
    const iac = allPractices.find((p) => p.heading === 'Infrastructure as Code')!;

    await user.click(within(practiceArticle(iac)).getByRole('checkbox'));
    // Ticking the guide checkbox must not silently advance the tracker status.
    expect(metaStrip(iac)).toHaveTextContent('Not Started');
  });
});

describe('category tabs', () => {
  function tablist(): HTMLElement {
    return within(main()).getByRole('tablist');
  }

  /** Tab label with the count badge and screen-reader text removed. */
  function tabLabel(tab: HTMLElement): string {
    const clone = tab.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.sr-only, [aria-hidden="true"]').forEach((el) => el.remove());
    return (clone.textContent ?? '').trim();
  }

  it('offers the same two tabs on every category, never an empty one', () => {
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      const tabs = within(tablist()).getAllByRole('tab');
      expect(tabs.map(tabLabel), category.heading).toEqual(['Practices', 'Tracker rows']);
      unmount();
    }
  });

  it('shows the real counts on both tabs', () => {
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      const [practices, rows] = within(tablist()).getAllByRole('tab');
      expect(practices).toHaveAccessibleName(
        new RegExp(`, ${category.practices.length} items$`),
      );
      expect(rows).toHaveAccessibleName(
        new RegExp(`, ${trackerRowsForGuideCategory(category.id).length} items$`),
      );
      unmount();
    }
  });

  it('opens on the Practices tab', () => {
    renderApp(ROUTES.guideCategory('4-security'));
    const [practices, rows] = within(tablist()).getAllByRole('tab');
    expect(practices).toHaveAttribute('aria-selected', 'true');
    expect(rows).toHaveAttribute('aria-selected', 'false');
    expect(within(main()).getAllByRole('article')).toHaveLength(4);
  });

  it('switches to the tracker rows tab on click', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory('4-security'));

    await user.click(within(tablist()).getByRole('tab', { name: /^Tracker rows/ }));
    const table = within(main()).getByRole('table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(within(main()).queryAllByRole('article')).toHaveLength(0);
  });

  it('lists exactly the rows for that category', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory('4-security'));

    await user.click(within(tablist()).getByRole('tab', { name: /^Tracker rows/ }));
    const table = within(main()).getByRole('table');
    const sn = [...table.querySelectorAll('tbody tr')].map(
      (tr) => tr.children[0]?.textContent?.trim() ?? '',
    );
    expect(sn.sort()).toEqual(['ST-12', 'ST-13', 'ST-14', 'ST-15']);
  });

  it('matches rows by the declared mapping, not by category name', async () => {
    const user = userEvent.setup();
    // The guide heading is `1. Source Code Management & CI/CD`; the tracker
    // calls the same category `SCM & CI/CD`.
    renderApp(ROUTES.guideCategory('1-source-code-management-ci-cd'));

    await user.click(within(tablist()).getByRole('tab', { name: /^Tracker rows/ }));
    const table = within(main()).getByRole('table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(table).toHaveTextContent('SCM & CI/CD');
  });

  it('notes that the mapping is the portal\u2019s, not the document\u2019s', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory('3-testing-quality'));

    await user.click(within(tablist()).getByRole('tab', { name: /^Tracker rows/ }));
    expect(
      within(main()).getByText(/matched to this category by the portal/i),
    ).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory('4-security'));
    const [practices] = within(tablist()).getAllByRole('tab');

    practices!.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(tablist()).getByRole('tab', { name: /^Tracker rows/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.keyboard('{ArrowLeft}');
    expect(within(tablist()).getByRole('tab', { name: /^Practices/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('wires each tab to its panel', () => {
    renderApp(ROUTES.guideCategory('4-security'));
    for (const tab of within(tablist()).getAllByRole('tab')) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      const panel = document.getElementById(panelId!);
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    }
  });

  it('uses a roving tab index', () => {
    renderApp(ROUTES.guideCategory('4-security'));
    const [practices, rows] = within(tablist()).getAllByRole('tab');
    expect(practices).toHaveAttribute('tabindex', '0');
    expect(rows).toHaveAttribute('tabindex', '-1');
  });

  it('keeps the practice checkboxes working on the first tab', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory('3-testing-quality'));

    const boxes = within(main()).getAllByRole('checkbox');
    await user.click(boxes[0]!);
    expect(boxes[0]).toBeChecked();
  });
});
