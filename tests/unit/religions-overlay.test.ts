import { beforeEach, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapInstance } from 'maplibre-gl';
import { religionFixture } from '../fixtures/religions';
import { createInitialAtlasState } from '../../lib/store';
import { useReligionStore } from '../../lib/religions/store';
import { religionFeatures, startReligionOverlay } from '../../components/map/religion-overlay';

const getDataset = vi.hoisted(() => vi.fn());
vi.mock('../../lib/religions/client', () => ({ getReligionDataset: getDataset }));
vi.mock('../../components/map/religion-sprites', () => ({
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
    setLayoutProperty: (id: string, key: string, value: string) => {
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
