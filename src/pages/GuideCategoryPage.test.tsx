import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderRoute';
import { ROUTES, allPractices, guide } from '../content/registry';
import type { Practice } from '../content/types';

/** The five labelled fields, in source order. */
const FIELD_LABELS = [
  'Description',
  'Why it matters',
  'Key concepts',
  'Recommended tools',
  'Verification gate',
];

/**
 * Locates a practice's article.
 *
 * Scoped to the `main` landmark because the heading also appears as a
 * third-level anchor in the sidebar.
 */
function practiceArticle(practice: Practice): HTMLElement {
  const main = screen.getByRole('main');
  const heading = within(main).getByText(practice.heading);
  const article = heading.closest('article');
  if (!article) throw new Error(`No article for "${practice.heading}"`);
  return article;
}

describe('guide category page — practice rendering', () => {
  it.each(guide.categories.map((c) => [c.heading, c.id, c.practices.length] as const))(
    'renders the exact practice count for "%s"',
    (_heading, id, count) => {
      renderApp(ROUTES.guideCategory(id));
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(count);
    },
  );

  it('renders all 24 practices across the 6 category pages', () => {
    let total = 0;
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      total += screen.getAllByRole('article').length;
      unmount();
    }
    expect(total).toBe(24);
  });

  it('keeps practices in source order', () => {
    const category = guide.categories[0]!;
    renderApp(ROUTES.guideCategory(category.id));
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent ?? '');
    category.practices.forEach((practice, index) => {
      expect(headings[index]).toContain(practice.heading);
    });
  });

  it('gives every practice an anchor id matching its slug', () => {
    const category = guide.categories[4]!;
    renderApp(ROUTES.guideCategory(category.id));
    for (const practice of category.practices) {
      expect(practiceArticle(practice)).toHaveAttribute('id', practice.id);
    }
  });

  it('offers a self-link to each practice anchor', () => {
    const category = guide.categories[2]!;
    renderApp(ROUTES.guideCategory(category.id));
    for (const practice of category.practices) {
      expect(
        screen.getByRole('link', { name: `Link to ${practice.heading}` }),
      ).toHaveAttribute('href', `#${practice.id}`);
    }
  });
});

describe('guide category page — field blocks', () => {
  it('shows all five labelled fields in source order for every practice', () => {
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      for (const practice of category.practices) {
        // Scoped to the field list, so the tracker metadata strip above it is
        // not counted.
        const fields = practiceArticle(practice).querySelector('[data-practice-fields]');
        expect(fields, practice.heading).not.toBeNull();
        const labels = [...fields!.querySelectorAll('dt')].map((t) => t.textContent);
        expect(labels, practice.heading).toEqual(FIELD_LABELS);
      }
      unmount();
    }
  });

  it('renders every field value verbatim', () => {
    for (const category of guide.categories) {
      const { unmount } = renderApp(ROUTES.guideCategory(category.id));
      for (const practice of category.practices) {
        const text = practiceArticle(practice).textContent ?? '';
        // Code spans lose their backticks when rendered as <code>, so compare
        // against the de-ticked form.
        expect(text, `${practice.heading} description`).toContain(strip(practice.description));
        expect(text, `${practice.heading} whyItMatters`).toContain(strip(practice.whyItMatters));
        expect(text, `${practice.heading} tools`).toContain(strip(practice.recommendedTools));
        expect(text, `${practice.heading} gate`).toContain(strip(practice.verificationGate));
        for (const concept of practice.keyConcepts) {
          expect(text, `${practice.heading} concept`).toContain(strip(concept));
        }
      }
      unmount();
    }
  });

  it('renders key concepts as a list', () => {
    const practice = allPractices.find((p) => p.heading === 'Infrastructure as Code')!;
    renderApp(ROUTES.guideCategory(practice.categoryId));
    const article = within(practiceArticle(practice));
    const list = article.getAllByRole('list').at(-1)!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(practice.keyConcepts.length);
  });

  it('renders the 4-concept practices at their authored length', () => {
    const practice = allPractices.find(
      (p) => p.heading === 'Automated Database Backups & Point-in-Time Recovery',
    )!;
    renderApp(ROUTES.guideCategory(practice.categoryId));
    const text = practiceArticle(practice).textContent ?? '';
    expect(practice.keyConcepts).toHaveLength(4);
    for (const concept of practice.keyConcepts) expect(text).toContain(strip(concept));
  });

  it('renders the mis-nested practices with their three concepts intact', () => {
    for (const heading of [
      'Backward-Compatible Database Migrations (Expand and Contract)',
      'Secure Container Registries & Access Control',
      'On-Call Rotation and Incident Routing (Optional for Startups)',
    ]) {
      const practice = allPractices.find((p) => p.heading === heading)!;
      const { unmount } = renderApp(ROUTES.guideCategory(practice.categoryId));
      const article = within(practiceArticle(practice));
      const list = article.getAllByRole('list').at(-1)!;
      expect(within(list).getAllByRole('listitem'), heading).toHaveLength(3);
      // The label must not have leaked into the rendered concept text.
      expect(list.textContent).not.toContain('Key concepts:');
      unmount();
    }
  });
});

