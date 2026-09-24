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

export type JsonRequestOptions = {
  /** Abandon only after this long without receiving a byte, however long the transfer lasts. */
  stallMs?: number;
  /** Further attempts after a network error, a stall or a 5xx response; never after a 4xx
   * or an unparsable body, which a new attempt would not change. Defaults to 2 for this
   * site's own files and to 0 for third-party APIs, which have their own fallbacks. */
  retries?: number;
  /** Base delays before successive attempts; each is jittered to spread reconnections. */
  backoffMs?: readonly number[];
};

const DEFAULT_STALL_MS = 15_000;
const DEFAULT_BACKOFF_MS = [1_000, 3_000] as const;

class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`${status}: ${url}`);
  }
}

class StallError extends Error {
  constructor(url: string, stallMs: number) {
    super(`No data received for ${stallMs} ms: ${url}`);
  }
}

const retryable = (error: unknown) =>
  error instanceof StallError ||
  (error instanceof HttpError && error.status >= 500) ||
  // fetch() and a response body stream report a dropped connection as a TypeError.
  error instanceof TypeError;

async function downloadJson(url: string, stallMs: number): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStall: (error: StallError) => void = () => {};
  const stalled = new Promise<never>((_, reject) => {
    rejectStall = reject;
  });
  stalled.catch(() => {});
  // Re-armed on every received block: slow transfers finish, silent ones are abandoned.
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const error = new StallError(url, stallMs);
      rejectStall(error);
      controller.abort(error);
    }, stallMs);
  };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    arm();
    const response = await Promise.race([fetch(url, { signal: controller.signal }), stalled]);
    if (!response.ok) throw new HttpError(response.status, url);
    if (!response.body) return JSON.parse(await Promise.race([response.text(), stalled]));
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const text: string[] = [];
    for (;;) {
      arm();
      const { done, value } = await Promise.race([reader.read(), stalled]);
      if (done) break;
      text.push(decoder.decode(value, { stream: true }));
    }
    text.push(decoder.decode());
    return JSON.parse(text.join(''));
  } catch (error) {
    void reader?.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Download and parse JSON without caching, resuming after transient failures. */
export async function fetchJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const {
    stallMs = DEFAULT_STALL_MS,
    retries = url.startsWith('/') ? 2 : 0,
    backoffMs = DEFAULT_BACKOFF_MS,
  } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await downloadJson(url, stallMs)) as T;
    } catch (error) {
      if (attempt >= retries || !retryable(error)) throw error;
      const base = backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 0;
      await wait(base * (0.5 + Math.random()));
    }
  }
}

const cache = new Map<string, Promise<unknown>>();
const failed = new Set<string>();
const recovered = new Map<string, Set<() => void>>();
/** A rejected schema is not a usable cache entry even when the HTTP request succeeded. */
export function invalidateJson(url: string): void {
  cache.delete(url);
}
/**
 * Calls `listener` when a URL whose last download failed downloads successfully, for example
 * after the map's Try again, so every reader of that file can recover, not only the retrying one.
 */
export function onJsonRecovered(url: string, listener: () => void): () => void {
  const listeners = recovered.get(url) ?? new Set();
  recovered.set(url, listeners.add(listener));
  return () => {
    listeners.delete(listener);
    if (!listeners.size && recovered.get(url) === listeners) recovered.delete(url);
  };
}
/** Shared, cached download: every caller of the same URL receives the same attempt. */
export function readJson<T>(url: string, options?: JsonRequestOptions): Promise<T> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetchJson<T>(url, options).catch((error) => {
      if (cache.get(url) === promise) cache.delete(url);
      failed.add(url);
      throw error;
    });
    cache.set(url, promise);
    promise.then(
      () => {
        if (failed.delete(url)) recovered.get(url)?.forEach((listener) => listener());
      },
      () => {},
    );
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
