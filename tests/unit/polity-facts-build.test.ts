import { describe, expect, it } from 'vitest';
import { normalizePolityFacts } from '../../pipeline/polities/normalize';
import type { ClaimValue, Entity } from '../../pipeline/normalize';
import { createPolityFactsArtifacts } from '../../pipeline/polities/build';

const snak = <T>(value: T) => ({ snaktype: 'value', datavalue: { value } });
const date = (year: number) => ({
  time: `${year < 0 ? '-' : '+'}${String(Math.abs(year)).padStart(4, '0')}-00-00T00:00:00Z`,
  precision: 9,
  calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
});

describe('offline polity fact publication', () => {
  const registry = {
    version: 1,
    reviewedAt: '2026-09-28',
    mappings: [
      {
        polityId: 'clio-abcd',
        sourceName: 'Historical polity',
        sourceWikidataId: 'Q1',
        subjectId: 'Q1',
        label: { en: 'Historical polity' },
        sources: [{ label: 'Reviewed', url: 'https://example.org/review' }],
      },
    ],
  };
  const extract = {
    version: 1,
    entities: Object.fromEntries(fixture({ P1082: [population('Q1$old', 100, 1800)] })),
  };

  it('publishes only mapped subjects and merges documented ranges without inventing a central value', () => {
    const files = createPolityFactsArtifacts(registry, extract, {
      version: 1,
      subjects: [
        {
          subjectId: 'Q1',
          populations: [
            {
              id: 'seshat:example',
              min: 80,
              max: 120,
              approximate: true,
              date: { date: { year: 1700 }, precision: 'year', calendar: 'unknown' },
              sources: [{ label: 'Source', url: 'https://example.org/research' }],
            },
          ],
        },
      ],
    });
    expect(Object.keys(files).sort()).toEqual(['Q1.json', 'coverage.json', 'index.json']);
    expect(JSON.parse(files['Q1.json']).populations[1]).toMatchObject({ min: 80, max: 120 });
    expect(JSON.parse(files['Q1.json']).populations[1].value).toBeUndefined();
    expect(JSON.parse(files['coverage.json'])).toMatchObject({
      subjects: 1,
      populationStatements: 2,
      subjectsWithPopulation: 1,
    });
  });

  it('fails for missing mapped source subjects or duplicate supplement statement IDs', () => {
    expect(() => createPolityFactsArtifacts(registry, { version: 1, entities: {} })).toThrow();
    const duplicate = {
      id: 'Q1$old',
      value: 1,
      approximate: true,
      sources: [{ label: 'Source', url: 'https://example.org/research' }],
    };
    expect(() =>
      createPolityFactsArtifacts(registry, extract, {
        version: 1,
        subjects: [{ subjectId: 'Q1', populations: [duplicate] }],
      }),
    ).toThrow();
  });
});
const claim = (id: string, value: ClaimValue, qualifiers = {}, rank = 'normal') => ({
  id,
  rank,
  type: 'statement',
  mainsnak: snak(value),
  qualifiers,
  references: [],
});
const population = (id: string, value: number, year?: number, rank = 'normal') =>
  claim(
    id,
    { amount: `+${value}`, unit: '1' },
    year === undefined ? {} : { P585: [snak(date(year))] },
    rank,
  );
const fixture = (claims: Entity['claims']) =>
  new Map<string, Entity>([
    ['Q1', { id: 'Q1', lastrevid: 123, labels: { en: { value: 'Historical polity' } }, claims }],
    ['Q2', { id: 'Q2', labels: { en: { value: 'Capital' }, fr: { value: 'Capitale' } } }],
    [
      'Q3',
      { id: 'Q3', labels: { en: { value: 'population estimation' }, fr: { value: 'estimation' } } },
    ],
  ]);

