import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapInstance } from 'maplibre-gl';
import { religionFixture } from '../fixtures/religions';
import type { ReligionDataset } from '../../lib/religions/types';
import { createInitialAtlasState } from '../../lib/store';
import { useReligionStore } from '../../lib/religions/store';
import {
  religionDetailZooms,
  religionFanIndex,
  religionFeatures,
  startReligionOverlay,
} from '../../components/map/religion-overlay';

const getDataset = vi.hoisted(() => vi.fn());
vi.mock('../../lib/religions/client', () => ({ getReligionDataset: getDataset }));
vi.mock('../../components/map/religion-sprites', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/map/religion-sprites')>()),
  createReligionSprites: () => ({ ensure: vi.fn(), dispose: vi.fn() }),
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
    moveLayer: vi.fn(),
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
const enabled = () => ({ ...createInitialAtlasState(), religionsVisible: true, year: -500 });

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

it('installs once and filters years without removing/reloading map geometry', async () => {
  const { map, calls, sources } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update(createInitialAtlasState());
  expect(getDataset).not.toHaveBeenCalled();
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  expect(calls.addSource).toHaveBeenCalledTimes(1);
  const geometry = sources.get('religion-history');
  overlay.update({ ...enabled(), year: -250, religionFilter: 'buddhism' });
  expect(useReligionStore.getState().visibleMilestones).toHaveLength(2);
  expect(calls.setFilter).toHaveBeenCalledWith('religion-milestones', [
    'all',
    ['==', ['get', 'shape'], 'point'],
    ['<=', ['get', 'year'], -250],
    ['==', ['get', 'tradition'], 'buddhism'],
  ]);
  overlay.update({ ...enabled(), year: -251, religionFilter: 'buddhism' });
  expect(useReligionStore.getState().visibleMilestones).toHaveLength(1);
  expect(sources.get('religion-history')).toBe(geometry);
  expect(calls.addSource).toHaveBeenCalledTimes(1);
  expect(getDataset).toHaveBeenCalledTimes(1);
  expect(calls.moveLayer).not.toHaveBeenCalled();
  overlay.dispose();
});

it('independently hides areas and routes and clears future or filtered selections', async () => {
  const { map, layers, handlers } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update({ ...enabled(), year: -250 });
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  const click = handlers.get('click:religion-milestones')!;
  click({
    point: { x: 1, y: 1 },
    features: [{ properties: { id: 'buddhism-sri-lanka' } }],
    preventDefault: vi.fn(),
  });
  expect(useReligionStore.getState().selected?.id).toBe('buddhism-sri-lanka');
  overlay.update({ ...enabled(), religionAreasVisible: false });
  expect(useReligionStore.getState().selected).toBeNull();
  expect(layers.get('religion-areas')?.layout?.visibility).toBe('none');
  expect(layers.get('religion-routes')?.layout?.visibility).toBe('visible');
  overlay.update({ ...enabled(), religionAreasVisible: true, religionRoutesVisible: false });
  expect(layers.get('religion-areas')?.layout?.visibility).toBe('visible');
  expect(layers.get('religion-routes')?.layout?.visibility).toBe('none');
  expect(layers.get('religion-route-directions')?.layout?.visibility).toBe('none');
  overlay.update({ ...enabled(), religionsVisible: false });
  for (const layer of layers.values()) expect(layer.layout?.visibility).toBe('none');
  expect(useReligionStore.getState().panelOpen).toBe(false);
  overlay.dispose();
  expect(handlers.size).toBe(0);
});

it('handles toggle-off during loading and retries failed requests', async () => {
  let resolve!: (value: typeof religionFixture) => void;
  getDataset.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { map, layers } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update(enabled());
  overlay.update({ ...enabled(), religionsVisible: false });
  resolve(religionFixture);
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  for (const layer of layers.values()) expect(layer.layout?.visibility).toBe('none');
  overlay.update(enabled());
  expect(useReligionStore.getState().visibleMilestones).toHaveLength(2);
  overlay.dispose();
  getDataset.mockRejectedValueOnce(new Error('offline'));
  const retry = startReligionOverlay(map);
  retry.update(enabled());
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('error'));
  useReligionStore.getState().retry();
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  retry.dispose();
});

it('does not recreate an overlay after disposal while a request is pending', async () => {
  let resolve!: (value: typeof religionFixture) => void;
  getDataset.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { map, calls } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update(enabled());
  overlay.dispose();
  resolve(religionFixture);
  await Promise.resolve();
  expect(calls.addSource).not.toHaveBeenCalled();
  expect(useReligionStore.getState().status).toBe('idle');
});

it('dates links and regions by their destination evidence and wraps trans-Pacific paths', () => {
  const data = structuredClone(religionFixture);
  data.milestones[0].coordinates = [170, 25];
  data.milestones[1].coordinates = [-170, 8];
  const features = religionFeatures(data).features;
  const route = features.find((item) => item.id === 'buddhism-sri-lanka-route')!;
  expect(route.properties?.year).toBe(-250);
  expect(route.geometry).toEqual({
    type: 'LineString',
    coordinates: [
      [170, 25],
      [190, 8],
    ],
  });
  expect(features.find((item) => item.id === 'buddhism-origin-area')?.properties?.year).toBe(-500);
});

