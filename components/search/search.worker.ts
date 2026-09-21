import MiniSearch from 'minisearch';
import { LOCALES, type LocalizedName } from '@/lib/types';
import {
  personSearchRecord,
  type PersonIndexRecord,
  type SearchRecord,
} from '@/lib/search-records';
const index = new MiniSearch<SearchRecord>({
  fields: ['title', 'aliases'],
  storeFields: ['name', 'year', 'coords', 'type', 'kind', 'importance', 'targetId'],
  searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 3 } },
});
let query = '',
  loaded = 0,
  total = 0,
  initialized = false;

function respond() {
  const results = query.trim() ? index.search(query, { combineWith: 'AND' }).slice(0, 30) : [];
  self.postMessage({ type: 'results', query, results, loaded, total });
}
async function json(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json();
}
async function initialize(year: number) {
  // Each catalog is independent: a failed polity file must not suppress battle or person search.
  total = 3;
  let available = false;
  const source = async (path: string, consume: (value: unknown) => void) => {
    try {
      consume(await json(path));
      available = true;
    } catch {
      self.postMessage({ type: 'warning', path });
    }
    loaded++;
    respond();
  };
  const entities = source('/geo/polities.json', (value) => {
    const records = value as {
      id: string;
      name: string | LocalizedName;
      firstObserved: number;
      center?: [number, number];
      wikipedia?: string;
    }[];
    for (const entity of records) {
      const name = typeof entity.name === 'string' ? { en: entity.name } : entity.name;
      if (!index.has(entity.id))
        index.add({
          id: entity.id,
          kind: 'entity',
          name,
          title: [...new Set(LOCALES.map((locale) => name[locale]).filter(Boolean))].join(' '),
          year: entity.firstObserved,
          coords: entity.center,
          type: 'entity',
          importance: 70,
          aliases: entity.wikipedia ?? '',
        });
    }
  });
  const people = source('/data/people-index.json', (value) => {
    for (const person of value as PersonIndexRecord[]) {
      const document = personSearchRecord(person);
      if (!index.has(document.id)) index.add(document);
    }
  });
  const events = async () => {
    let chunks: { path: string; start: number; end: number }[] = [];
    await source('/data/search-manifest.json', (value) => {
      const manifest = value as { chunks: typeof chunks };
      chunks = [...manifest.chunks].sort(
        (a, b) => Math.abs(a.start - year) - Math.abs(b.start - year),
      );
      total += chunks.length;
    });
    const load = async () => {
      while (chunks.length) {
        const chunk = chunks.shift()!;
        await source(chunk.path, (value) => {
          const records = value as {
            id: string;
            name: LocalizedName;
            start: { year: number };
            coords?: [number, number];
            type: string;
            importance: number;
            aliases?: string;
          }[];
          for (const event of records)
            if (!index.has(event.id))
              index.add({
                ...event,
                kind: 'event',
                title: [
                  ...new Set(LOCALES.map((locale) => event.name[locale]).filter(Boolean)),
                ].join(' '),
                year: event.start.year,
              });
        });
      }
    };
    await Promise.all([load(), load(), load()]);
  };
  await Promise.all([entities, people, events()]);
  if (!available) self.postMessage({ type: 'error' });
  respond();
}
self.onmessage = (message: MessageEvent<{ type: string; query?: string; year?: number }>) => {
  if (message.data.type === 'init' && !initialized) {
    initialized = true;
    void initialize(message.data.year ?? 1800);
  }
  if (message.data.type === 'search') {
    query = message.data.query ?? '';
    respond();
  }
};
