import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoricalEvent } from '../../lib/schema';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('lazy data loading and provenance-preserving summaries', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('shares an in-flight download and retries a failed download', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        attempts++;
        return attempts === 1 ? jsonResponse({}, 503) : jsonResponse({ sourced: true });
      }),
    );
    const { readJson } = await import('../../lib/data-client');
    const first = readJson('/data/retry.json');
    const duplicate = readJson('/data/retry.json');
    expect(first).toBe(duplicate);
    await expect(first).rejects.toThrow('503');
    await expect(readJson('/data/retry.json')).resolves.toEqual({ sourced: true });
    expect(attempts).toBe(2);
  });

  it('downloads only intersecting time chunks and deduplicates spanning records', async () => {
    const requested: string[] = [];
    const chunks = {
      '/data/manifest.json': {
        chunks: [
          { path: '/data/chunks/old.json', start: 1, end: 1600 },
          { path: '/data/chunks/current.json', start: 1700, end: 1950 },
          { path: '/data/chunks/later.json', start: 1900, end: 1999 },
        ],
      },
      '/data/chunks/current.json': [{ id: 'Q10', start: { year: 1800 }, end: { year: 1950 } }],
      '/data/chunks/later.json': [
        { id: 'Q10', start: { year: 1800 }, end: { year: 1950 } },
        { id: 'Q20', start: { year: 1905 } },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requested.push(url);
        return jsonResponse(chunks[url as keyof typeof chunks]);
      }),
    );
    const { getEventsInRange } = await import('../../lib/data-client');
    expect((await getEventsInRange(1900, 1910)).map((item) => item.id)).toEqual(['Q10', 'Q20']);
    expect(requested).toEqual([
      '/data/manifest.json',
      '/data/chunks/current.json',
      '/data/chunks/later.json',
    ]);
  });

  it('rejects malformed Wikidata identifiers before network access', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: 'Q0' }));
    vi.stubGlobal('fetch', fetcher);
    const { getEvent } = await import('../../lib/data-client');
    await expect(getEvent('../secrets')).rejects.toThrow();
    await expect(getEvent('Q0')).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls back from French to English while retaining the article URL and language', async () => {
    const fetched: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetched.push(url);
        return url.includes('//fr.')
          ? jsonResponse({}, 404)
          : jsonResponse({
              title: 'Sourced article',
              extract: 'Text received from the source.',
              thumbnail: { source: 'https://upload.wikimedia.org/image.jpg' },
              content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Sourced_article' } },
            });
      }),
    );
    const { getWikipediaSummary } = await import('../../lib/data-client');
    const event = {
      sources: [
        { label: 'FR', url: 'https://fr.wikipedia.org/wiki/Article_sourc%C3%A9' },
        { label: 'EN', url: 'https://en.wikipedia.org/wiki/Sourced_article' },
      ],
    } as HistoricalEvent;
    const summary = await getWikipediaSummary(event, 'fr');
    expect(fetched).toEqual([
      'https://fr.wikipedia.org/api/rest_v1/page/summary/Article_sourc%C3%A9',
      'https://en.wikipedia.org/api/rest_v1/page/summary/Sourced_article',
    ]);
    expect(summary).toMatchObject({
      language: 'en',
      url: 'https://en.wikipedia.org/wiki/Sourced_article',
      text: 'Text received from the source.',
    });
  });

  it('uses the normalized Wikipedia links even when the provenance list only contains Wikidata', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ title: 'Article', extract: 'Sourced context.' }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { getWikipediaSummary } = await import('../../lib/data-client');
    const summary = await getWikipediaSummary(
      {
        sources: [{ label: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q1' }],
        wikipedia: { fr: 'https://fr.wikipedia.org/wiki/Article_%C3%A9tudi%C3%A9' },
      } as HistoricalEvent,
      'fr',
    );
    expect(summary?.text).toBe('Sourced context.');
    expect(summary?.url).toBe('https://fr.wikipedia.org/wiki/Article_%C3%A9tudi%C3%A9');
    expect(fetcher).toHaveBeenCalledWith(
      'https://fr.wikipedia.org/api/rest_v1/page/summary/Article_%C3%A9tudi%C3%A9',
      expect.anything(),
    );
  });

  it('ignores misleading or malformed Wikipedia links without fetching unrelated hosts', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { getWikipediaSummary } = await import('../../lib/data-client');
    await expect(
      getWikipediaSummary(
        {
          sources: [{ label: 'Invalid', url: 'https://example.org/fr.wikipedia.org/wiki/Article' }],
          wikipedia: { fr: '%broken' },
        } as HistoricalEvent,
        'fr',
      ),
    ).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
