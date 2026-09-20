import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import pointToLineDistance from '@turf/point-to-line-distance';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { isChronologicallyPossible } from '../../lib/histdate';
import type { Calendar } from '../../lib/types';

type HistoricalDate = { year: number; month?: number; day?: number };
type PreparedLand = { polygon: Polygon; bounds: [number, number, number, number] };
const landCache = new WeakMap<object, PreparedLand[]>();
export function coordinateIssues(coords?: [number, number]): string[] {
  if (!coords) return ['missing-coordinates'];
  const issues: string[] = [];
  if (!Number.isFinite(coords[0]) || Math.abs(coords[0]) > 180) issues.push('invalid-longitude');
  if (!Number.isFinite(coords[1]) || Math.abs(coords[1]) > 90) issues.push('invalid-latitude');
  return issues;
}
export function validateChronology(
  start: HistoricalDate,
  end?: HistoricalDate,
  calendar: Calendar = 'unknown',
): string[] {
  if (!Number.isInteger(start.year)) return ['invalid-start-year'];
  if (!end) return [];
  return isChronologicallyPossible(start, end, calendar) ? [] : ['end-before-start'];
}

/** A 25km coastal tolerance avoids falsely rejecting generalized coasts/islands. */
export function isNearLand(
  coords: [number, number],
  land: FeatureCollection<Polygon | MultiPolygon>,
  toleranceKm = 25,
): boolean {
  let prepared = landCache.get(land);
  if (!prepared) {
    prepared = land.features.flatMap((feature) => {
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      return polygons.map((coordinates) => ({
        polygon: { type: 'Polygon' as const, coordinates },
        bounds: coordinates
          .flat()
          .reduce<[number, number, number, number]>(
            (box, point) => [
              Math.min(box[0], point[0]!),
              Math.min(box[1], point[1]!),
              Math.max(box[2], point[0]!),
              Math.max(box[3], point[1]!),
            ],
            [180, 90, -180, -90],
          ),
      }));
    });
    landCache.set(land, prepared);
  }
  // Conservative envelope: it only avoids impossible candidates; the final test is geodesic.
  const dLat = toleranceKm / 110;
  const dLon = Math.min(
    360,
    dLat / Math.max(0.00001, Math.cos((Math.min(90, Math.abs(coords[1]) + dLat) * Math.PI) / 180)),
  );
  const longitudes = [coords[0], coords[0] - 360, coords[0] + 360];
  const overlaps = (box: [number, number, number, number]) =>
    coords[1] + dLat >= box[1] &&
    coords[1] - dLat <= box[3] &&
    longitudes.some((longitude) => longitude + dLon >= box[0] && longitude - dLon <= box[2]);
  return prepared.some(({ polygon, bounds: box }) => {
    if (!overlaps(box)) return false;
    if (booleanPointInPolygon(coords, polygon)) return true;
    return polygon.coordinates.some((ring) => {
      for (let index = 1; index < ring.length; index++) {
        const a = ring[index - 1]!;
        const b = ring[index]!;
        if (
          !overlaps([
            Math.min(a[0]!, b[0]!),
            Math.min(a[1]!, b[1]!),
            Math.max(a[0]!, b[0]!),
            Math.max(a[1]!, b[1]!),
          ])
        )
          continue;
        if (
          pointToLineDistance(
            coords,
            { type: 'LineString', coordinates: [a, b] },
            { units: 'kilometers', method: 'geodesic' },
          ) <= toleranceKm
        )
          return true;
      }
      return false;
    });
  });
}
