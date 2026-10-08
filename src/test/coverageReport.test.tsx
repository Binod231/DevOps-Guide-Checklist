/**
 * Rendered-coverage report.
 *
 * The fidelity suite proves the generated content matches the sources. This
 * suite proves the rendered pages actually put that content on screen: every
 * category, practice, field value, phase item, readiness criterion and tracker
 * row, counted from the DOM rather than from the data.
 *
 * It also prints a summary table, so the counts can be read off a test run.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from './renderRoute';
import { ROUTES, allPractices, checklist, guide, tracker } from '../content/registry';
import { displayTitle, stageQualifier } from '../content/displayTitle';

interface Tally {
  label: string;
  rendered: number;
  expected: number;
}

const tallies: Tally[] = [];

function record(label: string, rendered: number, expected: number): void {
  tallies.push({ label, rendered, expected });
  expect(rendered, label).toBe(expected);
}

/** Strips code-span backticks and bold markers for DOM comparison. */
function strip(text: string): string {
  return text.replace(/`/g, '').replace(/\*\*/g, '');
}

afterAll(() => {
  const width = Math.max(...tallies.map((t) => t.label.length));
  const lines = tallies.map(
    (t) =>
      `  ${t.label.padEnd(width)}  ${String(t.rendered).padStart(4)} / ${String(t.expected).padEnd(4)}  ${
        t.rendered === t.expected ? 'OK' : 'MISMATCH'
      }`,
  );
  console.log(
    [
      '',
      '  RENDERED COVERAGE REPORT',
      `  ${'-'.repeat(width + 20)}`,
      ...lines,
      `  ${'-'.repeat(width + 20)}`,
      '',
    ].join('\n'),
  );
});

describe('coverage — guide', () => {
  it('renders all 6 categories as page headings', () => {
    let rendered = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      const h1 = screen.getByRole('heading', { level: 1 });
      if ((h1.textContent ?? '').includes(displayTitle(category.heading))) rendered += 1;
      unmount();
    }
    record('Guide categories', rendered, 6);
  });

  it('shows the stage qualifier beside the title wherever a heading had one', () => {
    const withQualifier = guide.categories.filter((c) => stageQualifier(c.heading));
    let rendered = 0;
    for (const category of withQualifier) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      const text = screen.getByRole('main').textContent ?? '';
      if (text.includes(stageQualifier(category.heading)!)) rendered += 1;
      unmount();
    }
    record('Category stage qualifiers', rendered, withQualifier.length);
  });

  it('renders all 24 practices', () => {
    let rendered = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      rendered += within(screen.getByRole('main')).getAllByRole('article').length;
      unmount();
    }
    record('Guide practices', rendered, 24);
  });

  it('renders all 24 practice checkboxes', () => {
    let rendered = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      rendered += within(screen.getByRole('main')).getAllByRole('checkbox').length;
      unmount();
    }
    record('Guide checkboxes', rendered, 24);
  });

  it('renders all 120 practice field values', () => {
    let rendered = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      const main = screen.getByRole('main');
      for (const practice of category.practices) {
        const article = within(main)
          .getByText(displayTitle(practice.heading))
          .closest('article')!;
        const text = article.textContent ?? '';
        for (const value of [
          practice.description,
          practice.whyItMatters,
          practice.recommendedTools,
          practice.verificationGate,
        ]) {
          if (text.includes(strip(value))) rendered += 1;
        }
        // Key concepts count as one field, matched in full.
        if (practice.keyConcepts.every((c) => text.includes(strip(c)))) rendered += 1;
      }
      unmount();
    }
    record('Guide field values', rendered, 24 * 5);
  });

  it('renders every key concept', () => {
    const expected = allPractices.reduce((n, p) => n + p.keyConcepts.length, 0);
    let rendered = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      const text = screen.getByRole('main').textContent ?? '';
      for (const practice of category.practices) {
        for (const concept of practice.keyConcepts) {
          if (text.includes(strip(concept))) rendered += 1;
        }
      }
      unmount();
    }
    record('Guide key concepts', rendered, expected);
  });

  it('renders the Objective and its 6 principles', () => {
    renderApp(ROUTES.overview);
    const text = screen.getByRole('main').textContent ?? '';
    let rendered = 0;
    if (text.includes(guide.objective.leadParagraph)) rendered += 1;
    if (text.includes(guide.objective.closingParagraph)) rendered += 1;
    for (const principle of guide.objective.principles) {
      if (text.includes(principle.term) && text.includes(principle.detail)) rendered += 1;
    }
    record('Objective paragraphs + principles', rendered, 8);
  });
});

describe('coverage — checklist', () => {
  it('renders all 4 phases and 23 items', () => {
    renderApp(ROUTES.implementationOrder);
    const main = screen.getByRole('main');
    const text = main.textContent ?? '';

    let phases = 0;
    for (const phase of checklist.phases) {
      if (text.includes(phase.heading)) phases += 1;
    }
    record('Phases', phases, 4);

    const boxes = within(main).getAllByRole('checkbox');
    record('Phase items', boxes.length, 23);

    let items = 0;
    for (const phase of checklist.phases) {
      for (const item of phase.items) {
        if (text.includes(strip(item.text))) items += 1;
      }
    }
    record('Phase item texts', items, 23);
  });

  it('renders all 16 readiness criteria', () => {
    renderApp(ROUTES.productionReadiness);
    const main = screen.getByRole('main');

    record('Readiness checkboxes', within(main).getAllByRole('checkbox').length, 16);

    const text = main.textContent ?? '';
    let criteria = 0;
    for (const criterion of checklist.readinessGate.criteria) {
      if (text.includes(strip(criterion.text))) criteria += 1;
    }
    record('Readiness criterion texts', criteria, 16);
  });

  it('renders the notes scaffold in full', () => {
    renderApp(ROUTES.notes);
    const main = screen.getByRole('main');
    const text = main.textContent ?? '';

    let prompts = 0;
    for (const section of checklist.notes.noteSections) {
      if (text.includes(section.heading) && text.includes(section.prompt)) prompts += 1;
    }
    record('Note sections', prompts, 3);

    record(
      'Open issue rows',
      within(within(main).getByRole('region', { name: checklist.notes.openIssuesHeading }))
        .getAllByRole('checkbox').length,
      3,
    );

    let links = 0;
    for (const link of checklist.notes.usefulLinks) {
      if (within(main).queryByRole('textbox', { name: link.label })) links += 1;
    }
    record('Useful link fields', links, 9);
  });
});

describe('coverage — tracker', () => {
  it('renders all 24 rows with all 11 columns', () => {
    renderApp(ROUTES.tracker);
    const table = screen.getByRole('table');

    record('Tracker rows', table.querySelectorAll('tbody tr').length, 24);

    const headers = [...table.querySelectorAll('thead th')].length;
    // 11 source columns plus the portal's Notes and Evidence.
    record('Tracker columns', headers, 13);
  });

  it('renders every S.N as written, duplicate included', () => {
    renderApp(ROUTES.tracker);
    const table = screen.getByRole('table');
    const sn = [...table.querySelectorAll('tbody tr')].map(
      (tr) => tr.children[0]?.textContent?.trim() ?? '',
    );
    record('Tracker S.N values', sn.length, 24);
    expect(sn).toEqual(tracker.rows.map((r) => r.sn));
    expect(sn.filter((s) => s === 'ST-10')).toHaveLength(2);
  });

  it('renders every verification gate', () => {
    renderApp(ROUTES.tracker);
    const text = screen.getByRole('table').textContent ?? '';
    let gates = 0;
    for (const row of tracker.rows) {
      if (text.includes(row.verificationGate.trim())) gates += 1;
    }
    record('Tracker verification gates', gates, 24);
  });
});

describe('coverage — totals', () => {
  it('exposes 63 tracked checkboxes across the three universes', () => {
    let total = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      total += within(screen.getByRole('main')).getAllByRole('checkbox').length;
      unmount();
    }

    const order = renderApp(ROUTES.implementationOrder);
    total += within(screen.getByRole('main')).getAllByRole('checkbox').length;
    order.unmount();

    renderApp(ROUTES.productionReadiness);
    total += within(screen.getByRole('main')).getAllByRole('checkbox').length;

    record('Tracked checkboxes (total)', total, 63);
  });

  it('every tally matched', () => {
    const mismatched = tallies.filter((t) => t.rendered !== t.expected);
    expect(mismatched).toEqual([]);
    expect(tallies.length).toBeGreaterThan(15);
  });
});
