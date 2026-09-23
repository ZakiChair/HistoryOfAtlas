import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const dataset = {
  version: 1,
  downloadedAt: '2026-09-23',
  description: 'Documented exploitation periods',
  sources: [
    {
      id: 'source',
      name: 'Inventory',
      year: 2009,
      url: 'https://example.org',
      license: 'Public domain',
    },
  ],
  sites: [
    {
      id: 'mine',
      name: 'Mine',
      coordinates: [12, 34],
      categories: ['copper'],
      sourceId: 'source',
      sourceUrl: 'https://example.org/mine',
      sourceYear: 2009,
      periods: [{ fromYear: 1800, toYear: 1900, sourceUrl: 'https://example.org/history' }],
    },
  ],
};

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it('does not fetch on import and shares one validated request between consumers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(dataset)));
  vi.stubGlobal('fetch', fetch);
  const { getResourceDataset } = await import('../../lib/resources/client');
  expect(fetch).not.toHaveBeenCalled();
  const [first, second] = await Promise.all([getResourceDataset(), getResourceDataset()]);
  expect(first).toEqual(dataset);
  expect(second).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('discards malformed coordinates and allows a corrected response on retry', async () => {
  const invalid = { ...dataset, sites: [{ ...dataset.sites[0], coordinates: [999, 34] }] };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(invalid)))
    .mockResolvedValueOnce(new Response(JSON.stringify(dataset)));
  vi.stubGlobal('fetch', fetch);
  const { getResourceDataset } = await import('../../lib/resources/client');
  await expect(getResourceDataset()).rejects.toThrow();
  await expect(getResourceDataset()).resolves.toEqual(dataset);
  expect(fetch).toHaveBeenCalledTimes(2);
});
