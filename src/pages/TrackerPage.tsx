import { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { SectionHeader } from '../components/SectionHeader';
import { TrackerTable } from '../components/TrackerTable';
import { FilterPanel, type FilterGroup } from '../components/FilterPanel';
import { ExportImportPanel } from '../components/ExportImportPanel';
import { TrackerRowModal } from '../components/TrackerRowModal';
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
import type { TrackerRow } from '../content/types';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';

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
 * All rows with all 11 columns, sortable and filterable. The two source
 * exports hold the same data in different column orders, so both orders are
 * offered rather than one being picked for the reader.
 *
 * Administrators have full CRUD capabilities (Add, Edit all fields, Delete,
 * and Restore rows) as well as access to the state Import/Export tools.
 */
export function TrackerPage() {
  const {
    trackerRowState,
    allTrackerRows,
    addTrackerRow,
    updateTrackerRowDetails,
    deleteTrackerRow,
    restoreTrackerRows,
    hasDeletedTrackerRows,
  } = usePortalState();
  const { isAdmin } = useAuth();

  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [columnOrder, setColumnOrder] = useState<ColumnOrder>('canonical');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TrackerRow | null>(null);

  const editsFor = (rowKey: string) => trackerRowState(rowKey);

  const baseRows = useMemo(() => allTrackerRows(tracker.rows), [allTrackerRows]);

  const columns = columnOrder === 'canonical' ? tracker.columns : tracker.alternateColumns;

  const groups = useMemo<FilterGroup[]>(
    () =>
      FILTER_FIELDS.map(({ field, header }) => ({
        field,
        label: header,
        options: filterOptions(baseRows, field, editsFor),
      })),
    // `trackerRowState` and `baseRows` change identity whenever rows or edits change.
    [baseRows, trackerRowState],
  );

  const visibleRows = useMemo(
    () => applySort(applyFilters(baseRows, filters, editsFor), sort, editsFor),
    [baseRows, filters, sort, trackerRowState],
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

  const handleAddRow = () => {
    setEditingRow(null);
    setModalOpen(true);
  };

  const handleEditRow = (row: TrackerRow) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const handleDeleteRow = (rowKey: string) => {
    deleteTrackerRow(rowKey);
  };

  const handleSaveRow = (savedRow: TrackerRow) => {
    if (editingRow) {
      updateTrackerRowDetails(savedRow.rowKey, savedRow);
    } else {
      addTrackerRow(savedRow);
    }
  };

  return (
    <PageShell>
      <SectionHeader heading={checklist.trackerLinkLabel}>
        <p className="mt-3 text-sm text-ink-muted">
          {baseRows.length} rows, {tracker.columns.length} columns, as exported.
        </p>
      </SectionHeader>

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-edge bg-surface px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-xs border border-accent-border bg-accent-subtle px-2 py-0.5 font-semibold text-accent uppercase tracking-wide">
              Admin Mode
            </span>
            <span className="text-ink-muted">
              Full CRUD enabled: create rows, edit core fields via modal, delete rows, and manage state transfer.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="border border-accent-border bg-accent-subtle px-3 py-1 font-semibold text-accent hover:bg-accent-subtle/80"
            >
              + Add Tracker Row
            </button>
            {hasDeletedTrackerRows && (
              <button
                type="button"
                onClick={restoreTrackerRows}
                className="border border-edge bg-surface px-2.5 py-1 text-ink-secondary hover:bg-sunken"
              >
                Restore Deleted Rows
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <FilterPanel
          groups={groups}
          filters={filters}
          onToggle={toggleFilter}
          onClear={() => setFilters(emptyFilters())}
          matching={visibleRows.length}
          total={baseRows.length}
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
          caption={`Implementation Tracker, ${visibleRows.length} of ${baseRows.length} rows shown`}
          onEditRow={isAdmin ? handleEditRow : undefined}
          onDeleteRow={isAdmin ? handleDeleteRow : undefined}
        />

        {UI_FLAGS.perRowNotesAndEvidence && (
          <p className="text-xs text-ink-muted">
            <span aria-hidden="true">&dagger;</span> Notes and Evidence are capture fields added by
            this portal. They are not columns in the source export and start empty.
          </p>
        )}

        {isAdmin && <ExportImportPanel />}
      </div>

      <TrackerRowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRow={editingRow}
        onSave={handleSaveRow}
      />
    </PageShell>
  );
}
