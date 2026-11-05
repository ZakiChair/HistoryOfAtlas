import { beforeEach, describe, expect, it } from 'vitest';
import * as panel from '@/components/panels/EntityPanel';
import { useAtlasStore } from '@/lib/store';
import { CURRENT_YEAR, MIN_YEAR } from '@/lib/eras';

const observations = [
  { fromYear: -2, toYear: 0, areaKm2: 100 },
  { fromYear: 5, toYear: 9, areaKm2: 200 },
  { fromYear: 10, toYear: 12, areaKm2: 150 },
];

describe('territorial observation navigation', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('keeps an undocumented gap empty while offering its nearest documented observations', () => {
    expect(panel.observationNavigation).toBeTypeOf('function');
    expect(panel.observationNavigation(observations, 3)).toEqual({
      active: undefined,
      previous: observations[0],
      next: observations[1],
    });
  });

  it.each([
    { year: -5, active: undefined, previous: undefined, next: 0 },
    { year: 0, active: 0, previous: undefined, next: 1 },
    { year: 7, active: 1, previous: 0, next: 2 },
    { year: 10, active: 2, previous: 1, next: undefined },
    { year: 15, active: undefined, previous: 2, next: undefined },
  ])('respects interval boundaries at year $year', ({ year, active, previous, next }) => {
    expect(panel.observationNavigation).toBeTypeOf('function');
    expect(panel.observationNavigation(observations, year)).toEqual({
      active: active === undefined ? undefined : observations[active],
      previous: previous === undefined ? undefined : observations[previous],
      next: next === undefined ? undefined : observations[next],
    });
  });

  it('locates the chosen year without inventing an area inside a gap', () => {
    expect(panel.areaPath(observations, 5).current).toEqual({ x: 170, y: 16 });
    expect(panel.areaPath(observations, 0).current).toEqual({ x: 57.14285714285714, y: 60 });
    expect(panel.areaPath(observations, 3).current?.y).toBeNull();
    expect(panel.areaPath(observations, -3).current).toBeNull();
    expect(panel.areaPath([], 3).current).toBeNull();
  });

  it('stops following and clears a conflicting range before navigating to the sourced date', () => {
    expect(panel.selectTerritorialObservation).toBeTypeOf('function');
    useAtlasStore.getState().patchState({
      selectedEntity: 'clio-ab12',
      year: -1,
      range: [-2, 0],
      entityFollowing: true,
    });
    panel.selectTerritorialObservation(observations[1]);
    expect(useAtlasStore.getState()).toMatchObject({
      selectedEntity: 'clio-ab12',
      year: 5,
      range: null,
      playing: false,
      entityFollowing: false,
    });
  });

  it('stops ordinary playback while preserving a range that includes the destination', () => {
    expect(panel.selectTerritorialObservation).toBeTypeOf('function');
    useAtlasStore.getState().patchState({ year: 10, range: [-2, 12], playing: true });
    panel.selectTerritorialObservation(observations[0]);
    expect(useAtlasStore.getState()).toMatchObject({
      year: -2,
      range: [-2, 12],
      playing: false,
      entityFollowing: false,
    });
  });

  it('skips source snapshots outside the atlas while retaining reachable intervals', () => {
    const history = [
      { fromYear: -3999, toYear: -3999, areaKm2: 100 },
      { fromYear: -3000, toYear: -2000, areaKm2: 200 },
      { fromYear: CURRENT_YEAR + 1, toYear: CURRENT_YEAR + 1, areaKm2: 300 },
    ];
    expect(panel.observationNavigation(history, MIN_YEAR)).toEqual({
      active: undefined,
      previous: undefined,
      next: history[1],
    });
    expect(panel.observationNavigation(history, -3000)).toEqual({
      active: history[1],
      previous: undefined,
      next: undefined,
    });
  });

  it('enters a partly reachable interval at the first year supported by the atlas', () => {
    useAtlasStore.getState().setYear(100);
    panel.selectTerritorialObservation({ fromYear: -3999, toYear: -3000, areaKm2: 100 });
    expect(useAtlasStore.getState().year).toBe(-3500);
  });

  it('does not stop playback or pretend to navigate to an inaccessible source snapshot', () => {
    useAtlasStore.getState().patchState({ year: MIN_YEAR, playing: true });
    const before = useAtlasStore.getState();
    panel.selectTerritorialObservation({ fromYear: -3999, toYear: -3999, areaKm2: 100 });
    expect(useAtlasStore.getState()).toBe(before);
  });
});
