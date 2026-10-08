/**
 * Shared test queries.
 *
 * Headings are shortened for display: a trailing company-stage qualifier is
 * moved out of the title. So tests that locate an element by its heading must
 * look for the display title, not the raw source heading.
 */
import { screen, within } from '@testing-library/react';
import { displayTitle } from '../content/displayTitle';
import type { Practice } from '../content/types';

/** The main content landmark. */
export function main(): HTMLElement {
  return screen.getByRole('main');
}

/** The sidebar navigation landmark. */
export function sidebar(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Portal sections' });
}

/**
 * Locates a practice's article.
 *
 * Scoped to `main`, because practice titles also appear as third-level anchors
 * in the sidebar.
 */
export function practiceArticle(practice: Practice): HTMLElement {
  const heading = within(main()).getByText(displayTitle(practice.heading));
  const article = heading.closest('article');
  if (!article) throw new Error(`No article for "${practice.heading}"`);
  return article;
}

/** Escapes a string for use inside a RegExp. */
export function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds a sidebar link by its source heading.
 *
 * Accessible names are whitespace-normalised by the accname algorithm, and the
 * label itself is the shortened display title.
 */
export function navLink(heading: string): HTMLElement {
  const label = displayTitle(heading).replace(/\s+/g, ' ');
  return within(sidebar()).getByRole('link', { name: new RegExp(`^${escapeRe(label)}`) });
}
