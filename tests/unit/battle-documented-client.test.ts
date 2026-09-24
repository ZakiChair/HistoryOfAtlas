import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENTED_BATTLES_PATH } from '../../lib/battles/documented';

const readJson = vi.fn<(url: string, options?: unknown) => Promise<unknown>>();
vi.mock('@/lib/data-client', () => ({ readJson }));

// A fresh module per case: the parsed list is page-lifetime state.
const client = () => import('../../lib/battles/documented-client');

describe('documented battle list for dossiers', () => {
  beforeEach(() => {
    vi.resetModules();
    readJson.mockReset();
  });

  it('is unknown before loading, then readable synchronously by later dossiers', async () => {
    readJson.mockResolvedValue({ version: 1, ids: ['Q48314'] });
    const { loadDocumentedBattles, peekDocumentedBattles } = await client();
    expect(peekDocumentedBattles()).toBeNull();
    expect((await loadDocumentedBattles()).has('Q48314')).toBe(true);
    // The next dossier labels its button on its first render, without another request.
    expect(peekDocumentedBattles()?.has('Q48314')).toBe(true);
    expect(peekDocumentedBattles()?.has('Q42')).toBe(false);
    await loadDocumentedBattles();
    expect(readJson).toHaveBeenCalledTimes(1);
  });

  it('uses a short request budget for this optional two-kilobyte file', async () => {
    readJson.mockResolvedValue({ version: 1, ids: [] });
    const { loadDocumentedBattles } = await client();
    await loadDocumentedBattles();
    expect(readJson).toHaveBeenCalledWith(DOCUMENTED_BATTLES_PATH, { stallMs: 5_000, retries: 1 });
  });

  it('never calls a scene sourced from a malformed list', async () => {
    readJson.mockResolvedValue({ version: 2, ids: ['Q48314'] });
    const { loadDocumentedBattles, peekDocumentedBattles } = await client();
    expect((await loadDocumentedBattles()).size).toBe(0);
    expect(peekDocumentedBattles()?.size).toBe(0);
  });

  it('keeps the list unknown after a network failure so the next dossier retries', async () => {
    readJson.mockRejectedValueOnce(new Error('stalled'));
    readJson.mockResolvedValueOnce({ version: 1, ids: ['Q48314'] });
    const { loadDocumentedBattles, peekDocumentedBattles } = await client();
    await expect(loadDocumentedBattles()).rejects.toThrow('stalled');
    expect(peekDocumentedBattles()).toBeNull();
    expect((await loadDocumentedBattles()).has('Q48314')).toBe(true);
  });
});
