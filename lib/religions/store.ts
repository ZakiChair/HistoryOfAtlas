import { create } from 'zustand';
import type { ReligionDataset, ReligionMilestone } from './types';

interface ReligionState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  dataset: ReligionDataset | null;
  visibleMilestones: ReligionMilestone[];
  selected: ReligionMilestone | null;
  panelOpen: boolean;
  revision: number;
  retry: () => void;
  select: (milestone: ReligionMilestone | null) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useReligionStore = create<ReligionState>((set) => ({
  status: 'idle',
  error: null,
  dataset: null,
  visibleMilestones: [],
  selected: null,
  panelOpen: false,
  revision: 0,
  retry: () => set((state) => ({ revision: state.revision + 1 })),
  select: (selected) => set(selected ? { selected, panelOpen: true } : { selected }),
  setPanelOpen: (panelOpen) => set(panelOpen ? { panelOpen } : { panelOpen, selected: null }),
}));

export function publishReligionDataset(
  dataset: ReligionDataset,
  visibleMilestones: ReligionMilestone[],
) {
  const selected = useReligionStore.getState().selected;
  useReligionStore.setState({
    status: 'ready',
    error: null,
    dataset,
    visibleMilestones,
    selected: selected ? (visibleMilestones.find((item) => item.id === selected.id) ?? null) : null,
  });
}
