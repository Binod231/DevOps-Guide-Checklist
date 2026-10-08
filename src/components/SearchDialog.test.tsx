import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import { ROUTES } from '../content/registry';

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function searchInput(): HTMLElement {
  return screen.getByRole('combobox');
}

async function openSearch(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /^search/i }));
}

function options(): HTMLElement[] {
  return within(dialog()).getAllByRole('option');
}

describe('search dialog — opening and closing', () => {
  it('is closed initially', () => {
    renderApp();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens from the header button', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('opens with Ctrl-K', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.keyboard('{Control>}k{/Control}');
    expect(dialog()).toBeInTheDocument();
  });

  it('opens with Cmd-K', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(dialog()).toBeInTheDocument();
  });

  it('focuses the input on open', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    expect(searchInput()).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes from the Close button', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns focus to the trigger on close', async () => {
    const user = userEvent.setup();
    renderApp();
    const trigger = screen.getByRole('button', { name: /^search/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('clears the query between openings', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'WAF');
    await user.keyboard('{Escape}');

    await openSearch(user);
    expect(searchInput()).toHaveValue('');
  });

  it('has an accessible name', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    expect(dialog()).toHaveAccessibleName('Search the source documents');
  });
});

describe('search dialog — results', () => {
  it('shows guidance before anything is typed', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    expect(within(dialog()).getByText(/search headings, checklist items/i)).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole('option')).toHaveLength(0);
  });

  it('finds the Edge Security practice from WAF', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'WAF');

    expect(
      within(dialog()).getAllByText(/Edge Security, WAF & Ingress Rate Limiting/).length,
    ).toBeGreaterThan(0);
  });

  it('finds a tracker row by control ID', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'ST-14');

    expect(within(dialog()).getByText(/ST-14/)).toBeInTheDocument();
  });

  it('groups results by source document', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');

    const groups = [...dialog().querySelectorAll('[data-group-header]')].map((el) =>
      el.getAttribute('data-group-header'),
    );
    expect(groups).toEqual([
      'DevOps Implementation Guide',
      'DevOps Operational Checklist',
      'Implementation Tracker',
    ]);
  });

  it('names each result\u2019s source document for assistive technology', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'ST-14');

    const trackerOption = options().find((o) =>
      /in Implementation Tracker$/.test(o.textContent ?? ''),
    );
    expect(trackerOption).toBeDefined();
  });

  it('keeps the listbox containing only options', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');

    // Group headers are presentational, so every exposed child is an option.
    const listbox = dialog().querySelector('[role="listbox"]')!;
    for (const child of listbox.children) {
      const exposed =
        child.getAttribute('aria-hidden') !== 'true' ? child.getAttribute('role') : 'presentation';
      expect(exposed, child.outerHTML.slice(0, 80)).toMatch(/^(option|presentation)$/);
    }
  });

  it('labels a field-level match with its field name', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'distroless');

    expect(within(dialog()).getByText('Key concepts')).toBeInTheDocument();
  });

  it('shows an empty state rather than fabricating matches', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'service mesh');

    expect(within(dialog()).getByRole('status')).toHaveTextContent(
      'No matches for “service mesh” in the source documents.',
    );
    expect(within(dialog()).queryAllByRole('option')).toHaveLength(0);
  });

  it('announces the match count', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'ST-14');

    const statuses = within(dialog()).getAllByRole('status');
    expect(statuses.some((s) => /match/.test(s.textContent ?? ''))).toBe(true);
  });

  it('narrows as more words are typed', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);

    await user.type(searchInput(), 'secret');
    const broad = options().length;

    await user.type(searchInput(), ' scanning');
    expect(options().length).toBeLessThan(broad);
  });
});

describe('search dialog — keyboard navigation', () => {
  it('selects the first result by default', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');

    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves the selection with ArrowDown and ArrowUp', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');

    await user.keyboard('{ArrowDown}');
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(options()[0]).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{ArrowUp}');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps around at both ends', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'Infrastructure as Code');

    const count = options().length;
    await user.keyboard('{ArrowUp}');
    expect(options()[count - 1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps focus in the input while navigating', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');
    await user.keyboard('{ArrowDown}');
    expect(searchInput()).toHaveFocus();
  });

  it('resets the selection when the query changes', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.type(searchInput(), ' procedure');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);

    await user.tab();
    expect(dialog().contains(document.activeElement)).toBe(true);

    await user.tab();
    expect(dialog().contains(document.activeElement)).toBe(true);
  });
});

describe('search dialog — navigation to results', () => {
  it('navigates to a practice anchor on Enter', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview);
    await openSearch(user);
    await user.type(searchInput(), 'Infrastructure as Code');
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2. Infrastructure');
    expect(document.getElementById('infrastructure-as-code')).not.toBeNull();
  });

  it('navigates on click', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview);
    await openSearch(user);
    await user.type(searchInput(), 'Production Readiness Gate');
    await user.click(options()[0]!);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Production Readiness Gate',
    );
  });

  it('navigates to the tracker from a control ID', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview);
    await openSearch(user);
    await user.type(searchInput(), 'ST-14');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('navigates to the implementation order from a phase item', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview);
    await openSearch(user);
    await user.type(searchInput(), 'Organization-wide 2FA enforcement');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Suggested Implementation Order',
    );
  });

  it('does nothing on Enter with no results', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview);
    await openSearch(user);
    await user.type(searchInput(), 'service mesh');
    await user.keyboard('{Enter}');

    expect(dialog()).toBeInTheDocument();
  });

  it('selects a result on hover', async () => {
    const user = userEvent.setup();
    renderApp();
    await openSearch(user);
    await user.type(searchInput(), 'rollback');

    await user.hover(options()[2]!);
    expect(options()[2]).toHaveAttribute('aria-selected', 'true');
  });
});
