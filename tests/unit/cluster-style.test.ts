import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type {
  LayerSpecification,
  Map as MapInstance,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { attachEventClustering, EVENT_QUERY_LAYER } from '../../components/map/event-clusters';
import { EMPTY_FEATURE_FILTER } from '../../components/map/style-filters';

// Validate against the exact style-spec version used by the installed MapLibre runtime.
const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { validateStyleMin, featureFilter } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  validateStyleMin: (style: StyleSpecification) => { message: string }[];
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

describe('cluster layer style validation', () => {
  it('also disables historical ghost fills with a valid expression filter', () => {
    expect(
      validateStyleMin({
        version: 8,
        sources: {
          territories: { type: 'vector', tiles: ['https://example.org/{z}/{x}/{y}.pbf'] },
        },
        layers: [
          {
            id: 'snapshot-ghost',
            type: 'fill',
            source: 'territories',
            'source-layer': 'territories',
            filter: EMPTY_FEATURE_FILTER,
          },
        ],
      }),
    ).toEqual([]);
    const compiled = featureFilter(EMPTY_FEATURE_FILTER, 'layers[0].filter');
    expect(
      compiled.filter({ zoom: 1.8 }, { type: 'Polygon', properties: { id: 'hb-example' } }),
    ).toBe(false);
    expect(compiled.filter({ zoom: 1.8 }, { type: 'Polygon', properties: {} })).toBe(false);
  });
  it('creates only valid initial layers, including the transparent query filter', () => {
    const layers: LayerSpecification[] = [];
    const sources: Record<string, SourceSpecification> = {
      events: { type: 'vector', tiles: ['https://example.org/{z}/{x}/{y}.pbf'] },
    };
    const map = {
      addLayer: (layer: LayerSpecification) => layers.push(layer),
      addSource: (id: string, source: SourceSpecification) => {
        sources[id] = source;
      },
      on: vi.fn(),
    } as unknown as MapInstance;
    attachEventClustering(map, {
      getState: () => ({ playing: false, mode: 'events' }),
      selectEvent: vi.fn(),
      reducedMotion: true,
    });
    const style: StyleSpecification = {
      version: 8,
      'font-faces': { 'Atlas UI': 'https://example.org/manrope.woff2' },
      sources,
      layers,
    };
    expect(validateStyleMin(style).map((error) => error.message)).toEqual([]);
    expect(layers).toHaveLength(4);
    const query = layers.find((layer) => layer.id === EVENT_QUERY_LAYER)!;
    expect('filter' in query).toBe(true);
    if (!('filter' in query)) throw new Error('Missing query filter');
    const compiled = featureFilter(query.filter, 'layers[0].filter');
    expect(compiled.filter({ zoom: 1.8 }, { type: 'Point', properties: { id: 'Q1' } })).toBe(false);
    expect(compiled.filter({ zoom: 1.8 }, { type: 'Point', properties: {} })).toBe(false);
  });
});
