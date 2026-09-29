import { create } from 'zustand';
import type {
  ReligionCoverageEntry,
  ReligionCoverageIndex,
  ReligionCoverageObservation,
} from './coverage';
import { getReligionCoverageRegion } from './coverage-client';
import { useReligionStore } from './store';

interface CoverageState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  dataset: ReligionCoverageIndex | null;
  visibleObservations: ReligionCoverageEntry[];
  selected: ReligionCoverageEntry | null;
  /** Full observation behind `selected`, read from its region file. */
  detail: ReligionCoverageObservation | null;
  detailStatus: 'idle' | 'loading' | 'ready' | 'error';
  revision: number;
  retry: () => void;
  select: (entry: ReligionCoverageEntry | null) => void;
  retryDetail: () => void;
}

export const useReligionCoverageStore = create<CoverageState>((set, get) => {
  const loadDetail = async (entry: ReligionCoverageEntry) => {
    try {
      const region = await getReligionCoverageRegion(entry.regionId);
      if (get().selected?.id !== entry.id) return;
      const detail = region.observations.find((row) => row.id === entry.id) ?? null;
      set({ detail, detailStatus: detail ? 'ready' : 'error' });
    } catch {
      if (get().selected?.id === entry.id) set({ detailStatus: 'error' });
    }
  };
  return {
    status: 'idle',
    error: null,
    dataset: null,
    visibleObservations: [],
    selected: null,
    detail: null,
    detailStatus: 'idle',
    revision: 0,
    retry: () => set((state) => ({ revision: state.revision + 1 })),
    select: (selected) => {
      set({ selected, detail: null, detailStatus: selected ? 'loading' : 'idle' });
      if (selected) {
        useReligionStore.getState().select(null);
        useReligionStore.getState().setPanelOpen(true);
        void loadDetail(selected);
      }
    },
    retryDetail: () => {
      const selected = get().selected;
      if (selected) get().select(selected);
    },
  };
});

export function publishReligionCoverage(
  dataset: ReligionCoverageIndex,
  visibleObservations: ReligionCoverageEntry[],
) {
  const selected = useReligionCoverageStore.getState().selected;
  const kept = selected
    ? (visibleObservations.find((row) => row.id === selected.id) ?? null)
    : null;
  useReligionCoverageStore.setState({
    status: 'ready',
    error: null,
    dataset,
    visibleObservations,
    selected: kept,
    ...(kept ? {} : { detail: null, detailStatus: 'idle' as const }),
  });
}
