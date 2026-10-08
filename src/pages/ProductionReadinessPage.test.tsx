import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import {
  GUIDE_CHECKLIST,
  PHASE_CHECKLIST,
  ROUTES,
  checkboxIds,
  checklist,
} from '../content/registry';
import { computeProgress, loadState } from '../state/portalState';

const { readinessGate } = checklist;

function main(): HTMLElement {
  return screen.getByRole('main');
}

function boxes(): HTMLElement[] {
  return within(main()).getAllByRole('checkbox');
}

function gatePanel(): HTMLElement {
  return within(main()).getByRole('region', { name: 'Readiness status' });
}

function stat(label: 'Criteria' | 'Confirmed' | 'Outstanding'): string {
  return within(gatePanel()).getByText(label).nextElementSibling?.textContent ?? '';
}

async function confirmAll(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  for (const box of boxes()) await user.click(box);
}

describe('production readiness page — content', () => {
  it('renders the gate heading as the page h1', () => {
    renderApp(ROUTES.productionReadiness);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(readinessGate.heading);
  });

  it('renders the lead-in sentence with its emphasis intact', () => {
    renderApp(ROUTES.productionReadiness);
    // Source: `Before calling the system **production-ready**, confirm:`
    const strong = within(main()).getByText('production-ready');
    expect(strong.tagName).toBe('STRONG');
    expect(main()).toHaveTextContent('Before calling the system production-ready, confirm:');
  });

  it('renders exactly 16 criteria', () => {
    renderApp(ROUTES.productionReadiness);
    expect(boxes()).toHaveLength(16);
    expect(readinessGate.criteria).toHaveLength(16);
  });

  it('renders every criterion verbatim and in source order', () => {
    renderApp(ROUTES.productionReadiness);
    const labels = boxes().map(
      (box) => document.querySelector(`label[for="${box.id}"]`)?.textContent ?? '',
    );
    expect(labels).toEqual(readinessGate.criteria.map((c) => c.text));
  });

  it('numbers the criteria without altering their text', () => {
    renderApp(ROUTES.productionReadiness);
    const items = within(main()).getAllByRole('listitem');
    const criteriaItems = items.filter((li) => li.querySelector('input[type="checkbox"]'));
    expect(criteriaItems).toHaveLength(16);
    expect(criteriaItems[0]).toHaveTextContent(readinessGate.criteria[0]!.text);
  });

  it('adds no criteria beyond the sixteen in the document', () => {
    renderApp(ROUTES.productionReadiness);
    const labels = boxes().map(
      (box) => document.querySelector(`label[for="${box.id}"]`)?.textContent ?? '',
    );
    const sourceTexts = new Set(readinessGate.criteria.map((c) => c.text));
    for (const label of labels) expect(sourceTexts.has(label), label).toBe(true);
  });

  it('starts every criterion unconfirmed', () => {
    renderApp(ROUTES.productionReadiness);
    for (const box of boxes()) expect(box).not.toBeChecked();
  });
});

describe('production readiness page — gate panel', () => {
  it('reports Not Started at zero', () => {
    renderApp(ROUTES.productionReadiness);
    expect(gatePanel()).toHaveTextContent('Not Started');
    expect(gatePanel()).toHaveTextContent('0%');
    expect(stat('Criteria')).toBe('16');
    expect(stat('Confirmed')).toBe('0');
    expect(stat('Outstanding')).toBe('16');
  });

  it('shows 0 / 16 initially', () => {
    renderApp(ROUTES.productionReadiness);
    expect(gatePanel()).toHaveTextContent('0 / 16');
  });

  it('moves out of Not Started once a criterion is confirmed', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness);

    await user.click(boxes()[0]!);
    expect(stat('Confirmed')).toBe('1');
    expect(stat('Outstanding')).toBe('15');
    expect(gatePanel()).not.toHaveTextContent('Not Started');
    expect(gatePanel()).toHaveTextContent('In review');
  });

  it('does not report the gate as met while any criterion is outstanding', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness);

    // 15 of 16.
    for (const box of boxes().slice(0, 15)) await user.click(box);
    expect(stat('Confirmed')).toBe('15');
    expect(stat('Outstanding')).toBe('1');
    expect(gatePanel()).not.toHaveTextContent('All criteria confirmed');
    expect(gatePanel()).toHaveTextContent('94%');
  });

  it('reports the gate as met only at 16 of 16', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness);

    await confirmAll(user);
    expect(stat('Confirmed')).toBe('16');
    expect(stat('Outstanding')).toBe('0');
    expect(gatePanel()).toHaveTextContent('All criteria confirmed');
    expect(gatePanel()).toHaveTextContent('100%');
  });

  it('announces readiness in a polite live region', () => {
    renderApp(ROUTES.productionReadiness);
    const live = gatePanel().querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('Not Started \u2014 0 of 16 criteria confirmed.');
  });

  it('uses a single live region on the page', () => {
    const { container } = renderApp(ROUTES.productionReadiness);
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});

describe('production readiness page — counts only its own criteria', () => {
  it('ignores ticked guide practices', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.guideCategory('4-security'));
    for (const box of within(screen.getByRole('main')).getAllByRole('checkbox')) {
      await user.click(box);
    }
    first.unmount();

    renderApp(ROUTES.productionReadiness);
    expect(stat('Confirmed')).toBe('0');
    expect(gatePanel()).toHaveTextContent('Not Started');
  });

  it('ignores ticked implementation-order items', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.implementationOrder);
    for (const box of within(screen.getByRole('main')).getAllByRole('checkbox')) {
      await user.click(box);
    }
    first.unmount();

    renderApp(ROUTES.productionReadiness);
    expect(stat('Confirmed')).toBe('0');
    expect(stat('Outstanding')).toBe('16');
  });

  it('leaves the other two sets untouched when criteria are confirmed', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness);
    await confirmAll(user);

    const { checked } = loadState();
    expect(computeProgress(checkboxIds(GUIDE_CHECKLIST), checked).completed).toBe(0);
    expect(computeProgress(checkboxIds(PHASE_CHECKLIST), checked).completed).toBe(0);
  });

  it('stores confirmations under readiness-namespaced ids', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.productionReadiness);
    await user.click(boxes()[0]!);

    const stored = Object.keys(loadState().checked);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.startsWith('readiness--')).toBe(true);
  });

  it('persists confirmations across a remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.productionReadiness);
    await user.click(boxes()[2]!);
    first.unmount();

    renderApp(ROUTES.productionReadiness);
    expect(boxes()[2]).toBeChecked();
    expect(stat('Confirmed')).toBe('1');
  });
});

describe('production readiness page — heading hierarchy', () => {
  it('never skips a heading level', () => {
    const { container } = renderApp(ROUTES.productionReadiness);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
      Number(h.tagName[1]),
    );
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!, `at index ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('exposes one h1 and no h3 without an h2', () => {
    renderApp(ROUTES.productionReadiness);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(main()).getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
  });
});
