import type { TrackerColumn, TrackerDataField, TrackerRow } from '../content/types';
import type { TrackerRowState } from '../state/portalState';
import { UI_FLAGS, statusOptions } from '../config/uiFlags';
import { usePortalState } from '../state/PortalStateProvider';
import { useAuth } from '../state/authContext';
import { COMPACT_TRACKER_QUERY, useMediaQuery } from '../state/useMediaQuery';
import { EmptyCell, PriorityBadge, StageBadge, StatusBadge, VerifiedBadge } from './badges';
import { type SortState, ariaSortFor, nextSort } from './trackerTableModel';

interface TrackerTableProps {
  columns: TrackerColumn[];
  rows: TrackerRow[];
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  /** Accessible caption describing the table's current contents. */
  caption: string;
  onEditRow?: (row: TrackerRow) => void;
  onDeleteRow?: (rowKey: string) => void;
}

/** Fields the reader may edit, per the brief. */
const EDITABLE = new Set<TrackerDataField>([
  'status',
  'implementationBy',
  'targetDate',
  'verified',
  'verifiedBy',
]);

/**
 * Column widths, in pixels.
 *
 * The table uses `table-layout: fixed`, so these are authoritative. That is
 * deliberate and not only cosmetic: with `table-layout: auto`, the table's
 * intrinsic width (about 2000px for 13 columns) propagates out of the
 * scrolling wrapper and makes the whole document scroll sideways. Fixing the
 * layout keeps the overflow where it belongs — inside the table's own box.
 */
const COLUMN_WIDTH: Record<TrackerDataField, number> = {
  sn: 76,
  category: 150,
  implementationItem: 260,
  implementationBy: 140,
  companyStage: 160,
  priority: 86,
  status: 148,
  targetDate: 150,
  verificationGate: 330,
  verified: 100,
  verifiedBy: 140,
};

/** Width of each portal-added column. */
const ADDED_COLUMN_WIDTH = 190;

function tableMinWidth(columns: TrackerColumn[]): number {
  const base = columns.reduce((total, c) => total + COLUMN_WIDTH[c.field], 0);
  return base + (UI_FLAGS.perRowNotesAndEvidence ? ADDED_COLUMN_WIDTH * 2 : 0);
}

