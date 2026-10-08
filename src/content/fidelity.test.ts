/**
 * The fidelity suite — the structural guarantee that the portal invents
 * nothing and drops nothing.
 *
 * The keystone test walks every string in the generated content tree and
 * asserts it appears verbatim somewhere in the raw text of one of the four
 * source documents. A fabricated sentence, a reworded requirement or a
 * "helpfully" tidied tool list would all fail it.
 *
 * Two classes of value are exempt, and both are declared explicitly below:
 *   - derived identifiers (slugs, row keys), which are routing machinery
 *     rather than content;
 *   - a small set of structural values which are source content with wrapping
 *     markdown syntax removed.
 */
import { describe, expect, it } from 'vitest';
import sources from './generated/sources.json';
import guideJson from './generated/guide.json';
import checklistJson from './generated/checklist.json';
import trackerJson from './generated/tracker.json';
import crosslinksJson from './generated/crosslinks.json';
import type { ChecklistDocument, GuideDocument, TrackerDocument } from './types';

const guide = guideJson as GuideDocument;
const checklist = checklistJson as ChecklistDocument;
const tracker = trackerJson as TrackerDocument;

/** All four source documents concatenated, for substring checking. */
const RAW_SOURCES = [
  sources.guide,
  sources.checklist,
  sources.tracker,
  sources.trackerAll,
] as const;

/**
 * Field names holding derived slug identifiers rather than document content.
 *
 * Slugs are lowercased and hyphenated, so they are not substrings of the
 * source by construction.
 */
const IDENTIFIER_FIELDS = new Set(['id', 'rowKey', 'categoryId', 'practiceId']);

/**
 * Field names holding a schema property name rather than document content.
 *
 * `TrackerColumn.field` records which `TrackerRow` property a CSV column feeds.
 * The column's `header` alongside it carries the verbatim source spelling and
 * is checked normally.
 */
const SCHEMA_FIELDS = new Set(['field']);

/** Valid `TrackerRow` property names, so the exemption cannot hide content. */
const TRACKER_ROW_FIELDS = new Set([
  'rowKey',
  'sn',
  'category',
  'implementationItem',
  'implementationBy',
  'companyStage',
  'priority',
  'status',
  'targetDate',
  'verificationGate',
  'verified',
  'verifiedBy',
  'sourceOrder',
]);

function isIdentifierField(field: string): boolean {
  return IDENTIFIER_FIELDS.has(field) || /(?:Id|Key)$/.test(field);
}

function isSchemaField(field: string): boolean {
  return SCHEMA_FIELDS.has(field);
}

function isExempt(field: string): boolean {
  return isIdentifierField(field) || isSchemaField(field);
}

/** Every string in the tree, paired with the path it was found at. */
function collectStrings(
  value: unknown,
  path: string,
  field: string,
  out: { path: string; field: string; value: string }[],
): void {
  if (typeof value === 'string') {
    out.push({ path, field, value });
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, field, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectStrings(child, `${path}.${key}`, key, out);
    }
  }
}

const ALL_STRINGS = (() => {
  const out: { path: string; field: string; value: string }[] = [];
  collectStrings(guide, 'guide', 'guide', out);
  collectStrings(checklist, 'checklist', 'checklist', out);
  collectStrings(tracker, 'tracker', 'tracker', out);
  collectStrings(crosslinksJson, 'crosslinks', 'crosslinks', out);
  return out;
})();

const CONTENT_STRINGS = ALL_STRINGS.filter(
  (entry) => !isExempt(entry.field) && entry.value.length > 0,
);

function appearsInSource(value: string): boolean {
  return RAW_SOURCES.some((source) => source.includes(value));
}

