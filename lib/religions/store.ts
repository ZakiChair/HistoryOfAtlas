import { createMilestoneStore, publishMilestones } from '../thematic/store';
import type { ReligionDataset, ReligionMilestone } from './types';

export const useReligionStore = createMilestoneStore<ReligionDataset, ReligionMilestone>();

export function publishReligionDataset(
  dataset: ReligionDataset,
  visibleMilestones: ReligionMilestone[],
) {
  publishMilestones(useReligionStore, dataset, visibleMilestones);
}
