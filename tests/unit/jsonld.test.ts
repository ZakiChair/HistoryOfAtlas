import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  datasetJsonLd,
  eventDates,
  eventJsonLd,
  isoDate,
  isoYear,
  jsonLdGraph,
  julianToGregorian,
  licenseDatasetParts,
  serializeJsonLd,
  type EventLike,
} from '@/lib/jsonld';
import type { LicenseDataset, LicenseManifest } from '@/lib/licenses';
import licenseManifest from '../../public/data/licenses.json';

const origin = 'https://atlas.example';

const gaugamela: EventLike = {
  id: 'Q188129',
  name: { en: 'Battle of Gaugamela', fr: 'bataille de Gaugamèles' },
  start: { year: -330, month: 10, day: 1 },
  datePrecision: 'day',
  calendar: 'julian',
  coords: [43.45, 36.36],
  place: { id: 'Q1128539', name: 'Gaugamela' },
  image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gaugamela.jpg?width=960',
  wikipedia: { en: 'https://en.wikipedia.org/wiki/Battle_of_Gaugamela' },
  summary: { en: 'Alexander defeats Darius III.' },
};

describe('ISO 8601 dates for structured data', () => {
  it('writes astronomical years in the expanded signed form', () => {
    expect(isoYear(-330)).toBe('-0330');
    expect(isoYear(0)).toBe('0000');
    expect(isoYear(5)).toBe('0005');
    expect(isoYear(1815)).toBe('1815');
    expect(isoYear(12000)).toBe('+12000');
    expect(() => isoYear(1.5)).toThrow(RangeError);
  });

  it('converts proleptic Julian days to proleptic Gregorian days', () => {
    expect(julianToGregorian({ year: 1582, month: 10, day: 4 })).toEqual({
      year: 1582,
      month: 10,
      day: 14,
    });
    expect(julianToGregorian({ year: 1700, month: 2, day: 18 })).toEqual({
      year: 1700,
      month: 2,
      day: 28,
    });
    // Ides of March, 44 BCE (astronomical −43).
    expect(julianToGregorian({ year: -43, month: 3, day: 15 })).toEqual({
      year: -43,
      month: 3,
      day: 13,
    });
    expect(julianToGregorian({ year: 1, month: 1, day: 1 })).toEqual({
      year: 0,
      month: 12,
      day: 30,
    });
  });

  it('truncates the date to the precision and calendar the source supports', () => {
    const date = { year: 1815, month: 6, day: 18 };
    expect(isoDate(date, 'day', 'gregorian')).toBe('1815-06-18');
    expect(isoDate(date, 'month', 'gregorian')).toBe('1815-06');
    expect(isoDate(date, 'year', 'gregorian')).toBe('1815');
    expect(isoDate({ year: -43, month: 3, day: 15 }, 'day', 'julian')).toBe('-0043-03-13');
    // A Julian month cannot be placed on the Gregorian calendar without inventing a day.
    expect(isoDate({ year: 1066, month: 10 }, 'month', 'julian')).toBe('1066');
    expect(isoDate(date, 'day', 'unknown')).toBe('1815');
    expect(isoDate(date, 'day')).toBe('1815');
  });

  it('widens a decade or a century to the edges of the period the page displays', () => {
    const span = (year: number, precision: 'decade' | 'century') => [
      isoDate({ year }, precision, 'julian', 'start'),
      isoDate({ year }, precision, 'julian', 'end'),
    ];
    // "1810s", not the stored 1815; the start edge is the default.
    expect(isoDate({ year: 1815, month: 6, day: 18 }, 'decade', 'gregorian')).toBe('1810');
    expect(span(1815, 'decade')).toEqual(['1810', '1819']);
    // "4th century" (Q16966331) and "17th century" (Q7832619).
    expect(span(400, 'century')).toEqual(['0301', '0400']);
    expect(span(1700, 'century')).toEqual(['1601', '1700']);
    // "730s BCE" (Q21660664, astronomical −729) is 739–730 BCE.
    expect(span(-729, 'decade')).toEqual(['-0738', '-0729']);
    // "4th century BCE": 400–301 BCE.
    expect(span(-330, 'century')).toEqual(['-0399', '-0300']);
    // Astronomical year 0 is 1 BCE, in the 1st century BCE.
    expect(span(0, 'century')).toEqual(['-0099', '0000']);
    // The "0s" have no historical year 0 on either side of the era boundary.
    expect(span(5, 'decade')).toEqual(['0001', '0009']);
    expect(span(-3, 'decade')).toEqual(['-0008', '0000']);
  });
});

