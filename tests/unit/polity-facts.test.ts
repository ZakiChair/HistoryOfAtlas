import { describe, expect, it } from 'vitest';
import {
  PolityFactsProfileSchema,
  PolityFactsRegistrySchema,
  factsAtYear,
  parsePolityFacts,
  populationFactsInScope,
  resolveFactsMapping,
  type CapitalFact,
  type FactDate,
  type PolityFactsMapping,
  type PolityFactsProfile,
  type PopulationFact,
} from '../../lib/polity-facts';

// Synthetic assertions test the evidence contract, not historical claims.
const sources = [{ label: 'Synthetic evidence', url: 'https://example.org/evidence' }];
const date = (year: number, extra: Partial<FactDate> = {}): FactDate => ({
  date: { year },
  precision: 'year',
  calendar: 'unknown',
  ...extra,
});
const capital = (id: string, extra: Partial<CapitalFact> = {}): CapitalFact => ({
  id,
  city: { id: 'Q2', name: { en: id, fr: `Ville ${id}` } },
  sources,
  ...extra,
});
const population = (id: string, extra: Partial<PopulationFact> = {}): PopulationFact => ({
  id,
  value: 1000,
  approximate: true,
  sources,
  ...extra,
});
const profile = (extra: Partial<PolityFactsProfile> = {}): PolityFactsProfile => ({
  version: 1,
  subjectId: 'Q1',
  name: { en: 'Synthetic polity' },
  capitals: [],
  populations: [],
  ...extra,
});
const mapping = (extra: Partial<PolityFactsMapping> = {}): PolityFactsMapping => ({
  polityId: 'clio-abcdef',
  sourceName: 'Map name',
  sourceWikidataId: 'Q1',
  subjectId: 'Q1',
  label: { en: 'Synthetic polity' },
  sources,
  ...extra,
});
const registry = (mappings: PolityFactsMapping[]) => ({
  version: 1 as const,
  reviewedAt: '2026-09-28',
  mappings,
});
const ids = (facts: { id: string }[]) => facts.map((fact) => fact.id);

describe('population and capital evidence validation', () => {
  it('rejects a profile borrowed from another political identity', () => {
    expect(parsePolityFacts(profile(), 'Q1').subjectId).toBe('Q1');
    expect(() => parsePolityFacts(profile(), 'Q9')).toThrow();
  });

  it('retains undated evidence, localized labels, zero and documented quantity bounds', () => {
    const result = parsePolityFacts(
      profile({
        capitals: [capital('undated')],
        populations: [population('zero', { value: 0, min: 0, max: 10 })],
      }),
      'Q1',
    );
    expect(result.capitals[0].city.name.fr).toBe('Ville undated');
    expect(result.populations[0]).toMatchObject({ value: 0, min: 0, max: 10 });
    expect(factsAtYear(result, 1800).populations).toEqual([]);
  });

  it('retains a sourced population range without inventing a midpoint', () => {
    const result = parsePolityFacts(
      profile({
        populations: [
          population('range', { value: undefined, min: 1000, max: 2000, date: date(1800) }),
        ],
      }),
      'Q1',
    );
    expect(result.populations[0].value).toBeUndefined();
    expect(factsAtYear(result, 1800).populations[0]).toMatchObject({ min: 1000, max: 2000 });
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({ populations: [population('none', { value: undefined })] }),
      ).success,
    ).toBe(false);
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({ populations: [population('one-bound', { value: undefined, min: 0 })] }),
      ).success,
    ).toBe(false);
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({
          populations: [population('reversed', { value: undefined, min: 2000, max: 1000 })],
        }),
      ).success,
    ).toBe(false);
  });

  it.each([
    { value: -1 },
    { value: 1.5 },
    { value: Number.MAX_SAFE_INTEGER + 1 },
    { min: 1001 },
    { max: 999 },
    { min: -1 },
    { max: Number.POSITIVE_INFINITY },
  ])('rejects unsafe or inconsistent population quantities: %j', (extra) => {
    expect(
      PolityFactsProfileSchema.safeParse(profile({ populations: [population('bad', extra)] }))
        .success,
    ).toBe(false);
  });

  it.each(['javascript:alert(1)', 'data:text/html,bad', 'file:///tmp/reference'])(
    'rejects unsafe evidence URLs: %s',
    (url) => {
      expect(
        PolityFactsProfileSchema.safeParse(
          profile({ capitals: [capital('bad', { sources: [{ label: 'Bad', url }] })] }),
        ).success,
      ).toBe(false);
    },
  );

  it('requires provenance for every fact and mapping', () => {
    expect(
      PolityFactsProfileSchema.safeParse(profile({ capitals: [capital('bad', { sources: [] })] }))
        .success,
    ).toBe(false);
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({ populations: [population('bad', { sources: [] })] }),
      ).success,
    ).toBe(false);
    expect(PolityFactsRegistrySchema.safeParse(registry([mapping({ sources: [] })])).success).toBe(
      false,
    );
  });

  it('rejects reversed intervals and dates incompatible with their precision or calendar', () => {
    for (const bad of [
      capital('reverse', { start: date(100), end: date(0) }),
      capital('missing-day', { at: date(1800, { precision: 'day' }) }),
      capital('invalid-day', {
        at: date(1900, {
          date: { year: 1900, month: 2, day: 29 },
          precision: 'day',
          calendar: 'gregorian',
        }),
      }),
    ])
      expect(PolityFactsProfileSchema.safeParse(profile({ capitals: [bad] })).success).toBe(false);
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({ populations: [population('reverse', { start: date(2000), end: date(1900) })] }),
      ).success,
    ).toBe(false);
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({
          capitals: [
            capital('julian', {
              at: date(1900, {
                date: { year: 1900, month: 2, day: 29 },
                precision: 'day',
                calendar: 'julian',
              }),
            }),
          ],
        }),
      ).success,
    ).toBe(true);
  });

  it('rejects duplicate fact identifiers without removing alternative observations', () => {
    expect(
      PolityFactsProfileSchema.safeParse(
        profile({ populations: [population('same'), population('same')] }),
      ).success,
    ).toBe(false);
    expect(
      parsePolityFacts(profile({ populations: [population('first'), population('second')] }), 'Q1')
        .populations,
    ).toHaveLength(2);
  });
});

