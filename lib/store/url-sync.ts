import { serializeAtlasUrl, type AtlasState } from './index';

export interface AtlasUrlSyncOptions {
  getState: () => AtlasState;
  subscribe: (listener: (state: AtlasState, previous: AtlasState) => void) => () => void;
  readQuery: () => string;
  writeQuery: (query: string) => void;
  hydrateQuery: (query: string) => void;
}

const WRITE_INTERVAL_MS = 250;

/** A leading/trailing throttle keeps links current even when playback never becomes quiet. */
export function createAtlasUrlSync(options: AtlasUrlSyncOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastWrite: number | undefined;
  let dirty = false;
  let restoring = false;
  let disposed = false;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    dirty = false;
    lastWrite = undefined;
  };
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (disposed || restoring || !dirty) return;
    dirty = false;
    lastWrite = performance.now();
    // Read at publication time; a captured subscription argument may already be obsolete.
    const query = serializeAtlasUrl(options.getState());
    if (options.readQuery() !== query) options.writeQuery(query);
  };
  const unsubscribe = options.subscribe((state, previous) => {
    if (disposed || restoring) return;
    dirty = true;
    const paused =
      (previous.playing && !state.playing) ||
      (previous.campaignPlaying && !state.campaignPlaying) ||
      (previous.entityFollowing && !state.entityFollowing);
    const elapsed = lastWrite === undefined ? WRITE_INTERVAL_MS : performance.now() - lastWrite;
    if (paused || elapsed >= WRITE_INTERVAL_MS) flush();
    else if (timer === undefined) timer = setTimeout(flush, WRITE_INTERVAL_MS - elapsed);
  });

  return {
    restore() {
      if (disposed) return;
      cancel();
      restoring = true;
      try {
        options.hydrateQuery(options.readQuery());
      } finally {
        restoring = false;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      cancel();
    },
  };
}