export function TrackerTable({
  columns,
  rows,
  sort,
  onSortChange,
  caption,
  onEditRow,
  onDeleteRow,
}: TrackerTableProps) {
  const compact = useMediaQuery(COMPACT_TRACKER_QUERY);
  const { isAdmin } = useAuth();
  const showActions = isAdmin && Boolean(onEditRow || onDeleteRow);

  if (compact) {
    return (
      <TrackerCards
        columns={columns}
        rows={rows}
        caption={caption}
        onEditRow={onEditRow}
        onDeleteRow={onDeleteRow}
        showActions={showActions}
      />
    );
  }

  return (
    /*
      `relative` is load-bearing, not decorative.

      The first column's cells are `position: sticky`. A sticky box reports its
      scrollable overflow to its nearest *positioned* ancestor. While this
      wrapper was `position: static`, that search walked straight past it and
      landed on the viewport, so the table's full 2120px width was added to the
      document's scrolling area and the whole browser window scrolled sideways
      — even though this wrapper was correctly clipping and scrolling the table
      itself (client 974 / scroll 2120). Making the wrapper positioned stops the
      leak here. Measured: window overflow 719px -> 0px at 1920px wide, with the
      sticky column still pinned.

      Note that `overflow-x: hidden` on html/body does NOT fix this, because the
      leak bypasses the normal box tree.
    */
    <div className="relative w-full max-w-full overflow-x-auto border border-edge bg-surface">
      <table
        className="border-collapse text-sm"
        style={{
          tableLayout: 'fixed',
          width: '100%',
          minWidth: `${tableMinWidth(columns)}px`,
        }}
      >
        <caption className="sr-only">{caption}</caption>

        <colgroup>
          {columns.map((column) => (
            <col key={column.field} style={{ width: `${COLUMN_WIDTH[column.field]}px` }} />
          ))}
          {UI_FLAGS.perRowNotesAndEvidence && (
            <>
              <col style={{ width: `${ADDED_COLUMN_WIDTH}px` }} />
              <col style={{ width: `${ADDED_COLUMN_WIDTH}px` }} />
            </>
          )}
        </colgroup>

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
          {rows.map((row) => (
            <TableRow
              key={row.rowKey}
              row={row}
              columns={columns}
              showActions={showActions}
              onEditRow={onEditRow}
              onDeleteRow={onDeleteRow}
            />
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={
                  columns.length +
                  (UI_FLAGS.perRowNotesAndEvidence ? 2 : 0)
                }
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

function TableRow({
  row,
  columns,
  showActions,
  onEditRow,
  onDeleteRow,
}: {
  row: TrackerRow;
  columns: TrackerColumn[];
  showActions: boolean;
  onEditRow?: (row: TrackerRow) => void;
  onDeleteRow?: (rowKey: string) => void;
}) {
  const { trackerRowState, setTrackerField } = usePortalState();
  const edits = trackerRowState(row.rowKey);

  return (
    <tr className="border-t border-edge align-top">
      {columns.map((column, index) => (
        <td
          key={column.field}
          className={[
            'px-3 py-2 align-top text-ink-secondary',
            index === 0 ? 'sticky left-0 z-10 bg-surface font-mono text-xs' : '',
          ].join(' ')}
        >
          <CellContent
            column={column}
            row={row}
            edits={edits}
            onEdit={(value) => setTrackerField(row.rowKey, asStateField(column.field), value)}
          />
          {column.field === 'implementationItem' && showActions && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-edge/60 pt-1">
              <button
                type="button"
                onClick={() => onEditRow?.(row)}
                aria-label={`Edit row ${row.sn}`}
                className="border border-edge bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:border-accent hover:bg-sunken"
                title={`Edit row ${row.sn}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteRow?.(row.rowKey)}
                aria-label={`Delete row ${row.sn}`}
                className="border border-rose-200 bg-rose-50/50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
                title={`Delete row ${row.sn}`}
              >
                Delete
              </button>
            </div>
          )}
        </td>
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
        'border-b border-edge px-3 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-ink-secondary',
        sticky ? 'sticky left-0 z-20 bg-sunken' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onSortChange(nextSort(sort, field))}
        className="flex w-full items-center gap-1 text-left uppercase hover:text-accent"
      >
        <span className="min-w-0 flex-1">{column.header}</span>
        <SortGlyph direction={ariaSort} />
      </button>
    </th>
  );
}

function AddedHeader({ label }: { label: string }) {
  return (
    <th
      scope="col"
      className="border-b border-l border-edge px-3 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-ink-muted"
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

/* ------------------------------------------------------------------ *
 * Cell contents, shared by the table and the card layout
 * ------------------------------------------------------------------ */

const FIELD_CLASS =
  'w-full min-w-0 border border-edge bg-surface px-1.5 py-1 text-xs text-ink-secondary';

function CellContent({
  column,
  row,
  edits,
  onEdit,
  showBadge = false,
}: {
  column: TrackerColumn;
  row: TrackerRow;
  edits: TrackerRowState;
  onEdit: (value: string) => void;
  /** Renders the read-only badge alongside an editable control. */
  showBadge?: boolean;
}) {
  const { isAdmin } = useAuth();
  const { field } = column;
  const sourceValue = row[field];
  const label = `${column.header} for ${row.sn}, ${row.category}`;

  if (field === 'status') {
    const value = edits.status ?? row.status;
    return (
      <div className="flex flex-col gap-1">
        {showBadge && <StatusBadge value={value} />}
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onEdit(event.target.value)}
          className={FIELD_CLASS}
        >
          {/* Keeps an empty Status representable if the source ever has one. */}
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
    const isLocked = !isAdmin;
    return (
      <div className="flex flex-col gap-1">
        {showBadge && <VerifiedBadge value={value} />}
        <input
          type="text"
          aria-label={label}
          value={value}
          disabled={isLocked}
          title={isLocked ? 'Administrator role required to edit Verified' : undefined}
          onChange={(event) => {
            if (!isLocked) onEdit(event.target.value);
          }}
          className={[
            FIELD_CLASS,
            isLocked ? 'cursor-not-allowed bg-sunken text-ink-muted' : '',
          ].join(' ')}
        />
      </div>
    );
  }

  if (field === 'targetDate') {
    const isLocked = !isAdmin;
    return (
      <input
        type="date"
        aria-label={label}
        value={edits.targetDate ?? row.targetDate}
        disabled={isLocked}
        title={isLocked ? 'Administrator role required to edit Verify Deadline' : undefined}
        onChange={(event) => {
          if (!isLocked) onEdit(event.target.value);
        }}
        className={[
          FIELD_CLASS,
          isLocked ? 'cursor-not-allowed bg-sunken text-ink-muted' : '',
        ].join(' ')}
      />
    );
  }

  if (EDITABLE.has(field)) {
    const isLocked = field === 'verifiedBy' && !isAdmin;
    const value = (edits[asStateField(field)] as string | undefined) ?? sourceValue;
    return (
      <input
        type="text"
        aria-label={label}
        value={value}
        disabled={isLocked}
        title={isLocked ? 'Administrator role required to edit Verified By' : undefined}
        onChange={(event) => {
          if (!isLocked) onEdit(event.target.value);
        }}
        className={[
          FIELD_CLASS,
          isLocked ? 'cursor-not-allowed bg-sunken text-ink-muted' : '',
        ].join(' ')}
      />
    );
  }

  if (field === 'priority') return <PriorityBadge value={sourceValue} />;
  if (field === 'companyStage') return <StageBadge value={sourceValue} />;
  if (!sourceValue) return <EmptyCell />;

  return <span className="block break-words">{sourceValue.trim()}</span>;
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
  const { isAdmin } = useAuth();
  const isLocked = field === 'evidence' && !isAdmin;

  return (
    <td className="border-l border-edge px-3 py-2 align-top">
      <textarea
        aria-label={`${label} for ${sn}`}
        value={value}
        rows={2}
        disabled={isLocked}
        title={isLocked ? 'Administrator role required to edit Evidence' : undefined}
        onChange={(event) => {
          if (!isLocked) setTrackerField(rowKey, field, event.target.value);
        }}
        className={[
          FIELD_CLASS,
          'resize-y',
          isLocked ? 'cursor-not-allowed bg-sunken text-ink-muted' : '',
        ].join(' ')}
      />
    </td>
  );
}

function SortGlyph({ direction }: { direction: 'ascending' | 'descending' | 'none' }) {
  if (direction === 'none') {
    return (
      <span aria-hidden="true" className="shrink-0 text-edge-strong">
        &#8693;
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="shrink-0 text-accent">
      {direction === 'ascending' ? '\u2191' : '\u2193'}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Card layout for narrow screens
 * ------------------------------------------------------------------ */

/**
 * One card per tracker row.
 *
 * A 13-column table cannot be read on a phone, so below the breakpoint each
 * row becomes a stacked record: identifier and read-only attributes in a
 * header, then the editable fields as labelled rows, then the verification
 * gate. No horizontal scrolling at all.
 */
function TrackerCards({
  columns,
  rows,
  caption,
  onEditRow,
  onDeleteRow,
  showActions,
}: {
  columns: TrackerColumn[];
  rows: TrackerRow[];
  caption: string;
  onEditRow?: (row: TrackerRow) => void;
  onDeleteRow?: (rowKey: string) => void;
  showActions: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-edge bg-surface px-4 py-8 text-center text-ink-muted">
        No rows match the current filters.
      </div>
    );
  }

  const byField = new Map(columns.map((c) => [c.field, c]));
  const editableFields: TrackerDataField[] = [
    'status',
    'implementationBy',
    'targetDate',
    'verified',
    'verifiedBy',
  ];

  return (
    <section aria-label={caption} className="space-y-3">
      {rows.map((row) => (
        <TrackerCard
          key={row.rowKey}
          row={row}
          byField={byField}
          editableFields={editableFields}
          onEditRow={onEditRow}
          onDeleteRow={onDeleteRow}
          showActions={showActions}
        />
      ))}
    </section>
  );
}

function TrackerCard({
  row,
  byField,
  editableFields,
  onEditRow,
  onDeleteRow,
  showActions,
}: {
  row: TrackerRow;
  byField: Map<TrackerDataField, TrackerColumn>;
  editableFields: TrackerDataField[];
  onEditRow?: (row: TrackerRow) => void;
  onDeleteRow?: (rowKey: string) => void;
  showActions: boolean;
}) {
  const { trackerRowState, setTrackerField } = usePortalState();
  const { isAdmin } = useAuth();
  const edits = trackerRowState(row.rowKey);
  const headingId = `card-${row.rowKey}`;

  return (
    <article aria-labelledby={headingId} className="border border-edge bg-surface">
      <div className="border-b border-edge bg-sunken px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-muted">{row.sn}</span>
            <PriorityBadge value={row.priority} />
            <StageBadge value={row.companyStage} />
          </div>
          {showActions && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEditRow?.(row)}
                aria-label={`Edit row ${row.sn}`}
                className="border border-edge bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:border-accent hover:bg-sunken"
                title={`Edit row ${row.sn}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteRow?.(row.rowKey)}
                aria-label={`Delete row ${row.sn}`}
                className="border border-rose-200 bg-rose-50/50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50"
                title={`Delete row ${row.sn}`}
              >
                Delete
              </button>
            </div>
          )}
        </div>
        <h3 id={headingId} className="mt-1.5 text-sm font-semibold text-ink">
          {row.implementationItem.trim()}
        </h3>
        <p className="mt-0.5 text-xs text-ink-muted">{row.category}</p>
      </div>

      <dl className="divide-y divide-edge">
        {editableFields.map((field) => {
          const column = byField.get(field);
          if (!column) return null;
          return (
            <div
              key={field}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 px-3 py-2"
            >
              <dt className="text-xs uppercase tracking-wide text-ink-muted">{column.header}</dt>
              <dd className="min-w-0">
                <CellContent
                  column={column}
                  row={row}
                  edits={edits}
                  // A colour cue is worth the extra line in the card layout,
                  // where vertical space is cheap and columns are not.
                  showBadge={field === 'status' || field === 'verified'}
                  onEdit={(value) => setTrackerField(row.rowKey, asStateField(field), value)}
                />
              </dd>
            </div>
          );
        })}

        {UI_FLAGS.perRowNotesAndEvidence &&
          (['notes', 'evidence'] as const).map((field) => {
            const isLocked = field === 'evidence' && !isAdmin;
            return (
              <div key={field} className="px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-ink-muted">
                  {field === 'notes' ? 'Notes' : 'Evidence'}
                  <span className="ml-1" title="Added by this portal">
                    <span aria-hidden="true">&dagger;</span>
                    <span className="sr-only">, added by this portal</span>
                  </span>
                </dt>
                <dd className="mt-1">
                  <textarea
                    aria-label={`${field === 'notes' ? 'Notes' : 'Evidence'} for ${row.sn}`}
                    value={edits[field] ?? ''}
                    rows={2}
                    disabled={isLocked}
                    title={isLocked ? 'Administrator role required to edit Evidence' : undefined}
                    onChange={(event) => {
                      if (!isLocked) setTrackerField(row.rowKey, field, event.target.value);
                    }}
                    className={[
                      FIELD_CLASS,
                      'resize-y',
                      isLocked ? 'cursor-not-allowed bg-sunken text-ink-muted' : '',
                    ].join(' ')}
                  />
                </dd>
              </div>
            );
          })}

        <div className="px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-ink-muted">
            {byField.get('verificationGate')?.header ?? 'Verification Gate'}
          </dt>
          <dd className="mt-1 break-words text-xs text-ink-secondary">
            {row.verificationGate.trim()}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/** Narrows a tracker field to the subset the state layer stores. */
function asStateField(field: TrackerDataField): keyof TrackerRowState {
  return field as keyof TrackerRowState;
}