describe('reviewed map identity resolution', () => {
  const entity = { id: 'clio-abcdef', name: 'Map name', wikidataId: 'Q1' };

  it('requires the exact map ID, original name and original source QID', () => {
    const review = PolityFactsRegistrySchema.parse(registry([mapping({ subjectId: 'Q9' })]));
    expect(resolveFactsMapping(review, entity, 1800)?.subjectId).toBe('Q9');
    for (const changed of [
      { ...entity, id: 'clio-123456' },
      { ...entity, name: 'Other' },
      { ...entity, wikidataId: 'Q9' },
      { id: entity.id, name: entity.name },
    ]) {
      expect(resolveFactsMapping(review, changed, 1800)).toBeNull();
    }
  });

  it('supports explicitly reviewed Historical Basemaps records without inferring a missing source QID', () => {
    const review = PolityFactsRegistrySchema.parse(
      registry([mapping({ polityId: 'hb-abcdef', sourceWikidataId: undefined })]),
    );
    expect(resolveFactsMapping(review, { id: 'hb-abcdef', name: 'Map name' }, 0)?.subjectId).toBe(
      'Q1',
    );
    expect(
      resolveFactsMapping(review, { id: 'hb-abcdef', name: 'Map name', wikidataId: 'Q1' }, 0),
    ).toBeNull();
  });

  it('selects successive non-overlapping identities using inclusive year bounds', () => {
    const review = PolityFactsRegistrySchema.parse(
      registry([
        mapping({ subjectId: 'Q1', fromYear: -30, toYear: 0 }),
        mapping({ subjectId: 'Q2', fromYear: 1, toYear: 100 }),
      ]),
    );
    expect(resolveFactsMapping(review, entity, -31)).toBeNull();
    expect(resolveFactsMapping(review, entity, 0)?.subjectId).toBe('Q1');
    expect(resolveFactsMapping(review, entity, 1)?.subjectId).toBe('Q2');
    expect(resolveFactsMapping(review, entity, 101)).toBeNull();
  });

  it('rejects overlapping, reversed and duplicate identity intervals', () => {
    for (const entries of [
      [mapping(), mapping()],
      [mapping({ fromYear: 1800, toYear: 1900 }), mapping({ fromYear: 1900, toYear: 2000 })],
      [mapping({ fromYear: 1900, toYear: 1800 })],
    ])
      expect(PolityFactsRegistrySchema.safeParse(registry(entries)).success).toBe(false);
  });

  it('does not resolve an explicitly excluded identity', () => {
    const review = {
      ...registry([mapping()]),
      excluded: [{ polityId: entity.id, reason: 'Ambiguous source identity' }],
    };
    expect(PolityFactsRegistrySchema.safeParse(review).success).toBe(false);
    // Callers cannot bypass an exclusion by forgetting the schema validation.
    expect(resolveFactsMapping(review, entity, 1800)).toBeNull();
  });
});

