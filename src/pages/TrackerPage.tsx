import { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { TrackerTable } from '../components/TrackerTable';
import { FilterPanel, type FilterGroup } from '../components/FilterPanel';
import { ExportImportPanel } from '../components/ExportImportPanel';
import {
  type FilterField,
  type SortState,
  applyFilters,
  applySort,
  emptyFilters,
  filterOptions,
} from '../components/trackerTableModel';
import { UI_FLAGS } from '../config/uiFlags';
import { checklist, tracker } from '../content/registry';
import { usePortalState } from '../state/PortalStateProvider';

/** The two column orders the source exports use. */
type ColumnOrder = 'canonical' | 'alternate';

/** Filters offered, labelled with the source CSV's own header spelling. */
const FILTER_FIELDS: { field: FilterField; header: string }[] = [
  { field: 'category', header: 'Category' },
  { field: 'priority', header: 'Priority' },
  { field: 'companyStage', header: 'Company Stage' },
  { field: 'status', header: 'Status' },
  { field: 'verified', header: 'Verified' },
];

/**
 * Implementation Tracker.
 *
 * All 24 rows with all 11 columns, sortable and filterable. The two source
 * exports hold the same data in different column orders, so both orders are
 * offered rather than one being picked for the reader.
 */
export function TrackerPage() {
  const { trackerRowState } = usePortalState();
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [columnOrder, setColumnOrder] = useState<ColumnOrder>('canonical');

  const editsFor = (rowKey: string) => trackerRowState(rowKey);

  const columns = columnOrder === 'canonical' ? tracker.columns : tracker.alternateColumns;

  const groups = useMemo<FilterGroup[]>(
    () =>
      FILTER_FIELDS.map(({ field, header }) => ({
        field,
        label: header,
        options: filterOptions(tracker.rows, field, editsFor),
      })),
    // `trackerRowState` changes identity whenever an edit lands, which is
    // exactly when a filterable value may have changed.
    [trackerRowState],
  );

  const visibleRows = useMemo(
    () => applySort(applyFilters(tracker.rows, filters, editsFor), sort, editsFor),
    [filters, sort, trackerRowState],
  );

  const toggleFilter = (field: FilterField, value: string) => {
    setFilters((current) => {
      const selected = current[field];
      return {
        ...current,
        [field]: selected.includes(value)
          ? selected.filter((v) => v !== value)
          : [...selected, value],
      };
    });
  };

  return (
    <PageShell>
      <SectionHeader heading={checklist.trackerLinkLabel}>
        <p className="mt-3 text-sm text-ink-muted">
          {tracker.rows.length} rows, {tracker.columns.length} columns, as exported.
        </p>
      </SectionHeader>

      <div className="mt-6 space-y-4">
        <FilterPanel
          groups={groups}
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyFilters())}
          matching={visibleRows.length}
          total={tracker.rows.length}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset>
            <legend className="sr-only">Column order</legend>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-ink-muted">
                Column order
              </span>
              {(
                [
                  ['canonical', 'Default export'],
                  ['alternate', 'Alternate export'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={[
                    'cursor-pointer border px-2 py-1',
                    columnOrder === value
                      ? 'border-accent-border bg-accent-subtle font-semibold text-accent'
                      : 'border-edge bg-surface text-ink-secondary hover:bg-sunken',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="column-order"
                    value={value}
                    checked={columnOrder === value}
                    onChange={() => setColumnOrder(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {sort && (
            <button
              type="button"
              onClick={() => setSort(null)}
              className="border border-edge bg-surface px-2 py-1 text-xs text-ink-secondary hover:bg-sunken"
            >
              Reset to source order
            </button>
          )}
        </div>

        <TrackerTable
          columns={columns}
          rows={visibleRows}
          sort={sort}
          onSortChange={setSort}
          caption={`Implementation Tracker, ${visibleRows.length} of ${tracker.rows.length} rows shown`}
        />

        {UI_FLAGS.perRowNotesAndEvidence && (
          <p className="text-xs text-ink-muted">
            <span aria-hidden="true">&dagger;</span> Notes and Evidence are capture fields added by
            this portal. They are not columns in the source export and start empty.
          </p>
        )}

        <ExportImportPanel />
      </div>
    </PageShell>
  );
}
