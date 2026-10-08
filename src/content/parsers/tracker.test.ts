import { describe, expect, it } from 'vitest';
import sources from '../generated/sources.json';
import { assertExportsAgree, parseTracker } from './tracker';
import type { TrackerRow } from '../types';

const tracker = parseTracker(sources.tracker, sources.trackerAll);
const rows = tracker.rows;

const CANONICAL_HEADERS = [
  'S.N',
  'Category',
  'Implementation Item',
  'Implementation By',
  'Company Stage',
  'Priority',
  'Status',
  'Target Date',
  'Verification Gate',
  'Verified',
  'Verified By',
];

const ALTERNATE_HEADERS = [
  'S.N',
  'Category',
  'Company Stage',
  'Implementation By',
  'Implementation Item',
  'Priority',
  'Status',
  'Target Date',
  'Verification Gate',
  'Verified',
  'Verified By',
];

function row(sn: string, category?: string): TrackerRow {
  const matches = rows.filter((r) => r.sn === sn && (!category || r.category === category));
  if (matches.length !== 1) {
    throw new Error(`Expected one row for ${sn}${category ? ` / ${category}` : ''}`);
  }
  return matches[0]!;
}

function tally(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

describe('tracker parser — columns', () => {
  it('reads the canonical column order with verbatim header spelling', () => {
    expect(tracker.columns.map((c) => c.header)).toEqual(CANONICAL_HEADERS);
  });

  it('reads the _all export column order, which genuinely differs', () => {
    expect(tracker.alternateColumns.map((c) => c.header)).toEqual(ALTERNATE_HEADERS);
    expect(tracker.alternateColumns.map((c) => c.header)).not.toEqual(CANONICAL_HEADERS);
  });

  it('maps every column to a row field', () => {
    for (const column of [...tracker.columns, ...tracker.alternateColumns]) {
      expect(column.field, column.header).toBeTruthy();
    }
  });

  it('keeps the dotted `S.N` header spelling', () => {
    expect(tracker.columns[0]!.header).toBe('S.N');
    expect(tracker.columns[0]!.field).toBe('sn');
  });
});

describe('tracker parser — rows', () => {
  it('finds exactly 24 rows', () => {
    expect(rows).toHaveLength(24);
  });

  it('numbers rows 1..24 in canonical file order', () => {
    expect(rows.map((r) => r.sourceOrder)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('matches the source priority distribution', () => {
    expect(tally(rows.map((r) => r.priority))).toEqual({ P0: 15, P1: 7, P2: 2 });
  });

  it('matches the source company stage distribution', () => {
    expect(tally(rows.map((r) => r.companyStage))).toEqual({
      'For All': 11,
      'Optional For Startup': 13,
    });
  });

  it('matches the source category distribution', () => {
    expect(tally(rows.map((r) => r.category))).toEqual({
      'SCM & CI/CD': 5,
      Infrastructure: 5,
      'Testing & Quality': 2,
      Security: 4,
      Observability: 6,
      'Disaster Recovery': 2,
    });
  });

  it('leaves Implementation By, Target Date and Verified By empty on all 24 rows', () => {
    for (const r of rows) {
      expect(r.implementationBy, r.sn).toBe('');
      expect(r.targetDate, r.sn).toBe('');
      expect(r.verifiedBy, r.sn).toBe('');
    }
  });

  it('reads Verified as "No" on all 24 rows', () => {
    for (const r of rows) expect(r.verified, r.sn).toBe('No');
  });
});

describe('tracker parser — duplicate S.N is preserved', () => {
  it('keeps both ST-10 rows without renumbering either', () => {
    const st10 = rows.filter((r) => r.sn === 'ST-10');
    expect(st10).toHaveLength(2);
    expect(st10.map((r) => r.sn)).toEqual(['ST-10', 'ST-10']);
  });

  it('distinguishes the two ST-10 rows by category', () => {
    expect(row('ST-10', 'Infrastructure').implementationItem).toBe(
      'Cloud FinOps Guardrails & Budget Ceilings',
    );
    expect(row('ST-10', 'Testing & Quality').implementationItem).toBe(
      'Core Integration & API Tests',
    );
  });

  it('gives every row a unique rowKey despite the duplicate S.N', () => {
    expect(new Set(rows.map((r) => r.rowKey)).size).toBe(24);
    expect(row('ST-10', 'Infrastructure').rowKey).toBe('st-10--infrastructure');
    expect(row('ST-10', 'Testing & Quality').rowKey).toBe('st-10--testing-quality');
  });

  it('never renumbers S.N to force uniqueness', () => {
    // ST-11 exists in the source; a renumbering parser would have produced a
    // second ST-11 or an ST-24.
    expect(rows.filter((r) => r.sn === 'ST-11')).toHaveLength(1);
    expect(rows.some((r) => r.sn === 'ST-24')).toBe(false);
    const ids = [...new Set(rows.map((r) => r.sn))].sort();
    expect(ids).toHaveLength(23);
  });
});

describe('tracker parser — Status', () => {
  it('reads Not Started on all 24 rows', () => {
    // ST-20's Status cell was left empty by the export while every other row
    // read `Not Started`; corrected at source.
    expect(rows.filter((r) => r.status === 'Not Started')).toHaveLength(24);
    expect(rows.filter((r) => r.status === '')).toHaveLength(0);
  });

  it('reads ST-20 in full', () => {
    const r = row('ST-20');
    expect(r.implementationItem).toBe('Distributed APM & OpenTelemetry Tracing');
    expect(r.priority).toBe('P2');
    expect(r.status).toBe('Not Started');
    expect(r.verified).toBe('No');
  });

  it('still leaves a genuinely empty Status empty, rather than defaulting it', () => {
    const csv =
      `${CANONICAL_HEADERS.join(',')}\r\n` +
      'ST-01,Cat,Item,,For All,P0,,,Gate,No,';
    const parsed = parseTracker(csv, csv);
    expect(parsed.rows[0]!.status).toBe('');
  });
});

describe('tracker parser — whitespace', () => {
  it("reads ST-09's Implementation Item without the export's trailing newline", () => {
    expect(row('ST-09').implementationItem).toBe('Edge Security, WAF & Ingress Rate Limiting');
  });

  it("reads ST-19's Verification Gate without the export's trailing newline", () => {
    expect(row('ST-19').verificationGate).toBe(
      'Simulate artificial database latency on an endpoint; verify p99 latency alerts trigger even while basic uptime checks pass.',
    );
  });

  it('leaves no leading or trailing whitespace in any field', () => {
    for (const r of rows) {
      for (const [field, value] of Object.entries(r)) {
        if (typeof value !== 'string') continue;
        expect(value, `${r.sn} ${field}`).toBe(value.trim());
      }
    }
  });

  it('does not leak carriage returns from the CRLF record separators', () => {
    for (const r of rows) {
      for (const value of Object.values(r)) {
        if (typeof value === 'string') expect(value, r.sn).not.toContain('\r');
      }
    }
  });

  it('keeps the comma inside quoted Implementation Item values', () => {
    expect(row('ST-19').implementationItem).toBe('Golden Signals, SLIs & SLO Tracking');
    expect(row('ST-09').implementationItem).toContain('Edge Security, WAF');
  });

  it('still carries an embedded newline through, in case an export regresses', () => {
    const csv =
      `${CANONICAL_HEADERS.join(',')}\r\n` +
      'ST-01,Cat,"one\ntwo",,For All,P0,Not Started,,Gate,No,';
    const parsed = parseTracker(csv, csv);
    expect(parsed.rows[0]!.implementationItem).toBe('one\ntwo');
  });
});

describe('tracker parser — other source characteristics', () => {
  it("reads ST-04's Verification Gate without Notion's LaTeX delimiters", () => {
    // The export wrapped N+1 and N in `$...$`; corrected at source.
    expect(row('ST-04').verificationGate).toBe(
      'Simulate a rollback from Version N+1 to Version N with the new schema; the older version must function without errors.',
    );
  });

  it('leaves no LaTeX math delimiters anywhere in the tracker', () => {
    for (const r of rows) {
      for (const value of Object.values(r)) {
        if (typeof value === 'string') expect(value, r.sn).not.toMatch(/\$[^$]+\$/);
      }
    }
  });

  it('keeps the tracker category spelling distinct from the guide headings', () => {
    // The tracker says `SCM & CI/CD`; the guide says
    // `1. Source Code Management & CI/CD`. Neither is rewritten to match.
    expect(rows.some((r) => r.category === 'SCM & CI/CD')).toBe(true);
    expect(rows.some((r) => r.category === 'Source Code Management & CI/CD')).toBe(false);
  });

  it('keeps tracker item names distinct from guide practice headings', () => {
    expect(row('ST-03').implementationItem).toBe('Automated Secret Scanning');
    expect(row('ST-11').implementationItem).toBe('Pinned Dependencies & Security Audits');
  });
});

describe('tracker parser — the two exports agree', () => {
  it('accepts the real pair of exports', () => {
    expect(() => parseTracker(sources.tracker, sources.trackerAll)).not.toThrow();
  });

  it('reports a row count mismatch', () => {
    expect(() => assertExportsAgree(rows, rows.slice(1))).toThrow(/disagree on row count/);
  });

  it('reports a missing row', () => {
    const swapped = [...rows.slice(1), { ...rows[0]!, rowKey: 'st-99--nowhere' }];
    expect(() => assertExportsAgree(rows, swapped)).toThrow(/missing from the _all export/);
  });

  it('reports a field-level divergence', () => {
    const drifted = rows.map((r) =>
      r.sn === 'ST-14' ? { ...r, priority: 'P1' } : r,
    );
    expect(() => assertExportsAgree(rows, drifted)).toThrow(/disagree on priority/);
  });

  it('tolerates the differing row order between the exports', () => {
    const reversed = [...rows].reverse().map((r, i) => ({ ...r, sourceOrder: i + 1 }));
    expect(() => assertExportsAgree(rows, reversed)).not.toThrow();
  });
});

describe('tracker parser — strictness', () => {
  const HEADER = CANONICAL_HEADERS.join(',');

  it('rejects an unrecognised column header', () => {
    const csv = `${HEADER},Compliance\r\nST-01,Cat,Item,,For All,P0,Not Started,,Gate,No,,X`;
    expect(() => parseTracker(csv, csv)).toThrow(/unrecognised column header "Compliance"/);
  });

  it('rejects a missing column', () => {
    const csv = 'S.N,Category\r\nST-01,Cat';
    expect(() => parseTracker(csv, csv)).toThrow(/missing column/);
  });

  it('rejects a row with the wrong field count', () => {
    const csv = `${HEADER}\r\nST-01,Cat,Item`;
    expect(() => parseTracker(csv, csv)).toThrow(/has 3 fields, expected 11/);
  });

  it('rejects a file with no data rows', () => {
    expect(() => parseTracker(HEADER, HEADER)).toThrow(/no data rows/);
  });

  it('rejects a row with no S.N', () => {
    const csv = `${HEADER}\r\n,Cat,Item,,For All,P0,Not Started,,Gate,No,`;
    expect(() => parseTracker(csv, csv)).toThrow(/has no S\.N/);
  });

  it('rejects an S.N that repeats inside the same category', () => {
    const csv =
      `${HEADER}\r\n` +
      'ST-01,Cat,A,,For All,P0,Not Started,,Gate,No,\r\n' +
      'ST-01,Cat,B,,For All,P0,Not Started,,Gate,No,';
    expect(() => parseTracker(csv, csv)).toThrow(/repeats within category/);
  });
});
