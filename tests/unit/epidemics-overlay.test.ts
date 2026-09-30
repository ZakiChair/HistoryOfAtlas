import { beforeEach, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapInstance } from 'maplibre-gl';
import { epidemicFixture } from '../fixtures/epidemics';
import { createInitialAtlasState } from '../../lib/store';
import { useEpidemicStore } from '../../lib/epidemics/store';
import { EPIDEMIC_TIME } from '../../lib/epidemics/time';
import {
  epidemicFeatures,
  epidemicFilter,
  startEpidemicOverlay,
} from '../../components/map/epidemic-overlay';

const getDataset = vi.hoisted(() => vi.fn());
vi.mock('../../lib/epidemics/client', () => ({ getEpidemicDataset: getDataset }));
vi.mock('../../components/map/epidemic-sprites', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/map/epidemic-sprites')>()),
  createEpidemicSprites: () => ({ ensure: vi.fn(), dispose: vi.fn() }),
}));

function mapDouble() {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<string, unknown>();
  const handlers = new Map<string, (event: unknown) => void>();
  const map = {
    addSource: vi.fn((id: string, source: unknown) => sources.set(id, source)),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: vi.fn((layer: LayerSpecification) => layers.set(layer.id, layer)),
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    removeLayer: (id: string) => layers.delete(id),
    moveLayer: vi.fn((id: string) => {
      const layer = layers.get(id);
      if (layer) {
        layers.delete(id);
        layers.set(id, layer);
      }
    }),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: (id: string, key: string, value: unknown) => {
      const layer = layers.get(id)!;
      layer.layout = { ...layer.layout, [key]: value };
    },
    getCanvas: () => ({ style: { cursor: '' } }),
    queryRenderedFeatures: () => [],
    triggerRepaint: vi.fn(),
    isSourceLoaded: vi.fn(() => true),
    on: (type: string, id: string, handler: (event: unknown) => void) =>
      handlers.set(`${type}:${id}`, handler),
    off: (type: string, id: string) => handlers.delete(`${type}:${id}`),
  };
  return { map: map as unknown as MapInstance, layers, sources, handlers, calls: map };
}
const enabled = () => ({
  ...createInitialAtlasState(),
  epidemicsVisible: true,
  year: 1347,
});

beforeEach(() => {
  getDataset.mockReset().mockResolvedValue(epidemicFixture());
  useEpidemicStore.setState({
    status: 'idle',
    selected: null,
    dataset: null,
    panelOpen: false,
    visibleMilestones: [],
    revision: 0,
  });
});

it('installs once and filters years without removing/reloading map geometry', async () => {
  const { map, calls, sources } = mapDouble();
  const overlay = startEpidemicOverlay(map);
  overlay.update(createInitialAtlasState());
  expect(getDataset).not.toHaveBeenCalled();
  overlay.update(enabled());
  await vi.waitFor(() => expect(useEpidemicStore.getState().status).toBe('ready'));
  expect(calls.addSource).toHaveBeenCalledTimes(2);
  const geometry = sources.get('epidemic-history');
  expect(geometry).toBeDefined();
  expect(sources.get('epidemic-spread')).toBeDefined();
  expect(calls.setFilter).toHaveBeenCalledWith('epidemic-milestones', [
    'all',
    ['==', ['get', 'shape'], 'point'],
    EPIDEMIC_TIME.filter(1347),
  ]);
  overlay.update({ ...enabled(), year: 1400 });
  expect(sources.get('epidemic-history')).toBe(geometry);
  expect(calls.addSource).toHaveBeenCalledTimes(2);
  expect(getDataset).toHaveBeenCalledTimes(1);
  calls.moveLayer.mockClear();
  overlay.update({ ...enabled(), year: 1401 });
  expect(calls.moveLayer).not.toHaveBeenCalled();
  overlay.dispose();
});

it('keeps outbreaks through their interval plus grace, ongoing ones indefinitely', async () => {
  const { map } = mapDouble();
  const overlay = startEpidemicOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useEpidemicStore.getState().status).toBe('ready'));
  const visible = () => useEpidemicStore.getState().visibleMilestones.map((item) => item.id);
  // 1347: the emergence (1346–1347) and the Constantinople wave (1347–1348) are active.
  expect(visible()).toEqual(['plague-emergence', 'plague-constantinople']);
  // Still inside the 25-year grace after 1348.
  overlay.update({ ...enabled(), year: 1365 });
  expect(visible()).toEqual(['plague-emergence', 'plague-constantinople']);
  // 1400: grace over; nothing until later milestones.
  overlay.update({ ...enabled(), year: 1400 });
  expect(visible()).toEqual([]);
  // The ongoing HIV-like milestone never leaves once reached.
  overlay.update({ ...enabled(), year: 2100 });
  expect(visible()).toContain('hiv-ongoing');
  overlay.dispose();
});

it('marks emergence and eradication emblems and clears selections out of view', async () => {
  const features = epidemicFeatures(epidemicFixture());
  const point = (id: string) => features.features.find((item) => item.id === `${id}-point`)!;
  expect(point('plague-emergence').properties?.emblem).toBe('origin');
  expect(point('plague-constantinople').properties?.emblem).toBe('plain');
  expect(point('smallpox-eradication').properties?.emblem).toBe('closing');
  expect(point('smallpox-origin').properties?.closedYear).toBe(1980);

  const { map, handlers } = mapDouble();
  const overlay = startEpidemicOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useEpidemicStore.getState().status).toBe('ready'));
  const click = handlers.get('click:epidemic-milestones')!;
  click({
    point: { x: 1, y: 1 },
    features: [{ properties: { id: 'plague-constantinople' } }],
    preventDefault: vi.fn(),
  });
  expect(useEpidemicStore.getState().selected?.id).toBe('plague-constantinople');
  overlay.update({ ...enabled(), year: 1400 });
  expect(useEpidemicStore.getState().selected).toBeNull();
  overlay.dispose();
  expect(handlers.size).toBe(0);
});

it('epidemicFilter builds the point clause over year and endYear', () => {
  expect(epidemicFilter(1347, 'plague')).toEqual([
    'all',
    ['==', ['get', 'shape'], 'point'],
    [
      'all',
      ['<=', ['get', 'year'], 1347],
      ['any', ['!', ['has', 'endYear']], ['>=', ['+', ['get', 'endYear'], 25], 1347]],
    ],
    ['==', ['get', 'theme'], 'plague'],
  ]);
});
