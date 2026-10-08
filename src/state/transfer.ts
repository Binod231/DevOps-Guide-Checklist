/**
 * Export and import of a reader's engagement state.
 *
 * Two formats, for two purposes:
 *
 *   JSON  the full state, round-trippable back into the portal.
 *   CSV   the tracker only, written with the source export's exact column
 *         order and header spelling so it drops straight back into Notion or a
 *         client spreadsheet.
 *
 * Import validates rather than trusting its input, and reports every problem it
 * finds instead of silently discarding data.
 */
import { toCsv, parseCsv } from '../content/parsers/csv';
import type { TrackerColumn, TrackerDocument, TrackerRow } from '../content/types';
import {
  STATE_VERSION,
  emptyState,
  sanitiseState,
  type PortalState,
  type TrackerRowState,
} from './portalState';

/* ------------------------------------------------------------------ *
 * JSON export
 * ------------------------------------------------------------------ */

export const EXPORT_FORMAT = 'devops-portal-state';

export interface StateExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  /** ISO timestamp, recorded so a client can tell two exports apart. */
  exportedAt: string;
  state: PortalState;
}

export function buildStateExport(state: PortalState, now: Date = new Date()): StateExport {
  return {
    format: EXPORT_FORMAT,
    version: STATE_VERSION,
    exportedAt: now.toISOString(),
    state,
  };
}

export function serialiseState(state: PortalState, now?: Date): string {
  return `${JSON.stringify(buildStateExport(state, now), null, 2)}\n`;
}

/* ------------------------------------------------------------------ *
 * JSON import
 * ------------------------------------------------------------------ */

export interface ImportIssue {
  /** Dotted path to the offending value, e.g. `state.checked.foo`. */
  path: string;
  message: string;
}

export type ImportResult =
  | { ok: true; state: PortalState; issues: ImportIssue[] }
  | { ok: false; issues: ImportIssue[] };

const TRACKER_FIELDS: readonly (keyof TrackerRowState)[] = [
  'status',
  'implementationBy',
  'targetDate',
  'verified',
  'verifiedBy',
  'notes',
  'evidence',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses and validates an exported state file.
 *
 * Fails outright only when the payload is unusable: bad JSON, not an object, or
 * no recognisable state. Everything else is reported as an issue while the
 * usable remainder is still imported, so one bad field never costs a whole
 * engagement.
 */
export function parseStateImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      issues: [{ path: 'file', message: 'Not valid JSON.' }],
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      issues: [{ path: 'file', message: 'Expected a JSON object at the top level.' }],
    };
  }

  const issues: ImportIssue[] = [];

  if (parsed.format !== undefined && parsed.format !== EXPORT_FORMAT) {
    return {
      ok: false,
      issues: [
        {
          path: 'format',
          message: `Expected format "${EXPORT_FORMAT}" but found "${String(parsed.format)}".`,
        },
      ],
    };
  }

  if (typeof parsed.version === 'number' && parsed.version > STATE_VERSION) {
    return {
      ok: false,
      issues: [
        {
          path: 'version',
          message:
            `This file was written by a newer version of the portal ` +
            `(version ${parsed.version}, this portal reads ${STATE_VERSION}).`,
        },
      ],
    };
  }

  // Accept either a wrapped export or a bare state object.
  const rawState = isRecord(parsed.state) ? parsed.state : parsed;

  if (
    !isRecord(rawState.checked) &&
    !isRecord(rawState.tracker) &&
    !isRecord(rawState.notes) &&
    !isRecord(rawState.links) &&
    !isRecord(rawState.openIssues)
  ) {
    return {
      ok: false,
      issues: [
        {
          path: 'state',
          message:
            'No recognisable state found. Expected at least one of: checked, tracker, ' +
            'notes, links, openIssues.',
        },
      ],
    };
  }

  collectIssues(rawState, issues);
  const state = { ...sanitiseState(rawState), version: STATE_VERSION };

  return { ok: true, state, issues };
}