/** Reads an ISO value the way common parsers do: a reduced-precision value is its first day. */
function firstDay(value: string): number {
  const match = /^([+-]?\d+)(?:-(\d\d))?(?:-(\d\d))?$/.exec(value);
  if (!match) throw new Error(`Not an ISO date: ${value}`);
  return Number(match[1]) * 10_000 + Number(match[2] ?? 1) * 100 + Number(match[3] ?? 1);
}

describe('event start and end dates', () => {
  it('spans the whole decade or century, with or without a recorded end', () => {
    expect(eventDates({ start: { year: 400 }, datePrecision: 'century' })).toEqual({
      startDate: '0301',
      endDate: '0400',
    });
    // Q125547657: "4th–7th century".
    expect(
      eventDates({ start: { year: 400 }, end: { year: 700 }, datePrecision: 'century' }),
    ).toEqual({ startDate: '0301', endDate: '0700' });
    expect(
      eventDates({ start: { year: -729 }, datePrecision: 'decade', calendar: 'julian' }),
    ).toEqual({ startDate: '-0738', endDate: '-0729' });
  });

  it('leaves out an end cut back to the start’s own year or month', () => {
    // Q131696466: 26 Dec 1555 (Julian) is 5 Jan 1556; the Julian February end keeps only 1556.
    expect(
      eventDates({
        start: { year: 1555, month: 12, day: 26 },
        end: { year: 1556, month: 2 },
        datePrecision: 'day',
        calendar: 'julian',
      }),
    ).toEqual({ startDate: '1556-01-05' });
    expect(
      eventDates({
        start: { year: 1757, month: 8, day: 11 },
        end: { year: 1757, month: 8 },
        datePrecision: 'day',
        calendar: 'gregorian',
      }),
    ).toEqual({ startDate: '1757-08-11' });
    expect(
      eventDates({
        start: { year: 1716, month: 2, day: 9 },
        end: { year: 1716 },
        datePrecision: 'day',
        calendar: 'gregorian',
      }),
    ).toEqual({ startDate: '1716-02-09' });
  });

  it('keeps a reduced-precision end that falls after the start', () => {
    expect(
      eventDates({
        start: { year: 1757, month: 8, day: 11 },
        end: { year: 1757, month: 12 },
        datePrecision: 'day',
        calendar: 'gregorian',
      }),
    ).toEqual({ startDate: '1757-08-11', endDate: '1757-12' });
    expect(
      eventDates({
        start: { year: 1755, month: 12, day: 26 },
        end: { year: 1756 },
        datePrecision: 'day',
        calendar: 'gregorian',
      }),
    ).toEqual({ startDate: '1755-12-26', endDate: '1756' });
    // Converted, a Julian 26 Dec 1755 already falls in 1756: the bare-year end says nothing more.
    expect(
      eventDates({
        start: { year: 1755, month: 12, day: 26 },
        end: { year: 1756 },
        datePrecision: 'day',
        calendar: 'julian',
      }),
    ).toEqual({ startDate: '1756-01-06' });
    const node = eventJsonLd(
      { ...gaugamela, start: { year: 400 }, datePrecision: 'century' },
      { origin, path: '/event/Q16966331/' },
    );
    expect(node).toMatchObject({ startDate: '0301', endDate: '0400' });
    // A year-precision record within one year keeps both dates.
    expect(
      eventDates({ start: { year: 1556 }, end: { year: 1556 }, datePrecision: 'year' }),
    ).toEqual({ startDate: '1556', endDate: '1556' });
  });

  it('never publishes an end that sorts before the start', () => {
    const dates = [
      { year: -44 },
      { year: -44, month: 3 },
      { year: -44, month: 3, day: 15 },
      { year: 0, month: 12, day: 31 },
      { year: 1, month: 1, day: 1 },
      { year: 1555, month: 12, day: 26 },
      { year: 1556 },
      { year: 1556, month: 1 },
      { year: 1556, month: 1, day: 3 },
      { year: 1556, month: 2 },
      { year: 1699, month: 12 },
      { year: 1699, month: 12, day: 25 },
      { year: 1700 },
      { year: 1700, month: 1, day: 2 },
    ];
    type Parts = { year: number; month?: number; day?: number };
    const order = (date: Parts) => date.year * 10_000 + (date.month ?? 1) * 100 + (date.day ?? 1);
    // A valid record never ends before its start, compared at the end's own precision.
    const endsBeforeStart = (start: Parts, end: Parts) =>
      order(end) <
      order({
        year: start.year,
        ...(end.month === undefined ? {} : { month: start.month }),
        ...(end.day === undefined ? {} : { day: start.day }),
      });
    let checked = 0;
    for (const precision of ['day', 'month', 'year', 'decade', 'century'] as const)
      for (const calendar of ['julian', 'gregorian', 'unknown', undefined] as const)
        for (const start of dates)
          for (const end of dates) {
            if (endsBeforeStart(start, end)) continue;
            const result = eventDates({ start, end, datePrecision: precision, calendar });
            if (result.endDate === undefined) continue;
            expect(firstDay(result.endDate)).toBeGreaterThanOrEqual(firstDay(result.startDate));
            checked += 1;
          }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('JSON-LD payloads', () => {
  it('escapes characters that could close the script element', () => {
    const payload = serializeJsonLd({ name: '</script><b>\u2028\u2029' });
    expect(payload).not.toContain('<');
    expect(payload).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(payload)).toEqual({ name: '</script><b>\u2028\u2029' });
  });

  it('describes an event with its place, coordinates, image, identifiers and parent war', () => {
    const node = eventJsonLd(gaugamela, {
      origin,
      path: '/event/Q188129/',
      superEvent: { id: 'Q1057564', name: 'Wars of Alexander the Great', path: '/war/Q1057564/' },
    });
    expect(node).toMatchObject({
      '@type': 'Event',
      '@id': `${origin}/event/Q188129/#event`,
      name: 'Battle of Gaugamela',
      url: `${origin}/event/Q188129/`,
      startDate: '-0330-09-26',
      description: 'Alexander defeats Darius III.',
      location: {
        '@type': 'Place',
        name: 'Gaugamela',
        sameAs: 'https://www.wikidata.org/wiki/Q1128539',
        geo: { '@type': 'GeoCoordinates', latitude: 36.36, longitude: 43.45 },
      },
      image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gaugamela.jpg?width=1200',
      sameAs: [
        'https://www.wikidata.org/wiki/Q188129',
        'https://en.wikipedia.org/wiki/Battle_of_Gaugamela',
      ],
      superEvent: {
        '@type': 'Event',
        name: 'Wars of Alexander the Great',
        url: `${origin}/war/Q1057564/`,
        sameAs: 'https://www.wikidata.org/wiki/Q1057564',
      },
    });
    expect(node).not.toHaveProperty('endDate');
    expect(node).not.toHaveProperty('subEvent');
  });

  it('omits the location and image when the record has none', () => {
    const node = eventJsonLd(
      { ...gaugamela, coords: undefined, place: undefined, image: undefined },
      { origin, path: '/event/Q188129/', subEvents: [{ id: 'Q1', name: 'Child' }] },
    );
    expect(node).not.toHaveProperty('location');
    expect(node).not.toHaveProperty('image');
    expect(node.subEvent).toEqual([
      { '@type': 'Event', name: 'Child', sameAs: 'https://www.wikidata.org/wiki/Q1' },
    ]);
  });

  it('numbers breadcrumb items from one with absolute URLs', () => {
    expect(
      breadcrumbJsonLd(origin, [
        { name: 'Atlas', path: '/' },
        { name: 'Battle', path: '/event/Q1/' },
      ]),
    ).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Atlas', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Battle', item: `${origin}/event/Q1/` },
      ],
    });
  });

  it('declares one context for a graph of nodes', () => {
    const graph = jsonLdGraph({ '@type': 'Event' }, { '@type': 'BreadcrumbList' });
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph']).toHaveLength(2);
  });

  it('describes the dataset per source without a single licence or raw-file distribution', () => {
    const node = datasetJsonLd({
      origin,
      path: '/about/',
      name: 'HistoryOfAtlas',
      description: 'Dated, geolocated historical events.',
      dateModified: '2026-09-21T06:56:14Z',
      temporalCoverage: [-3500, 2026],
      keywords: ['history'],
      repository: 'https://github.com/example/atlas',
      parts: [
        {
          name: 'Wikidata',
          description: 'Events',
          url: 'https://www.wikidata.org/',
          license: 'https://creativecommons.org/publicdomain/zero/1.0/',
        },
        { name: 'Resources', description: 'Sites', url: `${origin}/about/#sources` },
        { name: 'Religions', description: 'Milestones', url: `${origin}/about/#sources` },
      ],
    });
    expect(node.temporalCoverage).toBe('-3500/2026');
    // Upstream sources only, once each; parts described on the site stay under hasPart.
    expect(node.isBasedOn).toEqual(['https://www.wikidata.org/']);
    expect(node).not.toHaveProperty('license');
    expect(node).not.toHaveProperty('distribution');
    expect(node.hasPart).toEqual([
      {
        '@type': 'Dataset',
        name: 'Wikidata',
        description: 'Events',
        url: 'https://www.wikidata.org/',
        license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
      {
        '@type': 'Dataset',
        name: 'Resources',
        description: 'Sites',
        url: `${origin}/about/#sources`,
      },
      {
        '@type': 'Dataset',
        name: 'Religions',
        description: 'Milestones',
        url: `${origin}/about/#sources`,
      },
    ]);
  });

  it('never links a licence copy under a path robots.txt blocks', () => {
    const node = datasetJsonLd({
      origin,
      path: '/about/',
      name: 'HistoryOfAtlas',
      description: 'Events',
      dateModified: '2026-09-21T06:56:14Z',
      temporalCoverage: [-3500, 2026],
      keywords: [],
      repository: 'https://github.com/example/atlas',
      parts: [
        {
          name: 'Blocked',
          description: 'x',
          url: 'https://a.example/',
          license: `${origin}/geo/L.txt`,
        },
        { name: 'Served', description: 'x', url: 'https://b.example/', license: `${origin}/L.txt` },
      ],
    });
    expect(node.hasPart).toEqual([
      { '@type': 'Dataset', name: 'Blocked', description: 'x', url: 'https://a.example/' },
      {
        '@type': 'Dataset',
        name: 'Served',
        description: 'x',
        url: 'https://b.example/',
        license: `${origin}/L.txt`,
      },
    ]);
  });
});

