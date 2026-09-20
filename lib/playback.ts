import { CURRENT_YEAR, yearToPosition } from './eras';

export interface DensityYear {
  year: number;
  count: number;
}
export interface PlaybackPosition {
  year: number;
  remainder: number;
}

export function densitySlowdown(count: number): number {
  return 1 + Math.min(7, Math.log2(1 + Math.max(0, count)) / 2);
}

/** Clamp long frames so returning to a background tab never skips centuries. */
export function advancePlayback(
  position: PlaybackPosition,
  elapsedMs: number,
  speed: number,
  eventCount: number,
  maxYear = CURRENT_YEAR,
): PlaybackPosition & { finished: boolean } {
  const elapsed = Math.max(0, Math.min(250, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const progress = position.remainder + ((elapsed / 1000) * speed) / densitySlowdown(eventCount);
  const years = Math.floor(progress + 1e-9);
  const year = Math.min(maxYear, position.year + years);
  const finished = year >= maxYear;
  return { year, remainder: finished ? 0 : Math.max(0, progress - years), finished };
}

export function buildDensityBins(
  density: readonly DensityYear[],
  count = 180,
  maxYear = CURRENT_YEAR,
): number[] {
  const bins = Array.from({ length: Math.max(1, Math.floor(count)) }, () => 0);
  for (const item of density) {
    if (!Number.isFinite(item.year) || !Number.isFinite(item.count) || item.count <= 0) continue;
    const index = Math.min(
      bins.length - 1,
      Math.floor(yearToPosition(item.year, maxYear) * bins.length),
    );
    bins[index]! += item.count;
  }
  return bins;
}
