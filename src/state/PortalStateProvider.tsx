import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  computeProgress,
  emptyState,
  loadState,
  saveState,
  type PortalState,
  type Progress,
  type TrackerRowState,
} from './portalState';
import { checkboxIds, type ChecklistUniverse } from '../content/registry';

interface PortalStateContextValue {
  state: PortalState;
  isChecked: (id: string) => boolean;
  setChecked: (id: string, checked: boolean) => void;
  toggleChecked: (id: string) => void;
  /** Clears ticks for a set of ids, leaving other universes untouched. */
  resetChecked: (ids: readonly string[]) => void;
  trackerRowState: (rowKey: string) => TrackerRowState;
  setTrackerField: (rowKey: string, field: keyof TrackerRowState, value: string) => void;
  noteValue: (sectionId: string) => string;
  setNote: (sectionId: string, value: string) => void;
  linkValue: (linkId: string) => string;
  setLink: (linkId: string, value: string) => void;
  openIssueValue: (itemId: string) => string;
  setOpenIssue: (itemId: string, value: string) => void;
  /** Replaces the whole state, used by import. */
  replaceState: (next: PortalState) => void;
  progressFor: (universe: ChecklistUniverse) => Progress;
  progressForIds: (ids: readonly string[]) => Progress;
}

const PortalStateContext = createContext<PortalStateContextValue | null>(null);

const EMPTY_ROW: TrackerRowState = Object.freeze({});

export function PortalStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalState>(() => loadState());
  const firstRender = useRef(true);

  // Persist on change, but not on mount: writing the just-loaded value back
  // would be a pointless round trip.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  const setChecked = useCallback((id: string, checked: boolean) => {
    setState((current) => {
      if (Boolean(current.checked[id]) === checked) return current;
      const next = { ...current.checked };
      // Store only ticks, so an untouched portal persists an empty map.
      if (checked) next[id] = true;
      else delete next[id];
      return { ...current, checked: next };
    });
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setState((current) => {
      const next = { ...current.checked };
      if (next[id]) delete next[id];
      else next[id] = true;
      return { ...current, checked: next };
    });
  }, []);

  const resetChecked = useCallback((ids: readonly string[]) => {
    setState((current) => {
      const next = { ...current.checked };
      for (const id of ids) delete next[id];
      return { ...current, checked: next };
    });
  }, []);

  const setTrackerField = useCallback(
    (rowKey: string, field: keyof TrackerRowState, value: string) => {
      setState((current) => ({
        ...current,
        tracker: {
          ...current.tracker,
          [rowKey]: { ...current.tracker[rowKey], [field]: value },
        },
      }));
    },
    [],
  );

  const setMapValue = useCallback(
    (section: 'notes' | 'links' | 'openIssues', key: string, value: string) => {
      setState((current) => ({
        ...current,
        [section]: { ...current[section], [key]: value },
      }));
    },
    [],
  );

  const value = useMemo<PortalStateContextValue>(
    () => ({
      state,
      isChecked: (id) => Boolean(state.checked[id]),
      setChecked,
      toggleChecked,
      resetChecked,
      trackerRowState: (rowKey) => state.tracker[rowKey] ?? EMPTY_ROW,
      setTrackerField,
      noteValue: (sectionId) => state.notes[sectionId] ?? '',
      setNote: (sectionId, v) => setMapValue('notes', sectionId, v),
      linkValue: (linkId) => state.links[linkId] ?? '',
      setLink: (linkId, v) => setMapValue('links', linkId, v),
      openIssueValue: (itemId) => state.openIssues[itemId] ?? '',
      setOpenIssue: (itemId, v) => setMapValue('openIssues', itemId, v),
      replaceState: (next) => setState(next),
      progressFor: (universe) => computeProgress(checkboxIds(universe), state.checked),
      progressForIds: (ids) => computeProgress(ids, state.checked),
    }),
    [state, setChecked, toggleChecked, resetChecked, setTrackerField, setMapValue],
  );

  return <PortalStateContext.Provider value={value}>{children}</PortalStateContext.Provider>;
}

export function usePortalState(): PortalStateContextValue {
  const context = useContext(PortalStateContext);
  if (!context) {
    throw new Error('usePortalState must be used inside a PortalStateProvider');
  }
  return context;
}

/** Re-exported so tests and the export panel can build a baseline. */
export { emptyState };
