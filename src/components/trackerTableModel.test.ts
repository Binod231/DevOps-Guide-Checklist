import { describe, expect, it } from 'vitest';
import { tracker } from '../content/registry';
import type { TrackerRowState } from '../state/portalState';
import {
  activeFilterCount,
  applyFilters,
  applySort,
  ariaSortFor,
  effectiveValue,
  emptyFilters,
  filterOptions,
  hasActiveFilters,
  nextSort,
} from './trackerTableModel';

const rows = tracker.rows;
const noEdits = () => undefined;

describe('emptyFilters', () => {
  it('offers the five filterable attributes, all unset', () => {
    expect(emptyFilters()).toEqual({
      category: [],
      priority: [],
      companyStage: [],
      status: [],
      verified: [],
    });
    expect(hasActiveFilters(emptyFilters())).toBe(false);
    expect(activeFilterCount(emptyFilters())).toBe(0);
  });
});

describe('effectiveValue', () => {
  it('returns the source value when there is no edit', () => {
    const row = rows.find((r) => r.sn === 'ST-01')!;
    expect(effectiveValue(row, 'status', undefined)).toBe('Not Started');
    expect(effectiveValue(row, 'priority', undefined)).toBe('P0');
  });

  it('prefers the reader edit for editable fields', () => {
    const row = rows.find((r) => r.sn === 'ST-01')!;
    const edits: TrackerRowState = { status: 'Completed', implementationBy: 'BJ' };
    expect(effectiveValue(row, 'status', edits)).toBe('Completed');
    expect(effectiveValue(row, 'implementationBy', edits)).toBe('BJ');
  });

  it('ignores edits for source-only fields', () => {
    const row = rows.find((r) => r.sn === 'ST-01')!;
    expect(effectiveValue(row, 'priority', { status: 'Completed' })).toBe('P0');
  });

  it("reads ST-20's corrected status", () => {
    const row = rows.find((r) => r.sn === 'ST-20')!;
    expect(effectiveValue(row, 'status', undefined)).toBe('Not Started');
  });
});

describe('filterOptions', () => {
  it('derives category options from the data, in first-appearance order', () => {
    expect(filterOptions(rows, 'category', noEdits)).toEqual([
      'SCM & CI/CD',
      'Infrastructure',
      'Testing & Quality',
      'Security',
      'Observability',
      'Disaster Recovery',
    ]);
  });

  it('derives priority options present in the source', () => {
    expect(filterOptions(rows, 'priority', noEdits)).toEqual(['P0', 'P1', 'P2']);
  });

  it('derives the two company stage values', () => {
    expect(filterOptions(rows, 'companyStage', noEdits)).toEqual([
      'For All',
      'Optional For Startup',
    ]);
  });

  it('offers only Not Started for status, since that is all the source has', () => {
    expect(filterOptions(rows, 'status', noEdits)).toEqual(['Not Started']);
  });

  it('excludes blank values rather than inventing a "blank" option', () => {
    // ST-20's status is empty; it must not appear as an option.
    expect(filterOptions(rows, 'status', noEdits)).not.toContain('');
  });

  it('picks up a reader-added status value', () => {
    const edits = (rowKey: string) =>
      rowKey === 'st-01--scm-ci-cd' ? ({ status: 'Completed' } as TrackerRowState) : undefined;
    expect(filterOptions(rows, 'status', edits)).toEqual(['Completed', 'Not Started']);
  });
});

describe('applyFilters', () => {
  it('returns every row when nothing is selected', () => {
    expect(applyFilters(rows, emptyFilters(), noEdits)).toHaveLength(24);
  });

  it('narrows by a single priority', () => {
    const filtered = applyFilters(rows, { ...emptyFilters(), priority: ['P0'] }, noEdits);
    expect(filtered).toHaveLength(15);
    for (const row of filtered) expect(row.priority).toBe('P0');
  });

  it('treats several values in one filter as OR', () => {
    const filtered = applyFilters(rows, { ...emptyFilters(), priority: ['P1', 'P2'] }, noEdits);
    expect(filtered).toHaveLength(9);
  });

  it('treats different filters as AND', () => {
    const filtered = applyFilters(
      rows,
      { ...emptyFilters(), priority: ['P0'], companyStage: ['For All'] },
      noEdits,
    );
    // P0 and For All: ST-01, ST-02, ST-03, both ST-10 rows, ST-13, ST-14, ST-15.
    expect(filtered).toHaveLength(8);
    for (const row of filtered) {
      expect(row.priority).toBe('P0');
      expect(row.companyStage).toBe('For All');
    }
  });

  it('narrows by category', () => {
    expect(
      applyFilters(rows, { ...emptyFilters(), category: ['Observability'] }, noEdits),
    ).toHaveLength(6);
    expect(
      applyFilters(rows, { ...emptyFilters(), category: ['Testing & Quality'] }, noEdits),
    ).toHaveLength(2);
  });

  it('keeps both ST-10 rows when their shared category is selected', () => {
    const infra = applyFilters(rows, { ...emptyFilters(), category: ['Infrastructure'] }, noEdits);
    expect(infra.filter((r) => r.sn === 'ST-10')).toHaveLength(1);

    const testing = applyFilters(
      rows,
      { ...emptyFilters(), category: ['Testing & Quality'] },
      noEdits,
    );
    expect(testing.filter((r) => r.sn === 'ST-10')).toHaveLength(1);
  });

  it('matches all 24 rows on Not Started, now that none is blank', () => {
    const filtered = applyFilters(rows, { ...emptyFilters(), status: ['Not Started'] }, noEdits);
    expect(filtered).toHaveLength(24);
    expect(filtered.some((r) => r.sn === 'ST-20')).toBe(true);
  });

  it('excludes a row whose status a reader has cleared', () => {
    const edits = (rowKey: string) =>
      rowKey === 'st-20--observability' ? ({ status: '' } as TrackerRowState) : undefined;
    const filtered = applyFilters(rows, { ...emptyFilters(), status: ['Not Started'] }, edits);
    expect(filtered).toHaveLength(23);
    expect(filtered.some((r) => r.sn === 'ST-20')).toBe(false);
  });

  it('respects reader edits when filtering', () => {
    const edits = (rowKey: string) =>
      rowKey === 'st-01--scm-ci-cd' ? ({ status: 'Completed' } as TrackerRowState) : undefined;
    const filtered = applyFilters(rows, { ...emptyFilters(), status: ['Completed'] }, edits);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.sn).toBe('ST-01');
  });

  it('returns nothing for a combination no row satisfies', () => {
    expect(
      applyFilters(rows, { ...emptyFilters(), priority: ['P2'], category: ['Security'] }, noEdits),
    ).toEqual([]);
  });
});

