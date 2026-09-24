import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type JsonState = { data: unknown; error: string | null; loading: boolean };

// A minimal stand-in for React, enough to run useJson's effect in node and record its states.
const react = vi.hoisted(() => ({
  states: [] as JsonState[],
  cleanup: undefined as (() => void) | undefined,
}));
vi.mock('react', () => ({
  useState: (initial: JsonState) => [
    initial,
    (next: JsonState) => {
      react.states.push(next);
    },
  ],
  useEffect: (effect: () => (() => void) | void) => {
    react.cleanup = effect() ?? undefined;
  },
}));

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A server that fails the first `failures` requests, then answers. */
function flakyServer(failures: number, body: unknown) {
  let requests = 0;
  const fetcher = vi.fn(async () =>
    ++requests <= failures ? jsonResponse({}, 503) : jsonResponse(body),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

const GEO = { temporal: { range: [-3400, 2024] }, snapshots: [] };

describe('recovering every reader of a file after one reader retries it', () => {
  beforeEach(() => {
    vi.resetModules();
    react.states = [];
    react.cleanup = undefined;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('tells subscribers when a failed file later downloads, and only then', async () => {
    flakyServer(1, GEO);
    const { onJsonRecovered, readJson } = await import('../../lib/data-client');
    const recovered = vi.fn();
    const neverFailed = vi.fn();
    const unsubscribe = onJsonRecovered('/geo/manifest.json', recovered);
    onJsonRecovered('/data/manifest.json', neverFailed);

    await expect(readJson('/geo/manifest.json', { retries: 0 })).rejects.toThrow('503');
    expect(recovered).not.toHaveBeenCalled();

    await expect(readJson('/geo/manifest.json')).resolves.toEqual(GEO);
    expect(recovered).toHaveBeenCalledTimes(1);

    // The file is healthy again: later reads of the cached copy are not recoveries.
    await readJson('/geo/manifest.json');
    expect(recovered).toHaveBeenCalledTimes(1);

    unsubscribe();
    await readJson('/data/manifest.json');
    expect(neverFailed).not.toHaveBeenCalled();
  });

  it('stops notifying a reader that unsubscribed', async () => {
    flakyServer(1, GEO);
    const { onJsonRecovered, readJson } = await import('../../lib/data-client');
    const recovered = vi.fn();
    onJsonRecovered('/geo/manifest.json', recovered)();
    await expect(readJson('/geo/manifest.json', { retries: 0 })).rejects.toThrow('503');
    await readJson('/geo/manifest.json');
    expect(recovered).not.toHaveBeenCalled();
  });

  it("brings a failed useJson copy back when the map's Try again re-reads the same file", async () => {
    const fetcher = flakyServer(1, GEO);
    const { readJson } = await import('../../lib/data-client');
    const { useJson } = await import('../../lib/data-client/hooks');

    // The map and the caption share one failing attempt.
    const mapRead = readJson('/geo/manifest.json', { retries: 0 });
    useJson('/geo/manifest.json');
    await expect(mapRead).rejects.toThrow('503');
    await vi.waitFor(() =>
      expect(react.states.at(-1)).toMatchObject({
        data: null,
        error: expect.stringMatching('503'),
      }),
    );

    // Try again: only the map reads the file again, and the caption's copy follows.
    await expect(readJson('/geo/manifest.json')).resolves.toEqual(GEO);
    await vi.waitFor(() =>
      expect(react.states.at(-1)).toEqual({ data: GEO, error: null, loading: false }),
    );
    // The recovered copy comes from the shared download, not a second request.
    expect(fetcher).toHaveBeenCalledTimes(2);
    // Recovery never flashes the loading state over the reader's view.
    expect(react.states.filter((state) => state.loading)).toHaveLength(1);
  });

  it('forgets an unmounted useJson so a later recovery does not update it', async () => {
    flakyServer(1, GEO);
    const { readJson } = await import('../../lib/data-client');
    const { useJson } = await import('../../lib/data-client/hooks');
    const mapRead = readJson('/geo/manifest.json', { retries: 0 });
    useJson('/geo/manifest.json');
    await expect(mapRead).rejects.toThrow('503');
    await vi.waitFor(() => expect(react.states.at(-1)?.error).toBeTruthy());
    const settled = react.states.length;

    react.cleanup?.();
    await readJson('/geo/manifest.json');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(react.states).toHaveLength(settled);
  });
});
