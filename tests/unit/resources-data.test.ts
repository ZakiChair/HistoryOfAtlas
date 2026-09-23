import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ResourceDatasetSchema, ResourcePeriodSchema } from '../../lib/resources/types';
import { normalizeGemSites, normalizeMineralSites } from '../../pipeline/resources/normalize';
import { normalizeSodirSites, reconcileNorwegianFields } from '../../pipeline/resources/sodir';
import { exploitedResourcesInPeriod as resourcesInPeriod } from '../../lib/resources/time';

describe('resource source normalization', () => {
  it('excludes country centroids and unknown fuel names, preserving mixed fields', () => {
    const rows = [
      {
        id: '1',
        name: 'Example Oil and Gas Field',
        latitude: 12,
        longitude: 34,
        accuracy: 'exact',
        country: 'Example',
        url: 'https://www.gem.wiki/Example',
        status: 'operating',
      },
      {
        id: '2',
        name: 'Example Oil Field',
        latitude: 12,
        longitude: 34,
        accuracy: 'country-level only',
        country: 'Example',
        url: 'https://www.gem.wiki/Example',
        status: 'operating',
      },
      {
        id: '3',
        name: 'Example Field',
        latitude: 12,
        longitude: 34,
        accuracy: 'exact',
        country: 'Example',
        url: 'https://www.gem.wiki/Example',
        status: 'operating',
      },
      {
        id: '4',
        name: 'Example Oil Field',
        latitude: 12,
        longitude: 34,
        accuracy: 'exact',
        country: 'Example',
        url: 'https://www.gem.wiki/Example',
        status: 'not found',
      },
    ];
    expect(
      normalizeGemSites(
        rows.map((row) => ({
          ...row,
          production:
            row.id === '3'
              ? []
              : [
                  { category: 'oil' as const, year: '2022', value: 4 },
                  { category: 'gas' as const, year: '2024', value: 8 },
                ],
        })),
        'goget',
      ),
    ).toEqual([
      expect.objectContaining({ id: 'goget:1', coordinates: [34, 12], categories: ['oil', 'gas'] }),
      expect.objectContaining({ id: 'goget:4', categories: ['oil'], periods: [] }),
    ]);
  });

  it('deduplicates coal mine geometry records and rejects missing or invalid coordinates', () => {
    const row = {
      id: '1',
      name: 'Example Coal Mine',
      latitude: 12,
      longitude: 34,
      accuracy: '',
      country: 'Example',
      url: 'https://www.gem.wiki/Example',
      status: 'closed',
      startYear: '1980',
      endYear: '2000',
    };
    const sites = normalizeGemSites(
      [row, row, { ...row, id: '2', latitude: 91 }, { ...row, id: '3', longitude: null }],
      'gcmt',
    );
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ categories: ['coal'], accuracy: 'unknown' });
  });

  it('excludes undated USGS occurrences instead of inventing exploitation periods', () => {
    const sites = normalizeMineralSites([
      {
        id: '1',
        name: 'Example',
        latitude: 1,
        longitude: 2,
        country: 'Example',
        commodities: ['Cu', 'Au', 'unknown'],
      },
      {
        id: '2',
        name: 'Example Gold-like Name',
        latitude: 1,
        longitude: 2,
        country: 'Example',
        commodities: ['clay'],
      },
    ]);
    expect(sites).toHaveLength(0);
  });

  it('links a mine without a wiki page to its official dataset without inventing a page', () => {
    for (const url of ['', 'Coal Mine - Global Energy Monitor']) {
      const sites = normalizeGemSites(
        [
          {
            id: '1',
            name: 'Mine',
            latitude: 1,
            longitude: 2,
            country: 'Example',
            accuracy: '',
            url,
            status: 'closed',
            startYear: '1980',
            endYear: '2000',
          },
        ],
        'gcmt',
      );
      expect(sites[0]?.sourceUrl).toBe(
        'https://globalenergymonitor.org/projects/global-coal-mine-tracker',
      );
    }
  });
});

