import { describe, expect, it, vi } from 'vitest';
import type { Map as MapInstance, MapGeoJSONFeature } from 'maplibre-gl';
import { queryViewportFeatures } from '../../components/map/query-viewport';

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
});
