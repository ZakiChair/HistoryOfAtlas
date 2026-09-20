import type { EventShard } from './schema';
import { temporalWindow } from './map-time';

type Manifest = { eventsPmtiles?: string; eventShards?: readonly EventShard[] };
type View = {
  year: number;
  speed: number;
  playing: boolean;
  range?: readonly [number, number] | null;
  trails?: boolean;
  selectedWar?: string | null;
};

/** Selects one archive; padded intervals avoid replacing tiles at every bin boundary. */
export function selectEventArchive(
  manifest: Manifest,
  view: View,
  current?: string,
): string | undefined {
  if (view.range || view.trails || view.selectedWar) return manifest.eventsPmtiles;
  const shards = manifest.eventShards;
  if (!shards?.length) return manifest.eventsPmtiles;
  const delta = temporalWindow(view.speed, view.playing);
  const coversWindow = (shard: EventShard) =>
    shard.validFrom <= view.year - delta && shard.validTo >= view.year + delta;
  const loaded = shards.find((shard) => shard.path === current);
  if (loaded && coversWindow(loaded)) return loaded.path;
  const nominal = shards.find((shard) => shard.start <= view.year && shard.end >= view.year);
  if (nominal) return nominal.path;
  const covering = shards.find(coversWindow);
  if (covering) return covering.path;
  // In a documentary gap, use the nearest small archive with the exact GPU time filter.
  // Its out-of-period features remain invisible; a gap never triggers a full-world download.
  const distance = (shard: EventShard) =>
    Math.max(shard.start - view.year, view.year - shard.end, 0);
  return shards.reduce((nearest, shard) => (distance(shard) < distance(nearest) ? shard : nearest))
    .path;
}
