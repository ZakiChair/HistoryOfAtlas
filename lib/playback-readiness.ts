const waitingMaps = new Set<symbol>();

/** Ephemeral rendering readiness, never persisted in the URL or historical data. */
export function isPlaybackMapReady(): boolean {
  return waitingMaps.size === 0;
}

/** Each mounted map owns its lock; stale asynchronous callbacks cannot revive it. */
export function createPlaybackMapGate() {
  const owner = Symbol('playback-map');
  let disposed = false;
  waitingMaps.add(owner);
  return {
    wait() {
      if (!disposed) waitingMaps.add(owner);
    },
    ready() {
      if (!disposed) waitingMaps.delete(owner);
    },
    dispose() {
      disposed = true;
      waitingMaps.delete(owner);
    },
  };
}

/** Count only frames of playable time, preserving fractions but not loading debt. */
export function createPlaybackFrameClock() {
  let previous: number | null = null;
  let previouslyReady = false;
  return {
    next(time: number, ready: boolean): number | null {
      const elapsed = previous === null || !previouslyReady ? 0 : time - previous;
      // Advance the clock even when rendering is blocked. On resumption, the
      // first frame establishes a new timestamp rather than catching up a stall.
      previous = time;
      previouslyReady = ready;
      return ready ? elapsed : null;
    },
    reset() {
      previous = null;
      previouslyReady = false;
    },
  };
}
