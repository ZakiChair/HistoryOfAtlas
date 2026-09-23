import { describe, expect, it } from 'vitest';
import type { ResourceSite } from '../../lib/resources/types';
import {
  reconcileResourceSites,
  type ResourceReconciliation,
} from '../../pipeline/resources/reconcile';

const mine: ResourceSite = {
  id: 'canonical',
  name: 'Documented mine',
  coordinates: [1, 2],
  categories: ['copper'],
  sourceId: 'reviewed',
  sourceUrl: 'https://example.com/review',
  sourceYear: 2026,
  periods: [
    { fromYear: 1900, toYear: 1930, sourceUrl: 'https://example.com/history' },
    { fromYear: 1940, toYear: 1950, sourceUrl: 'https://example.com/history' },
  ],
};
const rule: ResourceReconciliation = {
  duplicateId: 'duplicate',
  canonicalId: 'canonical',
  mode: 'replace',
  reason: 'Same mine, independently documented identity.',
  sourceUrl: 'https://example.com/identity',
};

describe('reviewed resource identities', () => {
  it('preserves discovery-only evidence without adding production for its new category', () => {
    const duplicate: ResourceSite = {
      ...mine,
      id: 'duplicate',
      categories: ['gold'],
      periods: [],
      knowledge: [
        {
          fromYear: 1980,
          kind: 'discovery',
          categories: ['gold'],
          sourceUrl: 'https://example.com/discovery',
        },
      ],
    };
    const result = reconcileResourceSites(
      [mine, duplicate],
      [{ ...rule, mode: 'append-observations' }],
    );
    expect(result.sites[0].knowledge).toEqual(duplicate.knowledge);
    expect(result.sites[0].periods.map((period) => period.categories)).toEqual([
      ['copper'],
      ['copper'],
    ]);
    expect(result.sites[0].categories).toEqual(['copper', 'gold']);
  });
  it('replaces a coarse lifetime without filling a documented shutdown or merging a nearby mine', () => {
    const result = reconcileResourceSites(
      [
        mine,
        { ...mine, id: 'duplicate', periods: [{ ...mine.periods[0], toYear: 1950 }] },
        { ...mine, id: 'nearby', name: 'Another mine' },
      ],
      [rule],
    );
    expect(result.sites.map((site) => site.id)).toEqual(['canonical', 'nearby']);
    expect(result.sites[0].periods).toEqual(mine.periods);
    expect(result.matches[0].duplicateName).toBe(mine.name);
  });

  it('adds observed years and their categories without backdating a new co-product or filling gaps', () => {
    const recent: ResourceSite = {
      ...mine,
      id: 'duplicate',
      categories: ['gold'],
      periods: [{ fromYear: 2025, toYear: 2025, sourceUrl: 'https://example.com/2025' }],
    };
    const result = reconcileResourceSites(
      [mine, recent],
      [{ ...rule, mode: 'append-observations' }],
    );
    expect(result.sites[0].periods.map((p) => [p.fromYear, p.toYear, p.categories])).toEqual([
      [1900, 1930, ['copper']],
      [1940, 1950, ['copper']],
      [2025, 2025, ['gold']],
    ]);
  });

  it('limits supplementary history to the reviewed years and fails on stale identities', () => {
    const recent: ResourceSite = {
      ...mine,
      id: 'duplicate',
      categories: ['iron'],
      periods: [{ fromYear: 1800, toYear: 2026, sourceUrl: 'https://example.com/snapshot' }],
    };
    const result = reconcileResourceSites(
      [mine, recent],
      [{ ...rule, mode: 'append-observations', fromYear: 2024 }],
    );
    expect(result.sites[0].periods.at(-1)).toMatchObject({
      fromYear: 2024,
      toYear: 2026,
      categories: ['iron'],
    });
    expect(() => reconcileResourceSites([mine], [rule])).toThrow('Invalid resource reconciliation');
    expect(() => reconcileResourceSites([mine, mine], [])).toThrow('Duplicate input');
    expect(() =>
      reconcileResourceSites(
        [{ ...mine, sourceYear: 2023 }, recent],
        [{ ...rule, mode: 'append-observations' }],
      ),
    ).toThrow('Canonical source is older');
  });
});
