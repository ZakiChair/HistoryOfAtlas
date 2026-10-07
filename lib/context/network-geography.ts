import type { LineString, MultiLineString } from 'geojson';

type Coordinate = readonly [number, number];
const longitude = (value: number) => ((((value + 180) % 360) + 360) % 360) - 180;

/** Split editorial connections at ±180°, following RFC 7946 §3.1.9. Not sailing tracks. */
export function networkGeometry(points: readonly Coordinate[]): LineString | MultiLineString {
  if (points.length < 2) throw new RangeError('A network needs at least two anchors.');
  const parts: [number, number][][] = [];
  let part: [number, number][] = [[...points[0]]];
  const append = (point: [number, number]) => {
    const last = part.at(-1)!;
    if (point[0] !== last[0] || point[1] !== last[1]) part.push(point);
  };
  for (const point of points.slice(1)) {
    const previous = part.at(-1)!;
    const delta = point[0] - previous[0];
    if (Math.abs(delta) <= 180) {
      append([...point]);
      continue;
    }
    const unwrapped = point[0] + (delta > 180 ? -360 : 360);
    if (unwrapped === previous[0]) {
      append([previous[0], point[1]]);
      continue;
    }
    const seam = delta < -180 ? 180 : -180;
    const fraction = (seam - previous[0]) / (unwrapped - previous[0]);
    const latitude = previous[1] + fraction * (point[1] - previous[1]);
    append([seam, latitude]);
    if (part.length >= 2) parts.push(part);
    part = [[-seam, latitude]];
    append([...point]);
  }
  if (part.length >= 2) parts.push(part);
  if (!parts.length) throw new RangeError('A network needs geographically distinct anchors.');
  return parts.length === 1
    ? { type: 'LineString', coordinates: parts[0] }
    : { type: 'MultiLineString', coordinates: parts };
}

/** The smallest longitude arc containing all anchors keeps transpacific views over the Pacific. */
export function networkCamera(points: readonly Coordinate[]): {
  coordinates: [number, number];
  zoom: number;
} {
  if (!points.length) throw new RangeError('A network view needs anchors.');
  const longitudes = points.map(([lon]) => (lon + 360) % 360).sort((a, b) => a - b);
  let gap = -1,
    start = longitudes[0];
  for (let i = 0; i < longitudes.length; i++) {
    const next = longitudes[(i + 1) % longitudes.length] + (i === longitudes.length - 1 ? 360 : 0);
    if (next - longitudes[i] > gap) {
      gap = next - longitudes[i];
      start = next % 360;
    }
  }
  const width = 360 - gap;
  const latitudes = points.map(([, lat]) => lat);
  const centre = start + width / 2;
  return {
    coordinates: [longitude(centre), (Math.min(...latitudes) + Math.max(...latitudes)) / 2],
    zoom: width > 100 ? 0.5 : width > 60 ? 1 : width > 35 ? 1.5 : 2.5,
  };
}
