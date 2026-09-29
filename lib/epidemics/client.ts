import { invalidateJson, readJson } from '@/lib/data-client';
import { EpidemicDatasetSchema, type EpidemicDataset } from './types';

let pending: Promise<EpidemicDataset> | undefined;
export function getEpidemicDataset(): Promise<EpidemicDataset> {
  pending ??= readJson<unknown>('/data/epidemics/history.json')
    .then((data) => EpidemicDatasetSchema.parse(data))
    .catch((error) => {
      pending = undefined;
      invalidateJson('/data/epidemics/history.json');
      throw error;
    });
  return pending;
}
