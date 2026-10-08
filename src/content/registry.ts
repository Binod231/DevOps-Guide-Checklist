/**
 * The portal's single content entry point.
 *
 * Everything the UI renders is read from here, and the navigation tree is
 * derived from the parsed documents rather than hand-listed. If a heading is
 * added, renamed or removed in a source file, the sidebar follows on the next
 * `npm run generate-content`; it cannot drift.
 */
import guideJson from './generated/guide.json';
import checklistJson from './generated/checklist.json';
import trackerJson from './generated/tracker.json';
import linksJson from './generated/crosslinks.json';
import type {
  ChecklistDocument,
  ChecklistItem,
  GuideCategory,
  GuideDocument,
  GuideTrackerLink,
  Phase,
  Practice,
  TrackerDocument,
  TrackerRow,
} from './types';
import { UI_FLAGS } from '../config/uiFlags';

export const guide = guideJson as GuideDocument;
export const checklist = checklistJson as ChecklistDocument;
export const tracker = trackerJson as TrackerDocument;
export const guideTrackerLinks = linksJson as GuideTrackerLink[];

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

export const ROUTES = {
  overview: '/',
  guideCategory: (categoryId: string) => `/guide/${categoryId}`,
  implementationOrder: '/checklist/implementation-order',
  productionReadiness: '/checklist/production-readiness',
  notes: '/notes',
  tracker: '/tracker',
} as const;

/* ------------------------------------------------------------------ *
 * Navigation tree, derived from the documents
 * ------------------------------------------------------------------ */

export interface NavLeaf {
  kind: 'leaf';
  id: string;
  /** Label shown in the sidebar, taken from the source heading. */
  label: string;
  path: string;
  /** Count shown beside the label, when the section holds countable items. */
  count?: number;
  /** Anchor targets beneath this entry, for third-level navigation. */
  anchors?: { id: string; label: string }[];
}

export interface NavGroup {
  kind: 'group';
  id: string;
  /** Group label, taken from a source document title or section heading. */
  label: string;
  children: NavNode[];
}

export type NavNode = NavLeaf | NavGroup;

function guideCategoryLeaf(category: GuideCategory): NavLeaf {
  return {
    kind: 'leaf',
    id: category.id,
    label: category.heading,
    path: ROUTES.guideCategory(category.id),
    count: category.practices.length,
    anchors: category.practices.map((p) => ({ id: p.id, label: p.heading })),
  };
}

function phaseAnchor(phase: Phase): { id: string; label: string } {
  return { id: phase.id, label: phase.heading };
}

/**
 * The sidebar tree.
 *
 * Top-level groups are the three source document titles. Nothing here is
 * invented: every label is a heading or title lifted from a source file.
 */
export const NAV_TREE: NavNode[] = [
  {
    kind: 'leaf',
    id: 'overview',
    label: guide.objective.heading,
    path: ROUTES.overview,
  },
  {
    kind: 'group',
    id: 'guide',
    label: guide.title,
    children: guide.categories.map(guideCategoryLeaf),
  },
  {
    kind: 'group',
    id: 'checklist',
    label: checklist.title,
    children: [
      {
        kind: 'leaf',
        id: 'implementation-order',
        label: checklist.implementationOrderHeading,
        path: ROUTES.implementationOrder,
        count: totalPhaseItems(),
        anchors: checklist.phases.map(phaseAnchor),
      },
      {
        kind: 'leaf',
        id: 'production-readiness',
        label: checklist.readinessGate.heading,
        path: ROUTES.productionReadiness,
        count: checklist.readinessGate.criteria.length,
      },
      {
        kind: 'leaf',
        id: 'notes',
        label: checklist.notes.heading,
        path: ROUTES.notes,
        anchors: [
          ...checklist.notes.noteSections.map((s) => ({ id: s.id, label: s.heading })),
          { id: 'open-issues', label: checklist.notes.openIssuesHeading },
          { id: 'useful-links', label: checklist.notes.usefulLinksHeading },
        ],
      },
    ],
  },
  {
    kind: 'group',
    id: 'tracker',
    label: checklist.trackerLinkLabel,
    children: [
      {
        kind: 'leaf',
        id: 'tracker',
        label: checklist.trackerLinkLabel,
        path: ROUTES.tracker,
        count: tracker.rows.length,
      },
    ],
  },
];

