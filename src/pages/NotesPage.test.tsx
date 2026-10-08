import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import { ROUTES, checklist } from '../content/registry';
import { loadState } from '../state/portalState';

const { notes } = checklist;

function main(): HTMLElement {
  return screen.getByRole('main');
}

function section(name: string): HTMLElement {
  return within(main()).getByRole('region', { name });
}

describe('notes page — structure', () => {
  it('renders the section heading as the page h1', () => {
    renderApp(ROUTES.notes);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(notes.heading);
  });

  it('renders all five subsections with verbatim headings', () => {
    renderApp(ROUTES.notes);
    for (const heading of [
      ...notes.noteSections.map((s) => s.heading),
      notes.openIssuesHeading,
      notes.usefulLinksHeading,
    ]) {
      expect(section(heading), heading).toBeInTheDocument();
    }
  });

  it('gives each subsection the anchor id the sidebar links to', () => {
    renderApp(ROUTES.notes);
    for (const noteSection of notes.noteSections) {
      expect(section(noteSection.heading)).toHaveAttribute('id', noteSection.id);
    }
    expect(section(notes.openIssuesHeading)).toHaveAttribute('id', 'open-issues');
    expect(section(notes.usefulLinksHeading)).toHaveAttribute('id', 'useful-links');

    const sidebar = screen.getByRole('navigation', { name: 'Portal sections' });
    for (const anchor of [
      ...notes.noteSections.map((s) => ({ label: s.heading, id: s.id })),
      { label: notes.openIssuesHeading, id: 'open-issues' },
      { label: notes.usefulLinksHeading, id: 'useful-links' },
    ]) {
      expect(within(sidebar).getByRole('link', { name: anchor.label })).toHaveAttribute(
        'href',
        `#${anchor.id}`,
      );
    }
  });

  it('states plainly that the source leaves this section blank', () => {
    renderApp(ROUTES.notes);
    expect(within(main()).getByText(/source document leaves this section blank/i))
      .toBeInTheDocument();
  });

  it('never skips a heading level', () => {
    const { container } = renderApp(ROUTES.notes);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
      Number(h.tagName[1]),
    );
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!, `at index ${i}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('notes page — note sections', () => {
  it('renders the three italic prompts verbatim', () => {
    renderApp(ROUTES.notes);
    expect(
      within(main()).getByText(
        'Add infrastructure decisions, diagrams, constraints, and important assumptions here.',
      ),
    ).toBeInTheDocument();
    expect(
      within(main()).getByText(
        'Add security exceptions, access-control decisions, secret-rotation policies, and audit findings here.',
      ),
    ).toBeInTheDocument();
    expect(
      within(main()).getByText(
        'Record backup-restore tests, rollback tests, incidents, RCA links, and lessons learned here.',
      ),
    ).toBeInTheDocument();
  });

  it('uses each prompt as the field placeholder', () => {
    renderApp(ROUTES.notes);
    for (const noteSection of notes.noteSections) {
      const field = within(section(noteSection.heading)).getByRole('textbox');
      expect(field, noteSection.heading).toHaveAttribute('placeholder', noteSection.prompt);
    }
  });

  it('starts every note field empty', () => {
    renderApp(ROUTES.notes);
    for (const noteSection of notes.noteSections) {
      expect(within(section(noteSection.heading)).getByRole('textbox')).toHaveValue('');
    }
  });

  it('labels each note field with its heading', () => {
    renderApp(ROUTES.notes);
    for (const noteSection of notes.noteSections) {
      expect(
        within(main()).getByRole('textbox', { name: noteSection.heading }),
      ).toBeInTheDocument();
    }
  });

  it('records what the reader types', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.notes);

    const field = within(section('Architecture Notes')).getByRole('textbox');
    await user.type(field, 'Single region, managed Postgres.');
    expect(loadState().notes['architecture-notes']).toBe('Single region, managed Postgres.');
  });

  it('keeps the three note fields independent', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.notes);

    await user.type(within(section('Security Notes')).getByRole('textbox'), 'Rotation quarterly');
    expect(within(section('Architecture Notes')).getByRole('textbox')).toHaveValue('');
    expect(
      within(section('Incident / Recovery Notes')).getByRole('textbox'),
    ).toHaveValue('');
  });

  it('persists note text across a remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.notes);
    await user.type(
      within(section('Incident / Recovery Notes')).getByRole('textbox'),
      'Restore drill 2026-03-04: passed',
    );
    first.unmount();

    renderApp(ROUTES.notes);
    expect(within(section('Incident / Recovery Notes')).getByRole('textbox')).toHaveValue(
      'Restore drill 2026-03-04: passed',
    );
  });
});

describe('notes page — open issues', () => {
  it('renders the three blank rows the source leaves', () => {
    renderApp(ROUTES.notes);
    const panel = within(section(notes.openIssuesHeading));
    expect(panel.getAllByRole('checkbox')).toHaveLength(3);
    expect(panel.getAllByRole('textbox')).toHaveLength(3);
    expect(panel.getByText('3 blank rows, as left in the source document.')).toBeInTheDocument();
  });

  it('starts every row blank and unchecked', () => {
    renderApp(ROUTES.notes);
    const panel = within(section(notes.openIssuesHeading));
    for (const box of panel.getAllByRole('checkbox')) expect(box).not.toBeChecked();
    for (const field of panel.getAllByRole('textbox')) expect(field).toHaveValue('');
  });

  it('labels each row distinctly', () => {
    renderApp(ROUTES.notes);
    const panel = within(section(notes.openIssuesHeading));
    for (let i = 1; i <= 3; i += 1) {
      expect(panel.getByRole('checkbox', { name: `Open issue ${i} complete` })).toBeInTheDocument();
      expect(panel.getByRole('textbox', { name: `Open issue ${i}` })).toBeInTheDocument();
    }
  });

  it('records text and a tick independently per row', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.notes);
    const panel = within(section(notes.openIssuesHeading));

    await user.type(panel.getByRole('textbox', { name: 'Open issue 2' }), 'Chase WAF quote');
    await user.click(panel.getByRole('checkbox', { name: 'Open issue 2 complete' }));

    const stored = loadState();
    expect(stored.openIssues[notes.openIssues[1]!.id]).toBe('Chase WAF quote');
    expect(stored.checked[notes.openIssues[1]!.id]).toBe(true);
    expect(stored.openIssues[notes.openIssues[0]!.id]).toBeUndefined();
  });

  it('keeps open issues out of the three tracked checklist universes', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.notes);

    await user.click(
      within(section(notes.openIssuesHeading)).getByRole('checkbox', {
        name: 'Open issue 1 complete',
      }),
    );

    // Ticking a placeholder must not move the readiness gate or any progress.
    const { checked } = loadState();
    const trackedIds = new Set([
      ...checklist.phases.flatMap((p) => p.items.map((i) => i.id)),
      ...checklist.readinessGate.criteria.map((c) => c.id),
    ]);
    for (const id of Object.keys(checked)) expect(trackedIds.has(id)).toBe(false);
  });
});

describe('notes page — useful links', () => {
  it('renders all nine labels verbatim and in source order', () => {
    renderApp(ROUTES.notes);
    const panel = section(notes.usefulLinksHeading);
    const labels = [...panel.querySelectorAll('dt label')].map((l) => l.textContent);
    expect(labels).toEqual(notes.usefulLinks.map((l) => l.label));
  });

  it('keeps the slash in the CI/CD and Backup/DR labels', () => {
    renderApp(ROUTES.notes);
    const panel = within(section(notes.usefulLinksHeading));
    expect(panel.getByText('CI/CD')).toBeInTheDocument();
    expect(panel.getByText('Backup/DR documentation')).toBeInTheDocument();
  });

  it('starts every link field empty, matching the source', () => {
    renderApp(ROUTES.notes);
    const panel = within(section(notes.usefulLinksHeading));
    const fields = panel.getAllByRole('textbox');
    expect(fields).toHaveLength(9);
    for (const field of fields) expect(field).toHaveValue('');
  });

  it('associates every field with its label', () => {
    renderApp(ROUTES.notes);
    const panel = within(section(notes.usefulLinksHeading));
    for (const link of notes.usefulLinks) {
      expect(panel.getByRole('textbox', { name: link.label }), link.label).toBeInTheDocument();
    }
  });

  it('records a URL against the right label', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.notes);
    const panel = within(section(notes.usefulLinksHeading));

    await user.type(
      panel.getByRole('textbox', { name: 'Repository' }),
      'https://git.example.test/app',
    );
    expect(loadState().links.repository).toBe('https://git.example.test/app');
    expect(loadState().links['incident-runbook']).toBeUndefined();
  });

  it('persists link values across a remount', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.notes);
    await user.type(
      within(section(notes.usefulLinksHeading)).getByRole('textbox', { name: 'Monitoring' }),
      'https://grafana.example.test',
    );
    first.unmount();

    renderApp(ROUTES.notes);
    expect(
      within(section(notes.usefulLinksHeading)).getByRole('textbox', { name: 'Monitoring' }),
    ).toHaveValue('https://grafana.example.test');
  });
});

describe('notes page — nothing is pre-filled', () => {
  it('stores nothing until the reader types', () => {
    renderApp(ROUTES.notes);
    const stored = loadState();
    expect(stored.notes).toEqual({});
    expect(stored.links).toEqual({});
    expect(stored.openIssues).toEqual({});
  });

  it('puts no prompt text into any field value', () => {
    renderApp(ROUTES.notes);
    for (const field of within(main()).getAllByRole('textbox')) {
      expect(field).toHaveValue('');
    }
  });

  it('adds no note sections or link labels beyond the source', () => {
    renderApp(ROUTES.notes);
    // 3 note textareas + 3 open issue inputs + 9 link inputs.
    expect(within(main()).getAllByRole('textbox')).toHaveLength(15);
  });
});
