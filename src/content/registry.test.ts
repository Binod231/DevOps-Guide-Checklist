import { describe, expect, it } from 'vitest';
import {
  GUIDE_CHECKLIST,
  NAV_TREE,
  PHASE_CHECKLIST,
  READINESS_CHECKLIST,
  ROUTES,
  TOTAL_CHECKBOXES,
  allPractices,
  categoryById,
  checkboxIds,
  checklist,
  guide,
  navLeaves,
  openIssues,
  practiceById,
  practiceForTrackerRow,
  totalPhaseItems,
  tracker,
  trackerRowByKey,
  trackerRowForPractice,
  trackerRowsForGuideCategory,
} from './registry';
import type { NavGroup, NavLeaf } from './registry';

function group(id: string): NavGroup {
  const node = NAV_TREE.find((n) => n.id === id);
  if (!node || node.kind !== 'group') throw new Error(`No nav group "${id}"`);
  return node;
}

function leaf(id: string): NavLeaf {
  const found = navLeaves().find((l) => l.id === id);
  if (!found) throw new Error(`No nav leaf "${id}"`);
  return found;
}

describe('registry — documents', () => {
  it('exposes the three parsed documents', () => {
    expect(guide.title).toBe('DevOps Implementation Guide');
    expect(checklist.title).toBe('DevOps Operational Checklist');
    expect(tracker.rows).toHaveLength(24);
  });
});

