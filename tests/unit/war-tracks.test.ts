import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareHistDates } from '../../lib/histdate';
import { hexToRgb, WAR_TRACK_RAMP } from '../../lib/colors/semantic';
import type { HistoricalEvent } from '../../lib/schema';
import {
  buildWarTracks,
  distanceKm,
  monthsBetween,
  warTrackColor,
  warTrackSegments,
  WAR_TRACK_MAX_GAP_KM,
  WAR_TRACK_MAX_GAP_MONTHS,
  type WarTrackEvent,
} from '../../lib/war-tracks';

const war = (id: string): HistoricalEvent[] =>
  JSON.parse(readFileSync(join(process.cwd(), 'public/data/wars', `${id}.json`), 'utf8'));

function event(
  id: string,
  coords: [number, number] | undefined,
  start: WarTrackEvent['start'],
  end?: WarTrackEvent['end'],
  datePrecision?: WarTrackEvent['datePrecision'],
): WarTrackEvent {
  return { id, coords, start, end, datePrecision, name: { en: id } };
}

/** Naive file-order polyline, as drawn before theatre legs existed. */
function fileOrderKm(events: HistoricalEvent[]): number {
  const points = events.flatMap((item) => (item.coords ? [item.coords] : []));
  let total = 0;
  for (let index = 1; index < points.length; index++)
    total += distanceKm(points[index - 1]!, points[index]!);
  return total;
}

function expectTheatreLegs(events: HistoricalEvent[]) {
  // Reversing the published order proves the tracks do not depend on file order.
  const tracks = buildWarTracks([...events].reverse());
  const localized = events.filter((item) => item.coords);
  expect(tracks.points).toHaveLength(localized.length);
  expect(new Set(tracks.points.map((point) => point.id))).toEqual(
    new Set(localized.map((item) => item.id)),
  );
  for (let index = 1; index < tracks.points.length; index++) {
    expect(
      compareHistDates(tracks.points[index - 1]!.start, tracks.points[index]!.start),
    ).toBeLessThanOrEqual(0);
    expect(tracks.points[index]!.order).toBe(index + 1);
    expect(tracks.points[index]!.ramp).toBeGreaterThanOrEqual(tracks.points[index - 1]!.ramp);
  }
  expect(tracks.points[0]!.ramp).toBe(0);
  expect(tracks.points.at(-1)!.ramp).toBe(1);

  let drawnKm = 0;
  const byId = new Map(events.map((item) => [item.id, item]));
  for (const leg of tracks.legs) {
    expect(leg.points.length).toBeGreaterThanOrEqual(2);
    expect(leg.path).toHaveLength(leg.points.length);
    for (let index = 1; index < leg.points.length; index++) {
      const from = leg.points[index - 1]!;
      const to = leg.points[index]!;
      expect(to.order).toBe(from.order + 1);
      const km = distanceKm(from.coords, to.coords);
      expect(km).toBeLessThanOrEqual(WAR_TRACK_MAX_GAP_KM);
      expect(monthsBetween(byId.get(from.id)!, byId.get(to.id)!)).toBeLessThanOrEqual(
        WAR_TRACK_MAX_GAP_MONTHS,
      );
      // Unwrapped longitudes never jump across the whole map.
      expect(Math.abs(leg.path[index]![0] - leg.path[index - 1]![0])).toBeLessThanOrEqual(180);
      drawnKm += km;
    }
  }
  // Every cut between two legs is justified by distance or time.
  const legOf = new Map(
    tracks.legs.flatMap((leg, legIndex) => leg.points.map((point) => [point.id, legIndex])),
  );
  for (let index = 1; index < tracks.points.length; index++) {
    const from = tracks.points[index - 1]!;
    const to = tracks.points[index]!;
    const sameLeg = legOf.has(from.id) && legOf.get(from.id) === legOf.get(to.id);
    if (sameLeg) continue;
    const far = distanceKm(from.coords, to.coords) > WAR_TRACK_MAX_GAP_KM;
    const late = monthsBetween(byId.get(from.id)!, byId.get(to.id)!) > WAR_TRACK_MAX_GAP_MONTHS;
    expect(far || late, `${from.id} → ${to.id}`).toBe(true);
  }
  for (const arrow of tracks.arrows) {
    expect(Number.isFinite(arrow.angle)).toBe(true);
    expect(Math.abs(arrow.position[0])).toBeLessThanOrEqual(180);
  }
  return { tracks, drawnKm, fileOrderKm: fileOrderKm(events) };
}

