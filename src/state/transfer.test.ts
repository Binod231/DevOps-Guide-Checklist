import { describe, expect, it } from 'vitest';
import sources from '../content/generated/sources.json';
import { tracker } from '../content/registry';
import { parseCsv, toCsv as toCsvForTest } from '../content/parsers/csv';
import { slugify } from '../content/slug';
import { emptyState, sanitiseState, type PortalState } from './portalState';
import {
  EXPORT_FORMAT,
  buildStateExport,
  findUnknownIds,
  parseStateImport,
  parseTrackerCsvEdits,
  serialiseState,
  serialiseTrackerCsv,
  stateFromTrackerEdits,
} from './transfer';

const CANONICAL_HEADER =
  'S.N,Category,Implementation Item,Implementation By,Company Stage,Priority,Status,' +
  'Target Date,Verification Gate,Verified,Verified By';

const rowKeys = new Set(tracker.rows.map((r) => r.rowKey));
const rowKeyFor = (sn: string, category: string) => `${slugify(sn)}--${slugify(category)}`;

/** A fully-populated state, for round-trip tests. */
function filledState(): PortalState {
  return {
    ...emptyState(),
    checked: {
      'infrastructure-as-code': true,
      'readiness--2fa-is-enforced-across-cloud-repository-and-saas-tooling': true,
    },
    tracker: {
      'st-07--infrastructure': {
        status: 'In Progress',
        implementationBy: 'BJ',
        targetDate: '2026-03-01',
        verified: 'No',
        verifiedBy: '',
        notes: 'Terraform in place',
        evidence: 'plan-output.txt',
      },
      'st-10--testing-quality': { status: 'Completed' },
    },
    notes: { 'architecture-notes': 'Single region.' },
    links: { repository: 'https://git.example.test/app' },
    openIssues: { 'open-issues--item-2': 'Chase WAF quote' },
  };
}

describe('JSON export', () => {
  it('stamps the format, version and an export time', () => {
    const exported = buildStateExport(emptyState(), new Date('2026-03-04T10:00:00Z'));
    expect(exported.format).toBe(EXPORT_FORMAT);
    expect(exported.version).toBe(1);
    expect(exported.exportedAt).toBe('2026-03-04T10:00:00.000Z');
  });

  it('serialises to readable JSON ending in a newline', () => {
    const text = serialiseState(emptyState());
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text).format).toBe(EXPORT_FORMAT);
  });

  it('carries the whole state', () => {
    const state = filledState();
    const parsed = JSON.parse(serialiseState(state));
    expect(parsed.state).toEqual(state);
  });
});

describe('JSON import — round trip', () => {
  it('restores every field exactly', () => {
    const state = filledState();
    const result = parseStateImport(serialiseState(state));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(state);
    expect(result.issues).toEqual([]);
  });

  it('round-trips an empty state', () => {
    const result = parseStateImport(serialiseState(emptyState()));
    expect(result.ok && result.state).toEqual(emptyState());
  });

  it('accepts a bare state object without the export wrapper', () => {
    const result = parseStateImport(JSON.stringify(filledState()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.checked['infrastructure-as-code']).toBe(true);
  });

  it('preserves a multi-line note', () => {
    const state = { ...emptyState(), notes: { 'security-notes': 'line one\nline two' } };
    const result = parseStateImport(serialiseState(state));
    expect(result.ok && result.state.notes['security-notes']).toBe('line one\nline two');
  });
});

describe('JSON import — rejection', () => {
  it('rejects invalid JSON with a readable message', () => {
    const result = parseStateImport('{not json');
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toEqual({ path: 'file', message: 'Not valid JSON.' });
  });

  it('rejects a non-object payload', () => {
    const result = parseStateImport('"a string"');
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toMatch(/JSON object at the top level/);
  });

  it('rejects a file from a different tool', () => {
    const result = parseStateImport(JSON.stringify({ format: 'something-else', state: {} }));
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.path).toBe('format');
    expect(result.issues[0]!.message).toContain(EXPORT_FORMAT);
  });

  it('rejects a file from a newer portal version', () => {
    const result = parseStateImport(
      JSON.stringify({ format: EXPORT_FORMAT, version: 99, state: emptyState() }),
    );
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.path).toBe('version');
    expect(result.issues[0]!.message).toMatch(/newer version/);
  });

  it('rejects a payload with no recognisable state', () => {
    const result = parseStateImport(JSON.stringify({ format: EXPORT_FORMAT, state: {} }));
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toMatch(/No recognisable state/);
  });
});

