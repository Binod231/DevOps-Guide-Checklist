import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderRoute';
import { ROUTES } from '../content/registry';
import { emptyState, loadState, type PortalState } from '../state/portalState';
import { EXPORT_FORMAT, serialiseState } from '../state/transfer';

/** Captures what the panel would have downloaded. */
interface Captured {
  filename: string;
  contents: string;
  mime: string;
}

let captured: Captured[] = [];
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  captured = [];

  // jsdom has no Blob URL plumbing, so stand in for it and read the Blob back.
  const blobs = new Map<string, Blob>();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      const url = `blob:${blobs.size}`;
      blobs.set(url, blob);
      return url;
    },
    revokeObjectURL: () => {},
  });

  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      const blob = blobs.get(this.href);
      if (!blob) return;
      captured.push({ filename: this.download, contents: '', mime: blob.type });
      void blob.text().then((text) => {
        const entry = captured.find((c) => c.filename === this.download);
        if (entry) entry.contents = text;
      });
    });
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.unstubAllGlobals();
});

function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Export and import' });
}

async function importFile(
  user: ReturnType<typeof userEvent.setup>,
  contents: string,
  filename = 'state.json',
): Promise<void> {
  const file = new File([contents], filename, { type: 'application/json' });
  await user.upload(screen.getByLabelText('Choose a state file to import'), file);
}

describe('export/import panel — rendering', () => {
  it('appears on the tracker page', () => {
    renderApp(ROUTES.tracker);
    expect(panel()).toBeInTheDocument();
  });

  it('offers the three actions', () => {
    renderApp(ROUTES.tracker);
    const p = within(panel());
    expect(p.getByRole('button', { name: 'Export state (JSON)' })).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Export tracker (CSV)' })).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Import state (JSON)' })).toBeInTheDocument();
  });

  it('warns that importing replaces current state', () => {
    renderApp(ROUTES.tracker);
    expect(within(panel()).getByText(/importing replaces everything/i)).toBeInTheDocument();
  });

  it('leaves the added-columns option off by default', () => {
    renderApp(ROUTES.tracker);
    expect(within(panel()).getByRole('checkbox')).not.toBeChecked();
  });

  it('shows no feedback before anything happens', () => {
    renderApp(ROUTES.tracker);
    expect(within(panel()).queryByText(/imported|could not import/i)).toBeNull();
  });
});

describe('export/import panel — exporting', () => {
  it('downloads a JSON state file with a dated name', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(within(panel()).getByRole('button', { name: 'Export state (JSON)' }));
    expect(captured).toHaveLength(1);
    expect(captured[0]!.filename).toMatch(/^devops-portal-state-\d{4}-\d{2}-\d{2}\.json$/);
    expect(captured[0]!.mime).toBe('application/json');
  });

  it('downloads a tracker CSV with a dated name', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.click(within(panel()).getByRole('button', { name: 'Export tracker (CSV)' }));
    expect(captured[0]!.filename).toMatch(/^implementation-tracker-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(captured[0]!.mime).toBe('text/csv');
  });

  it('exports the edits a reader has made', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.selectOptions(
      screen.getByLabelText('Status for ST-01, SCM & CI/CD'),
      'In Progress',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Export state (JSON)' }));

    // The export reads live state, which the store has already recorded.
    expect(loadState().tracker['st-01--scm-ci-cd']?.status).toBe('In Progress');
    expect(captured).toHaveLength(1);
  });
});

