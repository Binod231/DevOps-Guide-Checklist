import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import {
  GUIDE_CHECKLIST,
  READINESS_CHECKLIST,
  ROUTES,
  checkboxIds,
  checklist,
} from '../content/registry';
import { computeProgress, loadState } from '../state/portalState';

function main(): HTMLElement {
  return screen.getByRole('main');
}

function phaseSection(heading: string): HTMLElement {
  const section = within(main()).getByRole('region', {
    name: new RegExp(`^${escapeRe(heading.replace(/\s+/g, ' '))}`),
  });
  return section;
}

function phaseBoxes(heading: string): HTMLElement[] {
  return within(phaseSection(heading)).getAllByRole('checkbox');
}

function stat(label: 'Total' | 'Completed' | 'Remaining'): string {
  return within(main()).getByText(label).nextElementSibling?.textContent ?? '';
}

/**
 * The page-level rollup panel.
 *
 * Scoped by its own heading, since each phase also renders a compact indicator
 * showing a percentage.
 */
function overallPanel(): HTMLElement {
  const heading = within(main()).getByRole('heading', {
    level: 2,
    name: 'Implementation order progress',
  });
  const panel = heading.closest('div')?.parentElement;
  if (!panel) throw new Error('No overall progress panel');
  return panel;
}

describe('implementation order page — structure', () => {
  it('renders the section heading as the page h1', () => {
    renderApp(ROUTES.implementationOrder);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      checklist.implementationOrderHeading,
    );
  });

  it('renders all 4 phases with verbatim headings', () => {
    renderApp(ROUTES.implementationOrder);
    for (const phase of checklist.phases) {
      expect(phaseSection(phase.heading)).toBeInTheDocument();
    }
  });

  it('puts the phase headings in the DOM verbatim, em dash included', () => {
    renderApp(ROUTES.implementationOrder);
    const text = main().textContent ?? '';
    for (const phase of checklist.phases) {
      expect(text, phase.heading).toContain(phase.heading);
    }
    expect(text).toContain('Phase 1 \u2014 Foundations: Infrastructure, Identity & Data Safety');
  });

  it('keeps phases in source order', () => {
    renderApp(ROUTES.implementationOrder);
    const headings = within(main())
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '');
    for (const phase of checklist.phases) {
      expect(headings.some((h) => h.includes(phase.heading)), phase.heading).toBe(true);
    }
    const phaseOrder = checklist.phases.map((p) =>
      headings.findIndex((h) => h.includes(p.heading)),
    );
    expect(phaseOrder).toEqual([...phaseOrder].sort((a, b) => a - b));
  });

  it('gives each phase an anchor id matching the sidebar link', () => {
    renderApp(ROUTES.implementationOrder);
    for (const phase of checklist.phases) {
      expect(phaseSection(phase.heading)).toHaveAttribute('id', phase.id);
    }
    const sidebar = screen.getByRole('navigation', { name: 'Portal sections' });
    for (const phase of checklist.phases) {
      expect(within(sidebar).getByRole('link', { name: phase.heading })).toHaveAttribute(
        'href',
        `#${phase.id}`,
      );
    }
  });
});

describe('implementation order page — items', () => {
  it('renders 23 checkboxes in total', () => {
    renderApp(ROUTES.implementationOrder);
    expect(within(main()).getAllByRole('checkbox')).toHaveLength(23);
  });

  it('distributes items 6/6/6/5 across the phases', () => {
    renderApp(ROUTES.implementationOrder);
    expect(checklist.phases.map((p) => phaseBoxes(p.heading).length)).toEqual([6, 6, 6, 5]);
  });

  it('renders every item text verbatim and in source order', () => {
    renderApp(ROUTES.implementationOrder);
    for (const phase of checklist.phases) {
      const labels = within(phaseSection(phase.heading))
        .getAllByRole('checkbox')
        .map((box) => document.querySelector(`label[for="${box.id}"]`)?.textContent ?? '');
      expect(labels, phase.heading).toEqual(phase.items.map((i) => strip(i.text)));
    }
  });

  it('renders inline code inside a phase item', () => {
    renderApp(ROUTES.implementationOrder);
    const section = phaseSection(checklist.phases[0]!.heading);
    const code = within(section).getByText('.env');
    expect(code.tagName).toBe('CODE');
  });

  it('labels every checkbox with its own item text', () => {
    renderApp(ROUTES.implementationOrder);
    const first = checklist.phases[0]!.items[0]!;
    expect(
      within(main()).getByRole('checkbox', { name: first.text }),
    ).toBeInTheDocument();
  });

  it('starts every checkbox unchecked', () => {
    renderApp(ROUTES.implementationOrder);
    for (const box of within(main()).getAllByRole('checkbox')) expect(box).not.toBeChecked();
  });
});

