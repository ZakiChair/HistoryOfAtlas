import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerResponse = {
  type: string;
  query?: string;
  kind?: string | null;
  path?: string;
  loaded?: number;
  total?: number;
  counts?: Record<string, number>;
  results?: { kind: string; type: string; name: { en: string } }[];
};

// Structural search documents exercise network failures; they are never published as history.
const documents: Record<string, unknown> = {
  '/data/search-manifest.json': {
    chunks: [{ path: '/data/search/0.json', start: 0, end: 99 }],
  },
  '/data/search/0.json': [
    {
      id: 'Q10',
      name: { en: 'Example event' },
      start: { year: 0 },
      type: 'battle',
      importance: 50,
    },
  ],
  '/data/people-index.json': [{ id: 'Q11', name: { en: 'Example person' } }],
  '/geo/polities.json': [
    { id: 'structural-polity', name: 'Example polity', firstObserved: 0, center: [0, 0] },
  ],
  '/data/religions/history.json': {
    traditions: [{ id: 'structural-faith', names: { fr: 'Foi témoin', en: 'Witness faith' } }],
    milestones: [
      {
        id: 'structural-stage',
        traditionId: 'structural-faith',
        kind: 'origin',
        year: 0,
        approximate: true,
        title: { fr: 'Étape témoin', en: 'Witness stage' },
        coordinates: [0, 0],
      },
    ],
  },
  '/data/campaigns.json': [
    {
      id: 'Q12',
      name: { en: 'Witness campaign' },
      steps: [{ coords: [0, 0], date: { year: 0 } }],
    },
  ],
};

