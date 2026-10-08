/**
 * Content model for the portal.
 *
 * Every string field here is lifted verbatim from one of the four source
 * documents, with two narrow exceptions that are formatting rather than
 * content:
 *   - wrapping markdown emphasis markers around a heading or prompt are
 *     dropped, because they are syntax for "render this emphasised", and the
 *     portal renders emphasis structurally instead;
 *   - identifier fields (`id`, `*Id`, `*Key`) are derived slugs, not content.
 *
 * Inline markdown inside a value (backtick code spans, bold runs) is retained
 * as-authored so the renderer can present it without the stored text drifting
 * from the source.
 */

/* ------------------------------------------------------------------ *
 * DevOps Implementation Guide
 * ------------------------------------------------------------------ */

/** One bullet from the `Operating principles` list. */
export interface GuidePrinciple {
  id: string;
  /** Bolded lead-in, e.g. `Speed & Developer Velocity`. */
  term: string;
  /** Prose following the term. */
  detail: string;
}

/** The `## Objective` section that opens the guide. */
export interface GuideObjective {
  heading: string;
  leadParagraph: string;
  /** Standalone bolded label above the principles list. */
  principlesLabel: string;
  principles: GuidePrinciple[];
  closingParagraph: string;
}

/**
 * One practice (`##` heading) inside a guide category. All 24 practices in the
 * source carry the same six elements.
 */
export interface Practice {
  id: string;
  categoryId: string;
  /** Heading text with wrapping emphasis markers removed. */
  heading: string;
  /** Heading exactly as it appears in the source, markers included. */
  headingRaw: string;
  /** Label beside the source checkbox, e.g. `Implementation complete`. */
  checkboxLabel: string;
  description: string;
  whyItMatters: string;
  keyConcepts: string[];
  recommendedTools: string;
  verificationGate: string;
  /** 1-based position across the whole guide. */
  sourceOrder: number;
  /** 1-based position within the owning category. */
  orderInCategory: number;
  sourceLine: number;
}

/** One numbered `#` category in the guide. */
export interface GuideCategory {
  id: string;
  /** Full heading verbatim, including the source's irregular spacing. */
  heading: string;
  /** Leading number as written, e.g. `3`. */
  ordinal: string;
  /** Heading with the leading number and separator removed. */
  title: string;
  practices: Practice[];
  sourceLine: number;
}

export interface GuideDocument {
  title: string;
  objective: GuideObjective;
  categories: GuideCategory[];
}

/* ------------------------------------------------------------------ *
 * DevOps Operational Checklist
 * ------------------------------------------------------------------ */

/**
 * A single `- [ ]` row.
 *
 * `text` is empty for the three blank `Open Issues` placeholders, which the
 * source writes as `- [ ]  [ ]` — a stray checkbox marker left over from the
 * export, carrying no prose. `rawText` keeps whatever followed the checkbox so
 * nothing is lost.
 */
export interface ChecklistItem {
  id: string;
  text: string;
  rawText: string;
  sourceLine: number;
}

/** One `Phase N` grouping under `Suggested Implementation Order`. */
export interface Phase {
  id: string;
  heading: string;
  /** e.g. `Phase 1`. */
  label: string;
  /** Heading with the `Phase N —` prefix removed. */
  title: string;
  items: ChecklistItem[];
  sourceLine: number;
}

export interface ReadinessGate {
  heading: string;
  /** Lead-in sentence above the criteria, inline emphasis retained. */
  intro: string;
  criteria: ChecklistItem[];
}

/** A `Notes & Decisions` subsection whose body is an italic authoring prompt. */
export interface NoteSection {
  id: string;
  heading: string;
  /** Prompt text with wrapping italic markers removed. */
  prompt: string;
}

/** A `Useful Links` entry. `value` is empty throughout the source. */
export interface LinkLabel {
  id: string;
  label: string;
  value: string;
}

export interface NotesAndDecisions {
  heading: string;
  noteSections: NoteSection[];
  openIssuesHeading: string;
  openIssues: ChecklistItem[];
  usefulLinksHeading: string;
  usefulLinks: LinkLabel[];
}

export interface ChecklistDocument {
  title: string;
  /** Link text pointing at the tracker export. */
  trackerLinkLabel: string;
  /** Link target as authored, i.e. the tracker CSV's relative path. */
  trackerLinkTarget: string;
  implementationOrderHeading: string;
  phases: Phase[];
  readinessGate: ReadinessGate;
  notes: NotesAndDecisions;
}

/* ------------------------------------------------------------------ *
 * Implementation Tracker
 * ------------------------------------------------------------------ */

/**
 * One tracker row.
 *
 * `sn` is reproduced as written and is NOT unique: the source uses `ST-10`
 * twice. `rowKey` exists so the UI has a stable unique key without renumbering
 * anything.
 */
export interface TrackerRow {
  rowKey: string;
  sn: string;
  category: string;
  implementationItem: string;
  implementationBy: string;
  companyStage: string;
  priority: string;
  /** Empty for `ST-20`; `Not Started` on the other 23 rows. */
  status: string;
  targetDate: string;
  verificationGate: string;
  verified: string;
  verifiedBy: string;
  sourceOrder: number;
}

/**
 * The string-valued row fields a CSV column can map to.
 *
 * Excludes `rowKey` and `sourceOrder`, which are derived bookkeeping rather
 * than exported columns.
 */
export type TrackerDataField =
  | 'sn'
  | 'category'
  | 'implementationItem'
  | 'implementationBy'
  | 'companyStage'
  | 'priority'
  | 'status'
  | 'targetDate'
  | 'verificationGate'
  | 'verified'
  | 'verifiedBy';

/** Field order of the canonical export, keyed to {@link TrackerRow}. */
export interface TrackerColumn {
  /** Header spelling exactly as in the CSV, e.g. `S.N`. */
  header: string;
  field: TrackerDataField;
}

export interface TrackerDocument {
  /** Column order of the canonical (S.N-sorted) export. */
  columns: TrackerColumn[];
  /** Column order of the `_all` export of the same data. */
  alternateColumns: TrackerColumn[];
  rows: TrackerRow[];
}

/* ------------------------------------------------------------------ *
 * Cross-document links and the assembled bundle
 * ------------------------------------------------------------------ */

/**
 * Asserted 1:1 link between a guide practice and a tracker row, resolved by
 * category plus source order. Gated by `UI_FLAGS.guideTrackerCrossLink`
 * because the documents never state this relationship outright.
 */
export interface GuideTrackerLink {
  practiceId: string;
  rowKey: string;
}

export interface PortalContent {
  guide: GuideDocument;
  checklist: ChecklistDocument;
  tracker: TrackerDocument;
  guideTrackerLinks: GuideTrackerLink[];
}