describe('implementation order page — progress', () => {
  it('reports Not Started and 0 of 23 initially', () => {
    renderApp(ROUTES.implementationOrder);
    expect(stat('Total')).toBe('23');
    expect(stat('Completed')).toBe('0');
    expect(stat('Remaining')).toBe('23');
    expect(overallPanel()).toHaveTextContent('0%');
    expect(overallPanel()).toHaveTextContent('Not Started');
  });

  it('advances the overall rollup when an item is ticked', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder);

    await user.click(phaseBoxes(checklist.phases[0]!.heading)[0]!);
    expect(stat('Completed')).toBe('1');
    expect(stat('Remaining')).toBe('22');
  });

  it('keeps per-phase progress independent', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder);
    const [phase1, phase2] = checklist.phases;

    for (const box of phaseBoxes(phase1!.heading)) await user.click(box);

    // Phase 1 complete, phase 2 untouched.
    expect(phaseSection(phase1!.heading)).toHaveTextContent('6/6');
    expect(phaseSection(phase1!.heading)).toHaveTextContent('100%');
    expect(phaseSection(phase2!.heading)).toHaveTextContent('0/6');
    expect(phaseSection(phase2!.heading)).toHaveTextContent('0%');
  });

  it('shows the phase rollup alongside the overall rollup', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder);
    const phase1 = checklist.phases[0]!;

    for (const box of phaseBoxes(phase1.heading)) await user.click(box);

    // 6 of 23 overall.
    expect(stat('Completed')).toBe('6');
    expect(overallPanel()).toHaveTextContent('26%');
  });

  it('reaches 100% overall when all 23 items are ticked', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder);

    for (const box of within(main()).getAllByRole('checkbox')) await user.click(box);
    expect(stat('Completed')).toBe('23');
    expect(stat('Remaining')).toBe('0');
    expect(overallPanel()).toHaveTextContent('100%');
  });

  it('uses a single live region', () => {
    const { container } = renderApp(ROUTES.implementationOrder);
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});

describe('implementation order page — isolation from the other checklists', () => {
  it('ticking a phase item leaves the guide and readiness sets at zero', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder);
    await user.click(within(main()).getAllByRole('checkbox')[0]!);

    const { checked } = loadState();
    expect(computeProgress(checkboxIds(GUIDE_CHECKLIST), checked).completed).toBe(0);
    expect(computeProgress(checkboxIds(READINESS_CHECKLIST), checked).completed).toBe(0);
  });

  it('stores phase ticks under the phase-namespaced id', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.implementationOrder);
    const firstItem = checklist.phases[0]!.items[0]!;

    await user.click(within(main()).getAllByRole('checkbox')[0]!);
    expect(loadState().checked[firstItem.id]).toBe(true);
    expect(firstItem.id.startsWith(checklist.phases[0]!.id)).toBe(true);
  });

  it('does not reuse guide wording for phase items', () => {
    // The two documents word these differently; neither is rewritten.
    const phaseTexts = checklist.phases.flatMap((p) => p.items.map((i) => i.text));
    expect(phaseTexts).toContain('Organization-wide 2FA enforcement');
    expect(phaseTexts).not.toContain('Enforced Two-Factor Authentication');
  });

  it('persists ticks across a remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.implementationOrder);
    await user.click(within(main()).getAllByRole('checkbox')[3]!);
    first.unmount();

    renderApp(ROUTES.implementationOrder);
    expect(within(main()).getAllByRole('checkbox')[3]).toBeChecked();
    expect(within(main()).getAllByRole('checkbox')[0]).not.toBeChecked();
  });
});

describe('implementation order page — heading hierarchy', () => {
  it('never skips a heading level', () => {
    const { container } = renderApp(ROUTES.implementationOrder);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
      Number(h.tagName[1]),
    );
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!, `at index ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('uses h2 for each phase', () => {
    renderApp(ROUTES.implementationOrder);
    for (const phase of checklist.phases) {
      expect(
        within(main()).getByRole('heading', {
          level: 2,
          name: phase.heading.replace(/\s+/g, ' '),
        }),
      ).toBeInTheDocument();
    }
  });
});

function strip(text: string): string {
  return text.replace(/`/g, '').replace(/\*\*/g, '');
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
