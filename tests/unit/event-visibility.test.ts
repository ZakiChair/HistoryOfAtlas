import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createInitialAtlasState } from '../../lib/store';
import { isEventLayerVisible } from '../../lib/event-visibility';
import { eventFilter, selectedEventFilter } from '../../components/map/event-filters';

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { featureFilter } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  featureFilter: (
    filter: unknown,
    rootKey: string,
  ) => {
    filter: (
      globals: { zoom: number },
      feature: { type: string; properties: Record<string, unknown> },
    ) => boolean;
  };
};

const state = {
  ...createInitialAtlasState(),
  year: 1815,
  selectedEvent: 'Q1',
  battlesVisible: false,
};
const properties = {
  id: 'Q1',
  start: 1815,
  end: 1815,
  importance: 100,
  era: 'industrial',
  region: 'europe',
};

describe('battle layer filtering across map presentations', () => {
  it.each([
    ['battle', false],
    ['siege', false],
    ['naval', false],
    ['treaty', true],
    ['war', true],
    ['campaign', true],
  ])('applies the same visibility for %s to the list, map and selection halo', (type, visible) => {
    expect(isEventLayerVisible(String(type), false)).toBe(visible);
    for (const filter of [eventFilter(state), selectedEventFilter(state)]) {
      const compiled = featureFilter(filter, 'layers[0].filter');
      expect(
        compiled.filter({ zoom: 1.8 }, { type: 'Point', properties: { ...properties, type } }),
      ).toBe(visible);
    }
  });

  it('restores each battle category when its layer is shown again', () => {
    for (const type of ['battle', 'siege', 'naval']) {
      expect(isEventLayerVisible(type, true)).toBe(true);
      for (const filter of [
        eventFilter({ ...state, battlesVisible: true }),
        selectedEventFilter({ ...state, battlesVisible: true }),
      ]) {
        const compiled = featureFilter(filter, 'layers[0].filter');
        expect(
          compiled.filter({ zoom: 1.8 }, { type: 'Point', properties: { ...properties, type } }),
        ).toBe(true);
      }
    }
  });

  it('keeps the selected marker independent from the time window without bypassing visibility', () => {
    const compiled = featureFilter(selectedEventFilter(state), 'layers[0].filter');
    expect(
      compiled.filter(
        { zoom: 1.8 },
        {
          type: 'Point',
          properties: { ...properties, start: 1700, end: 1700, type: 'battle' },
        },
      ),
    ).toBe(false);
    expect(
      compiled.filter(
        { zoom: 1.8 },
        {
          type: 'Point',
          properties: { ...properties, start: 1700, end: 1700, type: 'treaty' },
        },
      ),
    ).toBe(true);
    expect(
      compiled.filter(
        { zoom: 1.8 },
        {
          type: 'Point',
          properties: { ...properties, id: 'Q2', type: 'treaty' },
        },
      ),
    ).toBe(false);
  });

  it('combines layer visibility with existing event-type filters', () => {
    const compiled = featureFilter(
      eventFilter({
        ...state,
        filters: { ...state.filters, types: ['battle', 'treaty'] },
      }),
      'layers[0].filter',
    );
    for (const [type, visible] of [
      ['battle', false],
      ['treaty', true],
      ['war', false],
    ])
      expect(
        compiled.filter({ zoom: 1.8 }, { type: 'Point', properties: { ...properties, type } }),
      ).toBe(visible);
  });
});