describe('registry — navigation derived from the documents', () => {
  it('groups the sidebar by source document title', () => {
    expect(group('guide').label).toBe(guide.title);
    expect(group('checklist').label).toBe(checklist.title);
    expect(group('tracker').label).toBe(checklist.trackerLinkLabel);
  });

  it('lists all 6 guide categories using their verbatim headings', () => {
    const children = group('guide').children as NavLeaf[];
    expect(children).toHaveLength(6);
    expect(children.map((c) => c.label)).toEqual(guide.categories.map((c) => c.heading));
  });

  it('shows the practice count beside each category', () => {
    const children = group('guide').children as NavLeaf[];
    expect(children.map((c) => c.count)).toEqual([5, 5, 2, 4, 6, 2]);
  });

  it('exposes all 24 practices as third-level anchors', () => {
    const children = group('guide').children as NavLeaf[];
    const anchors = children.flatMap((c) => c.anchors ?? []);
    expect(anchors).toHaveLength(24);
    expect(anchors.map((a) => a.label)).toEqual(allPractices.map((p) => p.heading));
  });

  it('lists the 4 phases as anchors under the implementation order', () => {
    const node = leaf('implementation-order');
    expect(node.label).toBe('Suggested Implementation Order');
    expect(node.count).toBe(23);
    expect(node.anchors?.map((a) => a.label)).toEqual(checklist.phases.map((p) => p.heading));
  });

  it('shows the readiness criteria count', () => {
    const node = leaf('production-readiness');
    expect(node.label).toBe('Production Readiness Gate');
    expect(node.count).toBe(16);
  });

  it('lists the notes subsections as anchors', () => {
    const node = leaf('notes');
    expect(node.label).toBe('Notes & Decisions');
    expect(node.anchors?.map((a) => a.label)).toEqual([
      'Architecture Notes',
      'Security Notes',
      'Incident / Recovery Notes',
      'Open Issues',
      'Useful Links',
    ]);
  });

  it('shows the tracker row count', () => {
    expect(leaf('tracker').count).toBe(24);
  });

  it('gives every leaf a route that exists in ROUTES', () => {
    const known = new Set([
      ROUTES.overview,
      ROUTES.implementationOrder,
      ROUTES.productionReadiness,
      ROUTES.notes,
      ROUTES.tracker,
      ...guide.categories.map((c) => ROUTES.guideCategory(c.id)),
    ]);
    for (const node of navLeaves()) expect(known, node.path).toContain(node.path);
  });

  it('has no duplicate leaf paths', () => {
    const paths = navLeaves().map((l) => l.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('invents no navigation labels', () => {
    // Every label must be a heading or title taken from a source document.
    const sourceLabels = new Set<string>([
      guide.title,
      guide.objective.heading,
      checklist.title,
      checklist.implementationOrderHeading,
      checklist.readinessGate.heading,
      checklist.notes.heading,
      checklist.notes.openIssuesHeading,
      checklist.notes.usefulLinksHeading,
      checklist.trackerLinkLabel,
      ...guide.categories.map((c) => c.heading),
      ...allPractices.map((p) => p.heading),
      ...checklist.phases.map((p) => p.heading),
      ...checklist.notes.noteSections.map((s) => s.heading),
    ]);

    const collect = (nodes: typeof NAV_TREE): string[] =>
      nodes.flatMap((node) =>
        node.kind === 'group'
          ? [node.label, ...collect(node.children)]
          : [node.label, ...(node.anchors ?? []).map((a) => a.label)],
      );

    const unknown = collect(NAV_TREE).filter((label) => !sourceLabels.has(label));
    expect(unknown, 'these sidebar labels are not source headings').toEqual([]);
  });
});

describe('registry — lookups', () => {
  it('indexes all 24 practices and 6 categories', () => {
    expect(practiceById.size).toBe(24);
    expect(categoryById.size).toBe(6);
    expect(trackerRowByKey.size).toBe(24);
  });

  it('resolves a practice to its tracker row', () => {
    const row = trackerRowForPractice('enforced-two-factor-authentication');
    expect(row?.sn).toBe('ST-14');
    expect(row?.implementationItem).toBe('Enforced Two-Factor Authentication');
  });

  it('resolves a tracker row back to its practice', () => {
    expect(practiceForTrackerRow('st-13--security')?.heading).toBe(
      'Automated Container & Binary Vulnerability Scanning',
    );
  });

  it('round-trips every practice through the cross-link', () => {
    for (const practice of allPractices) {
      const row = trackerRowForPractice(practice.id);
      expect(row, practice.heading).toBeDefined();
      expect(practiceForTrackerRow(row!.rowKey)?.id).toBe(practice.id);
    }
  });

  it('groups tracker rows by guide category despite the differing names', () => {
    // Guide says `4. Security`; the tracker says `Security`.
    const rows = trackerRowsForGuideCategory('4-security');
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.sn).sort()).toEqual(['ST-12', 'ST-13', 'ST-14', 'ST-15']);

    // Guide says `1. Source Code Management & CI/CD`; the tracker says `SCM & CI/CD`.
    expect(trackerRowsForGuideCategory('1-source-code-management-ci-cd')).toHaveLength(5);
  });

  it('returns tracker rows for all 6 categories, so no tab is ever empty', () => {
    for (const category of guide.categories) {
      expect(
        trackerRowsForGuideCategory(category.id).length,
        category.heading,
      ).toBe(category.practices.length);
    }
  });

  it('returns nothing for an unknown category', () => {
    expect(trackerRowsForGuideCategory('nope')).toEqual([]);
  });
});

describe('registry — checklist universes', () => {
  it('reports 24 / 23 / 16 ids for the three universes', () => {
    expect(checkboxIds(GUIDE_CHECKLIST)).toHaveLength(24);
    expect(checkboxIds(PHASE_CHECKLIST)).toHaveLength(23);
    expect(checkboxIds(READINESS_CHECKLIST)).toHaveLength(16);
  });

  it('keeps the universes disjoint', () => {
    const all = [
      ...checkboxIds(GUIDE_CHECKLIST),
      ...checkboxIds(PHASE_CHECKLIST),
      ...checkboxIds(READINESS_CHECKLIST),
    ];
    expect(new Set(all).size).toBe(63);
  });

  it('totals 63 interactive checkboxes', () => {
    expect(TOTAL_CHECKBOXES).toBe(63);
    expect(totalPhaseItems()).toBe(23);
  });

  it('keeps the 3 blank Open Issues out of the trackable universes', () => {
    expect(openIssues).toHaveLength(3);
    const all = new Set([
      ...checkboxIds(GUIDE_CHECKLIST),
      ...checkboxIds(PHASE_CHECKLIST),
      ...checkboxIds(READINESS_CHECKLIST),
    ]);
    for (const item of openIssues) expect(all.has(item.id)).toBe(false);
  });

  it('returns ids in source order', () => {
    expect(checkboxIds(GUIDE_CHECKLIST)[0]).toBe('branch-protections-single-pr-approvals');
    expect(checkboxIds(READINESS_CHECKLIST)[0]).toContain('readiness--');
  });
});
