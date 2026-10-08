import type { TrackerColumn, TrackerDataField, TrackerRow } from '../content/types';
import type { TrackerRowState } from '../state/portalState';
import { UI_FLAGS, statusOptions } from '../config/uiFlags';
import { usePortalState } from '../state/PortalStateProvider';
import { EmptyCell, PriorityBadge, StageBadge, StatusBadge, VerifiedBadge } from './badges';
import { type SortState, ariaSortFor, nextSort } from './trackerTableModel';

interface TrackerTableProps {
  columns: TrackerColumn[];
  rows: TrackerRow[];
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  /** Accessible caption describing the table's current contents. */
  caption: string;
}

/** Fields the reader may edit, per the brief. */
const EDITABLE = new Set<TrackerDataField>([
  'status',
  'implementationBy',
  'targetDate',
  'verified',
  'verifiedBy',
]);

/** Columns whose text is long enough to need room to breathe. */
const WIDE = new Set<TrackerDataField>(['implementationItem', 'verificationGate']);

export function TrackerTable({ columns, rows, sort, onSortChange, caption }: TrackerTableProps) {
  const { trackerRowState, setTrackerField } = usePortalState();

  return (
    <div className="overflow-x-auto border border-edge bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-sunken">
            {columns.map((column, index) => (
              <HeaderCell
                key={column.field}
                column={column}
                sort={sort}
                onSortChange={onSortChange}
                sticky={index === 0}
              />
            ))}
            {UI_FLAGS.perRowNotesAndEvidence && (
              <>
                <AddedHeader label="Notes" />
                <AddedHeader label="Evidence" />
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const edits = trackerRowState(row.rowKey);
            return (
              <tr key={row.rowKey} className="border-t border-edge align-top">
                {columns.map((column, index) => (
                  <DataCell
                    key={column.field}
                    column={column}
                    row={row}
                    edits={edits}
                    sticky={index === 0}
                    onEdit={(value) => setTrackerField(row.rowKey, asStateField(column.field), value)}
                  />
                ))}
                {UI_FLAGS.perRowNotesAndEvidence && (
                  <>
                    <AddedCell
                      rowKey={row.rowKey}
                      sn={row.sn}
                      field="notes"
                      label="Notes"
                      value={edits.notes ?? ''}
                    />
                    <AddedCell
                      rowKey={row.rowKey}
                      sn={row.sn}
                      field="evidence"
                      label="Evidence"
                      value={edits.evidence ?? ''}
                    />
                  </>
                )}
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (UI_FLAGS.perRowNotesAndEvidence ? 2 : 0)}
                className="px-3 py-8 text-center text-ink-muted"
              >
                No rows match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({
  column,
  sort,
  onSortChange,
  sticky,
}: {
  column: TrackerColumn;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  sticky: boolean;
}) {
  const { field } = column;
  const ariaSort = ariaSortFor(sort, field);

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={[
        'whitespace-nowrap border-b border-edge px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-secondary',
        sticky ? 'sticky left-0 z-10 bg-sunken' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onSortChange(nextSort(sort, field))}
        className="flex items-center gap-1 uppercase hover:text-accent"
      >
        {column.header}
        <SortGlyph direction={ariaSort} />
      </button>
    </th>
  );
}

function AddedHeader({ label }: { label: string }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap border-b border-l border-edge px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted"
    >
      {label}
      {/* Flagged so a reader can see this column is not in the source export. */}
      <span className="ml-1 font-normal normal-case" title="Added by this portal">
        <span aria-hidden="true">&dagger;</span>
        <span className="sr-only">, added by this portal, not in the source document</span>
      </span>
    </th>
  );
}

function DataCell({
  column,
  row,
  edits,
  sticky,
  onEdit,
}: {
  column: TrackerColumn;
  row: TrackerRow;
  edits: TrackerRowState;
  sticky: boolean;
  onEdit: (value: string) => void;
}) {
  const className = [
    'px-3 py-2 text-ink-secondary',
    sticky ? 'sticky left-0 z-10 bg-surface font-mono text-xs' : '',
    WIDE.has(column.field) ? 'min-w-64' : '',
  ].join(' ');

  return (
    <td className={className}>
      {renderCell({ column, row, edits, onEdit })}
    </td>
  );
}

function renderCell({
  column,
  row,
  edits,
  onEdit,
}: {
  column: TrackerColumn;
  row: TrackerRow;
  edits: TrackerRowState;
  onEdit: (value: string) => void;
}) {
  const { field } = column;
  const sourceValue = row[field];
  const label = `${column.header} for ${row.sn}, ${row.category}`;

  if (field === 'status') {
    const value = edits.status ?? row.status;
    return (
      <div className="flex flex-col gap-1">
        <StatusBadge value={value} />
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onEdit(event.target.value)}
          className="w-full min-w-28 border border-edge bg-surface px-1.5 py-1 text-xs text-ink-secondary"
        >
          {/* ST-20 has no status in the source; keep that representable. */}
          {value === '' && <option value="">(none)</option>}
          {statusOptions().map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field === 'verified') {
    const value = edits.verified ?? row.verified;
    return (
      <div className="flex flex-col gap-1">
        <VerifiedBadge value={value} />
        <input
          type="text"
          aria-label={label}
          value={value}
          onChange={(event) => onEdit(event.target.value)}
          className="w-full min-w-16 border border-edge bg-surface px-1.5 py-1 text-xs text-ink-secondary"
        />
      </div>
    );
  }

  if (field === 'targetDate') {
    const value = edits.targetDate ?? row.targetDate;
    return (
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(event) => onEdit(event.target.value)}
        className="w-full min-w-32 border border-edge bg-surface px-1.5 py-1 text-xs text-ink-secondary"
      />
    );
  }

  if (EDITABLE.has(field)) {
    const value = (edits[asStateField(field)] as string | undefined) ?? sourceValue;
    return (
      <input
        type="text"
        aria-label={label}
        value={value}
        onChange={(event) => onEdit(event.target.value)}
        className="w-full min-w-28 border border-edge bg-surface px-1.5 py-1 text-xs text-ink-secondary"
      />
    );
  }

  if (field === 'priority') return <PriorityBadge value={sourceValue} />;
  if (field === 'companyStage') return <StageBadge value={sourceValue} />;
  if (!sourceValue) return <EmptyCell />;

  // `ST-09`'s Implementation Item and `ST-19`'s Verification Gate end with a
  // newline inside their CSV field. The stored value keeps it; trimming only
  // the display avoids a stray blank line in the cell.
  return <span className="whitespace-pre-wrap">{sourceValue.trim()}</span>;
}

function AddedCell({
  rowKey,
  sn,
  field,
  label,
  value,
}: {
  rowKey: string;
  sn: string;
  field: 'notes' | 'evidence';
  label: string;
  value: string;
}) {
  const { setTrackerField } = usePortalState();
  return (
    <td className="border-l border-edge px-3 py-2">
      <textarea
        aria-label={`${label} for ${sn}`}
        value={value}
        rows={2}
        onChange={(event) => setTrackerField(rowKey, field, event.target.value)}
        className="w-full min-w-40 resize-y border border-edge bg-surface px-1.5 py-1 text-xs text-ink-secondary"
      />
    </td>
  );
}

function SortGlyph({ direction }: { direction: 'ascending' | 'descending' | 'none' }) {
  if (direction === 'none') {
    return (
      <span aria-hidden="true" className="text-edge-strong">
        &#8693;
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="text-accent">
      {direction === 'ascending' ? '\u2191' : '\u2193'}
    </span>
  );
}

/** Narrows a tracker field to the subset the state layer stores. */
function asStateField(field: TrackerDataField): keyof TrackerRowState {
  return field as keyof TrackerRowState;
}