describe('guide category page — inline code', () => {
  it('renders source code spans as code elements', () => {
    const practice = allPractices.find((p) => p.heading === 'Infrastructure as Code')!;
    renderApp(ROUTES.guideCategory(practice.categoryId));
    const code = within(practiceArticle(practice)).getByText('terraform plan');
    expect(code.tagName).toBe('CODE');
  });

  it('renders both code spans in the branch-protection description', () => {
    const practice = allPractices[0]!;
    renderApp(ROUTES.guideCategory(practice.categoryId));
    const article = practiceArticle(practice);
    const codes = [...article.querySelectorAll('code')].map((c) => c.textContent);
    expect(codes).toEqual(expect.arrayContaining(['main', 'master']));
  });

  it('renders no fenced code blocks, since the sources contain none', () => {
    for (const category of guide.categories) {
      const { container, unmount } = renderApp(ROUTES.guideCategory(category.id));
      expect(container.querySelectorAll('pre')).toHaveLength(0);
      unmount();
    }
  });
});

describe('guide category page — heading hierarchy', () => {
  it('uses h1 for the category and h3 for each practice', () => {
    const category = guide.categories[1]!;
    renderApp(ROUTES.guideCategory(category.id));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(
      category.practices.length,
    );
  });

  it('never skips from h1 to h3 without an h2', () => {
    const category = guide.categories[1]!;
    const { container } = renderApp(ROUTES.guideCategory(category.id));
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
      Number(h.tagName[1]),
    );
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!, `at index ${i}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('guide category page — adjacent navigation', () => {
  it('offers a next link but no previous link on the first category', () => {
    renderApp(ROUTES.guideCategory(guide.categories[0]!.id));
    const nav = within(screen.getByRole('navigation', { name: 'Adjacent categories' }));
    expect(nav.getAllByRole('link')).toHaveLength(1);
    expect(nav.getByRole('link')).toHaveTextContent(guide.categories[1]!.title);
  });

  it('offers a previous link but no next link on the last category', () => {
    renderApp(ROUTES.guideCategory(guide.categories[5]!.id));
    const nav = within(screen.getByRole('navigation', { name: 'Adjacent categories' }));
    expect(nav.getAllByRole('link')).toHaveLength(1);
  });

  it('offers both links on a middle category', () => {
    renderApp(ROUTES.guideCategory(guide.categories[3]!.id));
    const nav = within(screen.getByRole('navigation', { name: 'Adjacent categories' }));
    expect(nav.getAllByRole('link')).toHaveLength(2);
  });
});

/** Removes backticks so rendered `<code>` text can be compared to source text. */
function strip(text: string): string {
  return text.replace(/`/g, '').replace(/\*\*/g, '');
}