describe('resource exploitation evidence', () => {
  const mine = {
    id: '1',
    name: 'Example Coal Mine',
    country: 'Example',
    latitude: 1,
    longitude: 2,
    accuracy: '',
    url: 'https://example.com',
    status: 'operating',
  };

  it('keeps operating mines visible from their published opening through the dated snapshot, never a future closure', () => {
    const sites = normalizeGemSites(
      [
        {
          ...mine,
          startYear: '1811',
          endYear: '2039',
          production: [{ category: 'coal', year: '2024', value: '0.1' }],
        },
      ],
      'gcmt',
    );
    expect(sites[0].periods).toEqual([
      expect.objectContaining({ fromYear: 1811, toYear: 2026, approximate: true }),
    ]);
    expect(
      normalizeGemSites([{ ...mine, startYear: '1811', endYear: '2039' }], 'gcmt')[0].periods,
    ).toEqual([expect.objectContaining({ fromYear: 1811, toYear: 2026, approximate: true })]);
  });

  it('retains published past mine opening/closure bounds, and rejects future or ambiguous bounds', () => {
    expect(
      normalizeGemSites(
        [{ ...mine, status: 'closed', startYear: '1900', endYear: '2015' }],
        'gcmt',
      )[0].periods,
    ).toEqual([expect.objectContaining({ fromYear: 1900, toYear: 2015 })]);
    for (const endYear of ['2039', '2015/2016', 'unknown'])
      expect(
        normalizeGemSites([{ ...mine, status: 'closed', startYear: '1900', endYear }], 'gcmt')[0]
          .periods,
      ).toEqual([]);
  });

  it('keeps fuel starts separate and removes explicit zero years from operating-life estimates', () => {
    const row = {
      ...mine,
      name: 'Example Oil and Gas Field',
      production: [
        { category: 'oil' as const, year: '1990', value: 2 },
        { category: 'gas' as const, year: '2024', value: 3 },
        { category: 'oil' as const, year: '2025', value: 0 },
        { category: 'oil' as const, year: '2030', value: 50 },
      ],
    };
    const site = normalizeGemSites([row], 'goget')[0];
    const fuels = (year: number) =>
      [
        ...new Set(
          site.periods
            .filter((period) => period.fromYear <= year && period.toYear >= year)
            .flatMap((period) => period.categories ?? []),
        ),
      ].sort();
    expect(fuels(1989)).toEqual([]);
    expect(fuels(2023)).toEqual(['oil']);
    expect(fuels(2024)).toEqual(['gas', 'oil']);
    expect(fuels(2025)).toEqual(['gas']);
    expect(fuels(2027)).toEqual([]);
    expect(normalizeGemSites([{ ...row, status: 'in-development' }], 'goget')[0].periods).toEqual(
      [],
    );
  });

  it('uses a published production start for an operating field with one attested fuel', () => {
    const sites = normalizeGemSites(
      [
        {
          ...mine,
          name: 'Rumaila Oil Field (Iraq)',
          startYear: '1954',
          production: [{ category: 'oil', year: 2022, value: 518.3 }],
        },
      ],
      'goget',
    );
    expect(sites[0].periods).toEqual([
      expect.objectContaining({
        fromYear: 1954,
        toYear: 2026,
        categories: ['oil'],
        approximate: true,
      }),
    ]);
  });

  it('does not backdate a later fuel in a mixed field to the field opening', () => {
    const site = normalizeGemSites(
      [
        {
          ...mine,
          startYear: '1954',
          production: [
            { category: 'oil', year: 2000, value: 1 },
            { category: 'gas', year: 2024, value: 2 },
          ],
        },
      ],
      'goget',
    )[0];
    expect(
      site.periods
        .filter((period) => period.fromYear <= 2023 && period.toYear >= 2023)
        .flatMap((period) => period.categories ?? []),
    ).toEqual(['oil']);
    expect(site.periods.every((period) => period.fromYear >= 2000)).toBe(true);
  });

  it('does not project mothballed or closed assets to the snapshot without an operating attestation', () => {
    for (const status of ['mothballed', 'closed']) {
      const site = normalizeGemSites(
        [
          {
            ...mine,
            status,
            startYear: '1980',
            production: [{ category: 'coal', year: 2000, value: 1 }],
          },
        ],
        'gcmt',
      )[0];
      expect(Math.max(...site.periods.map((period) => period.toYear))).toBe(2000);
    }
  });

  it('keeps an undated operating coal mine only at its status attestation, and rejects future starts', () => {
    expect(normalizeGemSites([mine], 'gcmt')[0].periods).toEqual([
      expect.objectContaining({ fromYear: 2026, toYear: 2026, categories: ['coal'] }),
    ]);
    expect(normalizeGemSites([{ ...mine, startYear: '2030' }], 'gcmt')[0].periods).toEqual([]);
  });

  it('does not fill an explicit zero-production year even inside a published closed-mine lifetime', () => {
    const site = normalizeGemSites(
      [
        {
          ...mine,
          status: 'closed',
          startYear: '1980',
          endYear: '2000',
          production: [{ category: 'coal', year: 1990, value: 0 }],
        },
      ],
      'gcmt',
    )[0];
    expect(site.periods.map((period) => [period.fromYear, period.toYear])).toEqual([
      [1980, 1989],
      [1991, 2000],
    ]);
  });

  it('rejects backwards periods', () => {
    expect(
      ResourcePeriodSchema.safeParse({
        fromYear: 2000,
        toYear: 1900,
        sourceUrl: 'https://example.com',
      }).success,
    ).toBe(false);
  });
});

