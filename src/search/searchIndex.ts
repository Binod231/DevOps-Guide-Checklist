/**
 * The search index.
 *
 * Built entirely from parsed source content. Every entry's searchable text and
 * displayed snippet come from a source document, so a query can never surface
 * text the reader could not find by reading the documents themselves.
 *
 * Each entry carries the route and anchor needed to deep-link to where the text
 * actually lives.
 */
import {
  ROUTES,
  allPractices,
  checklist,
  guide,
  practiceForTrackerRow,
  tracker,
  trackerRowForPractice,
} from '../content/registry';
import { displayTitle } from '../content/displayTitle';

/** Which source document an entry came from, for grouping results. */
export type SearchGroup =
  | 'DevOps Implementation Guide'
  | 'DevOps Operational Checklist'
  | 'Implementation Tracker';

export interface SearchEntry {
  id: string;
  group: SearchGroup;
  /** Primary result line, e.g. a heading or an item's text. */
  title: string;
  /** Where in the document this sits, e.g. the owning category heading. */
  context: string;
  /** Field label when the match is inside a labelled field. */
  field?: string;
  /** The text matched against. */
  haystack: string;
  /** Text shown beneath the title, when it adds anything. */
  snippet?: string;
  path: string;
  anchor?: string;
}

function entryUrl(entry: SearchEntry): string {
  return entry.anchor ? `${entry.path}#${entry.anchor}` : entry.path;
}

export { entryUrl };

/* ------------------------------------------------------------------ *
 * Index construction
 * ------------------------------------------------------------------ */

function guideEntries(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  entries.push({
    id: 'guide-objective',
    group: 'DevOps Implementation Guide',
    title: guide.objective.heading,
    context: guide.title,
    haystack: [
      guide.objective.heading,
      guide.objective.leadParagraph,
      guide.objective.principlesLabel,
      guide.objective.closingParagraph,
    ].join(' \u2022 '),
    snippet: guide.objective.leadParagraph,
    path: ROUTES.overview,
  });

  for (const principle of guide.objective.principles) {
    entries.push({
      id: `principle-${principle.id}`,
      group: 'DevOps Implementation Guide',
      title: principle.term,
      context: `${guide.objective.heading} \u203a ${guide.objective.principlesLabel}`,
      haystack: `${principle.term} ${principle.detail}`,
      snippet: principle.detail,
      path: ROUTES.overview,
    });
  }

  for (const category of guide.categories) {
    entries.push({
      id: `category-${category.id}`,
      group: 'DevOps Implementation Guide',
      title: displayTitle(category.heading),
      context: guide.title,
      // The full heading stays searchable even though the title is shortened.
      haystack: category.heading,
      path: ROUTES.guideCategory(category.id),
    });

    for (const practice of category.practices) {
      const path = ROUTES.guideCategory(category.id);
      const row = trackerRowForPractice(practice.id);

      entries.push({
        id: `practice-${practice.id}`,
        group: 'DevOps Implementation Guide',
        title: displayTitle(practice.heading),
        context: displayTitle(category.heading),
        // The linked tracker S.N is included so searching an ID finds the
        // practice too. It is the row's own identifier, not invented text.
        haystack: [practice.heading, practice.checkboxLabel, row?.sn ?? ''].join(' '),
        path,
        anchor: practice.id,
      });

      const fields: { label: string; value: string }[] = [
        { label: 'Description', value: practice.description },
        { label: 'Why it matters', value: practice.whyItMatters },
        { label: 'Key concepts', value: practice.keyConcepts.join(' \u2022 ') },
        { label: 'Recommended tools', value: practice.recommendedTools },
        { label: 'Verification gate', value: practice.verificationGate },
      ];

      for (const field of fields) {
        entries.push({
          id: `practice-${practice.id}-${field.label.replace(/\s+/g, '-').toLowerCase()}`,
          group: 'DevOps Implementation Guide',
          title: displayTitle(practice.heading),
          context: displayTitle(category.heading),
          field: field.label,
          haystack: field.value,
          snippet: field.value,
          path,
          anchor: practice.id,
        });
      }
    }
  }

  return entries;
}