describe('war theatre tracks', () => {
  it('splits World War II into chronological theatre legs without numbers', () => {
    const events = war('Q362');
    const { tracks, drawnKm, fileOrderKm } = expectTheatreLegs(events);
    expect(tracks.numbered).toBe(false);
    expect(tracks.legs.length).toBeGreaterThan(10);
    // The former web crossed Europe and the Pacific hundreds of times.
    expect(drawnKm).toBeLessThan(fileOrderKm * 0.2);
    const order = (id: string) => tracks.points.find((point) => point.id === id)!.order;
    // Poland 1939, then France 1940, then Berlin 1945.
    expect(order('Q150812')).toBeLessThan(order('Q151340'));
    expect(order('Q151340')).toBeLessThan(order('Q154182'));
  });

  it('splits the Napoleonic Wars and keeps Austerlitz before Waterloo', () => {
    const events = war('Q78994');
    const { tracks, drawnKm, fileOrderKm } = expectTheatreLegs(events);
    expect(tracks.numbered).toBe(false);
    expect(drawnKm).toBeLessThan(fileOrderKm * 0.3);
    const austerlitz = tracks.points.find((point) => point.id === 'Q134114')!;
    const waterloo = tracks.points.find((point) => point.id === 'Q48314')!;
    expect(austerlitz.order).toBeLessThan(waterloo.order);
    expect(waterloo.ramp).toBeGreaterThan(0.9);
  });

  it('cuts on distance and on certain time gaps, never on imprecise dates', () => {
    const tracks = buildWarTracks([
      event('Q4', [2.35, 48.85], { year: 1801, month: 3 }), // Paris, about 1 000 km from Brno
      event('Q1', [16.37, 48.21], { year: 1800 }), // Vienna, known only to the year
      event('Q3', [17, 48.5], { year: 1801, month: 12 }), // eight months after Paris
      event('Q2', [16.6, 49.19], { year: 1800, month: 12 }), // Brno: 1800 may mean December
      event('Q5', [17.1, 48.6], { year: 1802, month: 1 }),
      event('Q6', undefined, { year: 1801, month: 9 }),
    ]);
    expect(tracks.points.map((point) => point.id)).toEqual(['Q1', 'Q2', 'Q4', 'Q3', 'Q5']);
    expect(tracks.legs.map((leg) => leg.points.map((point) => point.id))).toEqual([
      ['Q1', 'Q2', 'Q4'],
      ['Q3', 'Q5'],
    ]);
    const split = buildWarTracks(
      [
        event('Q1', [16.37, 48.21], { year: 1800, month: 1 }),
        event('Q2', [-3.7, 40.42], { year: 1800, month: 2 }), // Madrid, > 1 500 km
        event('Q3', [-3.6, 40.5], { year: 1800, month: 3 }),
      ],
      {},
    );
    expect(split.legs.map((leg) => leg.points.map((point) => point.id))).toEqual([['Q2', 'Q3']]);
  });

  it('measures the gap from the end of a long event', () => {
    expect(
      monthsBetween({ start: { year: 1800 }, end: { year: 1802 } }, { start: { year: 1802 } }),
    ).toBe(0);
    expect(
      monthsBetween(
        { start: { year: 1800, month: 1, day: 31 } },
        { start: { year: 1800, month: 9 } },
      ),
    ).toBeGreaterThan(6);
  });

  it('keeps legs crossing the antimeridian short and numbers only small wars', () => {
    const tracks = buildWarTracks([
      event('Q1', [179, -17], { year: 1943, month: 1 }),
      event('Q2', [-179, -17.5], { year: 1943, month: 2 }),
    ]);
    expect(tracks.legs[0]!.path).toEqual([
      [179, -17],
      [181, -17.5],
    ]);
    expect(Math.abs(tracks.arrows[0]!.position[0])).toBeCloseTo(180, 5);
    expect(Math.abs(tracks.arrows[0]!.angle)).toBeLessThan(30); // heading east
    expect(tracks.numbered).toBe(true);
    const many = Array.from({ length: 31 }, (_, index) =>
      event(`Q${index + 1}`, [index * 0.1, 0], { year: 1900, month: 1 + (index % 12) }),
    );
    expect(buildWarTracks(many.slice(0, 30)).numbered).toBe(true);
    expect(buildWarTracks(many).numbered).toBe(false);
    expect(buildWarTracks([])).toEqual({ points: [], legs: [], arrows: [], numbered: false });
  });

  it('reads decade and century dates as the interval they name', () => {
    // Q61115841, known only to the 1910s, then an event of November 1917 about 200 km away.
    const bakhmut = event('Q1', [38, 48.6], { year: 1910 }, undefined, 'decade');
    const next = event('Q2', [36.3, 50], { year: 1917, month: 11, day: 8 }, undefined, 'day');
    expect(monthsBetween(bakhmut, next)).toBe(0);
    expect(buildWarTracks([bakhmut, next]).legs.map((leg) => leg.points.length)).toEqual([2]);
    // The same year dated to the year is a certain gap of almost seven years.
    const exact = { ...bakhmut, datePrecision: 'year' as const };
    expect(monthsBetween(exact, next)).toBeGreaterThan(WAR_TRACK_MAX_GAP_MONTHS);
    expect(buildWarTracks([exact, next]).legs).toEqual([]);
    // Decade and century bounds follow formatHistDate: {1900} dated to the century is 1801-1900.
    expect(
      monthsBetween({ start: { year: 1850 } }, { start: { year: 1900 }, datePrecision: 'century' }),
    ).toBe(0);
    expect(
      monthsBetween({ start: { year: 1900 }, datePrecision: 'century' }, { start: { year: 1901 } }),
    ).toBeLessThan(1);
    expect(
      monthsBetween({ start: { year: 1900 }, datePrecision: 'century' }, { start: { year: 1902 } }),
    ).toBeGreaterThan(WAR_TRACK_MAX_GAP_MONTHS);
    // Before the common era: {-259} dated to the decade is the 260s BCE (astronomical -268..-259).
    const punic = { start: { year: -259 }, datePrecision: 'decade' as const };
    expect(monthsBetween({ start: { year: -268 } }, punic)).toBe(0);
    expect(monthsBetween({ start: { year: -270 } }, punic)).toBeGreaterThan(12);
    expect(monthsBetween(punic, { start: { year: -259 } })).toBe(0);
    expect(monthsBetween(punic, { start: { year: -257 } })).toBeGreaterThan(12);
    // An explicit later end keeps its own bounds: the precision describes the start.
    expect(
      monthsBetween(
        { start: { year: 1360 }, end: { year: 1368, month: 8, day: 15 }, datePrecision: 'decade' },
        { start: { year: 1369, month: 6 } },
      ),
    ).toBeGreaterThan(WAR_TRACK_MAX_GAP_MONTHS);
  });

  it('keeps a decade or century date from squeezing the ramp of dated events', () => {
    const tracks = buildWarTracks([
      event('Q1', [38, 48.6], { year: 1910 }, undefined, 'decade'),
      event('Q2', [36.3, 50], { year: 1917, month: 11 }),
      event('Q3', [36.5, 50.2], { year: 1918, month: 5 }),
      event('Q4', [36.7, 50.1], { year: 1918, month: 11 }),
      event('Q5', [37, 50], { year: 1900 }, undefined, 'century'),
    ]);
    expect(tracks.points.map((point) => [point.id, point.ramp])).toEqual([
      ['Q5', 0],
      ['Q1', 0],
      ['Q2', 0],
      ['Q3', 0.5],
      ['Q4', 1],
    ]);
    // Real data: the 1910s battle of Bakhmut no longer pushes the 1917-1921 events to the dark end.
    const civilWar = buildWarTracks(war('Q79911')).points;
    expect(civilWar.find((point) => point.id === 'Q61115841')!.ramp).toBe(0);
    expect(civilWar[1]!.ramp).toBeLessThan(0.1);
  });

  it('gives every segment of a leg its own constant colour, safe from globe tessellation', () => {
    // On the globe deck.gl inserts vertices along each path. A two-vertex row with one scalar
    // colour paints all of them; one colour per event would stop partway along the leg.
    const { tracks } = expectTheatreLegs(war('Q362'));
    const segments = warTrackSegments(tracks.legs);
    expect(segments).toHaveLength(
      tracks.legs.reduce((total, leg) => total + leg.points.length - 1, 0),
    );
    let index = 0;
    for (const leg of tracks.legs)
      for (let step = 1; step < leg.points.length; step++) {
        const segment = segments[index++]!;
        expect(segment.path).toEqual([leg.path[step - 1], leg.path[step]]);
        expect(segment.ramp).toBeCloseTo((leg.points[step - 1]!.ramp + leg.points[step]!.ramp) / 2);
        const color = warTrackColor(segment.ramp, 225);
        expect(color).toHaveLength(4);
        expect(color.every((channel) => Number.isInteger(channel))).toBe(true);
        expect(color[3]).toBe(225);
      }
    // A leg across the antimeridian keeps its unwrapped longitudes.
    const pacific = buildWarTracks([
      event('Q1', [179, -17], { year: 1943, month: 1 }),
      event('Q2', [-179, -17.5], { year: 1943, month: 2 }),
      event('Q3', [-178, -18], { year: 1943, month: 3 }),
    ]);
    const crossing = warTrackSegments(pacific.legs);
    expect(crossing.map((segment) => segment.path)).toEqual([
      [
        [179, -17],
        [181, -17.5],
      ],
      [
        [181, -17.5],
        [182, -18],
      ],
    ]);
    expect(crossing[0]!.ramp).toBeCloseTo(0.25);
    expect(crossing[1]!.ramp).toBeCloseTo(0.75);
    expect(warTrackSegments([])).toEqual([]);
  });

  it('draws a sequential ramp whose key matches the stylesheet', () => {
    expect(warTrackColor(0)).toEqual([...hexToRgb(WAR_TRACK_RAMP[0]), 255]);
    expect(warTrackColor(1)).toEqual([...hexToRgb(WAR_TRACK_RAMP.at(-1)!), 255]);
    expect(warTrackColor(Number.NaN)).toEqual(warTrackColor(0));
    const lightness = (color: number[]) =>
      color[0]! * 0.299 + color[1]! * 0.587 + color[2]! * 0.114;
    for (let step = 1; step <= 10; step++)
      expect(lightness(warTrackColor(step / 10))).toBeLessThan(
        lightness(warTrackColor((step - 1) / 10)),
      );
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    const key = css.slice(css.indexOf('.war-track-key'));
    expect(key.slice(0, key.indexOf('}', key.indexOf('.war-track-key i')))).toContain(
      `linear-gradient(90deg, ${WAR_TRACK_RAMP.join(', ')})`,
    );
  });
});
