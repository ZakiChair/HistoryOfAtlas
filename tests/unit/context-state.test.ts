import { beforeEach, describe, expect, it } from 'vitest';
import { parseAtlasUrl, serializeAtlasUrl, useAtlasStore } from '@/lib/store';
import { changesInPeriod, ChangesDatasetSchema } from '@/lib/context/changes';
import { rangeForYear, selectedTerritorySubject, territorySelection } from '@/lib/context/types';

describe('shareable historical context', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it.each([
    ['changes', 'vienna-1815'],
    ['coverage', 'north-america'],
    ['networks', 'silk-roads-changan-tianshan'],
    ['cities', 'Q85'],
  ] as const)(
    'roundtrips the %s view and its selection with camera and period',
    (contextView, contextSelection) => {
      const state = parseAtlasUrl(
        `?lang=fr&y=0&from=-2&to=10&lon=-73.125&lat=41.5&z=3.75&context=${contextView}&contextItem=${contextSelection}`,
      );
      expect(state).toMatchObject({ contextView, contextSelection, year: 0, range: [-2, 10] });
      const query = new URLSearchParams(serializeAtlasUrl(state));
      expect(query.get('context')).toBe(contextView);
      expect(query.get('contextItem')).toBe(contextSelection);
      expect(parseAtlasUrl(query)).toEqual(state);
    },
  );

  it.each(['<script>', '../source', 'x'.repeat(201), ''])(
    'rejects unsafe context IDs: %s',
    (id) => {
      const query = new URLSearchParams({ context: 'changes', contextItem: id });
      expect(parseAtlasUrl(query)).toMatchObject({
        contextView: 'changes',
        contextSelection: null,
      });
      useAtlasStore.getState().patchState({ contextView: 'changes', contextSelection: id });
      expect(useAtlasStore.getState().contextSelection).toBeNull();
    },
  );

  it('roundtrips a territory population record through the selection field', () => {
    const contextSelection = territorySelection('Q172579');
    expect(selectedTerritorySubject(contextSelection)).toBe('Q172579');
    expect(selectedTerritorySubject('Q85')).toBeNull();
    expect(selectedTerritorySubject(null)).toBeNull();
    const state = parseAtlasUrl(`?context=cities&contextItem=${contextSelection}`);
    expect(state.contextSelection).toBe(contextSelection);
    expect(new URLSearchParams(serializeAtlasUrl(state)).get('contextItem')).toBe(contextSelection);
  });

  it('keeps a period when navigating inside it and clears only a conflicting one', () => {
    expect(rangeForYear([1800, 1820], 1815)).toEqual([1800, 1820]);
    expect(rangeForYear([1800, 1820], 1800)).toEqual([1800, 1820]);
    expect(rangeForYear([1800, 1820], 1820)).toEqual([1800, 1820]);
    expect(rangeForYear([1800, 1820], 1821)).toBeNull();
    expect(rangeForYear([-5, 5], 0)).toEqual([-5, 5]);
    expect(rangeForYear(null, 1815)).toBeNull();
  });

  it('never lets a reconstruction and the reading panel share the map', () => {
    expect(parseAtlasUrl('?battle=1&context=changes&contextItem=vienna-1815')).toMatchObject({
      battleMode: true,
      contextView: null,
      contextSelection: null,
    });
    const store = useAtlasStore.getState();
    store.patchState({ contextView: 'changes', contextSelection: 'vienna-1815' });
    store.setBattleMode(true);
    expect(useAtlasStore.getState()).toMatchObject({ contextView: null, contextSelection: null });
    store.setBattleMode(false);
    store.patchState({ contextView: 'cities' });
    store.patchState({ battleMode: true });
    expect(useAtlasStore.getState().contextView).toBeNull();
  });

  it('drops a context selection when its view is unknown, changed, closed or reset', () => {
    expect(parseAtlasUrl('?context=unknown&contextItem=vienna-1815')).toMatchObject({
      contextView: null,
      contextSelection: null,
    });
    expect(parseAtlasUrl('?contextItem=vienna-1815').contextSelection).toBeNull();
    const state = useAtlasStore.getState();
    state.patchState({
      year: 1815,
      range: [1800, 1900],
      contextView: 'changes',
      contextSelection: 'vienna-1815',
    });
    state.patchState({ contextView: 'coverage' });
    expect(useAtlasStore.getState()).toMatchObject({
      contextSelection: null,
      year: 1815,
      range: [1800, 1900],
    });
    state.patchState({ contextSelection: 'europe' });
    state.patchState({ contextView: null });
    expect(
      new URLSearchParams(serializeAtlasUrl(useAtlasStore.getState())).has('contextItem'),
    ).toBe(false);
    expect(useAtlasStore.getState().contextSelection).toBeNull();
    state.patchState({ contextView: 'networks', contextSelection: 'great-migration-us' });
    state.reset();
    expect(useAtlasStore.getState()).toMatchObject({ contextView: null, contextSelection: null });
  });
});

describe('documented transformation reading window', () => {
  const copy = { fr: 'Fixture structurelle', en: 'Structural fixture' };
  const changes = ChangesDatasetSchema.parse({
    version: 1,
    reviewedAt: '2026-09-30',
    changes: [-11, -10, 0, 10, 11].map((year, index) => ({
      id: `fixture-${index}`,
      year,
      title: copy,
      mechanism: copy,
      consequence: copy,
      limits: copy,
      coordinates: [0, 0],
      sources: [{ label: 'Fixture', url: 'https://example.org' }],
    })),
  }).changes;

  it('includes exactly the labelled plus/minus ten-year window around astronomical zero', () => {
    expect(changesInPeriod(changes, 0, null).map((change) => change.year)).toEqual([-10, 0, 10]);
  });

  it('uses an explicit inclusive period instead of retaining the neighbouring-year window', () => {
    expect(changesInPeriod(changes, 1800, [-11, -10]).map((change) => change.year)).toEqual([
      -11, -10,
    ]);
    expect(changesInPeriod(changes, 0, [10, 10]).map((change) => change.year)).toEqual([10]);
    expect(changesInPeriod(changes, 0, [1, 9])).toEqual([]);
  });
});
