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

import type { TrackerRow, ChecklistItem, Practice } from '../content/types';

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

  /** Custom tracker rows created by Admin (CRUD: Create). */
  customRows?: TrackerRow[];
  /** Row keys deleted by Admin (CRUD: Delete). */
  deletedRowKeys?: Record<string, boolean>;
  /** Overrides to default row attributes made by Admin (CRUD: Update). */
  rowOverrides?: Record<string, Partial<TrackerRow>>;

  /** Custom guide practices created by Admin (CRUD: Create). */
  customPractices?: Practice[];
  /** Practice IDs deleted by Admin (CRUD: Delete). */
  deletedPracticeIds?: Record<string, boolean>;
  /** Overrides to practice attributes made by Admin (CRUD: Update). */
  practiceOverrides?: Record<string, Partial<Practice>>;

  /** Custom checklist items added to phases or readiness gate. Keyed by phaseId or 'readiness'. */
  customChecklistItems?: Record<string, ChecklistItem[]>;
  /** Checklist item IDs deleted by Admin. */
  deletedChecklistItemIds?: Record<string, boolean>;
  /** Text overrides for checklist items made by Admin. */
  checklistItemOverrides?: Record<string, { text?: string }>;

  /** Custom open issues created in Notes & Decisions. */
  customOpenIssues?: ChecklistItem[];
  /** Open issue IDs deleted in Notes & Decisions. */
  deletedOpenIssueIds?: Record<string, boolean>;

  /** Verification records for checklist items made by Admin. Keyed by item id. */
  checklistVerifications?: Record<string, ChecklistVerification>;
  /** User acknowledgements for completed checklist items. Keyed by item id. */
  checklistAcknowledgements?: Record<string, ChecklistAcknowledgement>;
}

export interface ChecklistVerification {
  verified: boolean;
  verifiedBy: string;
  verifiedAt: string;
  notes?: string;
}

export interface ChecklistAcknowledgement {
  completedBy: string;
  completedAt: string;
  notes?: string;
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

function sanitiseCustomRows(value: unknown): TrackerRow[] {
  if (!Array.isArray(value)) return [];
  const out: TrackerRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.rowKey === 'string' && typeof item.implementationItem === 'string') {
      out.push({
        rowKey: item.rowKey,
        sn: typeof item.sn === 'string' ? item.sn : '',
        category: typeof item.category === 'string' ? item.category : '',
        implementationItem: item.implementationItem,
        implementationBy: typeof item.implementationBy === 'string' ? item.implementationBy : '',
        companyStage: typeof item.companyStage === 'string' ? item.companyStage : 'For All',
        priority: typeof item.priority === 'string' ? item.priority : 'P1',
        status: typeof item.status === 'string' ? item.status : 'Not Started',
        targetDate: typeof item.targetDate === 'string' ? item.targetDate : '',
        verificationGate: typeof item.verificationGate === 'string' ? item.verificationGate : '',
        verified: typeof item.verified === 'string' ? item.verified : '',
        verifiedBy: typeof item.verifiedBy === 'string' ? item.verifiedBy : '',
        sourceOrder: typeof item.sourceOrder === 'number' ? item.sourceOrder : 999,
      });
    }
  }
  return out;
}

function sanitiseRowOverrides(value: unknown): Record<string, Partial<TrackerRow>> {
  if (!isRecord(value)) return {};
  const out: Record<string, Partial<TrackerRow>> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    const override: Partial<TrackerRow> = {};
    if (typeof item.sn === 'string') override.sn = item.sn;
    if (typeof item.category === 'string') override.category = item.category;
    if (typeof item.implementationItem === 'string') override.implementationItem = item.implementationItem;
    if (typeof item.implementationBy === 'string') override.implementationBy = item.implementationBy;
    if (typeof item.companyStage === 'string') override.companyStage = item.companyStage;
    if (typeof item.priority === 'string') override.priority = item.priority;
    if (typeof item.status === 'string') override.status = item.status;
    if (typeof item.targetDate === 'string') override.targetDate = item.targetDate;
    if (typeof item.verificationGate === 'string') override.verificationGate = item.verificationGate;
    if (typeof item.verified === 'string') override.verified = item.verified;
    if (typeof item.verifiedBy === 'string') override.verifiedBy = item.verifiedBy;
    if (Object.keys(override).length > 0) out[key] = override;
  }
  return out;
}

function sanitiseCustomPractices(value: unknown): Practice[] {
  if (!Array.isArray(value)) return [];
  const out: Practice[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.id === 'string' && typeof item.heading === 'string') {
      out.push({
        id: item.id,
        categoryId: typeof item.categoryId === 'string' ? item.categoryId : '',
        heading: item.heading,
        headingRaw: typeof item.headingRaw === 'string' ? item.headingRaw : item.heading,
        checkboxLabel: typeof item.checkboxLabel === 'string' ? item.checkboxLabel : 'Implementation complete',
        description: typeof item.description === 'string' ? item.description : '',
        whyItMatters: typeof item.whyItMatters === 'string' ? item.whyItMatters : '',
        keyConcepts: Array.isArray(item.keyConcepts) ? item.keyConcepts.filter((c): c is string => typeof c === 'string') : [],
        recommendedTools: typeof item.recommendedTools === 'string' ? item.recommendedTools : '',
        verificationGate: typeof item.verificationGate === 'string' ? item.verificationGate : '',
        sourceOrder: typeof item.sourceOrder === 'number' ? item.sourceOrder : 999,
        orderInCategory: typeof item.orderInCategory === 'number' ? item.orderInCategory : 999,
        sourceLine: typeof item.sourceLine === 'number' ? item.sourceLine : 0,
      });
    }
  }
  return out;
}

