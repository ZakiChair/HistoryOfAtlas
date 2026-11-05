import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('@/lib/data-client', () => ({ fetchJson: download }));
const corpus = (view: string) =>
  JSON.parse(readFileSync(`public/data/context/${view}.json`, 'utf8'));
beforeEach(() => {
  vi.resetModules();
  download.mockReset();
});

describe('lazy, validated context loading', () => {
  it('deduplicates concurrent consumers and does not publish a late result for a previous tab', async () => {
    let resolveChanges!: (value: unknown) => void;
    const changes = new Promise((resolve) => {
      resolveChanges = resolve;
    });
    download.mockImplementation((path: string) =>
      path.includes('changes') ? changes : Promise.resolve(corpus('networks')),
    );
    const { ensureContext, useContextStore } = await import('@/lib/context/store');
    const old = ensureContext('changes');
    const duplicate = ensureContext('changes');
    await ensureContext('networks');
    expect(useContextStore.getState().loaded?.view).toBe('networks');
    resolveChanges(corpus('changes'));
    await Promise.all([old, duplicate]);
    expect(useContextStore.getState().loaded?.view).toBe('networks');
    expect(download).toHaveBeenCalledTimes(2);
    await ensureContext('changes');
    expect(useContextStore.getState().loaded?.view).toBe('changes');
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('keeps invalid data out of the cache and permits a fresh retry', async () => {
    download.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce(corpus('changes'));
    const { ensureContext, useContextStore } = await import('@/lib/context/store');
    await ensureContext('changes');
    expect(useContextStore.getState()).toMatchObject({ status: 'error', loaded: null });
    await ensureContext('changes');
    expect(useContextStore.getState()).toMatchObject({
      status: 'ready',
      loaded: { view: 'changes' },
    });
    expect(download).toHaveBeenCalledTimes(2);
  });
});
