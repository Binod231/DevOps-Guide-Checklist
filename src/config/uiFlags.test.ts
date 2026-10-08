import { describe, expect, it } from 'vitest';
import {
  SOURCE_STATUS_VALUES,
  UI_FLAGS,
  UI_ONLY_STATUS_VALUES,
  isUiOnlyStatus,
  statusOptions,
} from './uiFlags';

describe('UI_FLAGS', () => {
  it('exposes exactly the three approved additions', () => {
    expect(Object.keys(UI_FLAGS).sort()).toEqual([
      'extendedStatusOptions',
      'guideTrackerCrossLink',
      'perRowNotesAndEvidence',
    ]);
  });

  it('records "Not Started" as the only status value present in the source', () => {
    expect(SOURCE_STATUS_VALUES).toEqual(['Not Started']);
  });

  it('labels the two added status values as UI-only', () => {
    expect(UI_ONLY_STATUS_VALUES).toEqual(['In Progress', 'Completed']);
    expect(isUiOnlyStatus('In Progress')).toBe(true);
    expect(isUiOnlyStatus('Completed')).toBe(true);
    expect(isUiOnlyStatus('Not Started')).toBe(false);
  });

  it('offers the extended status list while the flag is on', () => {
    expect(statusOptions()).toEqual(['Not Started', 'In Progress', 'Completed']);
  });

  it('keeps the source status value first so it stays the default', () => {
    expect(statusOptions()[0]).toBe('Not Started');
  });
});