describe('Norwegian annual production records', () => {
  const fields = [
    {
      id: '1',
      name: 'EXAMPLE',
      url: 'https://factpages.sodir.no/field/pageview/all/1',
      latitude: 60,
      longitude: 2,
    },
  ];
  it('merges only adjacent observed years with the same fuel categories', () => {
    const sites = normalizeSodirSites(fields, [
      { id: '1', name: 'EXAMPLE', year: 1996, oil: 1, gas: 0 },
      { id: '1', name: 'EXAMPLE', year: 1997, oil: 1, gas: 0 },
      { id: '1', name: 'EXAMPLE', year: 1998, oil: 0, gas: 0 },
      { id: '1', name: 'EXAMPLE', year: 2001, oil: 1, gas: 1 },
      { id: '1', name: 'EXAMPLE', year: 2030, oil: 1, gas: 1 },
    ]);
    expect(
      sites[0].periods.map((period) => [period.fromYear, period.toYear, period.categories]),
    ).toEqual([
      [1996, 1997, ['oil']],
      [2001, 2001, ['oil', 'gas']],
    ]);
  });

  it('supersedes a GEM duplicate only with matching country, official name and coherent geography', () => {
    const sodir = normalizeSodirSites(fields, [
      { id: '1', name: 'EXAMPLE', year: 2000, oil: 1, gas: 0 },
    ]);
    const gem = {
      ...sodir[0],
      id: 'goget:1',
      sourceId: 'gem-goget',
      name: 'Example Oil and Gas Field (Norway)',
    };
    const result = reconcileNorwegianFields(
      [
        gem,
        { ...gem, id: 'goget:2', name: 'Other Oil Field (Norway)' },
        { ...gem, id: 'goget:3', coordinates: [50, 0] as [number, number] },
      ],
      sodir,
    );
    expect(result.sites.map((site) => site.id)).toEqual(['goget:2', 'goget:3']);
    expect(result.matches).toHaveLength(1);
  });
});

