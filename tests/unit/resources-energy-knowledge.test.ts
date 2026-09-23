import { describe, expect, it } from 'vitest';
import { normalizeGemSites, type GemRow } from '../../pipeline/resources/normalize';

const field: GemRow = {
  id: 'field',
  name: 'Example Oil and Gas Field (Exampleland)',
  country: 'Exampleland',
  latitude: 12,
  longitude: 34,
  accuracy: 'exact',
  url: 'https://www.gem.wiki/Example',
  status: 'discovered',
  discoveryYear: '1985',
  startYear: '2030',
};

describe('GEM discovered and attested resources', () => {
  it('keeps a past opening as knowledge when an unknown closure prevents a production interval', () => {
    const [mine] = normalizeGemSites(
      [{ ...field, name: 'Coal Mine', status: 'closed', startYear: '1900', endYear: 'unknown' }],
      'gcmt',
    );
    expect(mine.periods).toEqual([]);
    expect(mine.knowledge?.[0]).toMatchObject({
      fromYear: 1900,
      kind: 'attestation',
      categories: ['coal'],
    });
    const [proposal] = normalizeGemSites(
      [{ ...field, name: 'Coal Mine', status: 'proposed', startYear: '1900' }],
      'gcmt',
    );
    expect(proposal.knowledge?.[0].fromYear).toBe(2026);
  });
  it('includes a discovered, unproduced field without converting planned production into exploitation', () => {
    const [site] = normalizeGemSites([field], 'goget');
    expect(site.categories).toEqual(['oil', 'gas']);
    expect(site.periods).toEqual([]);
    expect(site.knowledge).toEqual([
      expect.objectContaining({
        fromYear: 1985,
        kind: 'discovery',
        categories: ['oil', 'gas'],
        approximate: true,
      }),
    ]);
  });

  it('retains discovery of a closed field while leaving its exploitation endpoint intact', () => {
    const [site] = normalizeGemSites(
      [
        {
          ...field,
          name: 'Example Gas Field (Exampleland)',
          status: 'closed',
          startYear: 1990,
          endYear: 2000,
          production: [{ category: 'gas', year: 1998, value: 20 }],
        },
      ],
      'goget',
    );
    expect(site.knowledge?.[0]).toMatchObject({
      fromYear: 1985,
      kind: 'discovery',
      categories: ['gas'],
    });
    expect(site.periods).toEqual([
      expect.objectContaining({ fromYear: 1990, toYear: 2000, categories: ['gas'] }),
    ]);
  });

  it('reads only the terminal GEM fuel designation and never interprets condensate as oil', () => {
    const [gas] = normalizeGemSites(
      [{ ...field, name: 'Oil Company Gas and Condensate Asset (Exampleland)' }],
      'goget',
    );
    expect(gas.categories).toEqual(['gas']);
    expect(
      normalizeGemSites([{ ...field, name: 'Oil Company Unknown Field (Exampleland)' }], 'goget'),
    ).toEqual([]);
  });

  it('does not turn a designated but unproduced fuel into an exploitation period', () => {
    const [site] = normalizeGemSites(
      [
        {
          ...field,
          status: 'operating',
          startYear: 2000,
          production: [
            { category: 'oil', year: 2024, value: 10 },
            { category: 'gas', year: 2024, value: 0 },
          ],
        },
      ],
      'goget',
    );
    expect(site.knowledge?.[0].categories).toEqual(['oil', 'gas']);
    expect(site.periods.every((period) => period.categories?.join() === 'oil')).toBe(true);
  });

  it('uses a source attestation when discovery is missing or future, without backdating a proposal', () => {
    for (const discoveryYear of ['', '2030', 'unknown']) {
      const [site] = normalizeGemSites([{ ...field, discoveryYear }], 'goget');
      expect(site.knowledge?.[0]).toMatchObject({ fromYear: 2026, kind: 'attestation' });
      expect(site.periods).toEqual([]);
    }
    const [coal] = normalizeGemSites(
      [{ ...field, name: 'Example Coal Mine', status: 'proposed' }],
      'gcmt',
    );
    expect(coal.categories).toEqual(['coal']);
    expect(coal.periods).toEqual([]);
    expect(coal.knowledge?.[0]).toMatchObject({
      fromYear: 2026,
      kind: 'attestation',
      categories: ['coal'],
    });
  });

  it('deduplicates geometry copies but retains separate deposit discovery evidence', () => {
    const sites = normalizeGemSites([field, field, { ...field, discoveryYear: '1984' }], 'goget');
    expect(sites).toHaveLength(1);
    expect(sites[0].knowledge?.map((item) => item.fromYear)).toEqual([1985, 1984]);
    expect(normalizeGemSites([{ ...field, accuracy: 'country-level only' }], 'goget')).toEqual([]);
    expect(normalizeGemSites([{ ...field, latitude: 91 }], 'goget')).toEqual([]);
  });
});
