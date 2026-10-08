import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import { ROUTES, tracker } from '../content/registry';
import { loadState } from '../state/portalState';

const CANONICAL_HEADERS = [
  'S.N',
  'Category',
  'Implementation Item',
  'Implementation By',
  'Company Stage',
  'Priority',
  'Status',
  'Target Date',
  'Verification Gate',
  'Verified',
  'Verified By',
];

const ALTERNATE_HEADERS = [
  'S.N',
  'Category',
  'Company Stage',
  'Implementation By',
  'Implementation Item',
  'Priority',
  'Status',
  'Target Date',
  'Verification Gate',
  'Verified',
  'Verified By',
];

function table(): HTMLElement {
  return screen.getByRole('table');
}

function bodyRows(): HTMLElement[] {
  const body = table().querySelector('tbody')!;
  return [...body.querySelectorAll('tr')] as HTMLElement[];
}

/**
 * Header labels with decoration stripped.
 *
 * Headers carry a sort glyph and the added columns carry a dagger plus
 * screen-reader text; none of that is part of the label.
 */
function headerTexts(): string[] {
  return [...table().querySelectorAll('thead th')].map((th) => {
    const clone = th.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.sr-only').forEach((el) => el.remove());
    return (clone.textContent ?? '').replace(/[^\x20-\x7E]/g, '').trim();
  });
}

function columnValues(header: string): string[] {
  const index = headerTexts().indexOf(header);
  if (index === -1) throw new Error(`No column "${header}"`);
  return bodyRows().map((row) => row.children[index]?.textContent?.trim() ?? '');
}

function sortButton(header: string): HTMLElement {
  return within(table()).getByRole('button', { name: new RegExp(`^${escapeRe(header)}`) });
}

function headerCell(header: string): HTMLElement {
  const index = headerTexts().indexOf(header);
  if (index === -1) throw new Error(`No header cell "${header}"`);
  return table().querySelectorAll('thead th')[index] as HTMLElement;
}

describe('tracker page — table structure', () => {
  it('renders all 24 rows', () => {
    renderApp(ROUTES.tracker);
    expect(bodyRows()).toHaveLength(24);
  });

  it('renders the 11 source columns with verbatim header spelling', () => {
    renderApp(ROUTES.tracker);
    // Notes and Evidence are appended by the portal.
    expect(headerTexts().slice(0, 11)).toEqual(CANONICAL_HEADERS);
  });

  it('gives the table a caption describing its contents', () => {
    renderApp(ROUTES.tracker);
    const caption = table().querySelector('caption');
    expect(caption).toHaveTextContent('Implementation Tracker, 24 of 24 rows shown');
  });

  it('scopes every header cell to its column', () => {
    renderApp(ROUTES.tracker);
    for (const th of table().querySelectorAll('thead th')) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });

  it('renders rows in canonical source order by default', () => {
    renderApp(ROUTES.tracker);
    expect(columnValues('S.N')).toEqual(tracker.rows.map((r) => r.sn));
  });
});

describe('tracker page — source characteristics', () => {
  it('shows both ST-10 rows without a key collision', () => {
    renderApp(ROUTES.tracker);
    expect(columnValues('S.N').filter((sn) => sn === 'ST-10')).toHaveLength(2);
    expect(bodyRows()).toHaveLength(24);
  });

  it('distinguishes the two ST-10 rows by their item text', () => {
    renderApp(ROUTES.tracker);
    expect(within(table()).getByText('Cloud FinOps Guardrails & Budget Ceilings')).toBeInTheDocument();
    expect(within(table()).getByText('Core Integration & API Tests')).toBeInTheDocument();
  });

  it("shows ST-20's corrected status", () => {
    renderApp(ROUTES.tracker);
    const select = screen.getByLabelText('Status for ST-20, Observability') as HTMLSelectElement;
    expect(select.value).toBe('Not Started');
    expect(within(select).queryByText('(none)')).toBeNull();
  });

  it('shows Not Started on all 24 rows', () => {
    renderApp(ROUTES.tracker);
    expect(within(table()).getAllByText('Not Started').length).toBeGreaterThanOrEqual(24);
  });

  it("renders ST-04's gate without LaTeX delimiters", () => {
    renderApp(ROUTES.tracker);
    expect(table()).toHaveTextContent(
      'Simulate a rollback from Version N+1 to Version N with the new schema',
    );
    expect(table().textContent).not.toMatch(/\$N\+1\$/);
  });

  it('renders the previously newline-terminated fields cleanly', () => {
    renderApp(ROUTES.tracker);
    expect(
      within(table()).getByText('Edge Security, WAF & Ingress Rate Limiting'),
    ).toBeInTheDocument();
    expect(tracker.rows.find((r) => r.sn === 'ST-09')!.implementationItem).toBe(
      'Edge Security, WAF & Ingress Rate Limiting',
    );
  });

  it('marks the always-empty columns as empty rather than inventing values', () => {
    renderApp(ROUTES.tracker);
    const verifiedBy = screen.getAllByLabelText(/^Verified By for /);
    expect(verifiedBy).toHaveLength(24);
    for (const input of verifiedBy) expect(input).toHaveValue('');
  });
});

