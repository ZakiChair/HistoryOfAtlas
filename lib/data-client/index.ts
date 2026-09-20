import type { HistoricalEvent, Campaign, EventShard } from '@/lib/schema';

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
    promise = fetch(url)
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
export async function getWikipediaSummary(
  event: HistoricalEvent,
  locale: 'fr' | 'en',
): Promise<WikiSummary | null> {
  const languages = locale === 'fr' ? ['fr', 'en'] : ['en', 'fr'];
  for (const language of languages) {
    const source = event.sources.find((item) =>
      item.url.includes(`${language}.wikipedia.org/wiki/`),
    );
    if (!source) continue;
    const title = decodeURIComponent(new URL(source.url).pathname.replace('/wiki/', ''));
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
