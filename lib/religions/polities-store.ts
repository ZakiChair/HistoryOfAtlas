import { create } from 'zustand';
import type { ReligionPolityDataset } from './polities';
import { useReligionCoverageStore } from './coverage-store';
import { useReligionStore } from './store';

interface PolitySelection {
  entityId: string;
  name: string;
}

interface PolitiesState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  dataset: ReligionPolityDataset | null;
  selectedEntity: PolitySelection | null;
  revision: number;
  retry: () => void;
  select: (entity: PolitySelection | null) => void;
}

export const useReligionPolityStore = create<PolitiesState>((set) => ({
  status: 'idle',
  error: null,
  dataset: null,
  selectedEntity: null,
  revision: 0,
  retry: () => set((state) => ({ revision: state.revision + 1 })),
  select: (selectedEntity) => {
    set({ selectedEntity });
    if (selectedEntity) {
      useReligionCoverageStore.getState().select(null);
      useReligionStore.getState().select(null);
      useReligionStore.getState().setPanelOpen(true);
    }
  },
}));
