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

  it.each([
    ['de', 'Beispielartikel'],
    ['es', 'Artículo de ejemplo'],
    ['zh', '示例条目'],
    ['ru', 'Пример статьи'],
  ] as const)(
    'discovers the sourced %s article when the corpus only has an English link',
    async (locale, title) => {
      const articleUrl = `https://${locale}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
      const requested: URL[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
          const url = new URL(input);
          requested.push(url);
          return url.pathname === '/w/api.php'
            ? jsonResponse({
                batchcomplete: true,
                query: {
                  pages: [
                    {
                      pageid: 10,
                      ns: 0,
                      title: 'Source title & notes',
                      langlinks: [{ lang: locale, title, url: articleUrl }],
                    },
                  ],
                },
              })
            : url.hostname === `${locale}.wikipedia.org`
              ? jsonResponse({
                  title,
                  extract: 'Actual localized article.',
                  content_urls: { desktop: { page: articleUrl } },
                })
              : jsonResponse({ title: 'English article', extract: 'Fallback English article.' });
        }),
      );
      const { getWikipediaSummary } = await import('../../lib/data-client');
      const summary = await getWikipediaSummary(
        { sources: [], wikipedia: { en: 'https://en.wikipedia.org/wiki/Source_title_%26_notes' } },
        locale,
      );
      expect(summary).toMatchObject({
        language: locale,
        title,
        url: articleUrl,
        text: 'Actual localized article.',
      });
      expect(requested).toHaveLength(2);
      expect(requested[0].hostname).toBe('en.wikipedia.org');
      expect(Object.fromEntries(requested[0].searchParams)).toMatchObject({
        action: 'query',
        prop: 'langlinks',
        titles: 'Source_title_&_notes',
        lllang: locale,
        llprop: 'url',
        formatversion: '2',
        redirects: '1',
        origin: '*',
      });
      expect(requested[1].href).toBe(
        `https://${locale}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
      );
    },
  );

  it.each([
    'missing',
    'offline',
    'untrusted-url',
    'wrong-language',
    'summary-unavailable',
  ] as const)(
    'retains honest English fallback when localized article resolution is %s',
    async (failure) => {
      const requested: URL[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
          const url = new URL(input);
          requested.push(url);
          if (url.pathname === '/w/api.php') {
            if (failure === 'offline') throw new Error('offline');
            const links =
              failure === 'missing'
                ? []
                : [
                    {
                      lang: failure === 'wrong-language' ? 'es' : 'de',
                      title: 'Beispiel',
                      url:
                        failure === 'untrusted-url'
                          ? 'https://example.org/wiki/Beispiel'
                          : 'https://de.wikipedia.org/wiki/Beispiel',
                    },
                  ];
            return jsonResponse({
              batchcomplete: true,
              query: { pages: [{ pageid: 10, ns: 0, title: 'Example', langlinks: links }] },
            });
          }
          return url.hostname === 'de.wikipedia.org'
            ? jsonResponse({}, 404)
            : jsonResponse({ title: 'Example', extract: 'English source text.' });
        }),
      );
      const { getWikipediaSummary } = await import('../../lib/data-client');
      expect(
        await getWikipediaSummary(
          { sources: [{ label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Example' }] },
          'de',
        ),
      ).toMatchObject({
        language: 'en',
        text: 'English source text.',
        url: 'https://en.wikipedia.org/wiki/Example',
      });
      expect(requested[0].pathname).toBe('/w/api.php');
      expect(
        requested.every((url) => ['en.wikipedia.org', 'de.wikipedia.org'].includes(url.hostname)),
      ).toBe(true);
    },
  );

  it.each(['de', 'es', 'zh', 'ru'] as const)(
    'prefers an available %s source and identifies an English fallback honestly',
    async (locale) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          jsonResponse({
            title: 'Example',
            extract: url.includes(`//${locale}.`) ? 'Localized source.' : 'English source.',
          }),
        ),
      );
      const { getWikipediaSummary } = await import('../../lib/data-client');
      const sources = {
        sources: [],
        wikipedia: {
          [locale]: `https://${locale}.wikipedia.org/wiki/Example`,
          en: 'https://en.wikipedia.org/wiki/Example',
        },
      };
      expect(await getWikipediaSummary(sources, locale)).toMatchObject({
        language: locale,
        text: 'Localized source.',
      });
      expect(
        await getWikipediaSummary({ ...sources, wikipedia: { en: sources.wikipedia.en } }, locale),
      ).toMatchObject({ language: 'en', text: 'English source.' });
    },
  );

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
