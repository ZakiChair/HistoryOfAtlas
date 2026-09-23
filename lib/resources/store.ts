import { create } from 'zustand';
import type { ResourceCategory, ResourceDataset, ResourceSite, ResourceSource } from './types';

interface ResourceState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  sitesCount: number;
  filteredSitesCount: number;
  totalSitesCount: number;
  categoryFilter: ResourceCategory | null;
  selected: ResourceSite | null;
  sources: ResourceSource[];
  categoryCounts: Partial<Record<ResourceCategory, number>>;
  revision: number;
  retry: () => void;
  select: (site: ResourceSite | null) => void;
  setCategoryFilter: (category: ResourceCategory | null) => void;
}

export const useResourceStore = create<ResourceState>((set) => ({
  status: 'idle',
  error: null,
  sitesCount: 0,
  filteredSitesCount: 0,
  totalSitesCount: 0,
  categoryFilter: null,
  selected: null,
  sources: [],
  categoryCounts: {},
  revision: 0,
  retry: () => set((state) => ({ revision: state.revision + 1 })),
  select: (selected) => set({ selected }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
}));

export function publishResourceDataset(
  dataset: ResourceDataset,
  periodSites: ResourceSite[],
  filteredSitesCount = periodSites.length,
) {
  const categoryCounts: ResourceState['categoryCounts'] = {};
  for (const site of periodSites)
    for (const category of site.categories)
      categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  useResourceStore.setState({
    status: 'ready',
    error: null,
    sitesCount: periodSites.length,
    filteredSitesCount,
    totalSitesCount: dataset.sites.length,
    sources: dataset.sources,
    categoryCounts,
  });
}
