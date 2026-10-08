import { describe, expect, it } from 'vitest';
import sources from '../content/generated/sources.json';
import {
  GROUP_ORDER,
  INDEX_SIZE,
  SEARCH_INDEX,
  entryUrl,
  groupResults,
  search,
} from './searchIndex';
import { allPractices, checklist, guide, tracker } from '../content/registry';
import { displayTitle } from '../content/displayTitle';

const RAW = [sources.guide, sources.checklist, sources.tracker, sources.trackerAll] as const;

function titles(query: string): string[] {
  return search(query).map((r) => r.title);
}

describe('search index — coverage', () => {
  it('indexes a meaningful number of entries', () => {
    expect(INDEX_SIZE).toBeGreaterThan(200);
  });

  it('indexes every category, titled by its display title', () => {
    for (const category of guide.categories) {
      expect(
        SEARCH_INDEX.some((e) => e.title === displayTitle(category.heading)),
        category.heading,
      ).toBe(true);
    }
  });

  it('indexes every practice, titled by its display title', () => {
    for (const practice of allPractices) {
      expect(
        SEARCH_INDEX.some((e) => e.title === displayTitle(practice.heading)),
        practice.heading,
      ).toBe(true);
    }
  });

  it('keeps the full heading searchable even though the title is shortened', () => {
    // Searching the qualifier still reaches the practice.
    const results = search('Optional For Startup');
    expect(results.length).toBeGreaterThan(0);
    expect(search('Progressive Delivery & Canary Deployments (Optional For Startup)').length)
      .toBeGreaterThan(0);
  });

  it('indexes all five fields of every practice', () => {
    for (const practice of allPractices) {
      const fields = SEARCH_INDEX.filter(
        (e) => e.anchor === practice.id && e.field !== undefined,
      ).map((e) => e.field);
      expect(fields, practice.heading).toEqual([
        'Description',
        'Why it matters',
        'Key concepts',
        'Recommended tools',
        'Verification gate',
      ]);
    }
  });

  it('indexes every phase item', () => {
    for (const phase of checklist.phases) {
      for (const item of phase.items) {
        expect(SEARCH_INDEX.some((e) => e.title === item.text), item.text).toBe(true);
      }
    }
  });

  it('indexes every readiness criterion', () => {
    for (const criterion of checklist.readinessGate.criteria) {
      expect(SEARCH_INDEX.some((e) => e.title === criterion.text), criterion.text).toBe(true);
    }
  });

  it('indexes every note heading and useful link label', () => {
    for (const section of checklist.notes.noteSections) {
      expect(SEARCH_INDEX.some((e) => e.title === section.heading)).toBe(true);
    }
    for (const link of checklist.notes.usefulLinks) {
      expect(SEARCH_INDEX.some((e) => e.title === link.label), link.label).toBe(true);
    }
  });

  it('indexes all 24 tracker rows', () => {
    const trackerEntries = SEARCH_INDEX.filter((e) => e.group === 'Implementation Tracker');
    expect(trackerEntries).toHaveLength(24);
    for (const row of tracker.rows) {
      expect(trackerEntries.some((e) => e.title.startsWith(row.sn)), row.sn).toBe(true);
    }
  });

  it('indexes the six operating principles', () => {
    for (const principle of guide.objective.principles) {
      expect(SEARCH_INDEX.some((e) => e.title === principle.term), principle.term).toBe(true);
    }
  });

  it('gives every entry a route', () => {
    for (const entry of SEARCH_INDEX) expect(entry.path, entry.id).toMatch(/^\//);
  });

  it('gives every entry a unique id', () => {
    expect(new Set(SEARCH_INDEX.map((e) => e.id)).size).toBe(SEARCH_INDEX.length);
  });
});

describe('search index — content fidelity', () => {
  it('builds every searchable haystack from source text', () => {
    // Haystacks are joined source fields; each non-trivial word in a title must
    // be findable in the sources.
    const fabricated = SEARCH_INDEX.filter((entry) => {
      if (entry.field) return false;
      const bare = entry.title.split('\u00b7').pop()!.trim();
      if (bare.length < 4) return false;
      return !RAW.some((raw) => raw.includes(bare));
    }).map((e) => e.title);
    expect(fabricated).toEqual([]);
  });

  it('surfaces no result for text absent from the documents', () => {
    expect(search('service mesh')).toEqual([]);
    expect(search('zero trust networking')).toEqual([]);
    expect(search('SOC 2')).toEqual([]);
  });
});

describe('search — querying', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(search('')).toEqual([]);
    expect(search('   ')).toEqual([]);
  });

  it('finds the 2FA tracker row by its control ID', () => {
    const results = search('ST-14');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.title).toContain('ST-14');
    expect(results[0]!.title).toContain('Enforced Two-Factor Authentication');
  });

  it('finds every control ID in the source', () => {
    for (const row of tracker.rows) {
      const results = search(row.sn);
      expect(results.length, row.sn).toBeGreaterThan(0);
    }
  });

  it('finds both ST-10 rows from one query', () => {
    const results = search('ST-10').filter((r) => r.group === 'Implementation Tracker');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.title).join(' ')).toContain('Cloud FinOps');
    expect(results.map((r) => r.title).join(' ')).toContain('Core Integration');
  });

  it('finds Golden Signals and the APM gate from p99', () => {
    const results = search('p99');
    const text = results.map((r) => `${r.title} ${r.snippet ?? ''}`).join(' | ');
    expect(text).toContain('Golden Signals');
    // The APM verification gate and the readiness criterion both mention p99.
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('finds the Edge Security gate from 429', () => {
    const results = search('429');
    expect(results.length).toBeGreaterThan(0);
    const text = results.map((r) => `${r.title} ${r.snippet ?? ''}`).join(' | ');
    expect(text).toContain('429 Too Many Requests');
  });

  it('finds the Edge Security practice from WAF', () => {
    expect(titles('WAF').join(' ')).toContain('Edge Security, WAF & Ingress Rate Limiting');
  });

  it('is case insensitive', () => {
    expect(search('waf').length).toBe(search('WAF').length);
    expect(search('st-14').length).toBe(search('ST-14').length);
  });

  it('requires every term to match, so extra words narrow the result', () => {
    const broad = search('secret');
    const narrow = search('secret scanning');
    expect(narrow.length).toBeGreaterThan(0);
    expect(narrow.length).toBeLessThan(broad.length);
  });

  it('ranks an exact heading match first', () => {
    expect(search('Infrastructure as Code')[0]!.title).toBe('Infrastructure as Code');
  });

  it('finds a practice by text inside one of its fields', () => {
    const results = search('distroless');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.title).toBe('Automated Container & Binary Vulnerability Scanning');
    expect(results[0]!.field).toBe('Key concepts');
  });

  it('finds inline-code terms from the source', () => {
    expect(titles('traceparent').join(' ')).toContain('Distributed APM & OpenTelemetry Tracing');
    expect(titles('request_id').join(' ')).toContain('Structured Log Aggregation & Search');
    expect(titles('terraform plan').join(' ')).toContain('Infrastructure as Code');
  });

  it('finds a phase item by its own wording', () => {
    expect(titles('Organization-wide 2FA enforcement')).toContain(
      'Organization-wide 2FA enforcement',
    );
  });

  it('finds a readiness criterion by its own wording', () => {
    expect(titles('runbooks are documented')).toContain(
      'On-call escalation paths and runbooks are documented',
    );
  });

  it('finds a useful link label', () => {
    expect(titles('Incident runbook')).toContain('Incident runbook');
  });

  it('finds a tracker row from the guide wording for the same item', () => {
    // The guide calls ST-03 `Automated Secret Scanning in CI & Pre-Commit Hooks`.
    const results = search('Pre-Commit Hooks');
    expect(results.some((r) => r.group === 'Implementation Tracker')).toBe(true);
  });

  it('caps the result count', () => {
    expect(search('the', 10).length).toBeLessThanOrEqual(10);
  });
});

