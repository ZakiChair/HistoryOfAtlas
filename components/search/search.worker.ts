import MiniSearch from 'minisearch';
import { LOCALES, type LocalizedName } from '@/lib/types';
import {
  campaignSearchRecord,
  personSearchRecord,
  religionSearchRecords,
  searchBoost,
  searchFuzziness,
  SEARCH_KINDS,
  type PersonIndexRecord,
  type SearchKind,
  type SearchRecord,
} from '@/lib/search-records';
const index = new MiniSearch<SearchRecord>({
  fields: ['title', 'aliases'],
  storeFields: [
    'name',
    'year',
    'approximate',
    'coords',
    'type',
    'kind',
    'importance',
    'targetId',
    'parentId',
    'context',
  ],
  searchOptions: {
    prefix: true,
    fuzzy: searchFuzziness,
    boost: { title: 3 },
    boostDocument: (_id, _term, stored) => searchBoost(stored ?? {}),
  },
});
let query = '',
  kind: SearchKind | null = null,
  loaded = 0,
  total = 0,
  initialized = false;

function respond() {
  const matches = query.trim() ? index.search(query, { combineWith: 'AND' }) : [];
  // Counts cover every kind so the dialog can offer only the filters that have results.
  const counts = Object.fromEntries(SEARCH_KINDS.map((value) => [value, 0])) as Record<
    SearchKind,
    number
  >;
  for (const match of matches)
    if (Object.hasOwn(counts, match.kind)) counts[match.kind as SearchKind] += 1;
  const results = (kind ? matches.filter((match) => match.kind === kind) : matches).slice(0, 30);
  self.postMessage({ type: 'results', query, kind, results, counts, loaded, total });
}
async function json(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(path);
  return response.json();
}
function add(document: SearchRecord) {
  if (!index.has(document.id)) index.add(document);
}
async function initialize(year: number) {
  // Each catalog is independent: a failed polity file must not suppress battle or person search.
  total = 5;
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
      add({
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
    for (const person of value as PersonIndexRecord[]) add(personSearchRecord(person));
  });
  // Same URLs as the religion layer and the campaign list, so the browser cache can serve both.
  const religions = source('/data/religions/history.json', (value) => {
    for (const document of religionSearchRecords(
      value as Parameters<typeof religionSearchRecords>[0],
    ))
      add(document);
  });
  const campaigns = source('/data/campaigns.json', (value) => {
    for (const campaign of value as Parameters<typeof campaignSearchRecord>[0][])
      add(campaignSearchRecord(campaign));
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
            add({
              ...event,
              kind: 'event',
              title: [...new Set(LOCALES.map((locale) => event.name[locale]).filter(Boolean))].join(
                ' ',
              ),
              year: event.start.year,
            });
        });
      }
    };
    await Promise.all([load(), load(), load()]);
  };
  await Promise.all([entities, people, religions, campaigns, events()]);
  if (!available) self.postMessage({ type: 'error' });
  respond();
}
self.onmessage = (
  message: MessageEvent<{ type: string; query?: string; year?: number; kind?: string | null }>,
) => {
  if (message.data.type === 'init' && !initialized) {
    initialized = true;
    void initialize(message.data.year ?? 1800);
  }
  if (message.data.type === 'search') {
    query = message.data.query ?? '';
    kind = SEARCH_KINDS.find((value) => value === message.data.kind) ?? null;
    respond();
  }
};
