import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderRoute';
import { ROUTES, checklist, guide, navLeaves } from './content/registry';

function sidebar(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Portal sections' });
}

/**
 * Finds a sidebar link by its source heading.
 *
 * Accessible names are whitespace-normalised by the accname algorithm, so the
 * double spaces in headings such as `3.  Testing & Quality` collapse to one.
 * The DOM text itself stays verbatim — asserted separately below.
 */
function navLink(heading: string): HTMLElement {
  const normalised = heading.replace(/\s+/g, ' ');
  return within(sidebar()).getByRole('link', {
    name: new RegExp(`^${escape(normalised)}`),
  });
}

describe('app shell — landmarks and skip link', () => {
  it('renders banner, navigation and main landmarks', () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(sidebar()).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('offers a skip link targeting the main landmark', () => {
    renderApp();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#portal-main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'portal-main');
  });

  it('shows the portal title without inventing an organisation or version', () => {
    renderApp();
    const banner = screen.getByRole('banner');
    expect(
      within(banner).getByText('DevOps Implementation & Readiness Portal'),
    ).toBeInTheDocument();
    // The source documents carry no version, date or organisation name.
    expect(banner.textContent).not.toMatch(/v\d|version|©|\b20\d{2}\b/i);
  });

  it('exposes exactly one h1 per page', () => {
    for (const path of navLeaves().map((l) => l.path)) {
      const { unmount } = renderApp(path);
      expect(screen.getAllByRole('heading', { level: 1 }), path).toHaveLength(1);
      unmount();
    }
  });
});

describe('app shell — sidebar built from the registry', () => {
  it('lists all 6 guide categories', () => {
    renderApp();
    for (const category of guide.categories) {
      expect(navLink(category.heading), category.heading).toBeInTheDocument();
    }
  });

  it('puts each category heading in the DOM verbatim', () => {
    renderApp();
    const text = sidebar().textContent ?? '';
    for (const category of guide.categories) {
      expect(text, category.heading).toContain(category.heading);
    }
    // The export's spacing defects were corrected at source.
    expect(text).toContain('3. Testing & Quality');
    expect(text).toContain('5. Observability (Optional For Startup)');
    expect(text).toContain('6. Disaster Recovery (Optional For Startup)');
    expect(text).not.toMatch(/\d\.\s{2}/);
  });

  it('lists the three source document titles as group labels', () => {
    renderApp();
    const nav = within(sidebar());
    expect(nav.getByRole('button', { name: guide.title })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: checklist.title })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: checklist.trackerLinkLabel })).toBeInTheDocument();
  });

  it('renders a link for every navigation leaf', () => {
    renderApp();
    const links = within(sidebar()).getAllByRole('link');
    // One link per leaf; anchors only appear for the active section.
    expect(links.length).toBeGreaterThanOrEqual(navLeaves().length);
  });

  it('shows item counts beside countable sections', () => {
    renderApp();
    // Practice counts per category, then the phase, readiness and tracker totals.
    expect(navLink(guide.categories[0]!.heading)).toHaveAccessibleName(/, 5 items$/);
    expect(navLink(guide.categories[2]!.heading)).toHaveAccessibleName(/, 2 items$/);
    expect(navLink(checklist.implementationOrderHeading)).toHaveAccessibleName(/, 23 items$/);
    expect(navLink(checklist.readinessGate.heading)).toHaveAccessibleName(/, 16 items$/);
    expect(navLink(checklist.trackerLinkLabel)).toHaveAccessibleName(/, 24 items$/);
  });

  it('keeps the count out of the visible badge text for screen readers', () => {
    renderApp();
    // The badge is decorative; the count reaches assistive tech via sr-only text.
    const link = navLink(checklist.readinessGate.heading);
    expect(link.querySelector('[aria-hidden="true"]')).toHaveTextContent('16');
  });

  it('collapses and expands a group, reflecting state in aria-expanded', async () => {
    const user = userEvent.setup();
    renderApp();
    const toggle = within(sidebar()).getByRole('button', { name: guide.title });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists the 4 phases as anchors when the order page is active', () => {
    renderApp(ROUTES.implementationOrder);
    const nav = within(sidebar());
    for (const phase of checklist.phases) {
      expect(nav.getByRole('link', { name: phase.heading })).toHaveAttribute(
        'href',
        `#${phase.id}`,
      );
    }
  });

  it('lists practice anchors when a guide category is active', () => {
    const category = guide.categories[3]!;
    renderApp(ROUTES.guideCategory(category.id));
    const nav = within(sidebar());
    for (const practice of category.practices) {
      expect(nav.getByRole('link', { name: practice.heading })).toHaveAttribute(
        'href',
        `#${practice.id}`,
      );
    }
  });
});

