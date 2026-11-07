import type { GeographyManifest } from './geography';
import { surroundingSnapshots } from './map-time';

export type BoundaryFrame = {
  id: string;
  url: string;
  sourceLayer: string;
  labelLayer: string;
  weight: number;
  /** Snapshot date uses astronomical years, like the atlas. Not a vector-tile filter. */
  snapshotYear?: number;
  year?: number;
};

/** Source coverage, rather than tile shard padding, determines temporal availability. */
export function boundaryFrames(
  geo: GeographyManifest,
  year: number,
  source: 'cliopatria' | 'historical-basemaps',
): BoundaryFrame[] {
  const timeline = source === 'cliopatria' ? geo.temporal : undefined;
  if (timeline && year >= timeline.range[0]) {
    const boundaryYear = Math.min(year, timeline.range[1]);
    const shard = timeline.shards.find(
      (item) => item.start <= boundaryYear && item.end >= boundaryYear,
    );
    if (shard)
      return [
        {
          id: `territory-${shard.start}`,
          url: shard.url,
          sourceLayer: timeline.sourceLayer,
          labelLayer: timeline.labelLayer,
          weight: 1,
          year: boundaryYear,
        },
      ];
  }
  const surrounding = surroundingSnapshots(geo.snapshots, year);
  if (!surrounding) return [];
  const frames = new Map<string, BoundaryFrame>();
  for (const [snapshot, weight] of [
    [surrounding.before, 1 - surrounding.mix],
    [surrounding.after, surrounding.mix],
  ] as const) {
    if (weight <= 0) continue;
    const id = `snapshot-${snapshot.year}`;
    frames.set(id, {
      id,
      url: snapshot.url,
      sourceLayer: snapshot.sourceLayer ?? 'territories',
      labelLayer: snapshot.labelLayer ?? 'labels',
      weight,
      snapshotYear: snapshot.year,
    });
  }
  return [...frames.values()];
}

/** The caption describes exactly the same positive-weight frames as the renderer. */
export function boundaryPresentation(
  geo: GeographyManifest,
  year: number,
  requestedSource: 'cliopatria' | 'historical-basemaps',
): {
  source: 'cliopatria' | 'historical-basemaps' | null;
  status: 'unavailable' | 'transition' | 'latest' | 'earliest' | 'dated' | 'snapshot';
  years: number[];
  fallback: boolean;
} {
  const frames = boundaryFrames(geo, year, requestedSource);
  const source = !frames.length
    ? null
    : frames[0].year !== undefined
      ? 'cliopatria'
      : 'historical-basemaps';
  const years = frames.map((frame) => (frame.year ?? frame.snapshotYear)!);
  const status = !frames.length
    ? 'unavailable'
    : years.length > 1
      ? 'transition'
      : year > years[0]
        ? 'latest'
        : year < years[0]
          ? 'earliest'
          : source === 'cliopatria'
            ? 'dated'
            : 'snapshot';
  return { source, status, years, fallback: source !== null && requestedSource !== source };
}

/** Preserve precision within one world; wrap repeated Mercator worlds for shareable URLs. */
export function wrapLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) return longitude;
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