describe('tracker page — sorting', () => {
  it('starts with no column sorted', () => {
    renderApp(ROUTES.tracker);
    for (const th of table().querySelectorAll('thead th[aria-sort]')) {
      expect(th).toHaveAttribute('aria-sort', 'none');
    }
  });

  it('sorts ascending then descending then back to source order', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(sortButton('Priority'));
    expect(headerCell('Priority')).toHaveAttribute('aria-sort', 'ascending');
    expect(columnValues('Priority')[0]).toBe('P0');

    await user.click(sortButton('Priority'));
    expect(headerCell('Priority')).toHaveAttribute('aria-sort', 'descending');
    expect(columnValues('Priority')[0]).toBe('P2');

    await user.click(sortButton('Priority'));
    expect(headerCell('Priority')).toHaveAttribute('aria-sort', 'none');
    expect(columnValues('S.N')).toEqual(tracker.rows.map((r) => r.sn));
  });

  it('marks only one column as sorted at a time', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(sortButton('Priority'));
    await user.click(sortButton('Category'));

    expect(headerCell('Category')).toHaveAttribute('aria-sort', 'ascending');
    expect(headerCell('Priority')).toHaveAttribute('aria-sort', 'none');
  });

  it('keeps all 24 rows when sorting', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);
    await user.click(sortButton('Category'));
    expect(bodyRows()).toHaveLength(24);
  });

  it('offers a reset to source order once sorted', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    expect(screen.queryByRole('button', { name: /reset to source order/i })).toBeNull();
    await user.click(sortButton('Category'));
    await user.click(screen.getByRole('button', { name: /reset to source order/i }));
    expect(columnValues('S.N')).toEqual(tracker.rows.map((r) => r.sn));
  });
});

describe('tracker page — filtering', () => {
  function filterBox(group: string, option: string): HTMLElement {
    const fieldset = within(screen.getByRole('group', { name: group }));
    return fieldset.getByRole('checkbox', { name: option });
  }

  it('offers filters only for attributes the source carries', () => {
    renderApp(ROUTES.tracker);
    const panel = within(screen.getByRole('region', { name: 'Filters' }));
    for (const label of ['Category', 'Priority', 'Company Stage']) {
      expect(panel.getByRole('group', { name: label })).toBeInTheDocument();
    }
    // Status has a single value and Verified has a single value, so neither
    // can narrow anything and both are omitted.
    expect(panel.queryByRole('group', { name: 'Status' })).toBeNull();
    expect(panel.queryByRole('group', { name: 'Verified' })).toBeNull();
  });

  it('lists the real priority values as options', () => {
    renderApp(ROUTES.tracker);
    const group = within(screen.getByRole('group', { name: 'Priority' }));
    expect(group.getAllByRole('checkbox').map((b) => b.getAttribute('id'))).toHaveLength(3);
    for (const value of ['P0', 'P1', 'P2']) {
      expect(group.getByRole('checkbox', { name: value })).toBeInTheDocument();
    }
  });

  it('narrows to P0 rows', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(filterBox('Priority', 'P0'));
    expect(bodyRows()).toHaveLength(15);
    for (const value of columnValues('Priority')) expect(value).toBe('P0');
  });

  it('combines a priority and a stage filter', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(filterBox('Priority', 'P0'));
    await user.click(filterBox('Company Stage', 'For All'));
    expect(bodyRows()).toHaveLength(8);
  });

  it('narrows by category', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(filterBox('Category', 'Observability'));
    expect(bodyRows()).toHaveLength(6);
  });

  it('reports the match count', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);
    expect(screen.getByText('24 rows')).toBeInTheDocument();

    await user.click(filterBox('Priority', 'P2'));
    expect(screen.getByText('2 of 24 rows match')).toBeInTheDocument();
  });

  it('updates the caption as filters narrow the table', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);
    await user.click(filterBox('Priority', 'P2'));
    expect(table().querySelector('caption')).toHaveTextContent('2 of 24 rows shown');
  });

  it('clears all filters', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(filterBox('Priority', 'P0'));
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(bodyRows()).toHaveLength(24);
  });

  it('shows an empty state rather than a blank table', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(filterBox('Priority', 'P2'));
    await user.click(filterBox('Category', 'Security'));
    expect(within(table()).getByText(/no rows match the current filters/i)).toBeInTheDocument();
  });
});

