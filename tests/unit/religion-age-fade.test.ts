import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapInstance } from 'maplibre-gl';
import { religionFixture } from '../fixtures/religions';
import { createInitialAtlasState } from '../../lib/store';
import { useReligionStore } from '../../lib/religions/store';
import {
  religionAgeOpacity,
  religionAgePaint,
  startReligionOverlay,
} from '../../components/map/religion-overlay';

const getDataset = vi.hoisted(() => vi.fn());
vi.mock('../../lib/religions/client', () => ({ getReligionDataset: getDataset }));
vi.mock('../../components/map/religion-sprites', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/map/religion-sprites')>()),
  createReligionSprites: () => ({ ensure: vi.fn(), dispose: vi.fn() }),
}));

const require = createRequire(import.meta.url);
const mapRequire = createRequire(require.resolve('maplibre-gl/package.json'));
const { createExpression, latest } = mapRequire('@maplibre/maplibre-gl-style-spec') as {
  createExpression: (
    expression: unknown,
    spec: unknown,
  ) => {
    result: string;
    value: {
      evaluate: (
        globals: { zoom: number },
        feature: { type: string; properties: Record<string, unknown> },
      ) => number;
    };
  };
  latest: Record<string, Record<string, unknown>>;
};

function opacityAt(
  expression: unknown,
  year: number,
  layer = 'paint_symbol',
  key = 'icon-opacity',
) {
  const compiled = createExpression(expression, latest[layer]![key]);
  expect(compiled.result).toBe('success');
  return compiled.value.evaluate({ zoom: 3 }, { type: 'Point', properties: { year } });
}

function mapDouble() {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<string, unknown>();
  const paint: [string, string, unknown][] = [];
  const hidden: string[] = [];
  const map = {
    addSource: vi.fn((id: string, source: unknown) => sources.set(id, source)),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: vi.fn((layer: LayerSpecification) => layers.set(layer.id, layer)),
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    removeLayer: (id: string) => layers.delete(id),
    moveLayer: vi.fn(),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn((id: string, key: string, value: unknown) =>
      paint.push([id, key, value]),
    ),
    setLayoutProperty: (id: string, key: string, value: unknown) => {
      if (key === 'visibility' && value === 'none') hidden.push(id);
    },
    getCanvas: () => ({ style: { cursor: '' } }),
    queryRenderedFeatures: () => [],
    triggerRepaint: vi.fn(),
    isSourceLoaded: vi.fn(() => true),
    on: vi.fn(),
    off: vi.fn(),
  };
  return { map: map as unknown as MapInstance, paint, hidden, calls: map };
}

beforeEach(() => {
  getDataset.mockReset().mockResolvedValue(religionFixture);
  useReligionStore.setState({
    status: 'idle',
    selected: null,
    dataset: null,
    panelOpen: false,
    visibleMilestones: [],
    revision: 0,
  });
});

describe('religion attestation age fade', () => {
  it('fades milestones by age: 0 → 1, 500 → 0.8, 1,500 years and older → 0.45', () => {
    const expression = religionAgeOpacity(1950);
    expect(opacityAt(expression, 1950)).toBe(1);
    expect(opacityAt(expression, 1450)).toBeCloseTo(0.8);
    expect(opacityAt(expression, 450)).toBeCloseTo(0.45);
    expect(opacityAt(expression, -1000)).toBeCloseTo(0.45);
    expect(opacityAt(expression, 1700)).toBeCloseTo(0.9);
  });

  it('fades diffusion routes twice as fast and scales each layer’s base opacity', () => {
    const paint = new Map(
      religionAgePaint(1950, 'dark').map(([id, key, value]) => [`${id}:${key}`, value]),
    );
    const route = paint.get('religion-routes:line-opacity');
    expect(opacityAt(route, 1700, 'paint_line', 'line-opacity')).toBeCloseTo(0.95 * 0.8);
    expect(opacityAt(route, 1200, 'paint_line', 'line-opacity')).toBeCloseTo(0.95 * 0.45);
    const hatch = paint.get('religion-areas:fill-opacity');
    expect(opacityAt(hatch, 1950, 'paint_fill', 'fill-opacity')).toBeCloseTo(0.42);
    expect(opacityAt(hatch, 0, 'paint_fill', 'fill-opacity')).toBeCloseTo(0.42 * 0.45);
    // The selected emblem and its ring always stay fully opaque.
    expect([...paint.keys()].some((key) => key.startsWith('religion-selection'))).toBe(false);
  });

  it('updates paint with the date, never the geometry or the visibility', async () => {
    const { map, paint, hidden, calls } = mapDouble();
    const overlay = startReligionOverlay(map);
    const enabled = { ...createInitialAtlasState(), religionsVisible: true, year: -500 };
    overlay.update(enabled);
    await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
    const iconOpacity = () =>
      paint.filter(([id, key]) => id === 'religion-milestones' && key === 'icon-opacity');
    expect(iconOpacity().at(-1)?.[2]).toEqual(religionAgeOpacity(-500));
    for (const year of [-499, -498, 0, 1950]) overlay.update({ ...enabled, year });
    expect(iconOpacity().at(-1)?.[2]).toEqual(religionAgeOpacity(1950));
    expect(iconOpacity()).toHaveLength(5);
    // The same date again writes nothing.
    overlay.update({ ...enabled, year: 1950 });
    expect(iconOpacity()).toHaveLength(5);
    overlay.update({ ...enabled, year: 1950, theme: 'light' });
    const hatch = paint.filter(([id, key]) => id === 'religion-areas' && key === 'fill-opacity');
    expect(hatch.at(-1)?.[2]).toEqual(religionAgeOpacity(1950, 0.7));
    expect(calls.addSource).toHaveBeenCalledTimes(1);
    expect(hidden).toEqual([]);
    overlay.dispose();
  });
});
