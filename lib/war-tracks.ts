import { hexToRgb, WAR_TRACK_RAMP } from '@/lib/colors/semantic';
import { compareHistDates, histDateBounds, histDateToScalar } from '@/lib/histdate';
import type { HistDate, HistoricalEvent } from '@/lib/schema';

/**
 * A war file lists every localized event of a conflict, often across several theatres.
 * Joining them in file order draws movements that never happened, so the chronology is
 * cut into legs wherever two consecutive events are far apart in space or in time.
 * A leg remains a documentary sequence, not an attested route (see ARCHITECTURE.md).
 */
export const WAR_TRACK_MAX_GAP_KM = 1500;
export const WAR_TRACK_MAX_GAP_MONTHS = 6;
/** Beyond this many localized events, step numbers overlap and stop being readable. */
export const WAR_TRACK_NUMBER_LIMIT = 30;
/** Segments shorter than this carry no direction arrow: it would cover both points. */
export const WAR_TRACK_MIN_ARROW_KM = 40;

/** The chronological ramp itself lives with the other layer colours (WAR_TRACK_RAMP). */
const RAMP_RGB = WAR_TRACK_RAMP.map(hexToRgb);

/** `datePrecision` stays optional: a missing value reads as the precision of the date itself. */
export type WarTrackEvent = Pick<HistoricalEvent, 'id' | 'start' | 'name'> &
  Partial<Pick<HistoricalEvent, 'coords' | 'end' | 'datePrecision'>>;

export interface WarTrackPoint {
  id: string;
  coords: [number, number];
  start: HistDate;
  name: HistoricalEvent['name'];
  /** 1-based chronological position among the localized events of the war. */
  order: number;
  /** Position on the colour ramp: 0 for the earliest event, 1 for the latest. */
  ramp: number;
}

export interface WarTrackArrow {
  position: [number, number];
  /** Degrees counter-clockwise from east on a north-up Web Mercator plane. */
  angle: number;
  lengthKm: number;
  ramp: number;
}

export interface WarTrackLeg {
  points: WarTrackPoint[];
  /** Longitudes are unwrapped so a leg crossing the antimeridian stays short. */
  path: [number, number][];
}

/** One straight piece of a leg, between two consecutive events. */
export interface WarTrackSegment {
  /** Two consecutive vertices of the leg's path, with its unwrapped longitudes. */
  path: [[number, number], [number, number]];
  /** Midpoint of its two events on the ramp, like the direction arrows. */
  ramp: number;
}

export interface WarTracks {
  points: WarTrackPoint[];
  /** Only legs with at least two points: an isolated event is drawn as a point alone. */
  legs: WarTrackLeg[];
  arrows: WarTrackArrow[];
  numbered: boolean;
}

export interface WarTrackOptions {
  maxGapKm?: number;
  maxGapMonths?: number;
  numberLimit?: number;
  minArrowKm?: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Great-circle distance (haversine). */
export function distanceKm(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const COARSE_PRECISIONS: ReadonlySet<WarTrackEvent['datePrecision']> = new Set([
  'decade',
  'century',
]);

/**
 * Bounds of a start date read at its declared precision, with the conventions of
 * formatHistDate: `{year: 1910}` dated to the decade is the 1910s (1910-1919), and
 * `{year: 1900}` dated to the century is the 19th century (1801-1900). Before the common
 * era, historical years count back from 1 BCE (astronomical year 0).
 */
function startBounds(date: HistDate, precision: WarTrackEvent['datePrecision']) {
  if (precision !== 'decade' && precision !== 'century') return histDateBounds(date);
  const historical = date.year <= 0 ? 1 - date.year : date.year;
  const high =
    precision === 'decade'
      ? Math.floor(historical / 10) * 10 + 9
      : Math.ceil(historical / 100) * 100;
  const low = Math.max(1, precision === 'decade' ? high - 9 : high - 99);
  const [earliest, latest] = date.year <= 0 ? [1 - high, 1 - low] : [low, high];
  return {
    earliest: histDateBounds({ year: earliest }).earliest,
    latest: histDateBounds({ year: latest }).latest,
  };
}

/**
 * Months that certainly separate two events: from the latest possible end of the previous
 * one to the earliest possible start of the next. Imprecise dates never create a gap: a
 * year, decade or century is read as the whole interval it names.
 */
export function monthsBetween(
  previous: Pick<WarTrackEvent, 'start' | 'end' | 'datePrecision'>,
  next: Pick<WarTrackEvent, 'start' | 'datePrecision'>,
): number {
  // The declared precision describes the start; an explicit later end keeps its own bounds.
  const latest =
    previous.end && compareHistDates(previous.end, previous.start) > 0
      ? histDateBounds(previous.end).latest
      : startBounds(previous.start, previous.datePrecision).latest;
  const gap =
    histDateToScalar(startBounds(next.start, next.datePrecision).earliest) -
    histDateToScalar(latest);
  return Math.max(0, gap * 12);
}

const normalizeLongitude = (longitude: number) => ((((longitude + 180) % 360) + 360) % 360) - 180;
const unwrapDelta = (from: number, to: number) => {
  const delta = to - from;
  return delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta;
};
const mercatorY = (latitude: number) =>
  toDegrees(Math.log(Math.tan(Math.PI / 4 + toRadians(Math.max(-85, Math.min(85, latitude))) / 2)));

function validCoordinates(coords: unknown): coords is [number, number] {
  return (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1]) &&
    Math.abs(coords[1] as number) <= 90
  );
}

