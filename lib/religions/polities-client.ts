import { invalidateJson, readJson } from '@/lib/data-client';
import { ReligionPolitiesSchema, type ReligionPolityDataset } from './polities';

const PATH = '/data/religions/polities.json';
let pending: Promise<ReligionPolityDataset> | undefined;
export function getReligionPolities(): Promise<ReligionPolityDataset> {
  pending ??= readJson<unknown>(PATH)
    .then((data) => ReligionPolitiesSchema.parse(data))
    .catch((error) => {
      pending = undefined;
      invalidateJson(PATH);
      throw error;
    });
  return pending;
}