function checklistEntries(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const doc: SearchGroup = 'DevOps Operational Checklist';

  entries.push({
    id: 'implementation-order',
    group: doc,
    title: checklist.implementationOrderHeading,
    context: checklist.title,
    haystack: checklist.implementationOrderHeading,
    path: ROUTES.implementationOrder,
  });

  for (const phase of checklist.phases) {
    entries.push({
      id: `phase-${phase.id}`,
      group: doc,
      title: phase.heading,
      context: checklist.implementationOrderHeading,
      haystack: phase.heading,
      path: ROUTES.implementationOrder,
      anchor: phase.id,
    });

    for (const item of phase.items) {
      entries.push({
        id: `phase-item-${item.id}`,
        group: doc,
        title: item.text,
        context: phase.heading,
        haystack: item.text,
        path: ROUTES.implementationOrder,
        anchor: phase.id,
      });
    }
  }

  entries.push({
    id: 'readiness-gate',
    group: doc,
    title: checklist.readinessGate.heading,
    context: checklist.title,
    haystack: `${checklist.readinessGate.heading} ${checklist.readinessGate.intro}`,
    snippet: checklist.readinessGate.intro,
    path: ROUTES.productionReadiness,
  });

  for (const criterion of checklist.readinessGate.criteria) {
    entries.push({
      id: `readiness-${criterion.id}`,
      group: doc,
      title: criterion.text,
      context: checklist.readinessGate.heading,
      haystack: criterion.text,
      path: ROUTES.productionReadiness,
    });
  }

  entries.push({
    id: 'notes',
    group: doc,
    title: checklist.notes.heading,
    context: checklist.title,
    haystack: checklist.notes.heading,
    path: ROUTES.notes,
  });

  for (const section of checklist.notes.noteSections) {
    entries.push({
      id: `note-${section.id}`,
      group: doc,
      title: section.heading,
      context: checklist.notes.heading,
      haystack: `${section.heading} ${section.prompt}`,
      snippet: section.prompt,
      path: ROUTES.notes,
      anchor: section.id,
    });
  }

  entries.push({
    id: 'open-issues',
    group: doc,
    title: checklist.notes.openIssuesHeading,
    context: checklist.notes.heading,
    haystack: checklist.notes.openIssuesHeading,
    path: ROUTES.notes,
    anchor: 'open-issues',
  });

  entries.push({
    id: 'useful-links',
    group: doc,
    title: checklist.notes.usefulLinksHeading,
    context: checklist.notes.heading,
    haystack: [
      checklist.notes.usefulLinksHeading,
      ...checklist.notes.usefulLinks.map((l) => l.label),
    ].join(' '),
    path: ROUTES.notes,
    anchor: 'useful-links',
  });

  for (const link of checklist.notes.usefulLinks) {
    entries.push({
      id: `link-${link.id}`,
      group: doc,
      title: link.label,
      context: checklist.notes.usefulLinksHeading,
      haystack: link.label,
      path: ROUTES.notes,
      anchor: 'useful-links',
    });
  }

  return entries;
}

function trackerEntries(): SearchEntry[] {
  return tracker.rows.map((row) => {
    const practice = practiceForTrackerRow(row.rowKey);
    return {
      id: `tracker-${row.rowKey}`,
      group: 'Implementation Tracker' as const,
      title: `${row.sn} \u00b7 ${row.implementationItem.trim()}`,
      context: row.category,
      haystack: [
        row.sn,
        row.category,
        row.implementationItem,
        row.companyStage,
        row.priority,
        row.status,
        row.verificationGate,
        row.verified,
        // The linked guide heading, so searching the guide's wording finds the
        // row as well.
        practice?.heading ?? '',
      ].join(' '),

      snippet: row.verificationGate.trim(),
      path: ROUTES.tracker,
    };
  });
}

export const SEARCH_INDEX: SearchEntry[] = [
  ...guideEntries(),
  ...checklistEntries(),
  ...trackerEntries(),
];

/** Group order in the results list, matching the sidebar. */
export const GROUP_ORDER: SearchGroup[] = [
  'DevOps Implementation Guide',
  'DevOps Operational Checklist',
  'Implementation Tracker',
];

/* ------------------------------------------------------------------ *
 * Querying
 * ------------------------------------------------------------------ */

export interface SearchResult extends SearchEntry {
  score: number;
}

function normalise(text: string): string {
  return text.toLowerCase();
}

/**
 * Scores an entry against a query.
 *
 * Every term must appear somewhere in the entry, so multi-word queries narrow
 * rather than widen. Returns 0 when the entry does not match.
 */
function scoreEntry(entry: SearchEntry, terms: string[]): number {
  const title = normalise(entry.title);
  const haystack = normalise(entry.haystack);
  let score = 0;

  for (const term of terms) {
    const inTitle = title.includes(term);
    const inHaystack = haystack.includes(term);
    if (!inTitle && !inHaystack) return 0;

    if (title === term) score += 100;
    else if (title.startsWith(term)) score += 40;
    else if (inTitle) score += 20;
    if (inHaystack) score += 5;
  }

  // A heading-level entry is a more useful landing point than a field match.
  if (!entry.field) score += 3;
  return score;
}

export function search(query: string, limit = 40): SearchResult[] {
  const terms = normalise(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (terms.length === 0) return [];

  const results: SearchResult[] = [];
  for (const entry of SEARCH_INDEX) {
    const score = scoreEntry(entry, terms);
    if (score > 0) results.push({ ...entry, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (groupDiff !== 0) return groupDiff;
    return a.title.localeCompare(b.title, 'en');
  });

  return results.slice(0, limit);
}

/** Results bucketed by source document, preserving the ranking inside each. */
export function groupResults(results: SearchResult[]): { group: SearchGroup; results: SearchResult[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    results: results.filter((r) => r.group === group),
  })).filter((bucket) => bucket.results.length > 0);
}

/** Total indexed entries, exposed so tests can guard against a shrinking index. */
export const INDEX_SIZE = SEARCH_INDEX.length;

/** Every practice is indexed; exposed for coverage assertions. */
export const INDEXED_PRACTICE_COUNT = allPractices.length;
