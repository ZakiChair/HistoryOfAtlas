import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CitiesDatasetSchema,
  citiesGeoJSON,
  cityEvidenceInPeriod,
  visibleCities,
  previousPopulationReferences,
  cityObservationYear,
  type CityRecord,
  type CitiesDataset,
} from '@/lib/context/cities';
import { createCitiesDataset } from '@/scripts/build-context-cities';

const source = { label: 'Recorded evidence', url: 'https://www.wikidata.org/wiki/Q1' };
const date = (year: number) => ({
  date: { year },
  precision: 'year' as const,
  calendar: 'gregorian' as const,
});
const mapping = {
  polityId: 'clio-ab12',
  sourceName: 'Test polity',
  subjectId: 'Q1',
  label: { en: 'Test polity' },
  fromYear: 100,
  toYear: 120,
  sources: [source],
};
const city: CityRecord = {
  id: 'Q2',
  name: { en: 'Test city' },
  coordinates: [10, 20],
  coordinateSources: [source],
  coordinateVariantCount: 1,
  capitals: [
    {
      subjectId: 'Q1',
      subjectName: { en: 'Test polity' },
      mappings: [mapping],
      fact: {
        id: 'capital-1',
        city: { id: 'Q2', name: { en: 'Test city' } },
        start: date(105),
        end: date(110),
        sources: [source],
      },
    },
  ],
  populations: [
    { id: 'city-population', value: 1234, date: date(115), approximate: false, sources: [source] },
  ],
};
const dataset: CitiesDataset = {
  version: 1,
  cities: [city],
  territories: [
    {
      subjectId: 'Q1',
      name: { en: 'Test polity' },
      mappings: [mapping],
      populations: [
        {
          id: 'state-population',
          value: 9000000,
          date: date(115),
          approximate: false,
          sources: [source],
        },
      ],
    },
  ],
  coverage: {
    candidateCities: 1,
    mappedCities: 1,
    capitalAssertions: 1,
    excludedCapitalAssertions: 0,
    cityPopulationObservations: 1,
    territoryPopulationObservations: 1,
    rejectedPopulationStatements: 0,
    excludedCities: [],
  },
};
const options = (year: number, range: [number, number] | null = null) => ({
  year,
  range,
  sourceId: 'cliopatria' as const,
});

const curated = {
  version: 1,
  reviewedAt: '2026-10-01',
  license: 'CC-BY-4.0',
  capitals: [
    {
      subjectId: 'Q1',
      polityIds: ['clio-ab12'],
      fact: {
        ...city.capitals[0].fact,
        city: { id: 'Q2', name: { fr: 'Lieu documenté', en: 'Test city' } },
        id: 'context-capital-test',
        start: date(90),
        end: date(130),
        note: { en: 'Institutional chronology.' },
      },
    },
  ],
};
const extract = {
  version: 1,
  entities: {
    Q2: {
      id: 'Q2',
      labels: { en: { value: 'Test city' } },
      claims: {
        P625: [
          {
            id: 'Q2$point',
            mainsnak: {
              datavalue: {
                value: { longitude: 10, latitude: 20, globe: 'http://www.wikidata.org/entity/Q2' },
              },
            },
          },
        ],
      },
    },
  },
};
const profile = {
  version: 1,
  subjectId: 'Q1',
  name: { en: 'Test polity' },
  capitals: [],
  populations: [],
};
const buildCurated = (input: unknown, capitals: CityRecord['capitals'][number]['fact'][] = []) =>
  createCitiesDataset(
    { version: 1, reviewedAt: '2026-10-01', mappings: [mapping] },
    [{ ...profile, capitals }],
    extract,
    new Map(),
    input,
  );

