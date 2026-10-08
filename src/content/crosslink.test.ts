import { describe, expect, it } from 'vitest';
import sources from './generated/sources.json';
import { parseGuide } from './parsers/guide';
import { parseTracker } from './parsers/tracker';
import { buildGuideTrackerLinks, declaredPairCount, trackerCategoryOrder } from './crosslink';

const guide = parseGuide(sources.guide);
const tracker = parseTracker(sources.tracker, sources.trackerAll);
const links = buildGuideTrackerLinks(guide, tracker);

const practices = guide.categories.flatMap((c) => c.practices);
const practiceById = new Map(practices.map((p) => [p.id, p]));
const rowByKey = new Map(tracker.rows.map((r) => [r.rowKey, r]));

/** Content words shared by a pair, ignoring wording differences. */
function significantWords(text: string): Set<string> {
  const stop = new Set([
    'and',
    'the',
    'for',
    'with',
    'in',
    'of',
    'a',
    'an',
    'to',
    'optional',
    'startup',
    'startups',
    'automated',
    'is',
    'or',
    'small',
    'company',
    'env',
    'implement',
    'they',
    'want',
    'more',
    'security',
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w)),
  );
}

describe('guide <-> tracker cross-link', () => {
  it('declares exactly 24 pairs', () => {
    expect(declaredPairCount).toBe(24);
    expect(links).toHaveLength(24);
  });

  it('covers every guide practice exactly once', () => {
    const linked = links.map((l) => l.practiceId);
    expect(new Set(linked).size).toBe(24);
    expect(new Set(linked)).toEqual(new Set(practices.map((p) => p.id)));
  });

  it('covers every tracker row exactly once', () => {
    const linked = links.map((l) => l.rowKey);
    expect(new Set(linked).size).toBe(24);
    expect(new Set(linked)).toEqual(new Set(tracker.rows.map((r) => r.rowKey)));
  });

  it('leaves no orphans on either side', () => {
    const linkedPractices = new Set(links.map((l) => l.practiceId));
    const linkedRows = new Set(links.map((l) => l.rowKey));
    expect(practices.filter((p) => !linkedPractices.has(p.id))).toEqual([]);
    expect(tracker.rows.filter((r) => !linkedRows.has(r.rowKey))).toEqual([]);
  });

  it('never pairs across a category boundary', () => {
    const trackerCategories = trackerCategoryOrder(tracker);
    const guideIndexOf = new Map<string, number>();
    guide.categories.forEach((c, i) => {
      for (const p of c.practices) guideIndexOf.set(p.id, i);
    });

    for (const link of links) {
      const row = rowByKey.get(link.rowKey)!;
      expect(guideIndexOf.get(link.practiceId), link.practiceId).toBe(
        trackerCategories.indexOf(row.category),
      );
    }
  });

  it('pairs entries that share distinctive terminology', () => {
    // A sanity check on the hand-written table, not the matching mechanism.
    const weak: string[] = [];
    for (const link of links) {
      const practice = practiceById.get(link.practiceId)!;
      const row = rowByKey.get(link.rowKey)!;
      const a = significantWords(practice.heading);
      const b = significantWords(row.implementationItem);
      const shared = [...b].filter((w) => a.has(w));
      if (shared.length === 0) weak.push(`${practice.heading} <-> ${row.implementationItem}`);
    }
    expect(weak, 'every pair should share at least one content word').toEqual([]);
  });

  it('handles the two categories the documents order differently', () => {
    const rowFor = (practiceId: string) =>
      rowByKey.get(links.find((l) => l.practiceId === practiceId)!.rowKey)!;

    // Security: the guide lists 2FA before container scanning; the tracker
    // numbers them the other way round.
    expect(rowFor('enforced-two-factor-authentication').sn).toBe('ST-14');
    expect(rowFor('automated-container-binary-vulnerability-scanning').sn).toBe('ST-13');

    // Disaster Recovery: same situation.
    expect(rowFor('automated-database-backups-point-in-time-recovery').sn).toBe('ST-23');
    expect(rowFor('documented-rollback-procedure-one-click-reverts').sn).toBe('ST-22');
  });

  it('maps both ST-10 rows to their own practice', () => {
    const byRow = new Map(links.map((l) => [l.rowKey, l.practiceId]));
    expect(byRow.get('st-10--infrastructure')).toBe('cloud-finops-guardrails-budget-ceilings');
    expect(byRow.get('st-10--testing-quality')).toBe('automated-core-integration-api-tests');
  });
});

describe('cross-link drift detection', () => {
  it('fails when a guide practice disappears from the documents', () => {
    const trimmed = structuredClone(guide);
    trimmed.categories[3]!.practices = trimmed.categories[3]!.practices.filter(
      (p) => p.id !== 'enforced-two-factor-authentication',
    );
    expect(() => buildGuideTrackerLinks(trimmed, tracker)).toThrow(
      /declared practice "enforced-two-factor-authentication" is not in the guide/,
    );
  });

  it('fails when a tracker row disappears', () => {
    const trimmed = structuredClone(tracker);
    trimmed.rows = trimmed.rows.filter((r) => r.rowKey !== 'st-14--security');
    expect(() => buildGuideTrackerLinks(guide, trimmed)).toThrow(
      /declared tracker row "st-14--security" is not in the tracker/,
    );
  });

  it('fails when a new guide practice has no declared pair', () => {
    const extended = structuredClone(guide);
    const template = extended.categories[3]!.practices[0]!;
    extended.categories[3]!.practices.push({ ...template, id: 'newly-added-practice' });
    expect(() => buildGuideTrackerLinks(extended, tracker)).toThrow(
      /guide practice\(s\) have no tracker pair: newly-added-practice/,
    );
  });

  it('fails when the category counts stop matching', () => {
    const trimmed = structuredClone(guide);
    trimmed.categories = trimmed.categories.slice(0, 5);
    expect(() => buildGuideTrackerLinks(trimmed, tracker)).toThrow(/categories but the tracker/);
  });
});