describe('keystone — every generated string is verbatim source text', () => {
  it('finds each content string in one of the four source documents', () => {
    const fabricated = CONTENT_STRINGS.filter((entry) => !appearsInSource(entry.value)).map(
      (entry) => `${entry.path} = ${JSON.stringify(entry.value)}`,
    );
    expect(fabricated, 'these strings are not present in any source document').toEqual([]);
  });

  it('checks a meaningful number of strings, so the test cannot pass vacuously', () => {
    expect(CONTENT_STRINGS.length).toBeGreaterThan(400);
  });

  it('would catch a fabricated value', () => {
    expect(appearsInSource('Implement a service mesh for zero-trust networking')).toBe(false);
  });

  it('would catch a reworded requirement', () => {
    // Real text, lightly reworded — exactly the failure mode being guarded against.
    expect(appearsInSource('Enforce branch protection on main and master branches')).toBe(false);
    expect(
      appearsInSource('Enforce branch protection on `main`/`master`. Prohibit direct pushes'),
    ).toBe(true);
  });

  it('exempts identifier fields only when they hold a slug', () => {
    const exempt = ALL_STRINGS.filter((e) => isIdentifierField(e.field));
    const unexpected = exempt
      .filter((e) => !/^[a-z0-9-]*$/.test(e.value))
      .map((e) => `${e.path} = ${JSON.stringify(e.value)}`);
    expect(unexpected, 'identifier fields should contain slugs only').toEqual([]);
    expect(exempt.length).toBeGreaterThan(60);
  });

  it('exempts schema fields only when they name a real row property', () => {
    const exempt = ALL_STRINGS.filter((e) => isSchemaField(e.field));
    const unexpected = exempt
      .filter((e) => !TRACKER_ROW_FIELDS.has(e.value))
      .map((e) => `${e.path} = ${JSON.stringify(e.value)}`);
    expect(unexpected, 'schema fields should name TrackerRow properties only').toEqual([]);
    // 11 canonical + 11 alternate columns.
    expect(exempt).toHaveLength(22);
  });

  it('keeps the exemption list to two narrow categories', () => {
    expect([...IDENTIFIER_FIELDS]).toEqual(['id', 'rowKey', 'categoryId', 'practiceId']);
    expect([...SCHEMA_FIELDS]).toEqual(['field']);
  });
});

