import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { FilterSpecification, Map as MapInstance, MapGeoJSONFeature } from 'maplibre-gl';
import { queryViewportFeatures } from '../../components/map/query-viewport';
import { eventFilter } from '../../components/map/event-filters';
import { createInitialAtlasState } from '../../lib/store';

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

const feature = (id: string, source = 'events') =>
  ({
    source,
    sourceLayer: 'events',
    properties: { id },
  }) as unknown as MapGeoJSONFeature;

describe('rendered viewport queries on a globe', () => {
  it('queries every viewport cell and deduplicates features crossing cell edges', () => {
    const queryRenderedFeatures = vi.fn((box?: unknown) =>
      Array.isArray(box) ? [feature('Q1'), feature('Q2'), feature('Q1', 'another-source')] : [],
    );
    const map = {
      getProjection: () => ({ type: 'globe' }),
      getCanvas: () => ({ clientWidth: 600, clientHeight: 300 }),
      queryRenderedFeatures,
    } as unknown as MapInstance;
    const result = queryViewportFeatures(map, ['event-cluster-query']);
    expect(result).toHaveLength(3);
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(6);
    expect(queryRenderedFeatures).toHaveBeenNthCalledWith(
      1,
      [
        [0, 0],
        [256, 256],
      ],
      { layers: ['event-cluster-query'] },
    );
    expect(queryRenderedFeatures).toHaveBeenLastCalledWith(
      [
        [512, 256],
        [600, 300],
      ],
      { layers: ['event-cluster-query'] },
    );
  });

  it('keeps the native single query for Mercator and never queries a zero-size globe', () => {
    const expected = [feature('Q1')];
    const queryRenderedFeatures = vi.fn(() => expected);
    const map = {
      getProjection: () => ({ type: 'mercator' }),
      getCanvas: () => ({ clientWidth: 0, clientHeight: 0 }),
      queryRenderedFeatures,
    } as unknown as MapInstance;
    expect(queryViewportFeatures(map, ['events'])).toBe(expected);
    expect(queryRenderedFeatures).toHaveBeenCalledWith({ layers: ['events'] });
    map.getProjection = () => ({ type: 'globe' });
    expect(queryViewportFeatures(map, ['events'])).toEqual([]);
    expect(queryRenderedFeatures).toHaveBeenCalledTimes(1);
  });

  it.each(['globe', 'mercator'])(
    'revalidates old tile features against the current filter on %s',
    (projection) => {
      // MapLibre queries can still see the previous feature bucket while a layer's
      // replacement tiles are being prepared. Only the query filter is synchronous.
      const bucket = ['battle', 'treaty', 'siege', 'naval', 'war', 'campaign'].map(
        (type, index) => ({
          ...feature(`Q${index + 1}`),
          properties: { id: `Q${index + 1}`, type, start: 1812, end: 1812, importance: 100 },
        }),
      );
      type Query = { filter?: FilterSpecification };
      const map = {
        getProjection: () => ({ type: projection }),
        getCanvas: () => ({ clientWidth: 600, clientHeight: 300 }),
        queryRenderedFeatures: (boxOrOptions: unknown, options?: Query) => {
          const query = options ?? (boxOrOptions as Query);
          const compiled = featureFilter(query.filter, 'queryRenderedFeatures.filter');
          return bucket.filter((item) =>
            compiled.filter({ zoom: 1.8 }, { type: 'Point', properties: item.properties }),
          );
        },
      } as unknown as MapInstance;
      const state = { ...createInitialAtlasState(), battlesVisible: false };
      expect(
        queryViewportFeatures(map, ['event-cluster-query'], eventFilter(state)).map(
          (item) => item.properties.id,
        ),
        // Hiding battles hides every armed conflict: only the treaty remains.
      ).toEqual(['Q2']);
      expect(
        queryViewportFeatures(
          map,
          ['event-cluster-query'],
          eventFilter({ ...state, battlesVisible: true }),
        ).map((item) => item.properties.id),
      ).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
    },
  );
});
