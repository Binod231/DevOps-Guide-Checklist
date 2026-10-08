import { beforeEach, describe, expect, it } from 'vitest';
import {
  STATE_STORAGE_KEY,
  STATE_VERSION,
  computeProgress,
  emptyState,
  loadState,
  sanitiseState,
  saveState,
} from './portalState';

beforeEach(() => {
  window.localStorage.clear();
});

describe('emptyState', () => {
  it('starts with nothing recorded', () => {
    const state = emptyState();
    expect(state.version).toBe(STATE_VERSION);
    expect(state.checked).toEqual({});
    expect(state.tracker).toEqual({});
    expect(state.notes).toEqual({});
    expect(state.links).toEqual({});
    expect(state.openIssues).toEqual({});
  });
});

describe('computeProgress', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('reports 0 of n and 0% when nothing is checked', () => {
    expect(computeProgress(ids, {})).toEqual({
      total: 4,
      completed: 0,
      remaining: 4,
      percent: 0,
    });
  });

  it('counts only ids in the given set', () => {
    expect(computeProgress(ids, { a: true, zz: true })).toEqual({
      total: 4,
      completed: 1,
      remaining: 3,
      percent: 25,
    });
  });

  it('reports 100% when everything is checked', () => {
    const all = Object.fromEntries(ids.map((id) => [id, true]));
    expect(computeProgress(ids, all)).toEqual({
      total: 4,
      completed: 4,
      remaining: 0,
      percent: 100,
    });
  });

  it('rounds the percentage to a whole number', () => {
    expect(computeProgress(['a', 'b', 'c'], { a: true }).percent).toBe(33);
    expect(computeProgress(['a', 'b', 'c'], { a: true, b: true }).percent).toBe(67);
  });

  it('ignores false entries', () => {
    expect(computeProgress(ids, { a: false }).completed).toBe(0);
  });

  it('reports 0% for an empty set rather than dividing by zero', () => {
    expect(computeProgress([], {})).toEqual({
      total: 0,
      completed: 0,
      remaining: 0,
      percent: 0,
    });
  });
});

describe('sanitiseState', () => {
  it('passes a well-formed payload through', () => {
    const input = {
      version: 1,
      checked: { 'a-practice': true },
      tracker: { 'st-01--scm-ci-cd': { status: 'In Progress', notes: 'hi' } },
      notes: { 'architecture-notes': 'text' },
      links: { repository: 'https://example.test' },
      openIssues: { 'open-issues--item-1': 'something' },
    };
    expect(sanitiseState(input)).toEqual(input);
  });

  it('falls back to an empty state for a non-object', () => {
    expect(sanitiseState(null)).toEqual(emptyState());
    expect(sanitiseState('nope')).toEqual(emptyState());
    expect(sanitiseState([1, 2])).toEqual(emptyState());
  });

  it('drops non-boolean checked entries', () => {
    expect(sanitiseState({ checked: { a: true, b: 'yes', c: 1 } }).checked).toEqual({ a: true });
  });

  it('drops non-string map entries', () => {
    const state = sanitiseState({
      notes: { a: 'ok', b: 42 },
      links: { c: 'ok', d: null },
      openIssues: { e: 'ok', f: {} },
    });
    expect(state.notes).toEqual({ a: 'ok' });
    expect(state.links).toEqual({ c: 'ok' });
    expect(state.openIssues).toEqual({ e: 'ok' });
  });

  it('keeps only recognised tracker fields', () => {
    const state = sanitiseState({
      tracker: {
        row: {
          status: 'Completed',
          implementationBy: 'A',
          targetDate: '2026-01-01',
          verified: 'Yes',
          verifiedBy: 'B',
          notes: 'n',
          evidence: 'e',
          injected: 'should be dropped',
          priority: 'P0',
        },
      },
    });
    expect(state.tracker.row).toEqual({
      status: 'Completed',
      implementationBy: 'A',
      targetDate: '2026-01-01',
      verified: 'Yes',
      verifiedBy: 'B',
      notes: 'n',
      evidence: 'e',
    });
  });

  it('drops tracker rows that contribute no usable fields', () => {
    expect(sanitiseState({ tracker: { row: { bogus: 1 } } }).tracker).toEqual({});
    expect(sanitiseState({ tracker: { row: 'nope' } }).tracker).toEqual({});
  });

  it('supplies missing sections', () => {
    expect(sanitiseState({ checked: { a: true } })).toEqual({
      ...emptyState(),
      checked: { a: true },
    });
  });
});

describe('loadState', () => {
  it('returns an empty state when nothing is stored', () => {
    expect(loadState()).toEqual(emptyState());
  });

  it('restores a previously saved state', () => {
    const state = { ...emptyState(), checked: { 'infrastructure-as-code': true } };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('falls back to empty on malformed JSON rather than throwing', () => {
    window.localStorage.setItem(STATE_STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(emptyState());
  });

  it('falls back to empty on a structurally wrong payload', () => {
    window.localStorage.setItem(STATE_STORAGE_KEY, '"a string"');
    expect(loadState()).toEqual(emptyState());
  });

  it('salvages the usable parts of a partially corrupt payload', () => {
    window.localStorage.setItem(
      STATE_STORAGE_KEY,
      JSON.stringify({ checked: { good: true, bad: 'x' }, tracker: 'broken' }),
    );
    const state = loadState();
    expect(state.checked).toEqual({ good: true });
    expect(state.tracker).toEqual({});
  });

  it('survives a storage implementation that throws', () => {
    const hostile = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(loadState(hostile)).toEqual(emptyState());
    expect(() => saveState(emptyState(), hostile)).not.toThrow();
  });
});
