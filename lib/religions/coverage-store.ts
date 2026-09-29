import { create } from 'zustand';
import type { ReligionCoverageDataset, ReligionCoverageObservation } from './coverage';
import { useReligionStore } from './store';

interface CoverageState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  dataset: ReligionCoverageDataset | null;
  visibleObservations: ReligionCoverageObservation[];
  selected: ReligionCoverageObservation | null;
  revision: number;
  retry: () => void;
  select: (observation: ReligionCoverageObservation | null) => void;
}
export const useReligionCoverageStore = create<CoverageState>((set) => ({
  status: 'idle',
  error: null,
  dataset: null,
  visibleObservations: [],
  selected: null,
  revision: 0,
  retry: () => set((state) => ({ revision: state.revision + 1 })),
  select: (selected) => {
    set({ selected });
    if (selected) {
      useReligionStore.getState().select(null);
      useReligionStore.getState().setPanelOpen(true);
    }
  },
}));

export function publishReligionCoverage(
  dataset: ReligionCoverageDataset,
  visibleObservations: ReligionCoverageObservation[],
) {
  const selected = useReligionCoverageStore.getState().selected;
  useReligionCoverageStore.setState({
    status: 'ready',
    error: null,
    dataset,
    visibleObservations,
    selected: selected ? (visibleObservations.find((row) => row.id === selected.id) ?? null) : null,
  });
}
