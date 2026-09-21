import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scoreImportance } from '../../pipeline/score';
import { coordinateIssues, validateChronology, isNearLand } from '../../pipeline/validate';
import { parsePoint, dedupeEvents } from '../../pipeline/normalize/helpers';
import {
  classifyRegion,
  normalize,
  sourceBattleMedium,
  scalarQuantity,
  loadEntities,
  sourceExclusion,
  values,
} from '../../pipeline/normalize';
import type { FeatureCollection, Polygon } from 'geojson';
import { publishDirectory } from '../../pipeline/build/publish';
import { verifyIdenticalTrees } from '../../pipeline/build/verify';
import { sourcedRegion } from '../../pipeline/normalize/region';
import { buildWarGroups } from '../../pipeline/build/war-groups';
import type { HistoricalEvent } from '../../lib/schema';
import type { Entity } from '../../pipeline/normalize';

it('publishes a complete generated tree and removes orphan notices without touching sibling files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-publish-'));
  try {
    const output = join(directory, 'data');
    const staging = join(directory, 'next');
    await mkdir(output);
    await mkdir(staging);
    await writeFile(join(output, 'orphan.json'), 'excluded record');
    await writeFile(join(staging, 'retained.json'), 'accepted record');
    await writeFile(join(directory, 'curation.json'), 'editorial selection');
    await publishDirectory(staging, output);
    expect(await readFile(join(output, 'retained.json'), 'utf8')).toBe('accepted record');
    await expect(readFile(join(output, 'orphan.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(join(directory, 'curation.json'), 'utf8')).toBe('editorial selection');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('verifies every published byte and detects extra generated files without replacing the live tree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-verify-'));
  try {
    const published = join(directory, 'published');
    const staging = join(directory, 'staging');
    await mkdir(published);
    await mkdir(staging);
    await writeFile(join(published, 'event.json'), 'source A');
    await writeFile(join(staging, 'event.json'), 'source A');
    expect(await verifyIdenticalTrees(staging, published)).toMatchObject({ files: 1 });
    await writeFile(join(staging, 'event.json'), 'source B');
    await expect(verifyIdenticalTrees(staging, published)).rejects.toThrow('event.json differs');
    expect(await readFile(join(published, 'event.json'), 'utf8')).toBe('source A');
    await writeFile(join(staging, 'orphan.json'), '{}');
    await expect(verifyIdenticalTrees(staging, published)).rejects.toThrow('file lists differ');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('preserves original-language labels and the newer source revision across cached batches', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-labels-'));
  try {
    await writeFile(
      join(directory, 'entities-a.json'),
      JSON.stringify({
        entities: {
          Q1: { id: 'Q1', lastrevid: 20, labels: { ja: { value: '原題' } }, claims: { P31: [] } },
        },
      }),
    );
    await writeFile(
      join(directory, 'entities-b.json'),
      JSON.stringify({
        entities: {
          Q1: {
            id: 'Q1',
            lastrevid: 10,
            labels: {},
            claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q2' } } } }] },
          },
        },
      }),
    );
    const entity = (await loadEntities(directory)).get('Q1')!;
    expect(entity.labels?.ja?.value).toBe('原題');
    expect(entity.lastrevid).toBe(20);
    expect(entity.claims?.P31).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('keeps sourced original titles and multilingual Wikipedia links without inventing translations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-original-title-'));
  try {
    await writeFile(join(directory, 'candidate-ids.json'), JSON.stringify(['Q1']));
    await writeFile(
      join(directory, 'taxonomy.json'),
      JSON.stringify({
        results: {
          bindings: [
            {
              class: { value: 'http://www.wikidata.org/entity/Q178561' },
              root: { value: 'http://www.wikidata.org/entity/Q178561' },
            },
          ],
        },
      }),
    );
    const claim = (value: unknown) => ({ mainsnak: { datavalue: { value } } });
    await writeFile(
      join(directory, 'entities-fixture.json'),
      JSON.stringify({
        entities: {
          Q1: {
            id: 'Q1',
            lastrevid: 20,
            labels: { ja: { value: '原題' } },
            sitelinks: {
              dewiki: { title: 'Deutscher Artikel' },
              eswiki: { title: 'Artículo español' },
              zhwiki: { title: '中文条目' },
              ruwiki: { title: 'Русская статья' },
            },
            claims: {
              P31: [claim({ id: 'Q178561' })],
              P585: [claim({ time: '+2000-01-01T00:00:00Z', precision: 9 })],
              P625: [
                claim({ longitude: 1, latitude: 2, globe: 'http://www.wikidata.org/entity/Q2' }),
              ],
            },
          },
        },
      }),
    );
    const result = await normalize(directory);
    expect(result.rejected).toEqual([]);
    expect(result.events[0]?.name.en).toBe('原題');
    expect(result.events[0]?.nameLanguage).toBe('ja');
    expect(result.events[0]?.sources[0]?.url).toBe('https://www.wikidata.org/wiki/Q1?oldid=20');
    expect(result.events[0]?.wikipedia).toEqual({
      de: `https://de.wikipedia.org/wiki/${encodeURIComponent('Deutscher_Artikel')}`,
      es: `https://es.wikipedia.org/wiki/${encodeURIComponent('Artículo_español')}`,
      zh: `https://zh.wikipedia.org/wiki/${encodeURIComponent('中文条目')}`,
      ru: `https://ru.wikipedia.org/wiki/${encodeURIComponent('Русская_статья')}`,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('sourced military relations', () => {
  const claim = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
  const time = (year: number) => ({
    mainsnak: { datavalue: { value: { time: `+${year}-01-01T00:00:00Z`, precision: 9 } } },
  });
  const entity = (id: string, start?: number, end?: number, parents: string[] = []): Entity => ({
    id,
    claims: {
      P31: [claim('Q198')],
      P361: parents.map(claim),
      ...(start ? { P580: [time(start)] } : {}),
      ...(end ? { P582: [time(end)] } : {}),
    },
  });
  const event = (id: string, start = 2000, end?: number): HistoricalEvent => ({
    id,
    type: 'battle',
    name: { en: 'Test event' },
    start: { year: start },
    ...(end ? { end: { year: end } } : {}),
    coords: [0, 0],
    belligerents: [],
    importance: 50,
    era: '20th-century',
    region: 'global',
    sources: [{ label: 'Test fixture', url: `https://www.wikidata.org/wiki/${id}` }],
    datePrecision: 'year',
  });
  const classes = new Set(['Q198']);
  it('keeps sourced multi-parent and inverse P527 membership while quarantining cyclic edges', () => {
    const entities = new Map([
      ['Q11', entity('Q11', 2000, 2000, ['Q21', 'Q22'])],
      ['Q12', entity('Q12', 2000, 2000)],
      ['Q21', entity('Q21', 1990, 2010, ['Q31'])],
      ['Q22', entity('Q22', 1990, 2010)],
      [
        'Q23',
        {
          ...entity('Q23', 1990, 2010),
          claims: { ...entity('Q23', 1990, 2010).claims, P527: [claim('Q12')] },
        },
      ],
      ['Q31', entity('Q31', 1990, 2010, ['Q21'])],
    ]);
    const result = buildWarGroups([event('Q11'), event('Q12')], entities, classes);
    expect(result.wars.has('Q31')).toBe(false);
    expect(result.wars.get('Q21')?.map((entry) => entry.id)).toEqual(['Q11']);
    expect(result.wars.get('Q22')?.map((entry) => entry.id)).toEqual(['Q11']);
    expect(result.wars.get('Q23')?.map((entry) => entry.id)).toEqual(['Q12']);
    expect(
      result.rejected.filter((entry) => entry.reason === 'cyclic-military-relation'),
    ).toHaveLength(2);
  });
  it('rejects a child extending beyond a parent even if their intervals overlap', () => {
    const entities = new Map([
      ['Q11', entity('Q11', 1792, 1815, ['Q21', 'Q22'])],
      ['Q21', entity('Q21', 1792, 1802)],
      ['Q22', entity('Q22', 1803, 1815)],
    ]);
    const result = buildWarGroups([event('Q11', 1792, 1815)], entities, classes);
    expect(result.wars.size).toBe(0);
    expect(result.rejected.map((entry) => entry.reason).sort()).toEqual([
      'child-ends-after-parent',
      'child-starts-before-parent',
    ]);
  });
  it('quarantines an undated parent and preserves valid partial-year overlap', () => {
    const entities = new Map([
      ['Q11', entity('Q11', 2000, 2000, ['Q21', 'Q22'])],
      ['Q21', entity('Q21')],
      ['Q22', entity('Q22', 2000, 2000)],
    ]);
    const child = {
      ...event('Q11'),
      start: { year: 2000, month: 12, day: 1 },
      datePrecision: 'day' as const,
    };
    const result = buildWarGroups([child], entities, classes);
    expect(result.wars.has('Q21')).toBe(false);
    expect(result.wars.get('Q22')).toEqual([child]);
    expect(result.rejected[0]?.reason).toBe('parent-without-source-date');
  });
  it('does not reuse a parent whose source record already failed schema validation', () => {
    const entities = new Map([
      ['Q11', entity('Q11', 2000, 2000, ['Q21'])],
      ['Q21', entity('Q21', 1990, 2010)],
    ]);
    const result = buildWarGroups([event('Q11')], entities, classes, new Set(['Q21']));
    expect(result.wars.size).toBe(0);
    expect(result.rejected[0]?.reason).toBe('invalid-parent-record');
  });
  it('checks each original event against every ancestor despite an open-ended intermediate group', () => {
    const entities = new Map([
      ['Q11', entity('Q11', 2021, 2021, ['Q21'])],
      ['Q21', entity('Q21', 1946, undefined, ['Q31'])],
      ['Q31', entity('Q31', 1945, 1991)],
    ]);
    const result = buildWarGroups([event('Q11', 2021)], entities, classes);
    expect(result.wars.has('Q21')).toBe(true);
    expect(result.wars.has('Q31')).toBe(false);
    expect(result.rejected.some((entry) => entry.eventId === 'Q11' && entry.parent === 'Q31')).toBe(
      true,
    );
  });
});

describe('historical ingestion quality gates', () => {
  it('excludes reviewed hypothetical events without treating a real false alarm as fiction', () => {
    expect(sourceExclusion({ id: 'Q4872153' })).toBe('hypothetical-event');
    expect(
      sourceExclusion({
        id: 'Q1066650',
        descriptions: { fr: { value: 'tirs en réponse à une invasion fictive' } },
      }),
    ).toBeUndefined();
  });
  it('does not present scoped, ranged, or competing source quantities as an exact total', () => {
    const quantity = (amount: string, extra = {}) => ({
      rank: 'normal',
      mainsnak: { datavalue: { value: { amount, unit: '1', ...extra } } },
    });
    expect(scalarQuantity({ id: 'Q1', claims: { P1120: [quantity('+50')] } }, 'P1120')).toBe(50);
    expect(
      scalarQuantity({ id: 'Q1', claims: { P1120: [quantity('+50'), quantity('+60')] } }, 'P1120'),
    ).toBeUndefined();
    expect(
      scalarQuantity(
        {
          id: 'Q1',
          claims: { P1120: [quantity('+50', { lowerBound: '+40', upperBound: '+60' })] },
        },
        'P1120',
      ),
    ).toBeUndefined();
    expect(
      scalarQuantity(
        { id: 'Q1', claims: { P1120: [{ ...quantity('+50'), qualifiers: { P710: [] } }] } },
        'P1120',
      ),
    ).toBeUndefined();
  });
  it('uses explicit sourced naval descriptions without treating every naval war as a naval battle', () => {
    expect(
      sourceBattleMedium({ id: 'Q1', descriptions: { en: { value: '1776 naval battle' } } }),
    ).toBe('naval');
    expect(
      sourceBattleMedium({
        id: 'Q2',
        descriptions: { fr: { value: 'bataille de la guerre navale franco-britannique' } },
      }),
    ).toBeUndefined();
    expect(
      sourceBattleMedium({
        id: 'Q3',
        claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q9173759' } } } }] },
      }),
    ).toBe('air');
  });
  it('rejects malformed, non-finite and out-of-range coordinates', () => {
    expect(coordinateIssues([181, 30])).toEqual(['invalid-longitude']);
    expect(coordinateIssues([5, -91])).toEqual(['invalid-latitude']);
    expect(coordinateIssues([Number.NaN, 30])).toEqual(['invalid-longitude']);
    expect(coordinateIssues([5, 30])).toEqual([]);
  });
  it('rejects an end before a beginning across astronomical year zero', () => {
    expect(validateChronology({ year: 0, month: 4 }, { year: -1, month: 5 })).toEqual([
      'end-before-start',
    ]);
    expect(validateChronology({ year: -1 }, { year: 0 })).toEqual([]);
  });
  it('does not turn an imprecise end year into an invented January first', () => {
    expect(validateChronology({ year: 2000, month: 6, day: 10 }, { year: 2000 })).toEqual([]);
    expect(validateChronology({ year: 2000, month: 6, day: 10 }, { year: 2000, month: 6 })).toEqual(
      [],
    );
    expect(validateChronology({ year: 2000, month: 7 }, { year: 2000, month: 6 })).toEqual([
      'end-before-start',
    ]);
  });
  it('preserves islands and near-coastal sites but detects open ocean', () => {
    const land: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(isNearLand([0.5, 0.5], land)).toBe(true);
    expect(isNearLand([1.05, 0.5], land)).toBe(true);
    expect(isNearLand([90, -30], land)).toBe(false);
  });
  it('recognizes a small island inside the coastal tolerance, not just on a sampled circle', () => {
    const land: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0.01, 0],
                [0.01, 0.01],
                [0, 0.01],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(isNearLand([0.1, 0.005], land)).toBe(true);
  });
  it('checks coasts across the antimeridian', () => {
    const land: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [179.9, 0],
                [180, 0],
                [180, 0.1],
                [179.9, 0.1],
                [179.9, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(isNearLand([-179.99, 0.05], land)).toBe(true);
  });
  it('parses longitude first and rejects unsupported WKT', () => {
    expect(parsePoint('Point(-12.25 40.5)')).toEqual([-12.25, 40.5]);
    expect(parsePoint('Polygon((1 2))')).toBeUndefined();
  });
  it('deduplicates only by Wikidata identity, never by similar names', () => {
    const entries = [
      { id: 'Q1', importance: 20 },
      { id: 'Q2', importance: 30 },
      { id: 'Q1', importance: 40 },
    ];
    expect(dedupeEvents(entries)).toEqual([
      { id: 'Q1', importance: 40 },
      { id: 'Q2', importance: 30 },
    ]);
  });
  it('does not misclassify Pacific islands as South America or Alaska as Oceania', () => {
    expect(classifyRegion([-170, -14])).toBe('oceania');
    expect(classifyRegion([-155, 20])).toBe('oceania');
    expect(classifyRegion([-155, 65])).toBe('north-america');
    expect(classifyRegion([45, 25])).toBe('middle-east');
    expect(classifyRegion([145, -6])).toBe('oceania');
  });
  it('uses the sourced geographic region where the fallback rectangle is ambiguous', () => {
    const regions: FeatureCollection<Polygon, { CONTINENT: string }> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { CONTINENT: 'North America' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-80, 8],
                [-79, 8],
                [-79, 9],
                [-80, 9],
                [-80, 8],
              ],
            ],
          },
        },
      ],
    };
    expect(classifyRegion([-79.5, 8.5])).toBe('south-america');
    expect(sourcedRegion([-79.5, 8.5], regions)).toBe('north-america');
  });
  it('honors preferred Wikidata statements and omits deprecated claims', () => {
    const item = {
      id: 'Q1',
      claims: {
        P31: [
          { rank: 'deprecated', mainsnak: { datavalue: { value: { id: 'Q2' } } } },
          { rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q3' } } } },
          { rank: 'preferred', mainsnak: { datavalue: { value: { id: 'Q4' } } } },
        ],
      },
    };
    expect(values(item, 'P31')).toEqual([{ id: 'Q4' }]);
  });
});

describe('importance expresses visibility, not human value', () => {
  it('is bounded and rewards source coverage and editorial inclusion', () => {
    expect(scoreImportance({ sitelinks: 0, curated: false, parentSize: 0 })).toBeGreaterThanOrEqual(
      0,
    );
    expect(
      scoreImportance({ sitelinks: 10000, curated: true, parentSize: 10000, strength: 100000000 }),
    ).toBeLessThanOrEqual(100);
    expect(scoreImportance({ sitelinks: 30, curated: true, parentSize: 0 })).toBeGreaterThan(
      scoreImportance({ sitelinks: 30, curated: false, parentSize: 0 }),
    );
    expect(scoreImportance({ sitelinks: 50, curated: false, parentSize: 0 })).toBeGreaterThan(
      scoreImportance({ sitelinks: 5, curated: false, parentSize: 0 }),
    );
  });
});

it.each([
  ['Q124042044', 'hypothetical-event'],
  ['Q26913948', 'legendary-event'],
])(
  'does not publish nonhistorical class %s merely because it inherits a requested root',
  async (classId, reason) => {
    const directory = await mkdtemp(join(tmpdir(), 'atlas-ingestion-'));
    try {
      await writeFile(join(directory, 'candidate-ids.json'), JSON.stringify(['Q1']));
      await writeFile(
        join(directory, 'taxonomy.json'),
        JSON.stringify({
          results: {
            bindings: [
              {
                class: { value: `http://www.wikidata.org/entity/${classId}` },
                root: { value: 'http://www.wikidata.org/entity/Q198' },
              },
            ],
          },
        }),
      );
      await writeFile(
        join(directory, 'entities-fixture.json'),
        JSON.stringify({
          entities: {
            Q1: {
              id: 'Q1',
              labels: { en: { value: 'Scenario fixture' } },
              claims: { P31: [{ mainsnak: { datavalue: { value: { id: classId } } } }] },
            },
          },
        }),
      );
      const result = await normalize(directory);
      expect(result.events).toEqual([]);
      expect(result.rejected).toEqual([{ id: 'Q1', reasons: [reason] }]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