/** Flattened leaves, in sidebar order. */
export function navLeaves(nodes: NavNode[] = NAV_TREE): NavLeaf[] {
  return nodes.flatMap((node) => (node.kind === 'leaf' ? [node] : navLeaves(node.children)));
}

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export const allPractices: Practice[] = guide.categories.flatMap((c) => c.practices);

export const practiceById = new Map(allPractices.map((p) => [p.id, p]));
export const categoryById = new Map(guide.categories.map((c) => [c.id, c]));
export const trackerRowByKey = new Map(tracker.rows.map((r) => [r.rowKey, r]));

const rowKeyByPracticeId = new Map(guideTrackerLinks.map((l) => [l.practiceId, l.rowKey]));
const practiceIdByRowKey = new Map(guideTrackerLinks.map((l) => [l.rowKey, l.practiceId]));

/** The tracker row linked to a practice, or undefined when the flag is off. */
export function trackerRowForPractice(practiceId: string): TrackerRow | undefined {
  if (!UI_FLAGS.guideTrackerCrossLink) return undefined;
  const rowKey = rowKeyByPracticeId.get(practiceId);
  return rowKey ? trackerRowByKey.get(rowKey) : undefined;
}

/** The practice linked to a tracker row, or undefined when the flag is off. */
export function practiceForTrackerRow(rowKey: string): Practice | undefined {
  if (!UI_FLAGS.guideTrackerCrossLink) return undefined;
  const practiceId = practiceIdByRowKey.get(rowKey);
  return practiceId ? practiceById.get(practiceId) : undefined;
}

/**
 * Tracker rows belonging to a guide category.
 *
 * Resolved through the cross-link rather than by comparing category names,
 * which differ between the two documents.
 */
export function trackerRowsForGuideCategory(categoryId: string): TrackerRow[] {
  const category = categoryById.get(categoryId);
  if (!category) return [];
  return category.practices
    .map((p) => trackerRowForPractice(p.id))
    .filter((r): r is TrackerRow => r !== undefined);
}

/* ------------------------------------------------------------------ *
 * Checklist universes
 *
 * The three sets of checkboxes are worded differently in the source and are
 * tracked independently. They are never merged or cross-mapped.
 * ------------------------------------------------------------------ */

export const GUIDE_CHECKLIST = 'guide' as const;
export const PHASE_CHECKLIST = 'phases' as const;
export const READINESS_CHECKLIST = 'readiness' as const;

export type ChecklistUniverse =
  | typeof GUIDE_CHECKLIST
  | typeof PHASE_CHECKLIST
  | typeof READINESS_CHECKLIST;

/** Every checkbox id in a universe, in source order. */
export function checkboxIds(universe: ChecklistUniverse): string[] {
  switch (universe) {
    case GUIDE_CHECKLIST:
      return allPractices.map((p) => p.id);
    case PHASE_CHECKLIST:
      return checklist.phases.flatMap((p) => p.items.map((i) => i.id));
    case READINESS_CHECKLIST:
      return checklist.readinessGate.criteria.map((c) => c.id);
  }
}

export function totalPhaseItems(): number {
  return checklist.phases.reduce((n, p) => n + p.items.length, 0);
}

/** Open Issues rows, which the source leaves deliberately blank. */
export const openIssues: ChecklistItem[] = checklist.notes.openIssues;

/** Interactive checkbox total across all three universes. */
export const TOTAL_CHECKBOXES =
  allPractices.length + totalPhaseItems() + checklist.readinessGate.criteria.length;