function sanitisePracticeOverrides(value: unknown): Record<string, Partial<Practice>> {
  if (!isRecord(value)) return {};
  const out: Record<string, Partial<Practice>> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    const override: Partial<Practice> = {};
    if (typeof item.heading === 'string') override.heading = item.heading;
    if (typeof item.description === 'string') override.description = item.description;
    if (typeof item.whyItMatters === 'string') override.whyItMatters = item.whyItMatters;
    if (typeof item.recommendedTools === 'string') override.recommendedTools = item.recommendedTools;
    if (typeof item.verificationGate === 'string') override.verificationGate = item.verificationGate;
    if (Object.keys(override).length > 0) out[key] = override;
  }
  return out;
}

function sanitiseCustomChecklistItems(value: unknown): Record<string, ChecklistItem[]> {
  if (!isRecord(value)) return {};
  const out: Record<string, ChecklistItem[]> = {};
  for (const [groupKey, items] of Object.entries(value)) {
    if (!Array.isArray(items)) continue;
    const groupItems: ChecklistItem[] = [];
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (typeof item.id === 'string' && typeof item.text === 'string') {
        groupItems.push({
          id: item.id,
          text: item.text,
          rawText: typeof item.rawText === 'string' ? item.rawText : item.text,
          sourceLine: typeof item.sourceLine === 'number' ? item.sourceLine : 0,
        });
      }
    }
    if (groupItems.length > 0) out[groupKey] = groupItems;
  }
  return out;
}

function sanitiseChecklistItemOverrides(value: unknown): Record<string, { text?: string }> {
  if (!isRecord(value)) return {};
  const out: Record<string, { text?: string }> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item)) continue;
    if (typeof item.text === 'string') out[key] = { text: item.text };
  }
  return out;
}

function sanitiseCustomOpenIssues(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const out: ChecklistItem[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.id === 'string') {
      out.push({
        id: item.id,
        text: typeof item.text === 'string' ? item.text : '',
        rawText: typeof item.rawText === 'string' ? item.rawText : '',
        sourceLine: typeof item.sourceLine === 'number' ? item.sourceLine : 0,
      });
    }
  }
  return out;
}

function sanitiseChecklistVerifications(value: unknown): Record<string, ChecklistVerification> {
  if (!isRecord(value)) return {};
  const out: Record<string, ChecklistVerification> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.verified === 'boolean' && typeof entry.verifiedBy === 'string' && typeof entry.verifiedAt === 'string') {
      out[id] = {
        verified: entry.verified,
        verifiedBy: entry.verifiedBy,
        verifiedAt: entry.verifiedAt,
        ...(typeof entry.notes === 'string' ? { notes: entry.notes } : {}),
      };
    }
  }
  return out;
}

function sanitiseChecklistAcknowledgements(value: unknown): Record<string, ChecklistAcknowledgement> {
  if (!isRecord(value)) return {};
  const out: Record<string, ChecklistAcknowledgement> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.completedBy === 'string' && typeof entry.completedAt === 'string') {
      out[id] = {
        completedBy: entry.completedBy,
        completedAt: entry.completedAt,
        ...(typeof entry.notes === 'string' ? { notes: entry.notes } : {}),
      };
    }
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
  const state: PortalState = {
    version: typeof value.version === 'number' ? value.version : STATE_VERSION,
    checked: sanitiseBooleanMap(value.checked),
    tracker: sanitiseTrackerMap(value.tracker),
    notes: sanitiseStringMap(value.notes),
    links: sanitiseStringMap(value.links),
    openIssues: sanitiseStringMap(value.openIssues),
  };

  if (value.customRows !== undefined) {
    state.customRows = sanitiseCustomRows(value.customRows);
  }
  if (value.deletedRowKeys !== undefined) {
    state.deletedRowKeys = sanitiseBooleanMap(value.deletedRowKeys);
  }
  if (value.rowOverrides !== undefined) {
    state.rowOverrides = sanitiseRowOverrides(value.rowOverrides);
  }
  if (value.customPractices !== undefined) {
    state.customPractices = sanitiseCustomPractices(value.customPractices);
  }
  if (value.deletedPracticeIds !== undefined) {
    state.deletedPracticeIds = sanitiseBooleanMap(value.deletedPracticeIds);
  }
  if (value.practiceOverrides !== undefined) {
    state.practiceOverrides = sanitisePracticeOverrides(value.practiceOverrides);
  }
  if (value.customChecklistItems !== undefined) {
    state.customChecklistItems = sanitiseCustomChecklistItems(value.customChecklistItems);
  }
  if (value.deletedChecklistItemIds !== undefined) {
    state.deletedChecklistItemIds = sanitiseBooleanMap(value.deletedChecklistItemIds);
  }
  if (value.checklistItemOverrides !== undefined) {
    state.checklistItemOverrides = sanitiseChecklistItemOverrides(value.checklistItemOverrides);
  }
  if (value.customOpenIssues !== undefined) {
    state.customOpenIssues = sanitiseCustomOpenIssues(value.customOpenIssues);
  }
  if (value.deletedOpenIssueIds !== undefined) {
    state.deletedOpenIssueIds = sanitiseBooleanMap(value.deletedOpenIssueIds);
  }
  if (value.checklistVerifications !== undefined) {
    state.checklistVerifications = sanitiseChecklistVerifications(value.checklistVerifications);
  }
  if (value.checklistAcknowledgements !== undefined) {
    state.checklistAcknowledgements = sanitiseChecklistAcknowledgements(value.checklistAcknowledgements);
  }

  return state;
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
