import { describe, expect, it } from 'vitest';
import { advancePlayback, densitySlowdown, buildDensityBins } from '../../lib/playback';

describe('timeline playback', () => {
  it('accumulates fractions so low speeds progress correctly over multiple frames', () => {
    let state = { year: 1812, remainder: 0 };
    for (let index = 0; index < 9; index++) state = advancePlayback(state, 100, 1, 0, 2026);
    expect(state.year).toBe(1812);
    state = advancePlayback(state, 100, 1, 0, 2026);
    expect(state.year).toBe(1813);
  });

  it('slows dense years and caps catch-up after the browser was suspended', () => {
    expect(densitySlowdown(100)).toBeGreaterThan(densitySlowdown(0));
    expect(advancePlayback({ year: 1812, remainder: 0 }, 250, 100, 100, 2026).year).toBeLessThan(
      1837,
    );
    expect(advancePlayback({ year: 1812, remainder: 0 }, 60_000, 100, 0, 2026).year).toBe(1837);
  });

  it('stops at the end of the supported timeline without wrapping', () => {
    expect(advancePlayback({ year: 2025, remainder: 0 }, 250, 100, 0, 2026)).toEqual({
      year: 2026,
      remainder: 0,
      finished: true,
    });
  });

  it('aggregates source counts into bounded histogram bins', () => {
    const bins = buildDensityBins(
      [
        { year: -3500, count: 2 },
        { year: -3500, count: 3 },
        { year: 2026, count: 7 },
      ],
      4,
      2026,
    );
    expect(bins).toEqual([5, 0, 0, 7]);
  });
});
