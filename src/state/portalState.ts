/**
 * The portal's persisted state shape and its `localStorage` codec.
 *
 * Everything a reader enters lives here: checkbox ticks, tracker row edits,
 * free-text notes and link values. Source content is never stored — only the
 * reader's own marks against it, keyed by the stable ids the content generator
 * produces.
 *
 * The payload is versioned so a future shape change can migrate rather than
 * discard. Unparseable or structurally wrong data falls back to an empty state
 * instead of throwing, because a corrupt storage entry must not stop the portal
 * from rendering the documents.
 */

export const STATE_STORAGE_KEY = 'portal.state.v1';
export const STATE_VERSION = 1;

/** Per-row tracker edits. Absent fields fall back to the source value. */
export interface TrackerRowState {
  status?: string;
  implementationBy?: string;
  targetDate?: string;
  verified?: string;
  verifiedBy?: string;
  /** ADDITION 2 — not a source column. Empty unless the reader types here. */
  notes?: string;
  /** ADDITION 2 — not a source column. Empty unless the reader types here. */
  evidence?: string;
}

export interface PortalState {
  version: number;
  /**
   * Ticked checkbox ids. The three checklist universes share this map because
   * their ids are namespaced and provably disjoint; nothing is merged.
   */
  checked: Record<string, boolean>;
  /** Tracker edits, keyed by `TrackerRow.rowKey`. */
  tracker: Record<string, TrackerRowState>;
  /** Free text for the `Notes & Decisions` sections, keyed by section id. */
  notes: Record<string, string>;
  /** Values for the `Useful Links` labels, keyed by link id. */
  links: Record<string, string>;
  /** Text entered against the blank `Open Issues` rows, keyed by item id. */
  openIssues: Record<string, string>;
}

export function emptyState(): PortalState {
  return {
    version: STATE_VERSION,
    checked: {},
    tracker: {},
    notes: {},
    links: {},
    openIssues: {},
  };
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keeps only `string -> boolean` entries. */
function sanitiseBooleanMap(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'boolean') out[key] = entry;
  }
  return out;
}

/** Keeps only `string -> string` entries. */
function sanitiseStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

const TRACKER_FIELDS = [
  'status',
  'implementationBy',
  'targetDate',
  'verified',
  'verifiedBy',
  'notes',
  'evidence',
] as const satisfies readonly (keyof TrackerRowState)[];

function sanitiseTrackerMap(value: unknown): Record<string, TrackerRowState> {
  if (!isRecord(value)) return {};
  const out: Record<string, TrackerRowState> = {};
  for (const [rowKey, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const row: TrackerRowState = {};
    for (const field of TRACKER_FIELDS) {
      const fieldValue = entry[field];
      if (typeof fieldValue === 'string') row[field] = fieldValue;
    }
    if (Object.keys(row).length > 0) out[rowKey] = row;
  }
  return out;
}

/**
 * Coerces unknown data into a well-formed {@link PortalState}.
 *
 * Unknown keys, wrong types and missing sections are dropped rather than
 * rejected wholesale, so a partially damaged entry still restores what survived.
 */
export function sanitiseState(value: unknown): PortalState {
  if (!isRecord(value)) return emptyState();
  return {
    version: typeof value.version === 'number' ? value.version : STATE_VERSION,
    checked: sanitiseBooleanMap(value.checked),
    tracker: sanitiseTrackerMap(value.tracker),
    notes: sanitiseStringMap(value.notes),
    links: sanitiseStringMap(value.links),
    openIssues: sanitiseStringMap(value.openIssues),
  };
}

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

export function loadState(storage: Storage = window.localStorage): PortalState {
  let raw: string | null;
  try {
    raw = storage.getItem(STATE_STORAGE_KEY);
  } catch {
    // Storage blocked entirely; run in-memory for this session.
    return emptyState();
  }
  if (!raw) return emptyState();

  try {
    return sanitiseState(JSON.parse(raw));
  } catch {
    // Malformed JSON. Start clean rather than failing to render.
    return emptyState();
  }
}

export function saveState(state: PortalState, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage blocked. State still holds for this session.
  }
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export interface Progress {
  total: number;
  completed: number;
  remaining: number;
  /** Whole-number percentage, 0 when there is nothing to count. */
  percent: number;
}

/** Counts completion across a set of checkbox ids. */
export function computeProgress(
  ids: readonly string[],
  checked: Record<string, boolean>,
): Progress {
  const total = ids.length;
  const completed = ids.reduce((n, id) => n + (checked[id] ? 1 : 0), 0);
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
