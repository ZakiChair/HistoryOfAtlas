import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

type HistoricalDate = { year: number; month?: number; day?: number };
const boundsCache = new WeakMap<object, [number, number, number, number][]>();
export function coordinateIssues(coords?: [number, number]): string[] {
  if (!coords) return ['missing-coordinates'];
  const issues: string[] = [];
  if (!Number.isFinite(coords[0]) || Math.abs(coords[0]) > 180) issues.push('invalid-longitude');
  if (!Number.isFinite(coords[1]) || Math.abs(coords[1]) > 90) issues.push('invalid-latitude');
  return issues;
}
export function validateChronology(start: HistoricalDate, end?: HistoricalDate): string[] {
  if (!Number.isInteger(start.year)) return ['invalid-start-year'];
  if (!end) return [];
  for (const key of ['year', 'month', 'day'] as const) {
    const a = start[key] ?? 1;
    const b = end[key] ?? 1;
    if (b < a) return ['end-before-start'];
    if (b > a) return [];
  }
  return [];
}

/** A 25km coastal tolerance avoids falsely rejecting generalized coasts/islands. */
export function isNearLand(
  coords: [number, number],
  land: FeatureCollection<Polygon | MultiPolygon>,
  toleranceKm = 25,
): boolean {
  let bounds = boundsCache.get(land);
  if (!bounds) {
    bounds = land.features.map((feature) => {
      const positions =
        feature.geometry.type === 'Polygon'
          ? feature.geometry.coordinates.flat()
          : feature.geometry.coordinates.flat(2);
      return positions.reduce<[number, number, number, number]>(
        (box, point) => [
          Math.min(box[0], point[0]!),
          Math.min(box[1], point[1]!),
          Math.max(box[2], point[0]!),
          Math.max(box[3], point[1]!),
        ],
        [180, 90, -180, -90],
      );
    });
    boundsCache.set(land, bounds);
  }
  const dLat = toleranceKm / 111.32;
  const dLon = dLat / Math.max(0.1, Math.cos((coords[1] * Math.PI) / 180));
  const probes: [number, number][] = [coords];
  for (let i = 0; i < 16; i++) {
    const angle = (2 * Math.PI * i) / 16;
    probes.push([coords[0] + Math.cos(angle) * dLon, coords[1] + Math.sin(angle) * dLat]);
  }
  return land.features.some((feature, index) => {
    const box = bounds![index]!;
    if (
      coords[0] + dLon < box[0] ||
      coords[0] - dLon > box[2] ||
      coords[1] + dLat < box[1] ||
      coords[1] - dLat > box[3]
    )
      return false;
    return probes.some((probe) => booleanPointInPolygon(probe, feature));
  });
}
