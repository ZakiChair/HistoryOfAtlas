import { invalidateJson, readJson } from '@/lib/data-client';
import { ReligionDatasetSchema, type ReligionDataset } from './types';

let pending: Promise<ReligionDataset> | undefined;
export function getReligionDataset(): Promise<ReligionDataset> {
  pending ??= readJson<unknown>('/data/religions/history.json')
    .then((data) => ReligionDatasetSchema.parse(data))
    .catch((error) => {
      pending = undefined;
      invalidateJson('/data/religions/history.json');
      throw error;
    });
  return pending;
}
