/**
 * Sorting and filtering for the Implementation Tracker.
 *
 * Kept as pure functions so the behaviour is testable without rendering, and
 * so the table component stays presentational.
 *
 * Filter options are derived from the values actually present in the parsed
 * rows. Nothing is hardcoded, so a source change cannot leave a stale option
 * behind or hide a new one.
 */
import type { TrackerDataField, TrackerRow } from '../content/types';
import type { TrackerRowState } from '../state/portalState';

/** Fields the table can sort and filter on. */
export type SortField = TrackerDataField;

export type SortDirection = 'ascending' | 'descending';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export type FilterField = 'category' | 'priority' | 'companyStage' | 'status' | 'verified';

/** Selected values per filter. An empty array means "no filter applied". */
export type FilterState = Record<FilterField, string[]>;

export function emptyFilters(): FilterState {
  return { category: [], priority: [], companyStage: [], status: [], verified: [] };
}

export function hasActiveFilters(filters: FilterState): boolean {
  return Object.values(filters).some((values) => values.length > 0);
}

export function activeFilterCount(filters: FilterState): number {
  return Object.values(filters).reduce((n, values) => n + values.length, 0);
}

/**
 * The effective value of a field: the reader's edit when present, otherwise the
 * source value. Used so filtering and sorting reflect what is on screen.
 */
export function effectiveValue(
  row: TrackerRow,
  field: SortField,
  edits: TrackerRowState | undefined,
): string {
  switch (field) {
    case 'status':
      return edits?.status ?? row.status;
    case 'implementationBy':
      return edits?.implementationBy ?? row.implementationBy;
    case 'targetDate':
      return edits?.targetDate ?? row.targetDate;
    case 'verified':
      return edits?.verified ?? row.verified;
    case 'verifiedBy':
      return edits?.verifiedBy ?? row.verifiedBy;
    default:
      return row[field];
  }
}

/**
 * Distinct values for a filter, in first-appearance order.
 *
 * Blank values are excluded: an empty cell is an absence, not a category to
 * filter by. A dedicated "blank" option would be inventing a value.
 */
export function filterOptions(
  rows: readonly TrackerRow[],
  field: FilterField,
  editsFor: (rowKey: string) => TrackerRowState | undefined,
): string[] {
  const seen: string[] = [];
  for (const row of rows) {
    const value = effectiveValue(row, field, editsFor(row.rowKey));
    if (value && !seen.includes(value)) seen.push(value);
  }
  return seen;
}

export function applyFilters(
  rows: readonly TrackerRow[],
  filters: FilterState,
  editsFor: (rowKey: string) => TrackerRowState | undefined,
): TrackerRow[] {
  const fields = Object.keys(filters) as FilterField[];
  return rows.filter((row) => {
    const edits = editsFor(row.rowKey);
    return fields.every((field) => {
      const selected = filters[field];
      if (selected.length === 0) return true;
      return selected.includes(effectiveValue(row, field, edits));
    });
  });
}

/**
 * Sorts rows, keeping the comparison stable.
 *
 * Ties fall back to the row's position in the canonical export, so repeated
 * sorts on a field with many equal values never reshuffle rows. Blank values
 * sort last in either direction, since they carry no ordering information.
 */
export function applySort(
  rows: readonly TrackerRow[],
  sort: SortState | null,
  editsFor: (rowKey: string) => TrackerRowState | undefined,
): TrackerRow[] {
  const out = [...rows];
  if (!sort) return out.sort((a, b) => a.sourceOrder - b.sourceOrder);

  const factor = sort.direction === 'ascending' ? 1 : -1;

  return out.sort((a, b) => {
    const left = effectiveValue(a, sort.field, editsFor(a.rowKey)).trim();
    const right = effectiveValue(b, sort.field, editsFor(b.rowKey)).trim();

    if (left === '' && right !== '') return 1;
    if (right === '' && left !== '') return -1;

    const compared = left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' });
    if (compared !== 0) return compared * factor;
    return a.sourceOrder - b.sourceOrder;
  });
}

/** Cycles a header: unsorted -> ascending -> descending -> unsorted. */
export function nextSort(current: SortState | null, field: SortField): SortState | null {
  if (!current || current.field !== field) return { field, direction: 'ascending' };
  if (current.direction === 'ascending') return { field, direction: 'descending' };
  return null;
}

/** `aria-sort` value for a column header. */
export function ariaSortFor(current: SortState | null, field: SortField): SortDirection | 'none' {
  if (!current || current.field !== field) return 'none';
  return current.direction;
}
