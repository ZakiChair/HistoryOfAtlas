import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { religionFixture } from '../fixtures/religions';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it('loads only on demand and shares one validated request across consumers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(religionFixture)));
  vi.stubGlobal('fetch', fetch);
  const { getReligionDataset } = await import('../../lib/religions/client');
  expect(fetch).not.toHaveBeenCalled();
  const [first, second] = await Promise.all([getReligionDataset(), getReligionDataset()]);
  expect(first).toEqual(religionFixture);
  expect(second).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('invalidates malformed provenance so a corrected dataset can be retried', async () => {
  const invalid = structuredClone(religionFixture);
  invalid.milestones[0].sourceIds = ['missing-source'];
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(invalid)))
    .mockResolvedValueOnce(new Response(JSON.stringify(religionFixture)));
  vi.stubGlobal('fetch', fetch);
  const { getReligionDataset } = await import('../../lib/religions/client');
  await expect(getReligionDataset()).rejects.toThrow();
  await expect(getReligionDataset()).resolves.toEqual(religionFixture);
  expect(fetch).toHaveBeenCalledTimes(2);
});
