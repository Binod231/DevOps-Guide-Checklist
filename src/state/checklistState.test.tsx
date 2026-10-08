import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import {
  GUIDE_CHECKLIST,
  PHASE_CHECKLIST,
  READINESS_CHECKLIST,
  ROUTES,
  checkboxIds,
  guide,
} from '../content/registry';
import { STATE_STORAGE_KEY, computeProgress, loadState } from './portalState';

const FIRST_CATEGORY = guide.categories[0]!;

function mainCheckboxes(): HTMLElement[] {
  return within(screen.getByRole('main')).getAllByRole('checkbox');
}

/** Reads a progress statistic by its visible label. */
function stat(label: 'Total' | 'Completed' | 'Remaining'): string {
  const main = screen.getByRole('main');
  const term = within(main).getByText(label);
  return term.nextElementSibling?.textContent ?? '';
}

function progressPanel(): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name: 'Implementation progress' });
  const panel = heading.closest('div')?.parentElement;
  if (!panel) throw new Error('No progress panel');
  return panel;
}

describe('guide checkboxes', () => {
  it('renders one native checkbox per practice', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const boxes = mainCheckboxes();
    expect(boxes).toHaveLength(FIRST_CATEGORY.practices.length);
    for (const box of boxes) expect(box.tagName).toBe('INPUT');
  });

  it('labels each checkbox with the source checkbox text', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    for (const box of mainCheckboxes()) {
      expect(box).toHaveAccessibleName('Implementation complete');
    }
  });

  it('associates every checkbox with a real label element', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    for (const box of mainCheckboxes()) {
      const label = document.querySelector(`label[for="${box.id}"]`);
      expect(label, box.id).not.toBeNull();
    }
  });

  it('starts every checkbox unchecked', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    for (const box of mainCheckboxes()) expect(box).not.toBeChecked();
  });

  it('renders 24 checkboxes across the six category pages', () => {
    let total = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      total += mainCheckboxes().length;
      unmount();
    }
    expect(total).toBe(24);
  });

  it('toggles on click and again on a second click', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const box = mainCheckboxes()[0]!;

    await user.click(box);
    expect(box).toBeChecked();
    await user.click(box);
    expect(box).not.toBeChecked();
  });

  it('toggles from the keyboard with Space', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const box = mainCheckboxes()[0]!;

    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('toggles when the associated label is clicked', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const box = mainCheckboxes()[0]!;
    const label = document.querySelector(`label[for="${box.id}"]`) as HTMLElement;

    await user.click(label);
    expect(box).toBeChecked();
  });

  it('keeps each practice checkbox independent', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const boxes = mainCheckboxes();

    await user.click(boxes[2]!);
    expect(boxes[2]).toBeChecked();
    expect(boxes[0]).not.toBeChecked();
    expect(boxes[1]).not.toBeChecked();
  });
});

describe('progress indicator', () => {
  it('reports Not Started and 0% initially', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    expect(progressPanel()).toHaveTextContent('0%');
    expect(progressPanel()).toHaveTextContent('Not Started');
  });

  it('shows total, completed and remaining from the real practice count', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    expect(stat('Total')).toBe('5');
    expect(stat('Completed')).toBe('0');
    expect(stat('Remaining')).toBe('5');
  });

  it('updates live as boxes are ticked', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));

    await user.click(mainCheckboxes()[0]!);
    expect(stat('Completed')).toBe('1');
    expect(stat('Remaining')).toBe('4');
    // 1 of 5.
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('reaches 100% when every practice in the category is ticked', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));

    for (const box of mainCheckboxes()) await user.click(box);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(stat('Remaining')).toBe('0');
    expect(stat('Completed')).toBe('5');
  });

  it('drops the Not Started wording once progress begins', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    await user.click(mainCheckboxes()[0]!);
    expect(progressPanel()).not.toHaveTextContent('Not Started');
  });

  it('announces progress in a polite live region', () => {
    const { container } = renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('Implementation progress: Not Started');
  });

  it('uses exactly one live region on the page', () => {
    const { container } = renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('survives an unmount and remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    await user.click(mainCheckboxes()[1]!);
    first.unmount();

    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    expect(mainCheckboxes()[1]).toBeChecked();
    expect(mainCheckboxes()[0]).not.toBeChecked();
  });

  it('writes the tick under the practice id', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    await user.click(mainCheckboxes()[0]!);

    const stored = loadState();
    expect(stored.checked[FIRST_CATEGORY.practices[0]!.id]).toBe(true);
  });

  it('stores only ticked ids, keeping an untouched portal empty', () => {
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    expect(loadState().checked).toEqual({});
  });

  it('removes the entry when a box is unticked', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    const box = mainCheckboxes()[0]!;

    await user.click(box);
    expect(Object.keys(loadState().checked)).toHaveLength(1);
    await user.click(box);
    expect(loadState().checked).toEqual({});
  });

  it('persists across a route change and back', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    await user.click(mainCheckboxes()[0]!);

    await user.click(
      within(screen.getByRole('navigation', { name: 'Adjacent categories' })).getByRole('link'),
    );
    expect(mainCheckboxes()[0]).not.toBeChecked();

    // Back via the sidebar, which also proves the tick was not category-scoped.
    const sidebar = screen.getByRole('navigation', { name: 'Portal sections' });
    await user.click(
      within(sidebar).getByRole('link', { name: /^1\. Source Code Management/ }),
    );
    expect(mainCheckboxes()[0]).toBeChecked();
  });

  it('falls back to zero progress when stored data is corrupt', () => {
    window.localStorage.setItem(STATE_STORAGE_KEY, '{{{ broken');
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));

    for (const box of mainCheckboxes()) expect(box).not.toBeChecked();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('ignores stored ids that are not in the documents', () => {
    window.localStorage.setItem(
      STATE_STORAGE_KEY,
      JSON.stringify({ checked: { 'not-a-real-practice': true } }),
    );
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));

    for (const box of mainCheckboxes()) expect(box).not.toBeChecked();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});

describe('checklist universes stay separate', () => {
  it('ticking a guide practice leaves the phase and readiness sets at zero', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.guideCategory(FIRST_CATEGORY.id));
    await user.click(mainCheckboxes()[0]!);

    const { checked } = loadState();
    expect(computeProgress(checkboxIds(GUIDE_CHECKLIST), checked).completed).toBe(1);
    expect(computeProgress(checkboxIds(PHASE_CHECKLIST), checked).completed).toBe(0);
    expect(computeProgress(checkboxIds(READINESS_CHECKLIST), checked).completed).toBe(0);
  });

  it('counts 24 / 23 / 16 totals independently', () => {
    const checked = {};
    expect(computeProgress(checkboxIds(GUIDE_CHECKLIST), checked).total).toBe(24);
    expect(computeProgress(checkboxIds(PHASE_CHECKLIST), checked).total).toBe(23);
    expect(computeProgress(checkboxIds(READINESS_CHECKLIST), checked).total).toBe(16);
  });
});
