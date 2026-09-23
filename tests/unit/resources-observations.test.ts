import { describe, expect, it } from 'vitest';
import type { ResourceSite, ResourceSource } from '../../lib/resources/types';
import { appendResourceObservations } from '../../pipeline/resources/observations';

const source: ResourceSource = {
  id: 'recent',
  name: 'Recent report',
  url: 'https://example.com/reports',
  license: 'Factual metadata',
  year: 2026,
};
const mine: ResourceSite = {
  id: 'mine',
  name: 'A mine',
  coordinates: [1, 2],
  categories: ['gold'],
  sourceId: 'history',
  sourceUrl: 'https://example.com/history',
  sourceYear: 2020,
  periods: [
    { fromYear: 1900, toYear: 1930, sourceUrl: 'https://example.com/history' },
    { fromYear: 1940, toYear: 1950, sourceUrl: 'https://example.com/history' },
  ],
};
const observation = {
  fromYear: 2026,
  toYear: 2026,
  categories: ['copper' as const],
  sourceUrl: 'https://example.com/2026',
};

describe('recent mine observations', () => {
  it('adds only the observed year and category while preserving coordinates, citations and shutdowns', () => {
    const { sites, applied } = appendResourceObservations(
      [mine],
      [{ siteId: 'mine', periods: [observation] }],
      source,
    );
    expect(sites[0].periods.map((p) => [p.fromYear, p.toYear, p.categories])).toEqual([
      [1900, 1930, ['gold']],
      [1940, 1950, ['gold']],
      [2026, 2026, ['copper']],
    ]);
    expect(sites[0]).toMatchObject({
      coordinates: [1, 2],
      sourceId: 'recent',
      sourceYear: 2026,
      coordinateSourceUrl: mine.sourceUrl,
      categories: ['gold', 'copper'],
    });
    expect(applied).toHaveLength(1);
    expect(mine.categories).toEqual(['gold']);
  });

  it('does not duplicate already attested commodities or replace a more specific coordinate citation', () => {
    const existing = {
      ...mine,
      sourceYear: 2026,
      coordinateSourceUrl: 'https://example.com/position',
      periods: [...mine.periods, { ...observation, categories: ['gold' as const] }],
    };
    const updates = [
      {
        siteId: 'mine',
        periods: [{ ...observation, categories: ['gold' as const, 'copper' as const] }],
      },
    ];
    const first = appendResourceObservations([existing], updates, source);
    expect(first.sites[0].periods.at(-1)?.categories).toEqual(['copper']);
    expect(first.sites[0].coordinateSourceUrl).toBe(existing.coordinateSourceUrl);
    const second = appendResourceObservations(first.sites, updates, source);
    expect(second.applied).toEqual([]);
    expect(second.sites).toEqual(first.sites);
  });

  it('rejects stale identities, inferred intervals, missing categories and future evidence', () => {
    expect(() =>
      appendResourceObservations([mine], [{ siteId: 'missing', periods: [observation] }], source),
    ).toThrow('Unknown');
    for (const period of [
      { ...observation, fromYear: 2025 },
      { ...observation, categories: undefined },
      { ...observation, fromYear: 2027, toYear: 2027 },
    ])
      expect(() =>
        appendResourceObservations([mine], [{ siteId: 'mine', periods: [period] }], source),
      ).toThrow('Invalid annual');
  });
});