/** Pure: sorts a war's localized events chronologically and splits them into theatre legs. */
export function buildWarTracks(
  events: readonly WarTrackEvent[],
  options: WarTrackOptions = {},
): WarTracks {
  const maxGapKm = options.maxGapKm ?? WAR_TRACK_MAX_GAP_KM;
  const maxGapMonths = options.maxGapMonths ?? WAR_TRACK_MAX_GAP_MONTHS;
  const numberLimit = options.numberLimit ?? WAR_TRACK_NUMBER_LIMIT;
  const minArrowKm = options.minArrowKm ?? WAR_TRACK_MIN_ARROW_KM;
  // Array.prototype.sort is stable: events sharing a date keep their published order.
  const localized = events
    .filter((event): event is WarTrackEvent & { coords: [number, number] } =>
      validCoordinates(event.coords),
    )
    .sort((a, b) => compareHistDates(a.start, b.start));
  if (!localized.length) return { points: [], legs: [], arrows: [], numbered: false };
  // A decade or century date may fall anywhere in its interval: it neither stretches the ramp
  // nor squeezes the dated events into part of it, and is clamped onto the ramp instead.
  const dated = localized.filter((event) => !COARSE_PRECISIONS.has(event.datePrecision));
  const reference = dated.length > 1 ? dated : localized;
  const first = histDateToScalar(reference[0]!.start);
  const span = histDateToScalar(reference.at(-1)!.start) - first;
  const points: WarTrackPoint[] = localized.map((event, index) => ({
    id: event.id,
    coords: [normalizeLongitude(event.coords[0]), event.coords[1]],
    start: event.start,
    name: event.name,
    order: index + 1,
    ramp:
      span > 0
        ? Math.max(0, Math.min(1, (histDateToScalar(event.start) - first) / span))
        : localized.length > 1
          ? index / (localized.length - 1)
          : 0,
  }));

  const groups: WarTrackPoint[][] = [[points[0]!]];
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    const far = distanceKm(previous.coords, point.coords) > maxGapKm;
    const late = monthsBetween(localized[index - 1]!, localized[index]!) > maxGapMonths;
    if (far || late) groups.push([point]);
    else groups.at(-1)!.push(point);
  }

  const legs: WarTrackLeg[] = [];
  const arrows: WarTrackArrow[] = [];
  for (const group of groups) {
    if (group.length < 2) continue;
    const path: [number, number][] = [group[0]!.coords];
    for (let index = 1; index < group.length; index++) {
      const from = path[index - 1]!;
      const to = group[index]!.coords;
      const deltaLon = unwrapDelta(from[0], to[0]);
      path.push([from[0] + deltaLon, to[1]]);
      const lengthKm = distanceKm(from, to);
      if (lengthKm < minArrowKm) continue;
      arrows.push({
        position: [normalizeLongitude(from[0] + deltaLon / 2), (from[1] + to[1]) / 2],
        angle: toDegrees(Math.atan2(mercatorY(to[1]) - mercatorY(from[1]), deltaLon)),
        lengthKm,
        ramp: (group[index - 1]!.ramp + group[index]!.ramp) / 2,
      });
    }
    legs.push({ points: group, path });
  }
  return { points, legs, arrows, numbered: points.length <= numberLimit };
}

/**
 * One row per segment of every leg, each drawn in a single colour. On the globe deck.gl cuts
 * paths on a 10-degree grid and inserts vertices, so one colour per event would land on the
 * first pieces of a leg and leave the inserted ones unpainted. A constant colour per two-vertex
 * row fills every vertex deck.gl adds, so the colours stay put in globe and mercator alike.
 */
export function warTrackSegments(legs: readonly WarTrackLeg[]): WarTrackSegment[] {
  return legs.flatMap((leg) =>
    leg.path.slice(1).map((to, index): WarTrackSegment => ({
      path: [leg.path[index]!, to],
      ramp: (leg.points[index]!.ramp + leg.points[index + 1]!.ramp) / 2,
    })),
  );
}

/** Linear interpolation on WAR_TRACK_RAMP (lib/colors/semantic.ts). */
export function warTrackColor(ramp: number, alpha = 255): [number, number, number, number] {
  const stops = RAMP_RGB.length - 1;
  const position = Math.max(0, Math.min(1, Number.isFinite(ramp) ? ramp : 0)) * stops;
  const index = Math.min(stops - 1, Math.floor(position));
  const local = position - index;
  const from = RAMP_RGB[index]!;
  const to = RAMP_RGB[index + 1]!;
  return [
    Math.round(from[0] + (to[0] - from[0]) * local),
    Math.round(from[1] + (to[1] - from[1]) * local),
    Math.round(from[2] + (to[2] - from[2]) * local),
    alpha,
  ];
}