describe('export/import panel — importing', () => {
  function filledState(): PortalState {
    return {
      ...emptyState(),
      checked: { 'infrastructure-as-code': true },
      tracker: { 'st-07--infrastructure': { status: 'Completed', implementationBy: 'BJ' } },
      notes: { 'architecture-notes': 'Single region.' },
      links: { repository: 'https://git.example.test/app' },
    };
  }

  it('restores a previously exported file', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await importFile(user, serialiseState(filledState()));

    expect(within(panel()).getByText('Imported state.json.')).toBeInTheDocument();
    expect(screen.getByLabelText('Status for ST-07, Infrastructure')).toHaveValue('Completed');
    expect(screen.getByLabelText('Implementation By for ST-07, Infrastructure')).toHaveValue('BJ');
  });

  it('applies imported checkbox state to the guide', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.tracker);
    await importFile(user, serialiseState(filledState()));
    first.unmount();

    renderApp(ROUTES.guideCategory('2-infrastructure'));
    const boxes = within(screen.getByRole('main')).getAllByRole('checkbox');
    // `infrastructure-as-code` is the second practice in this category.
    expect(boxes[1]).toBeChecked();
    expect(boxes[0]).not.toBeChecked();
  });

  it('applies imported notes and links', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.tracker);
    await importFile(user, serialiseState(filledState()));
    first.unmount();

    renderApp(ROUTES.notes);
    expect(screen.getByRole('textbox', { name: 'Architecture Notes' })).toHaveValue(
      'Single region.',
    );
    expect(screen.getByRole('textbox', { name: 'Repository' })).toHaveValue(
      'https://git.example.test/app',
    );
  });

  it('reports invalid JSON without changing anything', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await user.selectOptions(screen.getByLabelText('Status for ST-01, SCM & CI/CD'), 'Completed');
    await importFile(user, '{not json', 'broken.json');

    expect(within(panel()).getByText('Could not import broken.json.')).toBeInTheDocument();
    expect(within(panel()).getByText(/Not valid JSON/)).toBeInTheDocument();
    // The existing edit survives a rejected import.
    expect(screen.getByLabelText('Status for ST-01, SCM & CI/CD')).toHaveValue('Completed');
  });

  it('reports a file from a different tool', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await importFile(user, JSON.stringify({ format: 'other-tool', state: {} }), 'alien.json');
    expect(within(panel()).getByText('Could not import alien.json.')).toBeInTheDocument();
    expect(within(panel()).getByText(new RegExp(EXPORT_FORMAT))).toBeInTheDocument();
  });

  it('lists per-field issues while importing the usable remainder', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await importFile(
      user,
      JSON.stringify({
        checked: { 'infrastructure-as-code': true, 'bad-entry': 'yes' },
        tracker: { 'st-07--infrastructure': { status: 'Completed', priority: 'P9' } },
      }),
    );

    const p = within(panel());
    expect(p.getByText(/^Imported/)).toBeInTheDocument();
    expect(p.getByText('2 issues:')).toBeInTheDocument();
    expect(p.getByText(/Expected a boolean but found a string/)).toBeInTheDocument();
    expect(p.getByText(/Not an editable tracker field/)).toBeInTheDocument();
    // The good values still landed.
    expect(screen.getByLabelText('Status for ST-07, Infrastructure')).toHaveValue('Completed');
  });

  it('flags ids that no longer exist in the documents', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);

    await importFile(
      user,
      JSON.stringify({
        checked: { 'a-practice-that-was-removed': true },
        tracker: { 'st-99--nowhere': { status: 'Completed' } },
      }),
    );

    const p = within(panel());
    expect(p.getByText(/^Imported/)).toBeInTheDocument();
    expect(p.getAllByText(/kept but not shown/)).toHaveLength(2);
  });

  it('announces the outcome politely', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.tracker);
    await importFile(user, serialiseState(filledState()));

    const live = panel().querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('Imported state.json.');
  });

  it('round-trips a full engagement through export and import', async () => {
    const user = userEvent.setup();
    const first = renderApp(ROUTES.tracker);

    await user.selectOptions(
      screen.getByLabelText('Status for ST-14, Security'),
      'Completed',
    );
    await user.type(screen.getByLabelText('Notes for ST-14'), 'Okta enforced');
    const before = loadState();
    first.unmount();

    // Simulate clearing the browser, then re-importing.
    window.localStorage.clear();
    renderApp(ROUTES.tracker);
    expect(screen.getByLabelText('Status for ST-14, Security')).toHaveValue('Not Started');

    await importFile(user, serialiseState(before));
    expect(screen.getByLabelText('Status for ST-14, Security')).toHaveValue('Completed');
    expect(screen.getByLabelText('Notes for ST-14')).toHaveValue('Okta enforced');
  });
});
