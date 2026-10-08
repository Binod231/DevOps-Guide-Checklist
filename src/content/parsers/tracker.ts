/**
 * Parser for the two `Implementation Tracker` CSV exports.
 *
 * Both files hold the same 24 rows; they differ only in column order and row
 * order. The S.N-sorted export is canonical because the Operational Checklist
 * links to exactly that filename.
 *
 * Source characteristics that are reproduced, not corrected:
 *   - `ST-10` is used twice (Infrastructure and Testing & Quality). The `S.N`
 *     is rendered as written; `rowKey` supplies uniqueness for the UI.
 *   - `ST-20` has an empty `Status` cell while the other 23 read `Not Started`.
 *   - `ST-09`'s Implementation Item and `ST-19`'s Verification Gate each end
 *     with a newline inside their quoted field.
 *   - `Implementation By`, `Target Date` and `Verified By` are empty on all
 *     rows; `Verified` reads `No` on all rows.
 */
import type {
  TrackerColumn,
  TrackerDataField,
  TrackerDocument,
  TrackerRow,
} from '../types';
import { slugify } from '../slug';
import { parseCsv } from './csv';
import { fail } from './markdown';

/** Canonical header spelling -> field name, keyed by normalised header. */
const HEADER_TO_FIELD: Record<string, TrackerDataField> = {
  sn: 'sn',
  category: 'category',
  implementationitem: 'implementationItem',
  implementationby: 'implementationBy',
  companystage: 'companyStage',
  priority: 'priority',
  status: 'status',
  targetdate: 'targetDate',
  verificationgate: 'verificationGate',
  verified: 'verified',
  verifiedby: 'verifiedBy',
};

/** Fields carrying row data, i.e. everything except derived bookkeeping. */
const DATA_FIELDS = Object.values(HEADER_TO_FIELD);

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Resolves a header row into an ordered column list. */
export function parseColumns(headerRow: readonly string[], label: string): TrackerColumn[] {
  const columns: TrackerColumn[] = [];
  const seen = new Set<TrackerDataField>();

  for (const header of headerRow) {
    const field = HEADER_TO_FIELD[normaliseHeader(header)];
    if (!field) {
      fail(`tracker (${label}): unrecognised column header ${JSON.stringify(header)}`);
    }
    if (seen.has(field)) {
      fail(`tracker (${label}): duplicate column ${JSON.stringify(header)}`);
    }
    seen.add(field);
    columns.push({ header, field });
  }

  const missing = DATA_FIELDS.filter((f) => !seen.has(f));
  if (missing.length > 0) {
    fail(`tracker (${label}): missing column(s) ${missing.join(', ')}`);
  }

  return columns;
}

interface ParsedExport {
  columns: TrackerColumn[];
  rows: TrackerRow[];
}

/**
 * `rowKey` is derived from S.N plus Category.
 *
 * S.N alone is not unique in the source, and row position is not stable across
 * the two exports, so the pair is the only order-independent identifier
 * available. It is verified unique below.
 */
function rowKeyFor(sn: string, category: string): string {
  return `${slugify(sn)}--${slugify(category)}`;
}

function parseExport(csv: string, label: string): ParsedExport {
  const records = parseCsv(csv);
  const headerRow = records[0];
  if (!headerRow) fail(`tracker (${label}): file is empty`);

  const columns = parseColumns(headerRow, label);
  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) fail(`tracker (${label}): no data rows`);

  const seenKeys = new Set<string>();

  const rows = dataRecords.map((record, index) => {
    const recordNumber = index + 1;
    if (record.length !== columns.length) {
      fail(
        `tracker (${label}): row ${recordNumber} has ${record.length} fields, ` +
          `expected ${columns.length}`,
      );
    }

    // Start every field as an empty string so blank cells stay blank rather
    // than becoming undefined.
    const values: Record<TrackerDataField, string> = {
      sn: '',
      category: '',
      implementationItem: '',
      implementationBy: '',
      companyStage: '',
      priority: '',
      status: '',
      targetDate: '',
      verificationGate: '',
      verified: '',
      verifiedBy: '',
    };

    columns.forEach((column, columnIndex) => {
      values[column.field] = record[columnIndex]!;
    });

    if (!values.sn) fail(`tracker (${label}): row ${recordNumber} has no S.N`);
    if (!values.category) fail(`tracker (${label}): row ${recordNumber} has no Category`);

    const rowKey = rowKeyFor(values.sn, values.category);
    if (seenKeys.has(rowKey)) {
      fail(
        `tracker (${label}): S.N "${values.sn}" repeats within category ` +
          `"${values.category}", so rows cannot be told apart`,
      );
    }
    seenKeys.add(rowKey);

    const row: TrackerRow = {
      rowKey,
      sn: values.sn,
      category: values.category,
      implementationItem: values.implementationItem,
      implementationBy: values.implementationBy,
      companyStage: values.companyStage,
      priority: values.priority,
      status: values.status,
      targetDate: values.targetDate,
      verificationGate: values.verificationGate,
      verified: values.verified,
      verifiedBy: values.verifiedBy,
      sourceOrder: recordNumber,
    };
    return row;
  });

  return { columns, rows };
}

/**
 * Confirms the two exports describe the same data.
 *
 * Compares every field except `sourceOrder`, which legitimately differs because
 * the files list the rows in different orders. Any other divergence means the
 * exports have drifted apart and one of them is stale.
 */
export function assertExportsAgree(
  canonical: readonly TrackerRow[],
  alternate: readonly TrackerRow[],
): void {
  if (canonical.length !== alternate.length) {
    fail(
      `tracker: exports disagree on row count ` +
        `(canonical ${canonical.length}, _all ${alternate.length})`,
    );
  }

  const byKey = new Map(alternate.map((row) => [row.rowKey, row]));

  for (const row of canonical) {
    const other = byKey.get(row.rowKey);
    if (!other) {
      fail(`tracker: row "${row.sn}" / "${row.category}" is missing from the _all export`);
    }
    for (const field of DATA_FIELDS) {
      if (row[field] !== other[field]) {
        fail(
          `tracker: exports disagree on ${field} for "${row.sn}" / "${row.category}"\n` +
            `  canonical: ${JSON.stringify(row[field])}\n` +
            `  _all:      ${JSON.stringify(other[field])}`,
        );
      }
    }
  }
}

export function parseTracker(canonicalCsv: string, allCsv: string): TrackerDocument {
  const canonical = parseExport(canonicalCsv, 'canonical');
  const alternate = parseExport(allCsv, '_all');

  assertExportsAgree(canonical.rows, alternate.rows);

  return {
    columns: canonical.columns,
    alternateColumns: alternate.columns,
    rows: canonical.rows,
  };
}