describe('app shell — routing', () => {
  it('renders the Objective section at the root', () => {
    renderApp(ROUTES.overview);
    expect(screen.getByRole('heading', { level: 1, name: guide.objective.heading }))
      .toBeInTheDocument();
  });

  it.each(guide.categories.map((c) => [c.heading, c.id] as const))(
    'routes to guide category "%s"',
    (heading, id) => {
      renderApp(ROUTES.guideCategory(id));
      const h1 = screen.getByRole('heading', { level: 1 });
      // Compared on textContent so irregular spacing is checked verbatim.
      expect(h1).toHaveTextContent(heading, { normalizeWhitespace: false });
    },
  );

  it('routes to the implementation order', () => {
    renderApp(ROUTES.implementationOrder);
    expect(
      screen.getByRole('heading', { level: 1, name: checklist.implementationOrderHeading }),
    ).toBeInTheDocument();
  });

  it('routes to the production readiness gate', () => {
    renderApp(ROUTES.productionReadiness);
    expect(
      screen.getByRole('heading', { level: 1, name: checklist.readinessGate.heading }),
    ).toBeInTheDocument();
  });

  it('routes to notes and to the tracker', () => {
    const { unmount } = renderApp(ROUTES.notes);
    expect(
      screen.getByRole('heading', { level: 1, name: checklist.notes.heading }),
    ).toBeInTheDocument();
    unmount();

    renderApp(ROUTES.tracker);
    expect(
      screen.getByRole('heading', { level: 1, name: checklist.trackerLinkLabel }),
    ).toBeInTheDocument();
  });

  it('redirects /guide to the first category', () => {
    renderApp('/guide');
    expect(
      screen.getByRole('heading', { level: 1, name: guide.categories[0]!.heading }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown category to the first one', () => {
    renderApp('/guide/does-not-exist');
    expect(
      screen.getByRole('heading', { level: 1, name: guide.categories[0]!.heading }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown path to the overview', () => {
    renderApp('/nowhere');
    expect(
      screen.getByRole('heading', { level: 1, name: guide.objective.heading }),
    ).toBeInTheDocument();
  });

  it('navigates by clicking a sidebar link', async () => {
    const user = userEvent.setup();
    renderApp();
    const target = guide.categories[2]!;
    await user.click(navLink(target.heading));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(target.heading, {
      normalizeWhitespace: false,
    });
  });
});

describe('app shell — active state and breadcrumb', () => {
  it('marks the active section with aria-current', () => {
    const category = guide.categories[1]!;
    renderApp(ROUTES.guideCategory(category.id));
    const current = screen.getAllByText(category.heading).find((el) => el.closest('nav'));
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('shows the document title then the section heading in the breadcrumb', () => {
    const category = guide.categories[1]!;
    renderApp(ROUTES.guideCategory(category.id));
    const crumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumb.getByText(guide.title)).toBeInTheDocument();
    expect(crumb.getByText(category.heading)).toHaveAttribute('aria-current', 'page');
  });

  it('updates the breadcrumb when the route changes', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.overview);

    await user.click(navLink(checklist.readinessGate.heading));

    const crumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumb.getByText(checklist.title)).toBeInTheDocument();
    expect(crumb.getByText(checklist.readinessGate.heading)).toBeInTheDocument();
  });

  it('shows the current section in the header', () => {
    renderApp(ROUTES.productionReadiness);
    const banner = within(screen.getByRole('banner'));
    expect(banner.getByText(checklist.readinessGate.heading)).toBeInTheDocument();
  });
});

describe('app shell — theme toggle', () => {
  it('starts in light mode and toggles the dark class', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(document.documentElement).toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('persists the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    unmount();

    renderApp();
    expect(document.documentElement).toHaveClass('dark');
  });
});

describe('app shell — mobile drawer', () => {
  it('toggles the drawer and reflects state in aria-expanded', async () => {
    const user = userEvent.setup();
    renderApp();
    const toggle = screen.getByRole('button', { name: /open section navigation/i });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'portal-sidebar');

    await user.click(toggle);
    expect(
      screen.getByRole('button', { name: /close section navigation/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the drawer on Escape', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /open section navigation/i }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /open section navigation/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes the drawer after navigating', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /open section navigation/i }));
    await user.click(navLink(checklist.notes.heading));
    expect(screen.getByRole('button', { name: /open section navigation/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

/** Escapes a heading for use inside a RegExp. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
