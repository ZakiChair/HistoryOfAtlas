import { create } from 'zustand';
import { fetchJson } from '@/lib/data-client';
import type { ContextView } from './types';
import type { ChangesDataset } from './changes';
import type { CoverageDataset } from './coverage';
import type { NetworkDataset } from './networks';
import type { CitiesDataset } from './cities';

export type LoadedContext =
  | { view: 'changes'; dataset: ChangesDataset }
  | { view: 'coverage'; dataset: CoverageDataset }
  | { view: 'networks'; dataset: NetworkDataset }
  | { view: 'cities'; dataset: CitiesDataset };

export const useContextStore = create<{
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loaded: LoadedContext | null;
  revision: number;
}>()(() => ({ status: 'idle', error: null, loaded: null, revision: 0 }));

const cache = new Map<ContextView, LoadedContext>();
const pending = new Map<ContextView, Promise<LoadedContext>>();
let requested: ContextView | null = null;

async function load(view: ContextView): Promise<LoadedContext> {
  // This cache only retains validated corpora, so Retry can recover a malformed response too.
  const data = await fetchJson<unknown>(`/data/context/${view}.json`);
  switch (view) {
    case 'changes':
      return { view, dataset: (await import('./changes')).ChangesDatasetSchema.parse(data) };
    case 'coverage':
      return { view, dataset: (await import('./coverage')).CoverageDatasetSchema.parse(data) };
    case 'networks':
      return { view, dataset: (await import('./networks')).NetworkDatasetSchema.parse(data) };
    case 'cities':
      return { view, dataset: (await import('./cities')).CitiesDatasetSchema.parse(data) };
  }
}

/** Only the requested corpus loads; late responses cannot replace a newer tab. */
export async function ensureContext(view: ContextView): Promise<void> {
  requested = view;
  const existing = cache.get(view);
  if (existing) {
    if (
      useContextStore.getState().loaded !== existing ||
      useContextStore.getState().status !== 'ready'
    )
      useContextStore.setState({ status: 'ready', loaded: existing, error: null });
    return;
  }
  if (useContextStore.getState().status !== 'loading')
    useContextStore.setState({ status: 'loading', error: null });
  if (!pending.has(view)) {
    pending.set(
      view,
      load(view)
        .then((loaded) => {
          cache.set(view, loaded);
          return loaded;
        })
        .finally(() => pending.delete(view)),
    );
  }
  try {
    const loaded = await pending.get(view)!;
    if (requested === view) useContextStore.setState({ status: 'ready', loaded, error: null });
  } catch (error) {
    if (requested === view)
      useContextStore.setState({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
  }
}

export function retryContext(view: ContextView) {
  useContextStore.setState((state) => ({ revision: state.revision + 1 }));
  void ensureContext(view);
}