describe('applySort', () => {
  it('falls back to canonical source order when unsorted', () => {
    expect(applySort(rows, null, noEdits).map((r) => r.sourceOrder)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
  });

  it('sorts ascending and descending by priority', () => {
    const asc = applySort(rows, { field: 'priority', direction: 'ascending' }, noEdits);
    expect(asc[0]!.priority).toBe('P0');
    expect(asc.at(-1)!.priority).toBe('P2');

    const desc = applySort(rows, { field: 'priority', direction: 'descending' }, noEdits);
    expect(desc[0]!.priority).toBe('P2');
    expect(desc.at(-1)!.priority).toBe('P0');
  });

  it('is stable: equal values keep canonical order', () => {
    const sorted = applySort(rows, { field: 'priority', direction: 'ascending' }, noEdits);
    const p0 = sorted.filter((r) => r.priority === 'P0').map((r) => r.sourceOrder);
    expect(p0).toEqual([...p0].sort((a, b) => a - b));
  });

  it('sorts S.N numerically rather than lexically', () => {
    const sorted = applySort(rows, { field: 'sn', direction: 'ascending' }, noEdits);
    expect(sorted.slice(0, 3).map((r) => r.sn)).toEqual(['ST-01', 'ST-02', 'ST-03']);
    expect(sorted.at(-1)!.sn).toBe('ST-23');
  });

  it('sorts blank values last in both directions', () => {
    // No source row has a blank status any more, so clear one to exercise it.
    const edits = (rowKey: string) =>
      rowKey === 'st-07--infrastructure' ? ({ status: '' } as TrackerRowState) : undefined;

    const asc = applySort(rows, { field: 'status', direction: 'ascending' }, edits);
    expect(asc.at(-1)!.sn).toBe('ST-07');

    const desc = applySort(rows, { field: 'status', direction: 'descending' }, edits);
    expect(desc.at(-1)!.sn).toBe('ST-07');
  });

  it('sorts a column that is empty on every row without reordering', () => {
    const sorted = applySort(rows, { field: 'implementationBy', direction: 'ascending' }, noEdits);
    expect(sorted.map((r) => r.sourceOrder)).toEqual(rows.map((r) => r.sourceOrder));
  });

  it('sorts by category alphabetically', () => {
    const sorted = applySort(rows, { field: 'category', direction: 'ascending' }, noEdits);
    expect(sorted[0]!.category).toBe('Disaster Recovery');
  });

  it('never drops or duplicates a row', () => {
    const sorted = applySort(rows, { field: 'implementationItem', direction: 'descending' }, noEdits);
    expect(sorted).toHaveLength(24);
    expect(new Set(sorted.map((r) => r.rowKey)).size).toBe(24);
  });

  it('respects reader edits when sorting', () => {
    const edits = (rowKey: string) =>
      rowKey === 'st-23--disaster-recovery'
        ? ({ implementationBy: 'Aaron' } as TrackerRowState)
        : undefined;
    const sorted = applySort(rows, { field: 'implementationBy', direction: 'ascending' }, edits);
    expect(sorted[0]!.sn).toBe('ST-23');
  });
});

describe('nextSort', () => {
  it('cycles unsorted to ascending to descending and back', () => {
    const first = nextSort(null, 'priority');
    expect(first).toEqual({ field: 'priority', direction: 'ascending' });

    const second = nextSort(first, 'priority');
    expect(second).toEqual({ field: 'priority', direction: 'descending' });

    expect(nextSort(second, 'priority')).toBeNull();
  });

  it('starts ascending when switching to a different column', () => {
    expect(nextSort({ field: 'priority', direction: 'descending' }, 'category')).toEqual({
      field: 'category',
      direction: 'ascending',
    });
  });
});

describe('ariaSortFor', () => {
  it('reports none for an unsorted column', () => {
    expect(ariaSortFor(null, 'priority')).toBe('none');
    expect(ariaSortFor({ field: 'category', direction: 'ascending' }, 'priority')).toBe('none');
  });

  it('reports the direction for the sorted column', () => {
    expect(ariaSortFor({ field: 'priority', direction: 'ascending' }, 'priority')).toBe(
      'ascending',
    );
    expect(ariaSortFor({ field: 'priority', direction: 'descending' }, 'priority')).toBe(
      'descending',
    );
  });
});
