import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderRoute';
import { ROUTES, checklist, guide, tracker } from '../content/registry';
import { displayTitle } from '../content/displayTitle';

describe('overview page — Objective section', () => {
  it('renders the Objective heading as the page h1', () => {
    renderApp(ROUTES.overview);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      guide.objective.heading,
    );
  });

  it('renders the lead paragraph verbatim', () => {
    renderApp(ROUTES.overview);
    expect(screen.getByText(guide.objective.leadParagraph)).toBeInTheDocument();
  });

  it('renders the closing paragraph verbatim, keeping both near-identical paragraphs', () => {
    renderApp(ROUTES.overview);
    expect(screen.getByText(guide.objective.closingParagraph)).toBeInTheDocument();
    expect(screen.getByText(guide.objective.leadParagraph)).toBeInTheDocument();
    expect(guide.objective.leadParagraph).not.toBe(guide.objective.closingParagraph);
  });

  it('renders the Operating principles label from the source', () => {
    renderApp(ROUTES.overview);
    expect(
      screen.getByRole('heading', { level: 2, name: guide.objective.principlesLabel }),
    ).toBeInTheDocument();
  });

  it('renders all 6 principles with term and detail', () => {
    renderApp(ROUTES.overview);
    const section = within(
      screen.getByRole('region', { name: guide.objective.principlesLabel }),
    );
    expect(section.getAllByRole('term')).toHaveLength(6);

    for (const principle of guide.objective.principles) {
      expect(section.getByText(principle.term)).toBeInTheDocument();
      expect(section.getByText(principle.detail)).toBeInTheDocument();
    }
  });

  it('keeps principles in source order', () => {
    renderApp(ROUTES.overview);
    const section = within(
      screen.getByRole('region', { name: guide.objective.principlesLabel }),
    );
    expect(section.getAllByRole('term').map((t) => t.textContent)).toEqual(
      guide.objective.principles.map((p) => p.term),
    );
  });

  it('adds no principles beyond the six in the document', () => {
    renderApp(ROUTES.overview);
    const section = within(
      screen.getByRole('region', { name: guide.objective.principlesLabel }),
    );
    expect(section.getAllByRole('definition')).toHaveLength(6);
  });
});

describe('overview page — contents index', () => {
  it('links to all 6 guide categories with their counts', () => {
    renderApp(ROUTES.overview);
    const nav = within(screen.getByRole('navigation', { name: 'Contents' }));
    for (const category of guide.categories) {
      const link = nav.getByRole('link', {
        name: new RegExp(`^${escapeRe(displayTitle(category.heading))}`),
      });
      expect(link).toHaveAttribute('href', ROUTES.guideCategory(category.id));
      expect(link).toHaveAccessibleName(
        new RegExp(`, ${category.practices.length} practices$`),
      );
    }
  });

  it('links to the checklist sections and the tracker with real counts', () => {
    renderApp(ROUTES.overview);
    const nav = within(screen.getByRole('navigation', { name: 'Contents' }));

    expect(
      nav.getByRole('link', { name: new RegExp(`^${checklist.implementationOrderHeading}`) }),
    ).toHaveAccessibleName(/, 23 items$/);

    expect(
      nav.getByRole('link', { name: new RegExp(`^${checklist.readinessGate.heading}`) }),
    ).toHaveAccessibleName(/, 16 criteria$/);

    expect(
      nav.getByRole('link', { name: new RegExp(`^${checklist.trackerLinkLabel}`) }),
    ).toHaveAccessibleName(new RegExp(`, ${tracker.rows.length} rows$`));
  });

  it('links to Notes & Decisions', () => {
    renderApp(ROUTES.overview);
    const nav = within(screen.getByRole('navigation', { name: 'Contents' }));
    expect(nav.getByRole('link', { name: checklist.notes.heading })).toHaveAttribute(
      'href',
      ROUTES.notes,
    );
  });
});

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