it('fans later milestones around the earliest one drawn at the same place', () => {
  const data = structuredClone(religionFixture);
  const [origin, sriLanka, china, judaism] = data.milestones;
  // Same city, a nearby shrine, and a distinct place a few hundred kilometres away.
  judaism.coordinates = [83, 25];
  sriLanka.coordinates = [83.04, 25.05];
  china.coordinates = [85, 25];
  const fan = religionFanIndex(data);
  const shared = [origin, judaism, sriLanka].sort((a, b) => a.year - b.year);
  expect(shared.map((stage) => fan.get(stage.id))).toEqual([0, 1, 2]);
  expect(fan.get(china.id)).toBe(0);
  const point = religionFeatures(data).features.find((item) => item.id === `${sriLanka.id}-point`);
  expect(point?.properties?.fan).toBe(fan.get(sriLanka.id));
});

it('offsets fanned emblems only among the filtered tradition and shows every emblem under a filter', async () => {
  const data = structuredClone(religionFixture);
  data.milestones[3].coordinates = [...data.milestones[0].coordinates];
  getDataset.mockReset().mockResolvedValue(data);
  const fan = religionFanIndex(data);
  const own = religionFanIndex(data, true);
  const judaism = data.milestones[3];
  const buddhism = data.milestones[0];
  // Judaism (-600) anchors the shared place; alone in its tradition it keeps its true position.
  expect([fan.get(judaism.id), fan.get(buddhism.id)]).toEqual([0, 1]);
  expect([own.get(judaism.id), own.get(buddhism.id)]).toEqual([0, 0]);
  const { map, layers, calls } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  const layout = () => JSON.stringify(layers.get('religion-milestones')?.layout);
  expect(layout()).toContain('"fan"');
  expect(layout()).toContain('religion-dot-');
  overlay.update({ ...enabled(), religionFilter: 'buddhism' });
  expect(layout()).toContain('"fanOwn"');
  // Only milestones crowded within the filtered tradition stay dots.
  expect(layout()).toContain('"detailOwn"');
  expect(JSON.stringify(layers.get('religion-selection')?.layout)).toContain('"fanOwn"');
  overlay.update(enabled());
  expect(layout()).toContain('"fan"');
  expect(layout()).not.toContain('"detailOwn"');
  expect(calls.addSource).toHaveBeenCalledTimes(1);
  overlay.update({ ...enabled(), theme: 'light' });
  expect(calls.setPaintProperty).toHaveBeenCalledWith(
    'religion-route-casing',
    'line-color',
    expect.any(String),
  );
  overlay.dispose();
});

it('selects the origin drawn on top when overlapping emblems are clicked', async () => {
  const { map, handlers } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update({ ...enabled(), year: 200 });
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  handlers.get('click:religion-milestones')!({
    point: { x: 1, y: 1 },
    features: [
      { properties: { id: 'buddhism-china', origin: false } },
      { properties: { id: 'buddhism-origin', origin: true } },
    ],
    preventDefault: vi.fn(),
  });
  expect(useReligionStore.getState().selected?.id).toBe('buddhism-origin');
  overlay.dispose();
});

it('keeps the origin clicked by the browser test at its true position', () => {
  const data = JSON.parse(
    readFileSync(new URL('../../public/data/religions/history.json', import.meta.url), 'utf8'),
  ) as ReligionDataset;
  // Mirrors tests/e2e/religions.spec.ts, which clicks the map centre at zoom 9.
  const origin = data.milestones
    .filter((item) => item.kind === 'origin' && item.year > 0 && item.year < 1800)
    .sort((a, b) => b.year - a.year)[0];
  expect(religionFanIndex(data).get(origin.id)).toBe(0);
  expect(religionFanIndex(data, true).get(origin.id)).toBe(0);
});

it('keeps crowded milestones as dots until their zoom separates them from a more prominent neighbour', () => {
  const data = structuredClone(religionFixture);
  const [origin, sriLanka, china, judaism] = data.milestones;
  sriLanka.coordinates = [83.5, 25]; // 0.5 degrees from its origin
  china.coordinates = [83.04, 25.02]; // same place as the origin: fanned, not generalised
  judaism.coordinates = [84, 25]; // an earlier origin of another tradition, 1 degree away
  const zooms = religionDetailZooms(data);
  const own = religionDetailZooms(data, true);
  expect(zooms.get(judaism.id)).toBe(0);
  // A later origin yields to the earlier one, but not within its own tradition.
  expect(zooms.get(origin.id)).toBeGreaterThan(3);
  expect(own.get(origin.id)).toBe(0);
  // Half a degree needs about 36 px, i.e. zoom 6 on 512 px tiles.
  expect(zooms.get(sriLanka.id)).toBe(6);
  expect(own.get(sriLanka.id)).toBe(6);
  // The shared place with the origin is fanned instead: only the 0.46-degree neighbour counts.
  expect(zooms.get(china.id)).toBe(6);
  const point = religionFeatures(data).features.find((item) => item.id === `${sriLanka.id}-point`);
  expect(point?.properties).toMatchObject({ detail: 6, detailOwn: 6 });
});

it('leaves clicks on a resource count cartouche to the resource layer', async () => {
  const { map, handlers, layers } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update({ ...enabled(), year: 200 });
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  layers.set('resource-cluster-counts', { id: 'resource-cluster-counts' } as LayerSpecification);
  (map as unknown as { queryRenderedFeatures: () => object[] }).queryRenderedFeatures = () => [
    { properties: { cluster_id: 1 } },
  ];
  handlers.get('click:religion-milestones')!({
    point: { x: 1, y: 1 },
    features: [{ properties: { id: 'buddhism-origin', origin: true } }],
    preventDefault: vi.fn(),
  });
  expect(useReligionStore.getState().selected).toBeNull();
  overlay.dispose();
});
