import { afterEach, expect, it, vi } from 'vitest';
import { coverageFixture } from '../fixtures/religion-coverage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('loads only when requested, shares a pending request and retries an invalid response', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}'))
    .mockResolvedValueOnce(new Response(JSON.stringify(coverageFixture())));
  vi.stubGlobal('fetch', fetch);
  const { getReligionCoverageDataset } = await import('../../lib/religions/coverage-client');
  expect(fetch).not.toHaveBeenCalled();
  await expect(getReligionCoverageDataset()).rejects.toThrow();
  const [first, second] = await Promise.all([
    getReligionCoverageDataset(),
    getReligionCoverageDataset(),
  ]);
  expect(first.observations[0].id).toBe('old');
  expect(second).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toBe('/data/religions/coverage.json');
});