describe('polity facts source normalization', () => {
  it('retains past normal-rank populations alongside preferred observations and excludes deprecated claims', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({
        P1082: [
          population('Q1$old', 400, 1850),
          population('Q1$latest', 500, 1912, 'preferred'),
          population('Q1$retracted', 900, 1850, 'deprecated'),
        ],
      }),
    );
    expect(result.profile.populations.map((p) => [p.value, p.date?.date.year])).toEqual([
      [400, 1850],
      [500, 1912],
    ]);
  });

  it('keeps same-year alternatives separate and converts Wikibase BCE years', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({
        P1082: [population('Q1$a', 17_000_000, -500), population('Q1$b', 35_000_000, -500)],
      }),
    );
    expect(
      result.profile.populations.map((p) => [p.value, p.date?.date.year, p.min, p.max]),
    ).toEqual([
      [17_000_000, -499, undefined, undefined],
      [35_000_000, -499, undefined, undefined],
    ]);
  });

  it('keeps undated capitals undated and preserves a dated capital interval', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({
        P36: [
          claim('Q1$unknown-period', { id: 'Q2' }),
          claim('Q1$dated', { id: 'Q2' }, { P580: [snak(date(1400))], P582: [snak(date(1450))] }),
        ],
      }),
    );
    expect(result.profile.capitals[0]).toMatchObject({
      city: { id: 'Q2', name: { en: 'Capital', fr: 'Capitale' } },
    });
    expect(result.profile.capitals[0].start).toBeUndefined();
    expect(result.profile.capitals[0].end).toBeUndefined();
    expect(result.profile.capitals[1]).toMatchObject({
      start: { date: { year: 1400 } },
      end: { date: { year: 1450 } },
    });
  });

  it('rejects a subgroup population rather than publishing it as a total', () => {
    const partial = {
      ...population('Q1$partial', 10, 1900),
      qualifiers: { P585: [snak(date(1900))], P518: [snak({ id: 'Q3' })] },
    };
    const result = normalizePolityFacts(
      'Q1',
      fixture({ P1082: [partial, population('Q1$total', 30, 1900)] }),
    );
    expect(result.profile.populations.map((p) => p.value)).toEqual([30]);
    expect(result.rejected).toContainEqual(
      expect.objectContaining({ statementId: 'Q1$partial', reason: 'partial-population-scope' }),
    );
  });

  it('does not flatten a scoped capital into an unrestricted political capital', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({ P36: [claim('Q1$partial-capital', { id: 'Q2' }, { P518: [snak({ id: 'Q3' })] })] }),
    );
    expect(result.profile.capitals).toEqual([]);
    expect(result.rejected).toContainEqual(
      expect.objectContaining({ reason: 'partial-capital-scope' }),
    );
  });

  it('marks a circa capital date as approximate instead of asserting exact temporal applicability', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({
        P36: [
          claim(
            'Q1$circa-capital',
            { id: 'Q2' },
            { P580: [snak(date(1400))], P1480: [snak({ id: 'Q5727902' })] },
          ),
        ],
      }),
    );
    expect(result.profile.capitals[0].start?.approximate).toBe(true);
  });

  it('preserves supplied quantity bounds, undated observations, and method notes', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({
        P1082: [
          claim(
            'Q1$estimate',
            { amount: '+100', lowerBound: '+80', upperBound: '+120', unit: '1' },
            { P459: [snak({ id: 'Q3' })] },
          ),
        ],
      }),
    );
    expect(result.profile.populations[0]).toMatchObject({
      value: 100,
      min: 80,
      max: 120,
      approximate: true,
    });
    expect(result.profile.populations[0].date).toBeUndefined();
    expect(result.profile.populations[0].note?.en).toContain('population estimation');
  });

  it('retains statement revision and bibliographic / imported article provenance', () => {
    const sourceClaim = {
      ...population('Q1$source', 100, 1800),
      references: [
        {
          snaks: {
            P854: [snak('https://example.org/census')],
            P248: [snak({ id: 'Q3' })],
            P4656: [snak('https://fr.wikipedia.org/w/index.php?oldid=22')],
            P143: [snak({ id: 'Q2' })],
          },
        },
      ],
    };
    const { profile } = normalizePolityFacts('Q1', fixture({ P1082: [sourceClaim] }));
    expect(profile.populations[0].sources.map((s) => s.url)).toEqual(
      expect.arrayContaining([
        'https://www.wikidata.org/w/index.php?title=Q1&oldid=123#Q1$source',
        'https://example.org/census',
        'https://www.wikidata.org/wiki/Q3',
        'https://fr.wikipedia.org/w/index.php?oldid=22',
        'https://www.wikidata.org/wiki/Q2',
      ]),
    );
  });

  it('rejects invalid temporal and quantitative assertions without converting them to undated facts', () => {
    const result = normalizePolityFacts(
      'Q1',
      fixture({
        P36: [
          claim(
            'Q1$backwards',
            { id: 'Q2' },
            { P580: [snak(date(1500))], P582: [snak(date(1400))] },
          ),
        ],
        P1082: [
          claim('Q1$bad-time', { amount: '+1', unit: '1' }, { P585: [snak({ time: 'bad' })] }),
          claim('Q1$bad-unit', { amount: '+100', unit: 'http://www.wikidata.org/entity/Q11573' }),
          claim('Q1$negative', { amount: '-1', unit: '1' }),
          claim('Q1$fraction', { amount: '+1.5', unit: '1' }),
          claim(
            'Q1$point-outside',
            { amount: '+100', unit: '1' },
            { P585: [snak(date(1900))], P582: [snak(date(1800))] },
          ),
        ],
      }),
    );
    expect(result.profile.capitals).toEqual([]);
    expect(result.profile.populations).toEqual([]);
    expect(result.rejected).toHaveLength(6);
  });

  it('fails on a missing subject or unresolved capital label instead of silently publishing incomplete facts', () => {
    expect(() => normalizePolityFacts('Q404', fixture({}))).toThrow();
    expect(() =>
      normalizePolityFacts('Q1', fixture({ P36: [claim('Q1$missing', { id: 'Q404' })] })),
    ).toThrow();
  });

  it('retains a capital native label when no English or French translation exists', () => {
    const entities = fixture({ P36: [claim('Q1$native', { id: 'Q2' })] });
    entities.set('Q2', { id: 'Q2', labels: { ru: { value: 'Олтиси' } } });
    const { profile } = normalizePolityFacts('Q1', entities);
    expect(profile.capitals[0].city.name).toEqual({ en: 'Олтиси', ru: 'Олтиси' });
  });
});