describe('tracker page — column order toggle', () => {
  it('starts on the canonical export order', () => {
    renderApp(ROUTES.tracker);
    expect(headerTexts().slice(0, 11)).toEqual(CANONICAL_HEADERS);
  });

  it('switches to the alternate export order', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(screen.getByRole('radio', { name: 'Alternate export' }));
    expect(headerTexts().slice(0, 11)).toEqual(ALTERNATE_HEADERS);
  });

  it('keeps the same 24 rows in either order', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(screen.getByRole('radio', { name: 'Alternate export' }));
    expect(bodyRows()).toHaveLength(24);
    expect(columnValues('S.N')).toEqual(tracker.rows.map((r) => r.sn));
  });

  it('switches back to the canonical order', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(screen.getByRole('radio', { name: 'Alternate export' }));
    await user.click(screen.getByRole('radio', { name: 'Default export' }));
    expect(headerTexts().slice(0, 11)).toEqual(CANONICAL_HEADERS);
  });
});

describe('tracker page — editable fields', () => {
  it('offers a status dropdown with the source value plus the added ones', () => {
    renderApp(ROUTES.tracker);
    const select = screen.getByLabelText('Status for ST-01, SCM & CI/CD');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Not Started',
      'In Progress',
      'Completed',
    ]);
  });

  it('records a status change', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.selectOptions(screen.getByLabelText('Status for ST-01, SCM & CI/CD'), 'In Progress');
    expect(loadState().tracker['st-01--scm-ci-cd']?.status).toBe('In Progress');
  });

  it('records an owner and a target date', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.type(screen.getByLabelText('Implementation By for ST-07, Infrastructure'), 'BJ');
    const date = screen.getByLabelText('Target Date for ST-07, Infrastructure');
    await user.clear(date);
    await user.type(date, '2026-03-01');

    const stored = loadState().tracker['st-07--infrastructure'];
    expect(stored?.implementationBy).toBe('BJ');
    expect(stored?.targetDate).toBe('2026-03-01');
  });

  it('records the added Notes and Evidence fields, which start empty', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    const notes = screen.getByLabelText('Notes for ST-14');
    const evidence = screen.getByLabelText('Evidence for ST-14');
    expect(notes).toHaveValue('');
    expect(evidence).toHaveValue('');

    await user.type(notes, 'Okta enforced org-wide');
    await user.type(evidence, 'screenshot-2026-03.png');

    const stored = loadState().tracker['st-14--security'];
    expect(stored?.notes).toBe('Okta enforced org-wide');
    expect(stored?.evidence).toBe('screenshot-2026-03.png');
  });

  it('flags the added columns as not being in the source', () => {
    renderApp(ROUTES.tracker);
    expect(headerCell('Notes')).toHaveTextContent('added by this portal');
    expect(
      screen.getByText(/Notes and Evidence are capture fields added by this portal/i),
    ).toBeInTheDocument();
  });

  it('persists edits across a remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.tracker);
    await user.selectOptions(screen.getByLabelText('Status for ST-02, SCM & CI/CD'), 'Completed');
    first.unmount();

    renderApp(ROUTES.tracker);
    expect(screen.getByLabelText('Status for ST-02, SCM & CI/CD')).toHaveValue('Completed');
  });

  it('keeps edits to one ST-10 row off the other', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.selectOptions(
      screen.getByLabelText('Status for ST-10, Infrastructure'),
      'Completed',
    );
    expect(screen.getByLabelText('Status for ST-10, Infrastructure')).toHaveValue('Completed');
    expect(screen.getByLabelText('Status for ST-10, Testing & Quality')).toHaveValue(
      'Not Started',
    );
  });

  it('lets a reader-set status become a filter option', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.selectOptions(screen.getByLabelText('Status for ST-01, SCM & CI/CD'), 'Completed');
    const group = within(screen.getByRole('group', { name: 'Status' }));
    expect(group.getByRole('checkbox', { name: 'Completed' })).toBeInTheDocument();
    expect(group.getByRole('checkbox', { name: 'Not Started' })).toBeInTheDocument();
  });
});

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