describe('search — deep links', () => {
  it('links a practice to its category route and anchor', () => {
    const practice = allPractices.find((p) => p.heading === 'Infrastructure as Code')!;
    const result = search('Infrastructure as Code')[0]!;
    expect(entryUrl(result)).toBe(`/guide/${practice.categoryId}#${practice.id}`);
  });

  it('links a phase item to the order page and the phase anchor', () => {
    const result = search('Organization-wide 2FA enforcement')[0]!;
    expect(entryUrl(result)).toBe(
      '/checklist/implementation-order#phase-1-foundations-infrastructure-identity-data-safety',
    );
  });

  it('links a readiness criterion to the readiness page', () => {
    const result = search('runbooks are documented')[0]!;
    expect(entryUrl(result)).toBe('/checklist/production-readiness');
  });

  it('links a tracker row to the tracker page', () => {
    const result = search('ST-14')[0]!;
    expect(entryUrl(result)).toBe('/tracker');
  });

  it('links a note section to its anchor', () => {
    const result = search('Architecture Notes')[0]!;
    expect(entryUrl(result)).toBe('/notes#architecture-notes');
  });
});

describe('search — grouping', () => {
  it('buckets results by source document in sidebar order', () => {
    const buckets = groupResults(search('2FA'));
    expect(buckets.map((b) => b.group)).toEqual(
      GROUP_ORDER.filter((g) => buckets.some((b) => b.group === g)),
    );
  });

  it('omits groups with no matches', () => {
    const buckets = groupResults(search('Operating principles'));
    expect(buckets.every((b) => b.results.length > 0)).toBe(true);
  });

  it('spans all three documents for a broadly-used term', () => {
    const buckets = groupResults(search('rollback'));
    expect(buckets.map((b) => b.group)).toEqual(GROUP_ORDER);
  });
});
