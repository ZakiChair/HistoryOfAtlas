import type { HistoricalEvent, Campaign, EventShard } from '@/lib/schema';
import { DEFAULT_LOCALE, type Locale } from '@/lib/types';

export type DataManifest = {
  version: number;
  totalEvents: number;
  builtAt: string;
  chunks: { key: string; path: string; start: number; end: number; count: number }[];
  density: { year: number; count: number }[];
  coverage: {
    byType: Record<string, number>;
    byEra: Record<string, number>;
    byRegion: Record<string, number>;
  };
  eventsPmtiles: string;
  eventShards?: EventShard[];
  searchIndex: string;
  campaigns: string;
  sources: { label: string; url: string; license?: string }[];
};

const cache = new Map<string, Promise<unknown>>();
export function readJson<T>(url: string): Promise<T> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url, { signal: AbortSignal.timeout(12_000) })
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}: ${url}`);
        return response.json();
      })
      .catch((error) => {
        cache.delete(url);
        throw error;
      });
    cache.set(url, promise);
  }
  return promise as Promise<T>;
}

export const getManifest = () => readJson<DataManifest>('/data/manifest.json');
export const getEvent = (id: string) => {
  if (!/^Q[1-9]\d*$/.test(id)) return Promise.reject(new Error('Invalid event identifier'));
  return readJson<HistoricalEvent>(`/data/events/${id}.json`);
};
export const getCampaigns = () => readJson<Campaign[]>('/data/campaigns.json');
export async function getEventsInRange(from: number, to: number): Promise<HistoricalEvent[]> {
  const manifest = await getManifest();
  const chunks = manifest.chunks.filter((chunk) => chunk.start <= to && chunk.end >= from);
  const all = await Promise.all(chunks.map((chunk) => readJson<HistoricalEvent[]>(chunk.path)));
  return [...new Map(all.flat().map((event) => [event.id, event])).values()];
}

export type WikiSummary = {
  text: string;
  image?: string;
  imageDescription?: string;
  url: string;
  language: string;
  title: string;
};

type WikipediaArticle = { url: string; title: string; language: Locale };
type WikipediaSubject = Pick<HistoricalEvent, 'sources' | 'wikipedia'>;

function wikipediaArticle(value: unknown, language: Locale): WikipediaArticle | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== `${language}.wikipedia.org` ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith('/wiki/')
    )
      return null;
    const title = decodeURIComponent(url.pathname.slice('/wiki/'.length));
    return title ? { url: url.href, title, language } : null;
  } catch {
    return null;
  }
}

function sourcedWikipediaArticle(
  event: WikipediaSubject,
  language: Locale,
): WikipediaArticle | null {
  const candidates = [event.wikipedia?.[language], ...event.sources.map((item) => item.url)];
  return (
    candidates
      .map((value) => wikipediaArticle(value, language))
      .find((article) => article !== null) ?? null
  );
}

/** Resolve only an interlanguage link published by the already sourced article.
 * https://www.mediawiki.org/wiki/API:Langlinks
 */
async function resolveWikipediaLanguage(
  event: WikipediaSubject,
  locale: Locale,
): Promise<WikipediaArticle | null> {
  const source = (['en', 'fr'] as const)
    .filter((language) => language !== locale)
    .map((language) => sourcedWikipediaArticle(event, language))
    .find((article) => article !== null);
  if (!source) return null;
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    redirects: '1',
    titles: source.title,
    prop: 'langlinks',
    lllang: locale,
    llprop: 'url',
    lllimit: '1',
  });
  try {
    const result = await readJson<{
      query?: { pages?: { langlinks?: { lang?: string; url?: string }[] }[] };
    }>(`https://${source.language}.wikipedia.org/w/api.php?${query}`);
    const link = result.query?.pages?.[0]?.langlinks?.find((item) => item.lang === locale);
    return wikipediaArticle(link?.url, locale);
  } catch {
    // An unavailable language link never prevents reading the existing sourced article.
    return null;
  }
}

export async function getWikipediaSummary(
  event: WikipediaSubject,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WikiSummary | null> {
  const languages = [...new Set<Locale>([locale, 'en', 'fr'])];
  for (const language of languages) {
    let source = sourcedWikipediaArticle(event, language);
    if (!source && language === locale) source = await resolveWikipediaLanguage(event, locale);
    if (!source) continue;
    const { title } = source;
    try {
      const result = await readJson<{
        extract?: string;
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page: string } };
        title: string;
      }>(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (result.extract)
        return {
          text: result.extract,
          image: result.thumbnail?.source,
          url: result.content_urls?.desktop?.page ?? source.url,
          language,
          title: result.title,
        };
    } catch {
      /* Another language is tried; the sourced event remains usable offline. */
    }
  }
  return null;
}
