import { invalidateJson, readJson } from '@/lib/data-client';
import {
  ReligionCoverageIndexSchema,
  ReligionCoverageRegionSchema,
  type ReligionCoverageIndex,
  type ReligionCoverageRegion,
} from './coverage';

const INDEX_PATH = '/data/religions/coverage-index.json';
let pendingIndex: Promise<ReligionCoverageIndex> | undefined;
export function getReligionCoverageIndex(): Promise<ReligionCoverageIndex> {
  pendingIndex ??= readJson<unknown>(INDEX_PATH)
    .then((data) => ReligionCoverageIndexSchema.parse(data))
    .catch((error) => {
      pendingIndex = undefined;
      invalidateJson(INDEX_PATH);
      throw error;
    });
  return pendingIndex;
}

export const religionCoverageRegionPath = (regionId: string) =>
  `/data/religions/coverage/${encodeURIComponent(regionId)}.json`;

const pendingRegions = new Map<string, Promise<ReligionCoverageRegion>>();
export function getReligionCoverageRegion(regionId: string): Promise<ReligionCoverageRegion> {
  const path = religionCoverageRegionPath(regionId);
  let pending = pendingRegions.get(regionId);
  if (!pending) {
    pending = readJson<unknown>(path)
      .then((data) => ReligionCoverageRegionSchema.parse(data))
      .catch((error) => {
        pendingRegions.delete(regionId);
        invalidateJson(path);
        throw error;
      });
    pendingRegions.set(regionId, pending);
  }
  return pending;
}