describe('dataset parts from the licence manifest', () => {
  const datasets: LicenseDataset[] = [
    {
      id: 'wikidata',
      name: 'Wikidata',
      url: 'https://www.wikidata.org/',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      scope: 'Events',
    },
    {
      id: 'natural-earth-coastline-validation',
      name: 'Natural Earth · coastline validation',
      url: 'https://www.naturalearthdata.com/about/terms-of-use/',
      license: 'Public domain',
      licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
      scope: 'Validation mask for event coordinates',
    },
    {
      id: 'geo-historical-basemaps',
      name: 'Historical Basemaps · A. Ourednik et contributeurs',
      url: 'https://github.com/aourednik/historical-basemaps',
      license: 'GPL-3.0-only',
      licenseUrl: '/geo/HISTORICAL-BASEMAPS-LICENSE.txt',
      scope: 'Historical boundary snapshots',
    },
    {
      id: 'geo-natural-earth',
      name: 'Natural Earth',
      url: 'https://www.naturalearthdata.com/',
      license: 'Public domain',
      licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
      scope: 'Coastlines, rivers and physical basemap',
    },
    {
      id: 'project-notes',
      name: 'Project notes',
      url: 'https://notes.example/',
      license: 'CC BY 4.0',
      licenseUrl: '/licences/notes.txt',
      scope: 'Notes',
    },
    {
      id: 'wikipedia',
      name: 'Wikipedia',
      url: 'https://www.wikipedia.org/',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      scope: 'Summaries loaded on demand',
    },
    {
      id: 'wikimedia-commons',
      name: 'Wikimedia Commons',
      url: 'https://commons.wikimedia.org/',
      license: 'Licence stated on each file page',
      licenseUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
      scope: 'Illustrations',
    },
    {
      id: 'font-manrope',
      name: 'Manrope',
      url: 'https://github.com/googlefonts/manrope',
      license: 'SIL Open Font License 1.1',
      licenseUrl: '/fonts/manrope-OFL.txt',
      scope: 'Interface typeface, hosted locally',
    },
  ];

  it('lists each data source once, in English, with a public licence text', () => {
    expect(licenseDatasetParts(datasets, origin)).toEqual([
      {
        name: 'Wikidata',
        description: 'Events',
        url: 'https://www.wikidata.org/',
        license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      },
      {
        name: 'Historical Basemaps · A. Ourednik and contributors',
        description: 'Historical boundary snapshots',
        url: 'https://github.com/aourednik/historical-basemaps',
        license: 'https://www.gnu.org/licenses/gpl-3.0.html',
      },
      {
        name: 'Natural Earth',
        description:
          'Coastlines, rivers and physical basemap. Validation mask for event coordinates',
        url: 'https://www.naturalearthdata.com/',
        license: 'https://www.naturalearthdata.com/about/terms-of-use/',
      },
      {
        name: 'Project notes',
        description: 'Notes',
        url: 'https://notes.example/',
        license: `${origin}/licences/notes.txt`,
      },
    ]);
  });

  it('describes only data sources from the published manifest, with crawlable licences', () => {
    const parts = licenseDatasetParts((licenseManifest as LicenseManifest).datasets, origin);
    const node = datasetJsonLd({
      origin,
      path: '/about/',
      name: 'HistoryOfAtlas',
      description: 'Events',
      dateModified: '2026-09-21T06:56:14Z',
      temporalCoverage: [-3500, 2026],
      keywords: [],
      repository: 'https://github.com/example/atlas',
      parts,
    });
    const names = parts.map((part) => part.name);
    expect(names).toContain('Wikidata');
    expect(names.filter((name) => name.startsWith('Natural Earth'))).toHaveLength(1);
    for (const excluded of ['Cormorant', 'Manrope', 'Wikipedia', 'Wikimedia Commons'])
      expect(names).not.toContain(excluded);
    expect(names.join(' ')).not.toMatch(/ et /);
    for (const part of parts) {
      expect(part.url).toMatch(/^https:\/\//);
      if (part.license) expect(part.license).not.toMatch(/\/(data|geo|glyphs)\//);
    }
    expect(node.isBasedOn).not.toContain('https://www.naturalearthdata.com/about/terms-of-use/');
  });
});
