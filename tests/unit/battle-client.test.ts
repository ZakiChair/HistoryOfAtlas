import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const record = {
  id: 'Q42',
  name: { en: 'Sourced battle' },
  type: 'battle',
  medium: 'land',
  participants: [],
  totals: { strength: [], casualties: [], deaths: [] },
  sources: [{ label: 'Source', url: 'https://www.wikidata.org/wiki/Q42' }],
};

describe('battle evidence loading and retries', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('refetches after a successful HTTP response fails schema validation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'Q42' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(record)));
    vi.stubGlobal('fetch', fetch);
    const { getBattle } = await import('../../lib/battles/client');
    await expect(getBattle('Q42')).rejects.toThrow();
    await expect(getBattle('Q42')).resolves.toMatchObject(record);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects and refetches a response for another battle, then reuses validated data', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...record, id: 'Q43' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(record)));
    vi.stubGlobal('fetch', fetch);
    const { getBattle } = await import('../../lib/battles/client');
    await expect(getBattle('Q42')).rejects.toThrow('does not match');
    await expect(getBattle('Q42')).resolves.toMatchObject(record);
    await getBattle('Q42');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries an invalid index without retaining its raw successful response', async () => {
    const index = {
      version: 1,
      counts: { total: 0, mappable: 0, documented: 0, unmapped: 0 },
      battles: [],
      unmapped: 0,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response(JSON.stringify(index)));
    vi.stubGlobal('fetch', fetch);
    const { getBattleIndex } = await import('../../lib/battles/client');
    await expect(getBattleIndex()).rejects.toThrow();
    await expect(getBattleIndex()).resolves.toEqual(index);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
