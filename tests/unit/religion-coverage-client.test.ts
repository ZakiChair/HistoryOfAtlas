import { afterEach, expect, it, vi } from 'vitest';
import { coverageIndexFixture, coverageRegionFixture } from '../fixtures/religion-coverage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('loads the index only when requested, shares a pending request and retries an invalid response', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValueOnce(new Response(JSON.stringify(coverageIndexFixture())));
  vi.stubGlobal('fetch', fetch);
  const { getReligionCoverageIndex } = await import('../../lib/religions/coverage-client');
  expect(fetch).not.toHaveBeenCalled();
  await expect(getReligionCoverageIndex()).rejects.toThrow();
  const [first, second] = await Promise.all([
    getReligionCoverageIndex(),
    getReligionCoverageIndex(),
  ]);
  expect(first.observations[0].id).toBe('old');
  expect(second).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toBe('/data/religions/coverage-index.json');
});

it('caches each region detail and retries an invalid response', async () => {
  const region = coverageRegionFixture();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValue(new Response(JSON.stringify(region)));
  vi.stubGlobal('fetch', fetch);
  const client = await import('../../lib/religions/coverage-client');
  expect(client.religionCoverageRegionPath('r')).toBe('/data/religions/coverage/r.json');
  await expect(client.getReligionCoverageRegion('r')).rejects.toThrow();
  const [first, second] = await Promise.all([
    client.getReligionCoverageRegion('r'),
    client.getReligionCoverageRegion('r'),
  ]);
  expect(first.observations[0].id).toBe('old');
  expect(second).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toBe('/data/religions/coverage/r.json');
});