describe('facts on an annual timeline', () => {
  it('shares inclusive identity bounds with population history without clipping source intervals', () => {
    const data = profile({
      populations: [
        population('before', { date: date(1799) }),
        population('first-year', { date: date(1800) }),
        population('last-year', { date: date(1820) }),
        population('after', { date: date(1821) }),
        population('overlap', { start: date(1790), end: date(1805) }),
        population('earlier-period', { start: date(1780), end: date(1799) }),
        population('outside-endpoint', { start: date(1790) }),
        population('unknown'),
      ],
    });
    const scope = { fromYear: 1800, toYear: 1820 };
    const history = populationFactsInScope(data, scope);
    expect(ids(history)).toEqual(['first-year', 'last-year', 'overlap', 'unknown']);
    expect(history.find((fact) => fact.id === 'overlap')?.start?.date.year).toBe(1790);
    expect(ids(factsAtYear(data, 1800, scope).populations)).toEqual(['first-year', 'overlap']);
    expect(ids(factsAtYear(data, 1810, scope).referencePopulations)).toEqual(['overlap']);
    expect(populationFactsInScope(data)).toHaveLength(8);
  });

  it('keeps both capitals during a documented transition year, including astronomical year zero', () => {
    const data = profile({
      capitals: [
        capital('old', { start: date(-30), end: date(0) }),
        capital('new', { start: date(0), end: date(100) }),
        capital('point', { at: date(0) }),
      ],
    });
    expect(ids(factsAtYear(data, 0).capitals)).toEqual(['old', 'new', 'point']);
    expect(ids(factsAtYear(data, 1).capitals)).toEqual(['new']);
  });

  it('never stretches undated, incomplete, coarse or approximate capital evidence into an annual fact', () => {
    const data = profile({
      capitals: [
        capital('unknown'),
        capital('open-start', { start: date(1800) }),
        capital('open-end', { end: date(1900) }),
        capital('coarse', { at: date(1800, { precision: 'century' }) }),
        capital('approximate', { at: date(1800, { approximate: true }) }),
        capital('approximate-bound', { start: date(1700, { approximate: true }), end: date(1900) }),
      ],
    });
    const result = factsAtYear(data, 1800);
    expect(result.capitals).toEqual([]);
    expect(ids(result.otherCapitals)).toEqual([
      'unknown',
      'open-start',
      'open-end',
      'coarse',
      'approximate',
      'approximate-bound',
    ]);
  });

  it('uses population observations only in their explicit year or bounded period without interpolation', () => {
    const data = profile({
      populations: [
        population('zero', { value: 0, date: date(1800) }),
        population('period', { start: date(1810), end: date(1812) }),
        population('later', { date: date(1820) }),
      ],
    });
    expect(ids(factsAtYear(data, 1800).populations)).toEqual(['zero']);
    expect(ids(factsAtYear(data, 1812).populations)).toEqual(['period']);
    expect(factsAtYear(data, 1813).populations).toEqual([]);
    expect(factsAtYear(data, 1800).referencePopulations).toEqual([]);
  });

  it('retains conflicting exact-year estimates and never selects an undated number', () => {
    const data = profile({
      populations: [
        population('first', { value: 100, date: date(1800) }),
        population('second', { value: 200, date: date(1800) }),
        population('undated', { value: 300 }),
      ],
    });
    expect(ids(factsAtYear(data, 1800).populations)).toEqual(['first', 'second']);
    expect(ids(factsAtYear(data, 1801).referencePopulations)).toEqual(['first', 'second']);
  });

  it('chooses the nearest dated reference group and prefers the earlier year on a tie', () => {
    const data = profile({
      populations: [
        population('later', { date: date(1820) }),
        population('early-a', { date: date(1800) }),
        population('early-b', { date: date(1800) }),
      ],
    });
    expect(ids(factsAtYear(data, 1810).referencePopulations)).toEqual(['early-a', 'early-b']);
    expect(ids(factsAtYear(data, 1811).referencePopulations)).toEqual(['later']);
  });

  it('retains approximate and coarse population dates only as dated references', () => {
    const data = profile({
      populations: [
        population('approximate', { date: date(1800, { approximate: true }) }),
        population('coarse', { date: date(1800, { precision: 'century' }) }),
        population('unknown'),
      ],
    });
    expect(factsAtYear(data, 1800).populations).toEqual([]);
    expect(ids(factsAtYear(data, 1800).referencePopulations)).toEqual(['approximate', 'coarse']);
  });

  it('does not leak reference observations from outside the reviewed identity period', () => {
    const data = profile({
      populations: [
        population('before', { date: date(1799) }),
        population('inside', { date: date(1810) }),
        population('after', { date: date(1821) }),
      ],
    });
    expect(
      ids(factsAtYear(data, 1800, { fromYear: 1800, toYear: 1820 }).referencePopulations),
    ).toEqual(['inside']);
    expect(factsAtYear(data, 1799, { fromYear: 1800, toYear: 1820 }).populations).toEqual([]);
    expect(factsAtYear(data, 1799, { fromYear: 1800, toYear: 1820 }).referencePopulations).toEqual(
      [],
    );
  });
});