describe('fidelity — guide coverage', () => {
  it('renders 6 categories and 24 practices', () => {
    expect(guide.categories).toHaveLength(6);
    expect(guide.categories.flatMap((c) => c.practices)).toHaveLength(24);
  });

  it('accounts for every `##` practice heading in the guide source', () => {
    const sourceHeadings = (sources.guide.match(/^## .*$/gm) ?? []).map((h) =>
      h.replace(/^## /, '').trim(),
    );
    // The Objective H2 is a section, not a practice.
    const practiceHeadings = sourceHeadings.filter((h) => h !== 'Objective');
    expect(practiceHeadings).toHaveLength(24);

    const parsed = guide.categories.flatMap((c) => c.practices).map((p) => p.headingRaw);
    expect(parsed).toEqual(practiceHeadings);
  });

  it('accounts for every category `#` heading in the guide source', () => {
    const h1 = (sources.guide.match(/^# .*$/gm) ?? []).map((h) => h.replace(/^# /, '').trim());
    expect(h1[0]).toBe(guide.title);
    expect(h1.slice(1)).toEqual(guide.categories.map((c) => c.heading));
  });

  it('accounts for all 24 guide checkboxes', () => {
    const sourceCheckboxes = sources.guide.match(/^- \[[ xX]\]/gm) ?? [];
    expect(sourceCheckboxes).toHaveLength(24);
    expect(guide.categories.flatMap((c) => c.practices).map((p) => p.checkboxLabel)).toHaveLength(
      24,
    );
  });

  it('drops no key concepts', () => {
    // Nested bullets in the guide are key concepts and nothing else.
    const nested = sources.guide.match(/^ {4}- .*$/gm) ?? [];
    const parsed = guide.categories.flatMap((c) => c.practices).flatMap((p) => p.keyConcepts);
    expect(parsed).toHaveLength(nested.length);
  });
});

describe('fidelity — checklist coverage', () => {
  it('renders 4 phases with 23 items', () => {
    expect(checklist.phases).toHaveLength(4);
    expect(checklist.phases.reduce((n, p) => n + p.items.length, 0)).toBe(23);
  });

  it('renders 16 readiness criteria', () => {
    expect(checklist.readinessGate.criteria).toHaveLength(16);
  });

  it('accounts for all 42 checklist checkboxes', () => {
    const sourceCheckboxes = sources.checklist.match(/^- \[[ xX]\]/gm) ?? [];
    expect(sourceCheckboxes).toHaveLength(42);

    const parsed =
      checklist.phases.reduce((n, p) => n + p.items.length, 0) +
      checklist.readinessGate.criteria.length +
      checklist.notes.openIssues.length;
    expect(parsed).toBe(42);
  });

  it('accounts for every checklist heading', () => {
    const h1 = (sources.checklist.match(/^# .*$/gm) ?? []).map((h) => h.replace(/^# /, '').trim());
    expect(h1).toEqual([
      checklist.title,
      checklist.implementationOrderHeading,
      checklist.readinessGate.heading,
      checklist.notes.heading,
    ]);

    const h2 = (sources.checklist.match(/^## .*$/gm) ?? []).map((h) =>
      h.replace(/^## /, '').trim(),
    );
    expect(h2).toEqual([
      ...checklist.phases.map((p) => p.heading),
      ...checklist.notes.noteSections.map((s) => s.heading),
      checklist.notes.openIssuesHeading,
      checklist.notes.usefulLinksHeading,
    ]);
  });

  it('renders 3 note sections, 3 open issues and 9 useful links', () => {
    expect(checklist.notes.noteSections).toHaveLength(3);
    expect(checklist.notes.openIssues).toHaveLength(3);
    expect(checklist.notes.usefulLinks).toHaveLength(9);
  });
});

describe('fidelity — tracker coverage', () => {
  it('renders 24 rows with 11 columns', () => {
    expect(tracker.rows).toHaveLength(24);
    expect(tracker.columns).toHaveLength(11);
    expect(tracker.alternateColumns).toHaveLength(11);
  });

  it('accounts for every data row in the canonical export', () => {
    // 24 CRLF separators and no trailing newline: 1 header + 24 records, two of
    // which wrap onto a second physical line.
    const crlf = (sources.tracker.match(/\r\n/g) ?? []).length;
    expect(crlf).toBe(24);
    expect(tracker.rows).toHaveLength(crlf);
  });

  it('reproduces every S.N as written, duplicate included', () => {
    const snInSource = [...sources.tracker.matchAll(/^ST-\d+/gm)].map((m) => m[0]);
    expect(snInSource).toHaveLength(24);
    expect(tracker.rows.map((r) => r.sn)).toEqual(snInSource);
  });
});

describe('fidelity — interactive totals', () => {
  it('exposes exactly 63 checkboxes across the three universes', () => {
    const guideBoxes = guide.categories.flatMap((c) => c.practices).length;
    const phaseBoxes = checklist.phases.reduce((n, p) => n + p.items.length, 0);
    const readinessBoxes = checklist.readinessGate.criteria.length;
    expect(guideBoxes).toBe(24);
    expect(phaseBoxes).toBe(23);
    expect(readinessBoxes).toBe(16);
    expect(guideBoxes + phaseBoxes + readinessBoxes).toBe(63);
  });

  it('keeps the three universes disjoint by id', () => {
    const guideIds = guide.categories.flatMap((c) => c.practices).map((p) => p.id);
    const phaseIds = checklist.phases.flatMap((p) => p.items.map((i) => i.id));
    const readinessIds = checklist.readinessGate.criteria.map((c) => c.id);
    const all = [...guideIds, ...phaseIds, ...readinessIds];
    expect(new Set(all).size).toBe(63);
  });
});

describe('fidelity — generated content tree snapshot', () => {
  it('matches the recorded shape of the guide', () => {
    expect(guide).toMatchSnapshot();
  });

  it('matches the recorded shape of the checklist', () => {
    expect(checklist).toMatchSnapshot();
  });

  it('matches the recorded shape of the tracker', () => {
    expect(tracker).toMatchSnapshot();
  });

  it('matches the recorded cross-link mapping', () => {
    expect(crosslinksJson).toMatchSnapshot();
  });
});