/** Records a per-field complaint for anything the sanitiser will drop. */
function collectIssues(rawState: Record<string, unknown>, issues: ImportIssue[]): void {
  for (const section of ['checked', 'notes', 'links', 'openIssues'] as const) {
    const value = rawState[section];
    if (value === undefined) continue;
    if (!isRecord(value)) {
      issues.push({ path: `state.${section}`, message: 'Expected an object; ignored.' });
      continue;
    }
    const expected = section === 'checked' ? 'boolean' : 'string';
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry !== expected) {
        issues.push({
          path: `state.${section}.${key}`,
          message: `Expected a ${expected} but found ${describe(entry)}; ignored.`,
        });
      }
    }
  }

  const trackerValue = rawState.tracker;
  if (trackerValue === undefined) return;
  if (!isRecord(trackerValue)) {
    issues.push({ path: 'state.tracker', message: 'Expected an object; ignored.' });
    return;
  }

  for (const [rowKey, row] of Object.entries(trackerValue)) {
    if (!isRecord(row)) {
      issues.push({
        path: `state.tracker.${rowKey}`,
        message: `Expected an object but found ${describe(row)}; ignored.`,
      });
      continue;
    }
    for (const [field, entry] of Object.entries(row)) {
      if (!TRACKER_FIELDS.includes(field as keyof TrackerRowState)) {
        issues.push({
          path: `state.tracker.${rowKey}.${field}`,
          message: 'Not an editable tracker field; ignored.',
        });
        continue;
      }
      if (typeof entry !== 'string') {
        issues.push({
          path: `state.tracker.${rowKey}.${field}`,
          message: `Expected a string but found ${describe(entry)}; ignored.`,
        });
      }
    }
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/**
 * Reports ids in an imported state that no longer exist in the documents.
 *
 * Not an error: a state file may predate a source edit. Surfaced so the reader
 * knows some entries will not appear.
 */
export function findUnknownIds(
  state: PortalState,
  knownCheckboxIds: ReadonlySet<string>,
  knownRowKeys: ReadonlySet<string>,
): ImportIssue[] {
  const issues: ImportIssue[] = [];

  for (const id of Object.keys(state.checked)) {
    if (!knownCheckboxIds.has(id)) {
      issues.push({
        path: `state.checked.${id}`,
        message: 'No matching item in the current documents; kept but not shown.',
      });
    }
  }

  for (const rowKey of Object.keys(state.tracker)) {
    if (!knownRowKeys.has(rowKey)) {
      issues.push({
        path: `state.tracker.${rowKey}`,
        message: 'No matching tracker row in the current documents; kept but not shown.',
      });
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ *
 * Tracker CSV export
 * ------------------------------------------------------------------ */

/** The effective value of a column for export: reader edit, else source. */
function exportValue(row: TrackerRow, column: TrackerColumn, edits: TrackerRowState): string {
  switch (column.field) {
    case 'status':
      return edits.status ?? row.status;
    case 'implementationBy':
      return edits.implementationBy ?? row.implementationBy;
    case 'targetDate':
      return edits.targetDate ?? row.targetDate;
    case 'verified':
      return edits.verified ?? row.verified;
    case 'verifiedBy':
      return edits.verifiedBy ?? row.verifiedBy;
    default:
      return row[column.field];
  }
}

export interface TrackerCsvOptions {
  /** Which column order to write. Defaults to the canonical export. */
  columns?: TrackerColumn[];
  /**
   * Append the portal's Notes and Evidence columns.
   *
   * Off by default, so a plain export is byte-compatible with the source
   * export's shape.
   */
  includeAddedColumns?: boolean;
}

/**
 * Serialises the tracker to CSV.
 *
 * Header spelling and column order come from the parsed source export, so the
 * result round-trips. Values keep their source form, including the newline at
 * the end of `ST-09`'s Implementation Item and `ST-19`'s Verification Gate.
 */
export function serialiseTrackerCsv(
  tracker: TrackerDocument,
  trackerState: Record<string, TrackerRowState>,
  options: TrackerCsvOptions = {},
): string {
  const columns = options.columns ?? tracker.columns;
  const addAdded = options.includeAddedColumns ?? false;

  const header = [...columns.map((c) => c.header), ...(addAdded ? ['Notes', 'Evidence'] : [])];

  const body = tracker.rows.map((row) => {
    const edits = trackerState[row.rowKey] ?? {};
    const cells = columns.map((column) => exportValue(row, column, edits));
    if (addAdded) cells.push(edits.notes ?? '', edits.evidence ?? '');
    return cells;
  });

  return toCsv([header, ...body]);
}

/**
 * Reads a tracker CSV back into row edits.
 *
 * Only the editable columns are taken; source columns in the file are ignored
 * because the documents, not an import, define them. Rows are matched on S.N
 * plus Category, the same pairing the parser uses, so the duplicate `ST-10`
 * stays unambiguous.
 */
export function parseTrackerCsvEdits(
  text: string,
  knownRowKeys: ReadonlySet<string>,
  rowKeyFor: (sn: string, category: string) => string,
): { edits: Record<string, TrackerRowState>; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const edits: Record<string, TrackerRowState> = {};

  const records = parseCsv(text);
  const header = records[0];
  if (!header) {
    return { edits, issues: [{ path: 'file', message: 'The CSV is empty.' }] };
  }

  const indexOf = (name: string) =>
    header.findIndex((h) => h.toLowerCase().replace(/[^a-z0-9]/g, '') === name);

  const snIndex = indexOf('sn');
  const categoryIndex = indexOf('category');
  if (snIndex === -1 || categoryIndex === -1) {
    return {
      edits,
      issues: [
        { path: 'file', message: 'The CSV needs both an S.N and a Category column to match rows.' },
      ],
    };
  }

  const editableColumns: readonly { field: keyof TrackerRowState; header: string }[] = [
    { field: 'status', header: 'status' },
    { field: 'implementationBy', header: 'implementationby' },
    { field: 'targetDate', header: 'targetdate' },
    { field: 'verified', header: 'verified' },
    { field: 'verifiedBy', header: 'verifiedby' },
    { field: 'notes', header: 'notes' },
    { field: 'evidence', header: 'evidence' },
  ];

  const editable = editableColumns
    .map(({ field, header }) => ({ field, index: indexOf(header) }))
    .filter((entry) => entry.index !== -1);

  records.slice(1).forEach((record, i) => {
    const line = i + 2;
    const sn = record[snIndex]?.trim() ?? '';
    const category = record[categoryIndex]?.trim() ?? '';
    if (!sn && !category) return;

    const rowKey = rowKeyFor(sn, category);
    if (!knownRowKeys.has(rowKey)) {
      issues.push({
        path: `row ${line}`,
        message: `No tracker row matches S.N "${sn}" in category "${category}"; skipped.`,
      });
      return;
    }

    const rowEdits: TrackerRowState = {};
    for (const { field, index } of editable) {
      const value = record[index];
      if (typeof value === 'string' && value !== '') rowEdits[field] = value;
    }
    if (Object.keys(rowEdits).length > 0) edits[rowKey] = rowEdits;
  });

  return { edits, issues };
}

/** A fresh state carrying only the given tracker edits. */
export function stateFromTrackerEdits(
  edits: Record<string, TrackerRowState>,
): PortalState {
  return { ...emptyState(), tracker: edits };
}