async function searchWithUnavailable(
  paths: string[],
  query = 'Example',
  sourceDocuments = documents,
  kind?: string,
) {
  const responses: WorkerResponse[] = [];
  const scope = {
    onmessage: null as ((message: MessageEvent) => void) | null,
    postMessage: (response: WorkerResponse) => responses.push(response),
  };
  vi.stubGlobal('self', scope);
  vi.stubGlobal('fetch', async (path: string) => {
    if (paths.includes(path) || !(path in sourceDocuments))
      return new Response('', { status: 503 });
    return new Response(JSON.stringify(sourceDocuments[path]), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  await import('../../components/search/search.worker');
  scope.onmessage!({ data: { type: 'init', year: 0 } } as MessageEvent);
  scope.onmessage!({ data: { type: 'search', query, kind } } as MessageEvent);
  return responses;
}

const lastResults = (responses: WorkerResponse[]) =>
  responses.filter((response) => response.type === 'results').at(-1);

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('search sources fail independently', () => {
  it('still searches people and events when the territory catalog is unavailable', async () => {
    const responses = await searchWithUnavailable(['/geo/polities.json']);
    await vi.waitFor(() => {
      const last = responses.filter((response) => response.type === 'results').at(-1);
      expect(last?.results?.map((result) => result.kind).sort()).toEqual(['event', 'person']);
      expect(last?.loaded).toBe(last?.total);
    });
    expect(responses).toContainEqual({ type: 'warning', path: '/geo/polities.json' });
    expect(responses.some((response) => response.type === 'error')).toBe(false);
  });

  it('still searches people and territories when event metadata is unavailable', async () => {
    const responses = await searchWithUnavailable(['/data/search-manifest.json']);
    await vi.waitFor(() => {
      const last = responses.filter((response) => response.type === 'results').at(-1);
      expect(last?.results?.map((result) => result.kind).sort()).toEqual(['entity', 'person']);
      expect(last?.loaded).toBe(last?.total);
    });
    expect(responses).toContainEqual({ type: 'warning', path: '/data/search-manifest.json' });
    expect(responses.some((response) => response.type === 'error')).toBe(false);
  });

  it('finishes with an explicit error when no catalog can be searched', async () => {
    const responses = await searchWithUnavailable([
      '/data/search-manifest.json',
      '/data/people-index.json',
      '/geo/polities.json',
      '/data/religions/history.json',
      '/data/campaigns.json',
    ]);
    await vi.waitFor(() =>
      expect(responses.some((response) => response.type === 'error')).toBe(true),
    );
    expect(responses.flatMap((response) => response.results ?? [])).toEqual([]);
  });
});

describe('localized source names', () => {
  const name = {
    en: 'Example record',
    de: 'Einzigartig',
    es: 'Singular',
    zh: '本地标签',
    ru: 'Уникальный',
  };
  const localizedDocuments = {
    ...documents,
    '/data/search/0.json': [
      { id: 'Q10', name, start: { year: 0 }, type: 'battle', importance: 50 },
    ],
    '/data/people-index.json': [{ id: 'Q11', name }],
    '/geo/polities.json': [{ id: 'structural-polity', name, firstObserved: 0 }],
  };

  it.each(['de', 'es', 'zh', 'ru'] as const)(
    'finds supplied %s labels in events, people and territories',
    async (locale) => {
      const responses = await searchWithUnavailable([], name[locale], localizedDocuments);
      await vi.waitFor(() => {
        const last = responses.filter((response) => response.type === 'results').at(-1);
        expect(last?.loaded).toBe(last?.total);
        expect(last?.results?.map((result) => result.kind).sort()).toEqual([
          'entity',
          'event',
          'person',
        ]);
      });
    },
  );
});

describe('religions and campaigns', () => {
  it('finds traditions, their milestones and guided campaigns', async () => {
    const responses = await searchWithUnavailable([], 'Witness');
    await vi.waitFor(() => {
      const last = lastResults(responses);
      expect(last?.loaded).toBe(last?.total);
      expect(last?.results?.map((result) => `${result.kind}/${result.type}`).sort()).toEqual([
        'campaign/campaign',
        'religion/milestone',
        'religion/tradition',
      ]);
    });
  });

  it('finds a milestone from its tradition name in either language', async () => {
    const responses = await searchWithUnavailable([], 'Foi témoin étape');
    await vi.waitFor(() => {
      const last = lastResults(responses);
      expect(last?.loaded).toBe(last?.total);
      expect(last?.results?.map((result) => result.type)).toEqual(['milestone']);
    });
  });

  it('filters results by kind while still counting every kind', async () => {
    const responses = await searchWithUnavailable([], 'Witness', documents, 'religion');
    await vi.waitFor(() => {
      const last = lastResults(responses);
      expect(last?.loaded).toBe(last?.total);
      expect(last?.kind).toBe('religion');
      expect(last?.results?.map((result) => result.kind)).toEqual(['religion', 'religion']);
      expect(last?.counts).toEqual({ event: 0, entity: 0, person: 0, religion: 2, campaign: 1 });
    });
  });

  it('ignores an unknown kind instead of hiding every result', async () => {
    const responses = await searchWithUnavailable([], 'Witness', documents, 'resource');
    await vi.waitFor(() => {
      const last = lastResults(responses);
      expect(last?.loaded).toBe(last?.total);
      expect(last?.kind).toBeNull();
      expect(last?.results).toHaveLength(3);
    });
  });

  it('keeps the other catalogs when the religion and campaign files are unavailable', async () => {
    const responses = await searchWithUnavailable([
      '/data/religions/history.json',
      '/data/campaigns.json',
    ]);
    await vi.waitFor(() => {
      const last = lastResults(responses);
      expect(last?.loaded).toBe(last?.total);
      expect(last?.results?.map((result) => result.kind).sort()).toEqual([
        'entity',
        'event',
        'person',
      ]);
    });
    expect(responses).toContainEqual({ type: 'warning', path: '/data/religions/history.json' });
    expect(responses).toContainEqual({ type: 'warning', path: '/data/campaigns.json' });
    expect(responses.some((response) => response.type === 'error')).toBe(false);
  });
});
