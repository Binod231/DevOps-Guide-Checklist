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
  mergeStates,
  sanitiseState,
  type PortalState,
  type Progress,
  type TrackerRowState,
  type ChecklistVerification,
  type ChecklistAcknowledgement,
} from './portalState';
import { checkboxIds, categoryById, type ChecklistUniverse } from '../content/registry';
import type { TrackerRow, ChecklistItem, Practice, GuideCategory, Phase } from '../content/types';

interface PortalStateContextValue {
  state: PortalState;
  isChecked: (id: string) => boolean;
  setChecked: (id: string, checked: boolean, defaultCompletedBy?: string) => void;
  toggleChecked: (id: string, defaultCompletedBy?: string) => void;
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

  /** Tracker Row CRUD operations */
  allTrackerRows: (baseRows: readonly TrackerRow[]) => TrackerRow[];
  addTrackerRow: (row: TrackerRow) => void;
  updateTrackerRowDetails: (rowKey: string, updates: Partial<TrackerRow>) => void;
  deleteTrackerRow: (rowKey: string) => void;
  restoreTrackerRows: () => void;
  hasDeletedTrackerRows: boolean;

  /** Open Issues CRUD operations */
  allOpenIssues: (baseIssues: readonly ChecklistItem[]) => ChecklistItem[];
  addOpenIssueItem: (text: string) => void;
  deleteOpenIssueItem: (id: string) => void;

  /** Guide Practice CRUD operations */
  allCategoryPractices: (category: GuideCategory) => Practice[];
  addPractice: (practice: Practice) => void;
  updatePractice: (practiceId: string, updates: Partial<Practice>) => void;
  deletePractice: (practiceId: string) => void;
  restorePractices: (categoryId?: string) => void;
  hasDeletedPractices: (categoryId?: string) => boolean;

  /** Checklist Items CRUD operations (Phases & Production Readiness) */
  allPhaseItems: (phase: Phase) => ChecklistItem[];
  allReadinessCriteria: (criteria: readonly ChecklistItem[]) => ChecklistItem[];
  addChecklistItem: (parentId: string, text: string) => void;
  updateChecklistItem: (itemId: string, text: string) => void;
  deleteChecklistItem: (itemId: string, parentId?: string) => void;
  restoreChecklistItems: (parentId?: string) => void;
  hasDeletedChecklistItems: (parentId?: string) => boolean;

  /** Checklist Acknowledgement & Verification */
  checklistAcknowledgement: (id: string) => ChecklistAcknowledgement | undefined;
  setChecklistAcknowledgement: (id: string, ack: ChecklistAcknowledgement) => void;
  checklistVerification: (id: string) => ChecklistVerification | undefined;
  verifyChecklistItem: (id: string, verifiedBy?: string, notes?: string) => void;
  unverifyChecklistItem: (id: string) => void;
  verifyTrackerRow: (rowKey: string, verifiedBy?: string) => void;
  unverifyTrackerRow: (rowKey: string) => void;
  verifyAllPending: (verifiedBy?: string) => void;

  /** Central Cloud Store (AWS S3) Sync */
  syncFromCloudStore: () => Promise<{ success: boolean; message?: string }>;
  isCloudSyncing: boolean;
  cloudSyncNotice: string | null;
}

const PortalStateContext = createContext<PortalStateContextValue | null>(null);

const EMPTY_ROW: TrackerRowState = Object.freeze({});