describe('JSON import — per-field issues', () => {
  it('reports a wrongly-typed checked entry and imports the rest', () => {
    const result = parseStateImport(
      JSON.stringify({ checked: { good: true, bad: 'yes', worse: 1 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.checked).toEqual({ good: true });
    expect(result.issues).toEqual([
      { path: 'state.checked.bad', message: 'Expected a boolean but found a string; ignored.' },
      { path: 'state.checked.worse', message: 'Expected a boolean but found a number; ignored.' },
    ]);
  });

  it('reports a wrongly-typed note and keeps the good one', () => {
    const result = parseStateImport(
      JSON.stringify({ notes: { 'architecture-notes': 'fine', 'security-notes': 42 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.notes).toEqual({ 'architecture-notes': 'fine' });
    expect(result.issues[0]!.path).toBe('state.notes.security-notes');
  });

  it('reports an unknown tracker field rather than storing it', () => {
    const result = parseStateImport(
      JSON.stringify({
        tracker: { 'st-01--scm-ci-cd': { status: 'Completed', priority: 'P9' } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.tracker['st-01--scm-ci-cd']).toEqual({ status: 'Completed' });
    expect(result.issues).toEqual([
      {
        path: 'state.tracker.st-01--scm-ci-cd.priority',
        message: 'Not an editable tracker field; ignored.',
      },
    ]);
  });

  it('reports a tracker row that is not an object, and imports the rest', () => {
    const result = parseStateImport(
      JSON.stringify({
        tracker: { 'st-01--scm-ci-cd': 'oops', 'st-02--scm-ci-cd': { status: 'Completed' } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.tracker['st-01--scm-ci-cd']).toBeUndefined();
    expect(result.state.tracker['st-02--scm-ci-cd']).toEqual({ status: 'Completed' });
    expect(result.issues).toEqual([
      {
        path: 'state.tracker.st-01--scm-ci-cd',
        message: 'Expected an object but found a string; ignored.',
      },
    ]);
  });

  it('reports a non-object section', () => {
    const result = parseStateImport(JSON.stringify({ checked: { a: true }, notes: 'oops' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issues).toContainEqual({
      path: 'state.notes',
      message: 'Expected an object; ignored.',
    });
  });

  it('never silently discards without saying so', () => {
    const payload = {
      checked: { a: 'no' },
      notes: { b: 1 },
      links: { c: null },
      openIssues: { d: [] },
      tracker: { 'st-01--scm-ci-cd': { notes: 5 } },
    };
    const result = parseStateImport(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Five bad values, five reported issues.
    expect(result.issues).toHaveLength(5);
    expect(result.state).toEqual(sanitiseState({}));
  });
});

describe('findUnknownIds', () => {
  it('reports nothing for a state built from the current documents', () => {
    const known = new Set(['infrastructure-as-code']);
    const state = { ...emptyState(), checked: { 'infrastructure-as-code': true } };
    expect(findUnknownIds(state, known, rowKeys)).toEqual([]);
  });

  it('flags a checkbox id that no longer exists', () => {
    const state = { ...emptyState(), checked: { 'removed-practice': true } };
    const issues = findUnknownIds(state, new Set(), rowKeys);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe('state.checked.removed-practice');
    expect(issues[0]!.message).toMatch(/kept but not shown/);
  });

  it('flags a tracker row key that no longer exists', () => {
    const state = { ...emptyState(), tracker: { 'st-99--nowhere': { status: 'Completed' } } };
    const issues = findUnknownIds(state, new Set(), rowKeys);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe('state.tracker.st-99--nowhere');
  });
});

describe('tracker CSV export', () => {
  it('writes the source header spelling and column order exactly', () => {
    const csv = serialiseTrackerCsv(tracker, {});
    expect(csv.split('\r\n')[0]).toBe(CANONICAL_HEADER);
  });

  it('matches the header line of the source export byte for byte', () => {
    const sourceHeader = sources.tracker.replace(/^\uFEFF/, '').split('\r\n')[0];
    expect(serialiseTrackerCsv(tracker, {}).split('\r\n')[0]).toBe(sourceHeader);
  });

  it('writes all 24 rows', () => {
    const records = parseCsv(serialiseTrackerCsv(tracker, {}));
    expect(records).toHaveLength(25);
  });

  it('reproduces the source values when nothing is edited', () => {
    const records = parseCsv(serialiseTrackerCsv(tracker, {}));
    const body = records.slice(1);
    tracker.rows.forEach((row, i) => {
      expect(body[i]![0], row.sn).toBe(row.sn);
      expect(body[i]![2]).toBe(row.implementationItem);
      expect(body[i]![6]).toBe(row.status);
    });
  });

  it("quotes ST-09's comma-bearing Implementation Item", () => {
    const csv = serialiseTrackerCsv(tracker, {});
    expect(csv).toContain('"Edge Security, WAF & Ingress Rate Limiting"');
    const records = parseCsv(csv);
    const st09 = records.slice(1).find((r) => r[0] === 'ST-09')!;
    expect(st09[2]).toBe('Edge Security, WAF & Ingress Rate Limiting');
  });

  it("writes ST-20's corrected status", () => {
    const records = parseCsv(serialiseTrackerCsv(tracker, {}));
    const st20 = records.slice(1).find((r) => r[0] === 'ST-20')!;
    expect(st20[6]).toBe('Not Started');
  });

  it('still round-trips a field containing a newline', () => {
    const records = [
      ['S.N', 'Implementation Item'],
      ['ST-01', 'one\ntwo'],
    ];
    expect(parseCsv(toCsvForTest(records))).toEqual(records);
  });

  it('writes both ST-10 rows', () => {
    const records = parseCsv(serialiseTrackerCsv(tracker, {}));
    expect(records.slice(1).filter((r) => r[0] === 'ST-10')).toHaveLength(2);
  });

  it('writes reader edits in place of the source values', () => {
    const csv = serialiseTrackerCsv(tracker, {
      'st-07--infrastructure': {
        status: 'Completed',
        implementationBy: 'BJ',
        targetDate: '2026-03-01',
      },
    });
    const row = parseCsv(csv)
      .slice(1)
      .find((r) => r[0] === 'ST-07')!;
    expect(row[3]).toBe('BJ');
    expect(row[6]).toBe('Completed');
    expect(row[7]).toBe('2026-03-01');
  });

  it('omits the added columns by default', () => {
    expect(serialiseTrackerCsv(tracker, {}).split('\r\n')[0]).not.toContain('Notes');
  });

  it('appends the added columns on request', () => {
    const csv = serialiseTrackerCsv(tracker, {}, { includeAddedColumns: true });
    expect(csv.split('\r\n')[0]).toBe(`${CANONICAL_HEADER},Notes,Evidence`);
    expect(parseCsv(csv)[1]).toHaveLength(13);
  });

  it('writes the alternate column order on request', () => {
    const csv = serialiseTrackerCsv(tracker, {}, { columns: tracker.alternateColumns });
    expect(csv.split('\r\n')[0]).toBe(
      'S.N,Category,Company Stage,Implementation By,Implementation Item,Priority,Status,' +
        'Target Date,Verification Gate,Verified,Verified By',
    );
  });

  it('separates records with CRLF, as the source does', () => {
    expect(serialiseTrackerCsv(tracker, {})).toContain('\r\n');
  });
});

describe('tracker CSV import', () => {
  it('reads back the editable fields it wrote', () => {
    const edits = {
      'st-07--infrastructure': {
        status: 'In Progress',
        implementationBy: 'BJ',
        notes: 'Terraform in place',
      },
    };
    const csv = serialiseTrackerCsv(tracker, edits, { includeAddedColumns: true });
    const result = parseTrackerCsvEdits(csv, rowKeys, rowKeyFor);

    expect(result.issues).toEqual([]);
    expect(result.edits['st-07--infrastructure']).toMatchObject({
      status: 'In Progress',
      implementationBy: 'BJ',
      notes: 'Terraform in place',
    });
  });

  it('distinguishes the two ST-10 rows by category', () => {
    const csv = serialiseTrackerCsv(tracker, {
      'st-10--infrastructure': { status: 'Completed' },
      'st-10--testing-quality': { status: 'In Progress' },
    });
    const result = parseTrackerCsvEdits(csv, rowKeys, rowKeyFor);
    expect(result.edits['st-10--infrastructure']?.status).toBe('Completed');
    expect(result.edits['st-10--testing-quality']?.status).toBe('In Progress');
  });

  it('ignores source-only columns', () => {
    const csv = serialiseTrackerCsv(tracker, {});
    const result = parseTrackerCsvEdits(csv, rowKeys, rowKeyFor);
    for (const edits of Object.values(result.edits)) {
      expect(edits).not.toHaveProperty('priority');
      expect(edits).not.toHaveProperty('category');
    }
  });

  it('reports a row that matches nothing', () => {
    const csv = `${CANONICAL_HEADER}\r\nST-99,Nowhere,Item,,For All,P0,Not Started,,Gate,No,`;
    const result = parseTrackerCsvEdits(csv, rowKeys, rowKeyFor);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.message).toMatch(/No tracker row matches S\.N "ST-99"/);
    expect(result.edits).toEqual({});
  });

  it('rejects a CSV with no S.N or Category column', () => {
    const result = parseTrackerCsvEdits('Status\r\nCompleted', rowKeys, rowKeyFor);
    expect(result.issues[0]!.message).toMatch(/needs both an S\.N and a Category column/);
  });

  it('rejects an empty CSV', () => {
    expect(parseTrackerCsvEdits('', rowKeys, rowKeyFor).issues[0]!.message).toBe(
      'The CSV is empty.',
    );
  });

  it('skips a wholly blank row without complaining', () => {
    const csv = `${CANONICAL_HEADER}\r\n,,,,,,,,,,`;
    expect(parseTrackerCsvEdits(csv, rowKeys, rowKeyFor).issues).toEqual([]);
  });

  it('builds a state carrying only the imported edits', () => {
    const state = stateFromTrackerEdits({ 'st-01--scm-ci-cd': { status: 'Completed' } });
    expect(state.tracker['st-01--scm-ci-cd']?.status).toBe('Completed');
    expect(state.checked).toEqual({});
    expect(state.notes).toEqual({});
  });
});