describe('published resource data', () => {
  const published = ResourceDatasetSchema.parse(
    JSON.parse(readFileSync('public/data/resources/sites.json', 'utf8')),
  );

  it('covers non-fossil minerals globally and Mali in the relevant historical eras', () => {
    const minerals = published.sites.filter((site) =>
      site.categories.some((c) => !['oil', 'gas', 'coal'].includes(c)),
    );
    expect(minerals.length).toBeGreaterThan(1700);
    expect(new Set(minerals.map((site) => site.country)).size).toBeGreaterThan(75);
    const medieval = resourcesInPeriod(published, 1324).map((site) => site.id);
    expect(medieval).toEqual(expect.arrayContaining(['west-africa:bambuk', 'west-africa:bure']));
    expect(medieval).not.toContain('west-africa:fekola');
    const modern = resourcesInPeriod(published, 2025).map((site) => site.id);
    expect(modern).toEqual(
      expect.arrayContaining([
        'west-africa:fekola',
        'west-africa:loulo',
        'west-africa:gounkoto',
        'west-africa:syama',
        'west-africa:sadiola',
      ]),
    );
    const currentMali = resourcesInPeriod(published, 2026)
      .filter((site) => site.country === 'Mali')
      .map((site) => site.id);
    expect(currentMali).toEqual(
      expect.arrayContaining([
        'west-africa:loulo',
        'west-africa:gounkoto',
        'west-africa:fekola',
        'west-africa:syama',
        'west-africa:sadiola',
        'west-africa:nampala',
      ]),
    );
  });

  it('keeps suspended mines and later co-products out of the wrong years after source reconciliation', () => {
    const suspended = resourcesInPeriod(published, 2019).map((site) => site.id);
    for (const id of [
      'west-africa:sadiola',
      'west-africa:yatela',
      'west-africa:morila',
      'west-africa:kalana',
    ])
      expect(suspended).not.toContain(id);
    expect(resourcesInPeriod(published, 1979).some((site) => site.id === 'historical:idrija')).toBe(
      false,
    );
    expect(resourcesInPeriod(published, 1984).some((site) => site.id === 'historical:idrija')).toBe(
      true,
    );
    const kiruna = (year: number) =>
      resourcesInPeriod(published, year).find(
        (site) => site.id === 'historical:kiruna-kiirunavaara-iron-mine',
      );
    expect(kiruna(1986)?.categories).toEqual(['iron', 'phosphate']);
    expect(kiruna(2026)?.categories).toEqual(['iron']);
    expect(
      published.sites.some((site) => ['gem-giomt:P100000128628', 'mincan:772'].includes(site.id)),
    ).toBe(false);
  });

  it('is a global set of dated exploitation evidence with source-backed sites', () => {
    const dataset = ResourceDatasetSchema.parse(
      JSON.parse(readFileSync('public/data/resources/sites.json', 'utf8')),
    );
    expect(dataset.sites.length).toBeGreaterThan(5000);
    expect(new Set(dataset.sites.map((site) => site.country)).size).toBeGreaterThan(70);
    expect(dataset.sites.every((site) => site.periods.length > 0 || !!site.knowledge?.length)).toBe(
      true,
    );
    expect(
      dataset.sites.find((site) => site.name.startsWith('Rumaila Oil Field'))?.coordinates,
    ).toEqual([47.3528, 30.5913]);
    expect(dataset.sites.find((site) => site.id === 'gcmt:M0056')).toMatchObject({
      coordinates: [148.950644, -23.406874],
      coordinateSourceUrl:
        'https://linkeddata.pid.geoscience.gov.au/collections/mi/items/333308?f=json',
    });
  });

  it('preserves real shutdowns, archaeology uncertainty and fuel-specific production years', () => {
    const dataset = ResourceDatasetSchema.parse(
      JSON.parse(readFileSync('public/data/resources/sites.json', 'utf8')),
    );
    const yme = dataset.sites.find((site) => site.id === 'sodir:43807' || site.name === 'YME');
    expect(yme?.periods.map(({ fromYear, toYear }) => [fromYear, toYear])).toEqual([
      [1996, 2001],
      [2021, 2026],
    ]);
    const ranger = dataset.sites.find((site) => site.name === 'Ranger');
    expect(ranger?.periods.map(({ fromYear, toYear }) => [fromYear, toYear])).toEqual([
      [1981, 1994],
      [1997, 2012],
    ]);
    expect(
      dataset.sites.find((site) => site.name.startsWith('Great Orme'))?.periods[0],
    ).toMatchObject({ fromYear: -1699, toYear: -899, approximate: true });
    for (const site of dataset.sites.filter((site) => site.sourceId === 'gem-goget')) {
      expect(
        site.periods.every(
          (period) =>
            !!period.categories?.length &&
            (period.fromYear === period.toYear || period.approximate === true),
        ),
      ).toBe(true);
    }
    expect(
      dataset.sites.find((site) => site.name.startsWith('Rumaila Oil Field'))?.periods,
    ).toEqual([
      expect.objectContaining({
        fromYear: 1954,
        toYear: 2026,
        categories: ['oil'],
        approximate: true,
      }),
    ]);
    // Additional discoveries can remain separate from existing producing fields.
    expect(dataset.sites.some((site) => site.id === 'sodir:43807')).toBe(true);
  });

  it('retains current minerals through actual reports without projecting old observations to every later year', () => {
    const current = resourcesInPeriod(published, 2026);
    for (const category of ['copper', 'gold', 'lithium', 'rare-earths', 'bauxite'] as const)
      expect(current.some((site) => site.categories.includes(category))).toBe(true);
    expect(current.find((site) => site.id === 'current-major:escondida')?.categories).toContain(
      'copper',
    );
    expect(current.some((site) => site.id === 'historical:ranger')).toBe(false);
    expect(resourcesInPeriod(published, 2027)).toEqual([]);
  });

  it('rejects duplicate identifiers, dangling sources and out-of-range positions', () => {
    const source = {
      id: 'source',
      name: 'Source',
      url: 'https://example.com',
      license: 'CC0',
      year: 2009,
    };
    const site = {
      id: '1',
      name: 'Mine',
      coordinates: [1, 2],
      categories: ['iron'],
      sourceId: 'source',
      sourceUrl: 'https://example.com/mine',
      sourceYear: 2009,
      periods: [{ fromYear: 1900, toYear: 2009, sourceUrl: 'https://example.com' }],
    };
    const dataset = {
      version: 1,
      downloadedAt: '2026-09-23',
      description: 'Known deposits',
      sources: [source],
      sites: [site],
    };
    expect(ResourceDatasetSchema.safeParse(dataset).success).toBe(true);
    expect(ResourceDatasetSchema.safeParse({ ...dataset, sites: [site, site] }).success).toBe(
      false,
    );
    expect(ResourceDatasetSchema.safeParse({ ...dataset, sources: [] }).success).toBe(false);
    expect(
      ResourceDatasetSchema.safeParse({ ...dataset, sites: [{ ...site, coordinates: [190, 2] }] })
        .success,
    ).toBe(false);
    expect(
      ResourceDatasetSchema.safeParse({ ...dataset, sites: [{ ...site, periods: [] }] }).success,
    ).toBe(false);
    expect(
      ResourceDatasetSchema.safeParse({
        ...dataset,
        sites: [
          {
            ...site,
            periods: [{ fromYear: 1900, toYear: 2010, sourceUrl: 'https://example.com' }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ResourceDatasetSchema.safeParse({
        ...dataset,
        sites: [
          {
            ...site,
            periods: [
              {
                fromYear: 1900,
                toYear: 1900,
                categories: ['gas'],
                sourceUrl: 'https://example.com',
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
