import { describe, expect, it } from 'vitest';
import { resourcesInPeriod } from '../../lib/resources/time';
import { ResourceDatasetSchema, type ResourceDataset } from '../../lib/resources/types';
import { appendResourceKnowledge } from '../../pipeline/resources/knowledge';

const deposit = {
  id: 'discovered-field',
  name: 'Discovered field',
  coordinates: [2, 60] as [number, number],
  categories: ['oil', 'gas'] as ('oil' | 'gas')[],
  sourceId: 'authority',
  sourceUrl: 'https://example.org/field',
  sourceYear: 2026,
  knowledge: [
    {
      fromYear: 1969,
      kind: 'discovery' as const,
      categories: ['oil'] as ('oil' | 'gas')[],
      sourceUrl: 'https://example.org/discovery',
    },
    {
      fromYear: 1980,
      kind: 'attestation' as const,
      categories: ['gas'] as ('oil' | 'gas')[],
      sourceUrl: 'https://example.org/gas',
    },
  ],
  periods: [
    {
      fromYear: 1971,
      toYear: 1975,
      categories: ['oil'] as ('oil' | 'gas')[],
      sourceUrl: 'https://example.org/output',
    },
  ],
};
const dataset: ResourceDataset = {
  version: 1,
  downloadedAt: '2026-09-23',
  description: 'Known resources, separate extraction evidence',
  sources: [
    {
      id: 'authority',
      name: 'Authority',
      year: 2026,
      url: 'https://example.org',
      license: 'Public domain',
    },
  ],
  sites: [deposit],
};

describe('resources known since discovery', () => {
  it('adds an older catalogue attestation without backdating production or losing a newer source', () => {
    const original = {
      ...deposit,
      categories: ['oil'] as const,
      knowledge: [],
      periods: [{ fromYear: 1971, toYear: 1975, sourceUrl: 'https://example.org/output' }],
    };
    const result = appendResourceKnowledge(
      [{ ...original, categories: [...original.categories] }],
      [
        {
          siteId: deposit.id,
          knowledge: [
            {
              fromYear: 2009,
              kind: 'attestation',
              categories: ['gas'],
              sourceUrl: 'https://example.org/catalogue',
            },
          ],
        },
      ],
      { ...dataset.sources[0], year: 2009 },
    );
    expect(result.sites[0].sourceYear).toBe(2026);
    expect(result.sites[0].periods[0].categories).toEqual(['oil']);
    expect(resourcesInPeriod({ ...dataset, sites: result.sites }, 2008)[0].categories).toEqual([
      'oil',
    ]);
    expect(resourcesInPeriod({ ...dataset, sites: result.sites }, 2009)[0].categories).toEqual([
      'oil',
      'gas',
    ]);
    expect(original.periods[0]).not.toHaveProperty('categories');
  });
  it('appears at discovery before production and remains after closure', () => {
    expect(resourcesInPeriod(dataset, 1968)).toEqual([]);
    for (const year of [1969, 1970, 1975, 1976, 2026])
      expect(resourcesInPeriod(dataset, year), String(year)).toHaveLength(1);
    expect(resourcesInPeriod(dataset, 1976)[0].periods).toEqual(deposit.periods);
  });
  it('does not backdate later commodities and evaluates the end of a selected range', () => {
    expect(resourcesInPeriod(dataset, 1979)[0].categories).toEqual(['oil']);
    expect(resourcesInPeriod(dataset, 1980)[0].categories).toEqual(['oil', 'gas']);
    expect(resourcesInPeriod(dataset, 2026, [1960, 1968])).toEqual([]);
    expect(resourcesInPeriod(dataset, 2026, [1968, 1969])[0].categories).toEqual(['oil']);
  });
  it('accepts a discovered deposit with no production, but rejects undated or future evidence', () => {
    const unexploited = { ...dataset, sites: [{ ...deposit, periods: [] }] };
    const parsed = ResourceDatasetSchema.parse(unexploited);
    expect(resourcesInPeriod(parsed, 1970)[0].categories).toEqual(['oil']);
    expect(
      ResourceDatasetSchema.safeParse({
        ...unexploited,
        sites: [{ ...deposit, periods: [], knowledge: [] }],
      }).success,
    ).toBe(false);
    expect(
      ResourceDatasetSchema.safeParse({
        ...unexploited,
        sites: [
          { ...deposit, periods: [], knowledge: [{ ...deposit.knowledge[0], fromYear: 2030 }] },
        ],
      }).success,
    ).toBe(false);
  });
});
