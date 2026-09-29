import { createMilestoneStore, publishMilestones } from '../thematic/store';
import type { EpidemicDataset, EpidemicMilestone } from './types';

export const useEpidemicStore = createMilestoneStore<EpidemicDataset, EpidemicMilestone>();

export function publishEpidemicDataset(
  dataset: EpidemicDataset,
  visibleMilestones: EpidemicMilestone[],
) {
  publishMilestones(useEpidemicStore, dataset, visibleMilestones);
}
