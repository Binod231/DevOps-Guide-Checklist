/**
 * The three UI-only additions that are NOT present in the source documents.
 *
 * Every one of these is isolated here so it can be switched off independently
 * without touching component code. Nothing else in this application adds,
 * removes, or reworks document content.
 */
export const UI_FLAGS = {
  /**
   * ADDITION 1 — extra Status vocabulary.
   *
   * The tracker CSV only ever contains "Not Started" (and one blank cell on
   * ST-20). "In Progress" and "Completed" are UI vocabulary added so a
   * consultant can actually advance an engagement. Set to false to restrict the
   * dropdown to values that literally appear in the source.
   */
  extendedStatusOptions: true,

  /**
   * ADDITION 2 — per-row Notes and Evidence capture.
   *
   * These are not columns in either CSV. They render empty and only ever hold
   * text the user types, so no content is invented — but the fields themselves
   * are an addition. Set to false to hide them.
   */
  perRowNotesAndEvidence: true,

  /**
   * ADDITION 3 — guide-to-tracker cross-link.
   *
   * Guide headings and tracker item names differ (e.g. "Automated Secret
   * Scanning in CI & Pre-Commit Hooks" vs "Automated Secret Scanning"), so
   * linking them asserts a relationship that the documents do not state
   * outright. The mapping is 1:1, resolved by category plus source order. Set to
   * false to present the guide and tracker as fully independent documents.
   */
  guideTrackerCrossLink: true,
} as const;

export type UiFlags = typeof UI_FLAGS;

/** Status values that literally appear in the source tracker. */
export const SOURCE_STATUS_VALUES = ['Not Started'] as const;

/** Status values added by ADDITION 1. */
export const UI_ONLY_STATUS_VALUES = ['In Progress', 'Completed'] as const;

/** The Status dropdown options, honouring {@link UI_FLAGS.extendedStatusOptions}. */
export function statusOptions(): readonly string[] {
  return UI_FLAGS.extendedStatusOptions
    ? [...SOURCE_STATUS_VALUES, ...UI_ONLY_STATUS_VALUES]
    : SOURCE_STATUS_VALUES;
}

/** True when a status value is UI vocabulary rather than document vocabulary. */
export function isUiOnlyStatus(value: string): boolean {
  return (UI_ONLY_STATUS_VALUES as readonly string[]).includes(value);
}
