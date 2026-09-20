import MiniSearch from 'minisearch';

type SearchRecord = {
  id: string;
  kind: 'event' | 'entity';
  name: { fr?: string; en: string };
  title: string;
  year: number;
  coords?: [number, number];
  type: string;
  importance: number;
  aliases?: string;
};
const index = new MiniSearch<SearchRecord>({
  fields: ['title', 'aliases'],
  storeFields: ['name', 'year', 'coords', 'type', 'kind', 'importance'],
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
  try {
    const [manifest, entities] = await Promise.all([
      json('/data/search-manifest.json'),
      json('/geo/polities.json'),
    ]);
    for (const entity of entities) {
      const name = typeof entity.name === 'string' ? { en: entity.name } : entity.name;
      index.add({
        id: entity.id,
        kind: 'entity',
        name,
        title: `${name.fr ?? ''} ${name.en}`,
        year: entity.firstObserved,
        coords: entity.center,
        type: 'entity',
        importance: 70,
        aliases: entity.wikipedia ?? '',
      });
    }
    const chunks = (manifest.chunks as { path: string; start: number; end: number }[]).sort(
      (a, b) => Math.abs(a.start - year) - Math.abs(b.start - year),
    );
    total = chunks.length;
    const queue = [...chunks];
    const load = async () => {
      while (queue.length) {
        const chunk = queue.shift()!;
        try {
          const events = (await json(chunk.path)) as {
            id: string;
            name: { en: string; fr?: string };
            start: { year: number };
            coords?: [number, number];
            type: string;
            importance: number;
            aliases?: string;
          }[];
          for (const event of events)
            if (!index.has(event.id))
              index.add({
                ...event,
                kind: 'event',
                title: `${event.name.fr ?? ''} ${event.name.en}`,
                year: event.start.year,
              });
        } catch {
          self.postMessage({ type: 'warning', path: chunk.path });
        }
        loaded++;
        respond();
      }
    };
    await Promise.all([load(), load(), load()]);
    respond();
  } catch {
    self.postMessage({ type: 'error' });
  }
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
