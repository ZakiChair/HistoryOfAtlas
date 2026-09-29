import { invalidateJson, readJson } from '@/lib/data-client';
import { ReligionCoverageDatasetSchema, type ReligionCoverageDataset } from './coverage';

const PATH = '/data/religions/coverage.json';
let pending: Promise<ReligionCoverageDataset> | undefined;
export function getReligionCoverageDataset(): Promise<ReligionCoverageDataset> {
  pending ??= readJson<unknown>(PATH)
    .then((data) => ReligionCoverageDatasetSchema.parse(data))
    .catch((error) => {
      pending = undefined;
      invalidateJson(PATH);
      throw error;
    });
  return pending;
}
