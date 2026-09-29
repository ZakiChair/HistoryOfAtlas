import { create, type StoreApi, type UseBoundStore } from 'zustand';

export interface MilestoneState<D, M> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  dataset: D | null;
  visibleMilestones: M[];
  selected: M | null;
  panelOpen: boolean;
  revision: number;
  retry: () => void;
  select: (milestone: M | null) => void;
  setPanelOpen: (open: boolean) => void;
}

export type MilestoneStore<D, M> = UseBoundStore<StoreApi<MilestoneState<D, M>>>;

export function createMilestoneStore<D, M extends { id: string }>(): MilestoneStore<D, M> {
  return create<MilestoneState<D, M>>((set) => ({
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
}

export function publishMilestones<D, M extends { id: string }>(
  store: MilestoneStore<D, M>,
  dataset: D,
  visibleMilestones: M[],
): void {
  const selected = store.getState().selected;
  store.setState({
    status: 'ready',
    error: null,
    dataset,
    visibleMilestones,
    selected: selected ? (visibleMilestones.find((item) => item.id === selected.id) ?? null) : null,
  });
}
