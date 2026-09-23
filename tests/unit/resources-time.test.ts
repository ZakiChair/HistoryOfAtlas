import { describe, expect, it } from 'vitest';
import {
  resourcePeriodMatches,
  exploitedResourcesInPeriod as resourcesInPeriod,
  resourceKnowledge,
} from '../../lib/resources/time';
import type { ResourceDataset, ResourcePeriod } from '../../lib/resources/types';

const period = (fromYear: number, toYear: number): ResourcePeriod => ({
  fromYear,
  toYear,
  sourceUrl: 'https://example.org/exploitation',
});
const dataset: ResourceDataset = {
  version: 1,
  downloadedAt: '2026-09-23',
  description: 'Dated evidence',
  sources: [],
  sites: [
    {
      id: 'mine',
      name: 'Mine',
      coordinates: [12, 34],
      categories: ['copper', 'gold'],
      sourceId: 'history',
      sourceUrl: 'https://example.org',
      sourceYear: 2026,
      periods: [
        { ...period(1846, 1931), categories: ['copper'] },
        { ...period(1937, 1945), categories: ['copper', 'gold'] },
        { ...period(2022, 2022), categories: ['gold'] },
      ],
    },
  ],
};

describe('resource exploitation chronology', () => {
  it('uses production as an attestation, never relabels it as a discovery', () => {
    expect(resourceKnowledge(dataset.sites[0])).toEqual([
      expect.objectContaining({
        fromYear: 1846,
        kind: 'attestation',
        categories: ['copper'],
        approximate: true,
      }),
      expect.objectContaining({
        fromYear: 1937,
        kind: 'attestation',
        categories: ['gold'],
        approximate: true,
      }),
    ]);
  });
  it('includes attested boundary years and never fills shutdowns or extrapolates activity', () => {
    for (const year of [1846, 1900, 1931, 1937, 1945, 2022])
      expect(resourcesInPeriod(dataset, year), String(year)).toHaveLength(1);
    for (const year of [1845, 1932, 1936, 1946, 2021, 2023, 2026])
      expect(resourcesInPeriod(dataset, year), String(year)).toEqual([]);
  });
  it('shows only commodities attested in the chosen period and keeps full source chronology', () => {
    expect(resourcesInPeriod(dataset, 1900)[0].categories).toEqual(['copper']);
    expect(resourcesInPeriod(dataset, 1940)[0].categories).toEqual(['copper', 'gold']);
    expect(resourcesInPeriod(dataset, 2022)[0].categories).toEqual(['gold']);
    expect(resourcesInPeriod(dataset, 1900)[0].periods).toEqual(dataset.sites[0].periods);
    expect(dataset.sites[0].categories).toEqual(['copper', 'gold']);
  });
  it('respects an explicit selected range and handles BCE astronomical years', () => {
    expect(resourcesInPeriod(dataset, 2026, [1932, 1936])).toEqual([]);
    expect(resourcesInPeriod(dataset, 2026, [1930, 1937])[0].categories).toEqual([
      'copper',
      'gold',
    ]);
    expect(resourcePeriodMatches(period(-1699, -899), -1200)).toBe(true);
    expect(resourcePeriodMatches(period(-1699, -899), -1700)).toBe(false);
    expect(resourcePeriodMatches(period(-10, 10), 0)).toBe(true);
  });
});
