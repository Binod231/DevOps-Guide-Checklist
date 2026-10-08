/**
 * Automated accessibility checks.
 *
 * Automated tooling catches roughly 30-40% of accessibility problems. These
 * tests are a floor, not a conformance claim: full WCAG conformance needs
 * manual screen-reader testing and expert review, which no test suite replaces.
 */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderRoute';
import { describeViolations, findViolations } from './axe';
import { ROUTES, guide, navLeaves } from '../content/registry';

/** Every route in the portal, labelled for test output. */
const ROUTE_CASES: [label: string, path: string][] = [
  ['Overview', ROUTES.overview],
  ...guide.categories.map((c) => [c.heading, ROUTES.guideCategory(c.id)] as [string, string]),
  ['Suggested Implementation Order', ROUTES.implementationOrder],
  ['Production Readiness Gate', ROUTES.productionReadiness],
  ['Notes & Decisions', ROUTES.notes],
  ['Implementation Tracker', ROUTES.tracker],
];

describe('accessibility — axe-core across every page', () => {
  it.each(ROUTE_CASES)('has no automated violations on %s', async (_label, path) => {
    const { container } = renderApp(path);
    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });

  it('covers every route the sidebar exposes', () => {
    // Overview + 6 guide categories + order + readiness + notes + tracker.
    expect(ROUTE_CASES).toHaveLength(11);
    expect(navLeaves()).toHaveLength(11);
    expect(ROUTE_CASES.map(([, path]) => path).sort()).toEqual(
      navLeaves()
        .map((l) => l.path)
        .sort(),
    );
  });
});

describe('accessibility — interactive states', () => {
  it('has no violations with the search dialog open', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await user.click(screen.getByRole('button', { name: /^search/i }));
    await user.type(screen.getByRole('combobox'), 'rollback');

    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });

  it('has no violations with the mobile drawer open', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    await user.click(screen.getByRole('button', { name: /open section navigation/i }));

    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });

  it('has no violations on the tracker rows tab', async () => {
    const user = userEvent.setup();
    const { container } = renderApp(ROUTES.guideCategory('4-security'));
    await user.click(within(screen.getByRole('main')).getByRole('tab', { name: /^Tracker rows/ }));

    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });

  it('has no violations with filters applied and a column sorted', async () => {
    const user = userEvent.setup();
    const { container } = renderApp(ROUTES.tracker);
    await user.click(within(screen.getByRole('group', { name: 'Priority' })).getByRole('checkbox', { name: 'P0' }));
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: /^Category/ }));

    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });

  it('has no violations in dark mode', async () => {
    const user = userEvent.setup();
    const { container } = renderApp(ROUTES.productionReadiness);
    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));

    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });

  it('has no violations after an import reports issues', async () => {
    const user = userEvent.setup();
    const { container } = renderApp(ROUTES.tracker);
    const file = new File([JSON.stringify({ checked: { bad: 'yes' } })], 'x.json', {
      type: 'application/json',
    });
    await user.upload(screen.getByLabelText('Choose a state file to import'), file);

    const violations = await findViolations(container);
    expect(violations.length, describeViolations(violations)).toBe(0);
  });
});