describe('sourced cities and separate territorial demography', () => {
  it.each([
    ['Q170047', 836, 892],
    ['Q179046', 1572, 1585],
    ['Q111905239', 1352, 1767],
    ['Q6580711', 1769, 1782],
    ['Q178663', 1672, 1727],
    ['Q218861', 1636, 1636],
  ] as const)(
    'keeps the published editorial role for %s within source and geometry bounds',
    (id, from, to) => {
      const published = CitiesDatasetSchema.parse(
        JSON.parse(readFileSync('public/data/context/cities.json', 'utf8')),
      );
      const place = published.cities.find((place) => place.id === id)!;
      expect(place).toBeDefined();
      expect(cityEvidenceInPeriod(place, options(from)).capitals).toHaveLength(1);
      expect(cityEvidenceInPeriod(place, options(to)).capitals).toHaveLength(1);
      expect(cityEvidenceInPeriod(place, options(from - 1)).capitals).toEqual([]);
      expect(cityEvidenceInPeriod(place, options(to + 1)).capitals).toEqual([]);
      expect(
        cityEvidenceInPeriod(place, { ...options(from), sourceId: 'historical-basemaps' }).capitals,
      ).toEqual([]);
      expect(
        place.capitals[0].fact.sources.some((source) => !source.url.includes('wikidata.org')),
      ).toBe(true);
      expect(published.editorial?.capitalFactIds).toContain(place.capitals[0].fact.id);
      if (['Q111905239', 'Q6580711', 'Q178663', 'Q218861'].includes(id))
        expect(place.populations).toEqual([]);
    },
  );

  it('keeps Hue’s documented court after 1884 readable without prolonging its territorial identity', () => {
    const published = CitiesDatasetSchema.parse(
      JSON.parse(readFileSync('public/data/context/cities.json', 'utf8')),
    );
    const hue = published.cities.find((place) => place.id === 'Q36167')!;
    const role = hue.capitals.find(({ fact }) => fact.id === 'context-capital-hue-1802-1945')!;
    expect(role.fact.end?.date.year).toBe(1945);
    expect(cityEvidenceInPeriod(hue, options(1884)).capitals).toContainEqual(role);
    expect(cityEvidenceInPeriod(hue, options(1885)).capitals).not.toContainEqual(role);
    expect(cityEvidenceInPeriod(hue, options(1945)).capitals).not.toContainEqual(role);
  });

  it('adds sourced editorial roles only through reviewed mappings without extending their years', () => {
    const result = buildCurated(curated);
    expect(result.cities).toHaveLength(1);
    expect(result.cities[0].name.fr).toBe('Lieu documenté');
    expect(result.cities[0].capitals[0].fact.note?.en).toBe('Institutional chronology.');
    expect(visibleCities(result, options(99))).toEqual([]);
    expect(visibleCities(result, options(100))).toHaveLength(1);
    expect(visibleCities(result, options(120))).toHaveLength(1);
    expect(visibleCities(result, options(121))).toEqual([]);
    expect(visibleCities(result, { ...options(110), sourceId: 'historical-basemaps' })).toEqual([]);
    expect(result.editorial?.license).toBe('CC-BY-4.0');
    expect(result.cities[0].populations).toEqual([]);
  });

  it('replaces a specifically reviewed role without mutating its original profile', () => {
    const original = structuredClone(city.capitals[0].fact);
    const result = buildCurated(
      {
        ...curated,
        capitals: [
          {
            ...curated.capitals[0],
            replacesFactId: original.id,
            fact: { ...curated.capitals[0].fact, start: date(107), end: date(109) },
          },
        ],
      },
      [original],
    );
    expect(result.cities[0].capitals).toHaveLength(1);
    expect(result.cities[0].capitals[0].fact.start?.date.year).toBe(107);
    expect(original.start?.date.year).toBe(105);
    expect(visibleCities(result, options(106))).toEqual([]);
    expect(visibleCities(result, options(107))).toHaveLength(1);
    expect(visibleCities(result, options(110))).toEqual([]);
  });

  it('rejects editorial roles with an unknown mapping, missing replacement, or duplicate identity', () => {
    expect(() =>
      buildCurated({ ...curated, capitals: [{ ...curated.capitals[0], polityIds: ['hb-ab12'] }] }),
    ).toThrow();
    expect(() =>
      buildCurated({
        ...curated,
        capitals: [{ ...curated.capitals[0], replacesFactId: 'missing' }],
      }),
    ).toThrow();
    expect(() =>
      buildCurated({ ...curated, capitals: [curated.capitals[0], curated.capitals[0]] }),
    ).toThrow();
  });

  it('shows capital places only inside both definite capital dates and the reviewed identity', () => {
    expect(visibleCities(dataset, options(106))).toEqual([city]);
    expect(visibleCities(dataset, options(104))).toEqual([]);
    expect(visibleCities(dataset, options(111))).toEqual([]);
    const openCapital = {
      ...city,
      populations: [],
      capitals: [{ ...city.capitals[0], fact: { ...city.capitals[0].fact, end: undefined } }],
    };
    expect(cityEvidenceInPeriod(openCapital, options(106)).capitals).toEqual([]);
    expect(
      cityEvidenceInPeriod(city, { ...options(106), sourceId: 'historical-basemaps' }).capitals,
    ).toEqual([]);
  });

  it('does not interpolate or carry city populations between documented years', () => {
    expect(visibleCities(dataset, options(115))).toEqual([city]);
    expect(visibleCities(dataset, options(114))).toEqual([]);
    expect(visibleCities(dataset, options(116))).toEqual([]);
    expect(visibleCities(dataset, options(114, [114, 115]))).toEqual([city]);
    expect(cityEvidenceInPeriod(city, options(115)).populations[0].value).toBe(1234);
  });

  it('never substitutes a state population into a city marker', () => {
    const feature = citiesGeoJSON(dataset, options(115)).features[0];
    expect(feature.geometry.coordinates).toEqual([10, 20]);
    expect(feature.properties).toMatchObject({
      id: 'Q2',
      kind: 'cities',
      populationCount: 1,
      capitalCount: 0,
    });
    expect(JSON.stringify(feature)).not.toContain('9000000');
  });

  it('does not report a capital where the source dates and identity interval never meet', () => {
    const disjoint = {
      ...city,
      populations: [],
      capitals: [{ ...city.capitals[0], mappings: [{ ...mapping, fromYear: 115, toYear: 120 }] }],
    };
    expect(cityEvidenceInPeriod(disjoint, options(110, [100, 120])).capitals).toEqual([]);
  });

  it('focuses the intersection of source evidence, identity and selected range', () => {
    const restricted = {
      ...city,
      populations: [],
      capitals: [{ ...city.capitals[0], mappings: [{ ...mapping, fromYear: 108, toYear: 120 }] }],
    };
    expect(cityObservationYear(restricted, options(100, [100, 109]))).toBe(108);
  });

  it('only offers actual earlier population references, retaining conflicting observations', () => {
    const facts = [
      { ...city.populations[0], id: 'old', date: date(100) },
      { ...city.populations[0], id: 'other-old', date: date(100), value: 1300 },
      { ...city.populations[0], id: 'future', date: date(120) },
    ];
    expect(previousPopulationReferences(facts, 110).map((fact) => fact.id)).toEqual([
      'old',
      'other-old',
    ]);
    expect(previousPopulationReferences(facts, 90)).toEqual([]);
  });

  it('does not turn the beginning of a later interval into an earlier observation', () => {
    const interval = { ...city.populations[0], date: undefined, start: date(100), end: date(120) };
    expect(previousPopulationReferences([interval], 110)).toEqual([]);
    expect(previousPopulationReferences([interval], 121)).toEqual([interval]);
  });

  it('rejects mismatched subject identities and unsourced city coordinates', () => {
    expect(CitiesDatasetSchema.safeParse(dataset).success).toBe(true);
    expect(
      CitiesDatasetSchema.safeParse({ ...dataset, cities: [{ ...city, coordinateSources: [] }] })
        .success,
    ).toBe(false);
    expect(
      CitiesDatasetSchema.safeParse({
        ...dataset,
        cities: [
          {
            ...city,
            capitals: [
              {
                ...city.capitals[0],
                fact: { ...city.capitals[0].fact, city: { id: 'Q3', name: { en: 'Other city' } } },
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('builds from exact city coordinates and city quantities while accounting for missing locations', () => {
    const result = createCitiesDataset(
      { version: 1, reviewedAt: '2026-09-30', mappings: [mapping] },
      [
        {
          version: 1,
          subjectId: 'Q1',
          name: { en: 'Test polity' },
          capitals: [
            city.capitals[0].fact,
            {
              ...city.capitals[0].fact,
              id: 'missing-location',
              city: { id: 'Q3', name: { en: 'Missing city' } },
            },
          ],
          populations: dataset.territories[0].populations,
        },
      ],
      {
        version: 1,
        entities: {
          Q2: {
            id: 'Q2',
            labels: { en: { value: 'Test city' } },
            claims: {
              P625: [
                {
                  id: 'Q2$coordinate',
                  rank: 'normal',
                  mainsnak: {
                    snaktype: 'value',
                    datavalue: {
                      value: {
                        longitude: 10,
                        latitude: 20,
                        globe: 'http://www.wikidata.org/entity/Q2',
                      },
                    },
                  },
                },
              ],
              P1082: [
                {
                  id: 'Q2$population',
                  rank: 'normal',
                  mainsnak: {
                    snaktype: 'value',
                    datavalue: { value: { amount: '+1234', unit: '1' } },
                  },
                  qualifiers: {
                    P585: [
                      {
                        snaktype: 'value',
                        datavalue: {
                          value: {
                            time: '+0115-00-00T00:00:00Z',
                            precision: 9,
                            calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
                            before: 0,
                            after: 0,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          Q3: { id: 'Q3', labels: { en: { value: 'Missing city' } }, claims: {} },
        },
      },
    );
    expect(result.cities).toHaveLength(1);
    expect(result.cities[0].populations[0].value).toBe(1234);
    expect(result.territories[0].populations[0].value).toBe(9000000);
    expect(result.coverage.excludedCities).toEqual([
      { id: 'Q3', reason: 'missing-valid-earth-coordinate' },
    ]);
  });
});
