import { afterEach, describe, expect, it } from 'vitest';
import { advancePlayback } from '../../lib/playback';
import {
  createPlaybackFrameClock,
  createPlaybackMapGate,
  isPlaybackMapReady,
} from '../../lib/playback-readiness';

const gates: ReturnType<typeof createPlaybackMapGate>[] = [];
function mapGate() {
  const gate = createPlaybackMapGate();
  gates.push(gate);
  return gate;
}

afterEach(() => {
  for (const gate of gates.splice(0)) gate.dispose();
});

describe('playback waits for the rendered map', () => {
  it('blocks a newly mounted map until its first ready frame and can wait again', () => {
    expect(isPlaybackMapReady()).toBe(true);
    const gate = mapGate();
    expect(isPlaybackMapReady()).toBe(false);
    gate.ready();
    gate.ready();
    expect(isPlaybackMapReady()).toBe(true);
    gate.wait();
    gate.wait();
    expect(isPlaybackMapReady()).toBe(false);
    gate.ready();
    expect(isPlaybackMapReady()).toBe(true);
  });

  it('a ready or disposed map cannot unlock a different map that is still waiting', () => {
    const first = mapGate();
    const second = mapGate();
    first.ready();
    expect(isPlaybackMapReady()).toBe(false);
    first.dispose();
    expect(isPlaybackMapReady()).toBe(false);
    second.ready();
    expect(isPlaybackMapReady()).toBe(true);
  });

  it('ignores callbacks from a disposed StrictMode owner after a replacement mounts', () => {
    const previous = mapGate();
    previous.dispose();
    const replacement = mapGate();
    previous.ready();
    expect(isPlaybackMapReady()).toBe(false);
    replacement.ready();
    previous.wait();
    previous.dispose();
    expect(isPlaybackMapReady()).toBe(true);
  });

  it('does not turn a long tile-loading wait into historical years at resumption', () => {
    const gate = mapGate();
    const clock = createPlaybackFrameClock();
    let position = { year: 1785, remainder: 0 };
    const frame = (time: number) => {
      const elapsed = clock.next(time, isPlaybackMapReady());
      if (elapsed !== null) position = advancePlayback(position, elapsed, 100, 0, 2026);
      return elapsed;
    };
    gate.ready();
    expect(frame(1000)).toBe(0);
    frame(1005);
    expect(position).toMatchObject({ year: 1785, remainder: 0.5 });
    gate.wait();
    expect(frame(1010)).toBeNull();
    expect(frame(9000)).toBeNull();
    gate.ready();
    // Even a browser frame delayed after the ready signal is not loading debt.
    expect(frame(9200)).toBe(0);
    expect(position.year).toBe(1785);
    frame(9205);
    expect(position).toMatchObject({ year: 1786, remainder: 0 });
  });

  it('restarting after pause discards the earlier timestamp', () => {
    const clock = createPlaybackFrameClock();
    expect(clock.next(10, true)).toBe(0);
    expect(clock.next(30, true)).toBe(20);
    clock.reset();
    expect(clock.next(3_600_000, true)).toBe(0);
    expect(clock.next(3_600_010, true)).toBe(10);
  });
});