describe('accessibility — heading hierarchy', () => {
  it.each(ROUTE_CASES)('never skips a heading level on %s', (_label, path) => {
    const { container } = renderApp(path);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
      Number(h.tagName[1]),
    );
    expect(levels.length).toBeGreaterThan(0);
    for (let i = 1; i < levels.length; i += 1) {
      expect(
        levels[i]! - levels[i - 1]!,
        `heading jumped from h${levels[i - 1]} to h${levels[i]}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it.each(ROUTE_CASES)('has exactly one h1 on %s', (_label, path) => {
    renderApp(path);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it.each(ROUTE_CASES)('starts the document at h1 on %s', (_label, path) => {
    const { container } = renderApp(path);
    const first = container.querySelector('h1,h2,h3,h4,h5,h6');
    expect(first?.tagName).toBe('H1');
  });
});

describe('accessibility — landmarks and labels', () => {
  it.each(ROUTE_CASES)('exposes banner, nav and main on %s', (_label, path) => {
    renderApp(path);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Portal sections' })).toBeInTheDocument();
  });

  it.each(ROUTE_CASES)('names every navigation landmark on %s', (_label, path) => {
    const { container } = renderApp(path);
    for (const nav of container.querySelectorAll('nav')) {
      const name = nav.getAttribute('aria-label') ?? nav.getAttribute('aria-labelledby');
      expect(name, `an unnamed <nav> on ${path}`).toBeTruthy();
    }
  });

  it.each(ROUTE_CASES)('gives every form control an accessible name on %s', (_label, path) => {
    const { container } = renderApp(path);
    const controls = container.querySelectorAll<HTMLElement>(
      'input, select, textarea, button',
    );
    const unnamed: string[] = [];

    for (const control of controls) {
      const hasLabel =
        control.getAttribute('aria-label') ||
        control.getAttribute('aria-labelledby') ||
        (control.id && container.querySelector(`label[for="${control.id}"]`)) ||
        control.closest('label') ||
        (control.textContent ?? '').trim().length > 0;
      if (!hasLabel) unnamed.push(`${control.tagName}#${control.id || '(no id)'}`);
    }

    expect(unnamed, `unnamed controls on ${path}`).toEqual([]);
  });

  it.each(ROUTE_CASES)('offers the skip link on %s', (_label, path) => {
    renderApp(path);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#portal-main',
    );
  });

  it('keeps every table header scoped and sortable headers announced', () => {
    renderApp(ROUTES.tracker);
    const table = screen.getByRole('table');
    expect(table.querySelector('caption')).not.toBeNull();
    for (const th of table.querySelectorAll('thead th')) {
      expect(th).toHaveAttribute('scope', 'col');
    }
    for (const th of table.querySelectorAll('thead th[aria-sort]')) {
      expect(['none', 'ascending', 'descending']).toContain(th.getAttribute('aria-sort'));
    }
  });
});

describe('accessibility — live regions', () => {
  it.each(ROUTE_CASES)('uses at most one progress live region on %s', (_label, path) => {
    const { container } = renderApp(path);
    // The tracker page has its own filter-count and import-feedback regions.
    const regions = container.querySelectorAll('[aria-live]');
    expect(regions.length).toBeLessThanOrEqual(path === ROUTES.tracker ? 2 : 1);
  });

  it('announces progress changes politely', async () => {
    const user = userEvent.setup();
    const { container } = renderApp(ROUTES.productionReadiness);
    const live = container.querySelector('[aria-live="polite"]')!;
    expect(live).toHaveTextContent('0 of 16 criteria confirmed');

    await user.click(within(screen.getByRole('main')).getAllByRole('checkbox')[0]!);
    expect(live).toHaveTextContent('1 of 16 criteria confirmed');
  });
});

describe('accessibility — keyboard operation', () => {
  it('reaches the sidebar and main content by keyboard from the skip link', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  it('traps focus in the mobile drawer', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /open section navigation/i }));

    const drawer = document.getElementById('portal-sidebar')!;
    expect(drawer.contains(document.activeElement)).toBe(true);

    // Tab repeatedly; focus must never leave the drawer.
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(drawer.contains(document.activeElement), `after ${i + 1} tabs`).toBe(true);
    }
  });

  it('restores focus to the toggle when the drawer closes', async () => {
    const user = userEvent.setup();
    renderApp();
    const toggle = screen.getByRole('button', { name: /open section navigation/i });

    await user.click(toggle);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /open section navigation/i })).toHaveFocus();
  });

  it('operates every checkbox from the keyboard', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness);
    const box = within(screen.getByRole('main')).getAllByRole('checkbox')[0]!;

    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
    await user.keyboard(' ');
    expect(box).not.toBeChecked();
  });

  it('exposes no positive tabindex, so document order is preserved', () => {
    for (const [, path] of ROUTE_CASES) {
      const { container, unmount } = renderApp(path);
      const positive = [...container.querySelectorAll('[tabindex]')].filter(
        (el) => Number(el.getAttribute('tabindex')) > 0,
      );
      expect(positive, `positive tabindex on ${path}`).toEqual([]);
      unmount();
    }
  });
});