export function PortalStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PortalState>(() => loadState());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncNotice, setCloudSyncNotice] = useState<string | null>(null);
  const firstRender = useRef(true);

  // Auto-hydrate from central cloud store on initial mount (in browser)
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;

    fetch('/data/portal-state.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && typeof json === 'object') {
          const parsed = json.state && typeof json.state === 'object' ? json.state : json;
          setState((cur) => mergeStates(cur, sanitiseState(parsed)));
        }
      })
      .catch(() => {
        // Cloud store unreachable or offline; continue with local storage
      });
  }, []);

  // Persist on change, but not on mount: writing the just-loaded value back
  // would be a pointless round trip.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  const syncFromCloudStore = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    setIsCloudSyncing(true);
    try {
      const endpoints = [
        '/data/portal-state.json',
        `${import.meta.env.VITE_S3_WEBSITE_URL || ''}/data/portal-state.json`,
      ];
      let loadedJson: unknown = null;
      for (const ep of endpoints) {
        if (!ep) continue;
        try {
          const res = await fetch(ep, { cache: 'no-cache' });
          if (res.ok) {
            loadedJson = await res.json();
            break;
          }
        } catch {
          // try next endpoint
        }
      }

      if (loadedJson && typeof loadedJson === 'object') {
        const rawObj = loadedJson as Record<string, unknown>;
        const parsed = rawObj.state && typeof rawObj.state === 'object' ? rawObj.state : rawObj;
        const validState = sanitiseState(parsed);
        setState((cur) => mergeStates(cur, validState));
        setCloudSyncNotice('Synchronized with AWS Cloud Store!');
        setTimeout(() => setCloudSyncNotice(null), 3000);
        return { success: true, message: 'Synchronized with AWS Cloud Store!' };
      }
      return { success: false, message: 'Could not fetch cloud state from S3 endpoint.' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error syncing from cloud store';
      return { success: false, message: msg };
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);

  const setChecked = useCallback((id: string, checked: boolean, defaultCompletedBy?: string) => {
    setState((current) => {
      if (Boolean(current.checked[id]) === checked) return current;
      const next = { ...current.checked };
      const nextAcks = { ...(current.checklistAcknowledgements ?? {}) };
      // Store only ticks, so an untouched portal persists an empty map.
      if (checked) {
        next[id] = true;
        if (!nextAcks[id]) {
          nextAcks[id] = {
            completedBy: defaultCompletedBy || 'DevOps Contributor',
            completedAt: new Date().toISOString(),
          };
        }
      } else {
        delete next[id];
      }
      return { ...current, checked: next, checklistAcknowledgements: nextAcks };
    });
  }, []);

  const toggleChecked = useCallback((id: string, defaultCompletedBy?: string) => {
    setState((current) => {
      const next = { ...current.checked };
      const nextAcks = { ...(current.checklistAcknowledgements ?? {}) };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
        if (!nextAcks[id]) {
          nextAcks[id] = {
            completedBy: defaultCompletedBy || 'DevOps Contributor',
            completedAt: new Date().toISOString(),
          };
        }
      }
      return { ...current, checked: next, checklistAcknowledgements: nextAcks };
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

  const allTrackerRows = useCallback(
    (baseRows: readonly TrackerRow[]): TrackerRow[] => {
      const deleted = state.deletedRowKeys ?? {};
      const overrides = state.rowOverrides ?? {};

      const mappedBase = baseRows
        .filter((row) => !deleted[row.rowKey])
        .map((row) => (overrides[row.rowKey] ? { ...row, ...overrides[row.rowKey] } : row));

      const mappedCustom = (state.customRows ?? [])
        .filter((row) => !deleted[row.rowKey])
        .map((row) => (overrides[row.rowKey] ? { ...row, ...overrides[row.rowKey] } : row));

      return [...mappedBase, ...mappedCustom];
    },
    [state.deletedRowKeys, state.rowOverrides, state.customRows],
  );

  const addTrackerRow = useCallback((row: TrackerRow) => {
    setState((current) => ({
      ...current,
      customRows: [...(current.customRows ?? []), row],
    }));
  }, []);

  const updateTrackerRowDetails = useCallback(
    (rowKey: string, updates: Partial<TrackerRow>) => {
      setState((current) => {
        const nextCustom = (current.customRows ?? []).map((r) =>
          r.rowKey === rowKey ? { ...r, ...updates } : r,
        );
        const nextOverrides = {
          ...(current.rowOverrides ?? {}),
          [rowKey]: { ...(current.rowOverrides?.[rowKey] ?? {}), ...updates },
        };
        const rowEdits = { ...(current.tracker[rowKey] ?? {}) };
        if (updates.status !== undefined) rowEdits.status = updates.status;
        if (updates.implementationBy !== undefined) rowEdits.implementationBy = updates.implementationBy;
        if (updates.targetDate !== undefined) rowEdits.targetDate = updates.targetDate;
        if (updates.verified !== undefined) rowEdits.verified = updates.verified;
        if (updates.verifiedBy !== undefined) rowEdits.verifiedBy = updates.verifiedBy;

        return {
          ...current,
          customRows: nextCustom,
          rowOverrides: nextOverrides,
          tracker: {
            ...current.tracker,
            [rowKey]: rowEdits,
          },
        };
      });
    },
    [],
  );

  const deleteTrackerRow = useCallback((rowKey: string) => {
    setState((current) => ({
      ...current,
      deletedRowKeys: {
        ...(current.deletedRowKeys ?? {}),
        [rowKey]: true,
      },
      customRows: (current.customRows ?? []).filter((r) => r.rowKey !== rowKey),
    }));
  }, []);

  const restoreTrackerRows = useCallback(() => {
    setState((current) => ({
      ...current,
      deletedRowKeys: {},
    }));
  }, []);

  const allOpenIssues = useCallback(
    (baseIssues: readonly ChecklistItem[]): ChecklistItem[] => {
      const deleted = state.deletedOpenIssueIds ?? {};
      const baseFiltered = baseIssues.filter((i) => !deleted[i.id]);
      const customFiltered = (state.customOpenIssues ?? []).filter((i) => !deleted[i.id]);
      return [...baseFiltered, ...customFiltered];
    },
    [state.deletedOpenIssueIds, state.customOpenIssues],
  );

  const addOpenIssueItem = useCallback((text: string) => {
    const id = `open-issue-custom-${Date.now()}`;
    const newItem: ChecklistItem = {
      id,
      text,
      rawText: text,
      sourceLine: 0,
    };
    setState((current) => ({
      ...current,
      customOpenIssues: [...(current.customOpenIssues ?? []), newItem],
    }));
  }, []);

  const deleteOpenIssueItem = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      deletedOpenIssueIds: {
        ...(current.deletedOpenIssueIds ?? {}),
        [id]: true,
      },
      customOpenIssues: (current.customOpenIssues ?? []).filter((i) => i.id !== id),
    }));
  }, []);

  const hasDeletedTrackerRows = Boolean(
    state.deletedRowKeys && Object.keys(state.deletedRowKeys).length > 0,
  );

  /* ------------------------------------------------------------------ *
   * Guide Practice CRUD
   * ------------------------------------------------------------------ */

  const allCategoryPractices = useCallback(
    (category: GuideCategory): Practice[] => {
      const deleted = state.deletedPracticeIds ?? {};
      const overrides = state.practiceOverrides ?? {};
      const base = category.practices
        .filter((p) => !deleted[p.id])
        .map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p));
      const custom = (state.customPractices ?? [])
        .filter((p) => p.categoryId === category.id && !deleted[p.id])
        .map((p) => (overrides[p.id] ? { ...p, ...overrides[p.id] } : p));
      return [...base, ...custom];
    },
    [state.deletedPracticeIds, state.practiceOverrides, state.customPractices],
  );

  const addPractice = useCallback((practice: Practice) => {
    setState((current) => ({
      ...current,
      customPractices: [...(current.customPractices ?? []), practice],
    }));
  }, []);

  const updatePractice = useCallback((practiceId: string, updates: Partial<Practice>) => {
    setState((current) => {
      const nextCustom = (current.customPractices ?? []).map((p) =>
        p.id === practiceId ? { ...p, ...updates } : p,
      );
      return {
        ...current,
        customPractices: nextCustom,
        practiceOverrides: {
          ...(current.practiceOverrides ?? {}),
          [practiceId]: {
            ...(current.practiceOverrides?.[practiceId] ?? {}),
            ...updates,
          },
        },
      };
    });
  }, []);

  const deletePractice = useCallback((practiceId: string) => {
    setState((current) => ({
      ...current,
      deletedPracticeIds: {
        ...(current.deletedPracticeIds ?? {}),
        [practiceId]: true,
      },
      customPractices: (current.customPractices ?? []).filter((p) => p.id !== practiceId),
    }));
  }, []);

  const restorePractices = useCallback((categoryId?: string) => {
    setState((current) => {
      if (!categoryId) {
        return { ...current, deletedPracticeIds: {} };
      }
      const category = categoryById.get(categoryId);
      const categoryPracticeIds = new Set(category?.practices.map((p) => p.id) ?? []);
      const nextDeleted = { ...(current.deletedPracticeIds ?? {}) };
      for (const id of Object.keys(nextDeleted)) {
        if (categoryPracticeIds.has(id) || id.startsWith(categoryId)) {
          delete nextDeleted[id];
        }
      }
      return {
        ...current,
        deletedPracticeIds: nextDeleted,
      };
    });
  }, []);

  const hasDeletedPractices = useCallback(
    (categoryId?: string): boolean => {
      if (!state.deletedPracticeIds) return false;
      if (!categoryId) return Object.keys(state.deletedPracticeIds).length > 0;
      const category = categoryById.get(categoryId);
      const categoryPracticeIds = new Set(category?.practices.map((p) => p.id) ?? []);
      return Object.keys(state.deletedPracticeIds).some(
        (id) => categoryPracticeIds.has(id) || id.startsWith(categoryId),
      );
    },
    [state.deletedPracticeIds],
  );

  /* ------------------------------------------------------------------ *
   * Checklist Item CRUD (Phases & Production Readiness)
   * ------------------------------------------------------------------ */

  const allPhaseItems = useCallback(
    (phase: Phase): ChecklistItem[] => {
      const deleted = state.deletedChecklistItemIds ?? {};
      const overrides = state.checklistItemOverrides ?? {};
      const base = phase.items
        .filter((item) => !deleted[item.id])
        .map((item) =>
          overrides[item.id]?.text ? { ...item, text: overrides[item.id]!.text! } : item,
        );
      const custom = (state.customChecklistItems?.[phase.id] ?? [])
        .filter((item) => !deleted[item.id])
        .map((item) =>
          overrides[item.id]?.text ? { ...item, text: overrides[item.id]!.text! } : item,
        );
      return [...base, ...custom];
    },
    [state.deletedChecklistItemIds, state.checklistItemOverrides, state.customChecklistItems],
  );

  const allReadinessCriteria = useCallback(
    (criteria: readonly ChecklistItem[]): ChecklistItem[] => {
      const deleted = state.deletedChecklistItemIds ?? {};
      const overrides = state.checklistItemOverrides ?? {};
      const base = criteria
        .filter((item) => !deleted[item.id])
        .map((item) =>
          overrides[item.id]?.text ? { ...item, text: overrides[item.id]!.text! } : item,
        );
      const custom = (state.customChecklistItems?.['readiness'] ?? [])
        .filter((item) => !deleted[item.id])
        .map((item) =>
          overrides[item.id]?.text ? { ...item, text: overrides[item.id]!.text! } : item,
        );
      return [...base, ...custom];
    },
    [state.deletedChecklistItemIds, state.checklistItemOverrides, state.customChecklistItems],
  );

  const addChecklistItem = useCallback((parentId: string, text: string) => {
    const id = `chk-${parentId}-${Date.now()}`;
    const newItem: ChecklistItem = {
      id,
      text,
      rawText: text,
      sourceLine: 0,
    };
    setState((current) => ({
      ...current,
      customChecklistItems: {
        ...(current.customChecklistItems ?? {}),
        [parentId]: [...(current.customChecklistItems?.[parentId] ?? []), newItem],
      },
    }));
  }, []);

  const updateChecklistItem = useCallback((itemId: string, text: string) => {
    setState((current) => ({
      ...current,
      checklistItemOverrides: {
        ...(current.checklistItemOverrides ?? {}),
        [itemId]: { text },
      },
    }));
  }, []);

  const deleteChecklistItem = useCallback((itemId: string, parentId?: string) => {
    setState((current) => {
      const nextCustom = { ...(current.customChecklistItems ?? {}) };
      if (parentId && nextCustom[parentId]) {
        nextCustom[parentId] = nextCustom[parentId]!.filter((i) => i.id !== itemId);
      }
      return {
        ...current,
        deletedChecklistItemIds: {
          ...(current.deletedChecklistItemIds ?? {}),
          [itemId]: true,
        },
        customChecklistItems: nextCustom,
      };
    });
  }, []);

  const restoreChecklistItems = useCallback((parentId?: string) => {
    setState((current) => {
      const nextDeleted = { ...(current.deletedChecklistItemIds ?? {}) };
      for (const id of Object.keys(nextDeleted)) {
        if (!parentId || id.startsWith(parentId) || id.includes(parentId)) {
          delete nextDeleted[id];
        }
      }
      return {
        ...current,
        deletedChecklistItemIds: nextDeleted,
      };
    });
  }, []);

  const hasDeletedChecklistItems = useCallback(
    (parentId?: string): boolean => {
      if (!state.deletedChecklistItemIds) return false;
      if (!parentId) return Object.keys(state.deletedChecklistItemIds).length > 0;
      return Object.keys(state.deletedChecklistItemIds).some(
        (id) => id.startsWith(parentId) || id.includes(parentId),
      );
    },
    [state.deletedChecklistItemIds],
  );

  const checklistAcknowledgement = useCallback(
    (id: string): ChecklistAcknowledgement | undefined => {
      return state.checklistAcknowledgements?.[id];
    },
    [state.checklistAcknowledgements],
  );

  const setChecklistAcknowledgement = useCallback(
    (id: string, ack: ChecklistAcknowledgement) => {
      setState((current) => ({
        ...current,
        checklistAcknowledgements: {
          ...(current.checklistAcknowledgements ?? {}),
          [id]: ack,
        },
      }));
    },
    [],
  );

  const checklistVerification = useCallback(
    (id: string): ChecklistVerification | undefined => {
      return state.checklistVerifications?.[id];
    },
    [state.checklistVerifications],
  );

  const verifyChecklistItem = useCallback(
    (id: string, verifiedBy = 'Administrator', notes?: string) => {
      setState((current) => ({
        ...current,
        checklistVerifications: {
          ...(current.checklistVerifications ?? {}),
          [id]: {
            verified: true,
            verifiedBy,
            verifiedAt: new Date().toISOString(),
            ...(notes ? { notes } : {}),
          },
        },
      }));
    },
    [],
  );

  const unverifyChecklistItem = useCallback((id: string) => {
    setState((current) => {
      const nextVerifications = { ...(current.checklistVerifications ?? {}) };
      delete nextVerifications[id];
      return {
        ...current,
        checklistVerifications: nextVerifications,
      };
    });
  }, []);

  const verifyTrackerRow = useCallback(
    (rowKey: string, verifiedBy = 'Administrator') => {
      setState((current) => {
        const existing = current.tracker[rowKey] ?? {};
        return {
          ...current,
          tracker: {
            ...current.tracker,
            [rowKey]: {
              ...existing,
              verified: 'Yes',
              verifiedBy,
            },
          },
        };
      });
    },
    [],
  );

  const unverifyTrackerRow = useCallback((rowKey: string) => {
    setState((current) => {
      const existing = current.tracker[rowKey] ?? {};
      return {
        ...current,
        tracker: {
          ...current.tracker,
          [rowKey]: {
            ...existing,
            verified: 'No',
            verifiedBy: '',
          },
        },
      };
    });
  }, []);

  const verifyAllPending = useCallback((verifiedBy = 'Administrator') => {
    setState((current) => {
      const nextVerifications = { ...(current.checklistVerifications ?? {}) };
      const now = new Date().toISOString();
      for (const id of Object.keys(current.checked)) {
        if (current.checked[id] && !nextVerifications[id]?.verified) {
          nextVerifications[id] = {
            verified: true,
            verifiedBy,
            verifiedAt: now,
          };
        }
      }

      const nextTracker = { ...current.tracker };
      for (const [key, rowState] of Object.entries(current.tracker)) {
        if (
          (rowState.status?.toLowerCase().includes('complete') || rowState.implementationBy) &&
          rowState.verified?.toLowerCase() !== 'yes'
        ) {
          nextTracker[key] = {
            ...rowState,
            verified: 'Yes',
            verifiedBy,
          };
        }
      }

      return {
        ...current,
        checklistVerifications: nextVerifications,
        tracker: nextTracker,
      };
    });
  }, []);

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

      allTrackerRows,
      addTrackerRow,
      updateTrackerRowDetails,
      deleteTrackerRow,
      restoreTrackerRows,
      hasDeletedTrackerRows,

      allOpenIssues,
      addOpenIssueItem,
      deleteOpenIssueItem,

      allCategoryPractices,
      addPractice,
      updatePractice,
      deletePractice,
      restorePractices,
      hasDeletedPractices,

      allPhaseItems,
      allReadinessCriteria,
      addChecklistItem,
      updateChecklistItem,
      deleteChecklistItem,
      restoreChecklistItems,
      hasDeletedChecklistItems,

      checklistAcknowledgement,
      setChecklistAcknowledgement,
      checklistVerification,
      verifyChecklistItem,
      unverifyChecklistItem,
      verifyTrackerRow,
      unverifyTrackerRow,
      verifyAllPending,
      syncFromCloudStore,
      isCloudSyncing,
      cloudSyncNotice,
    }),
    [
      state,
      setChecked,
      toggleChecked,
      resetChecked,
      setTrackerField,
      setMapValue,
      allTrackerRows,
      addTrackerRow,
      updateTrackerRowDetails,
      deleteTrackerRow,
      restoreTrackerRows,
      hasDeletedTrackerRows,
      allOpenIssues,
      addOpenIssueItem,
      deleteOpenIssueItem,
      allCategoryPractices,
      addPractice,
      updatePractice,
      deletePractice,
      restorePractices,
      hasDeletedPractices,
      allPhaseItems,
      allReadinessCriteria,
      addChecklistItem,
      updateChecklistItem,
      deleteChecklistItem,
      restoreChecklistItems,
      hasDeletedChecklistItems,
      checklistAcknowledgement,
      setChecklistAcknowledgement,
      checklistVerification,
      verifyChecklistItem,
      unverifyChecklistItem,
      verifyTrackerRow,
      unverifyTrackerRow,
      verifyAllPending,
      syncFromCloudStore,
      isCloudSyncing,
      cloudSyncNotice,
    ],
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
