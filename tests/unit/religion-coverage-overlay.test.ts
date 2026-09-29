import { beforeEach, expect, it, vi } from 'vitest';
import type { LayerSpecification, Map as MapInstance } from 'maplibre-gl';
import { coverageFixture } from '../fixtures/religion-coverage';
import { splitReligionCoverage } from '../../lib/religions/coverage';
import { createInitialAtlasState } from '../../lib/store';
import { useReligionStore } from '../../lib/religions/store';
import { useReligionCoverageStore } from '../../lib/religions/coverage-store';
import { startReligionCoverageOverlay } from '../../components/map/religion-coverage-overlay';
import { startReligionOverlay } from '../../components/map/religion-overlay';
import { religionFixture } from '../fixtures/religions';

const load = vi.hoisted(() => vi.fn());
const regionLoad = vi.hoisted(() => vi.fn());
const historyLoad = vi.hoisted(() => vi.fn());
vi.mock('../../lib/religions/coverage-client', () => ({
  getReligionCoverageIndex: load,
  getReligionCoverageRegion: regionLoad,
}));
vi.mock('../../lib/religions/client', () => ({ getReligionDataset: historyLoad }));
vi.mock('../../components/map/religion-sprites', async (original) => ({
  ...(await original<typeof import('../../components/map/religion-sprites')>()),
  createReligionSprites: () => ({ ensure: vi.fn(), dispose: vi.fn() }),
}));

function mapDouble() {
  const layers = new Map<string, LayerSpecification>(),
    sources = new Map<string, unknown>();
  const handlers = new Map<string, (event: unknown) => void>();
  const filters = new Map<string, unknown>(),
    paint = new Map<string, unknown>();
  let foreground: string[] = [];
  const map = {
    addSource: vi.fn((id: string, source: unknown) => sources.set(id, source)),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    removeLayer: (id: string) => layers.delete(id),
    moveLayer: vi.fn(),
    setFilter: (id: string, value: unknown) => filters.set(id, value),
    setPaintProperty: (id: string, key: string, value: unknown) => paint.set(`${id}:${key}`, value),
    setLayoutProperty: (id: string, key: string, value: unknown) => {
      const layer = layers.get(id)!;
      layer.layout = { ...layer.layout, [key]: value };
    },
    getCanvas: () => ({ style: { cursor: '' } }),
    queryRenderedFeatures: () => foreground.map((id) => ({ layer: { id } })),
    triggerRepaint: vi.fn(),
    isSourceLoaded: () => true,
    on: (type: string, id: string, fn: (event: unknown) => void) =>
      handlers.set(`${type}:${id}`, fn),
    off: (type: string, id: string) => handlers.delete(`${type}:${id}`),
    hasImage: () => false,
    addImage: vi.fn(),
    removeImage: vi.fn(),
  };
  return {
    map: map as unknown as MapInstance,
    layers,
    sources,
    handlers,
    filters,
    paint,
    calls: map,
    foreground: (ids: string[]) => {
      foreground = ids;
    },
  };
}
const enabled = () => ({ ...createInitialAtlasState(), religionsVisible: true, year: 2000 });
const indexOf = (dataset: ReturnType<typeof coverageFixture>) =>
  splitReligionCoverage(dataset).index;
const regionsOf = (dataset: ReturnType<typeof coverageFixture>) =>
  splitReligionCoverage(dataset).regions;
beforeEach(() => {
  load.mockReset().mockImplementation(() => Promise.resolve(indexOf(coverageFixture())));
  regionLoad
    .mockReset()
    .mockImplementation((regionId: string) =>
      Promise.resolve(regionsOf(coverageFixture()).find((row) => row.regionId === regionId)),
    );
  historyLoad.mockReset().mockResolvedValue(religionFixture);
  useReligionStore.setState({ panelOpen: false, selected: null });
  useReligionCoverageStore.setState({
    status: 'idle',
    dataset: null,
    selected: null,
    detail: null,
    detailStatus: 'idle',
    visibleObservations: [],
    revision: 0,
  });
});

it('loads only the selected mode and retains each geometry source when switching back', async () => {
  const { map, sources, layers } = mapDouble();
  const overlay = startReligionOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  expect(historyLoad).not.toHaveBeenCalled();
  const original = sources.get('religion-coverage');
  useReligionCoverageStore.getState().select(indexOf(coverageFixture()).observations[0]);
  overlay.update({ ...enabled(), religionView: 'history' });
  await vi.waitFor(() => expect(useReligionStore.getState().status).toBe('ready'));
  expect(useReligionStore.getState().panelOpen).toBe(true);
  expect(useReligionCoverageStore.getState().selected).toBeNull();
  expect(layers.get('religion-coverage-areas')?.layout?.visibility).toBe('none');
  expect(layers.get('religion-milestones')?.layout?.visibility).toBe('visible');
  overlay.update(enabled());
  expect(useReligionStore.getState().panelOpen).toBe(true);
  expect(layers.get('religion-milestones')?.layout?.visibility).toBe('none');
  expect(layers.get('religion-coverage-areas')?.layout?.visibility).toBe('visible');
  expect(sources.get('religion-coverage')).toBe(original);
  expect(load).toHaveBeenCalledTimes(1);
  expect(historyLoad).toHaveBeenCalledTimes(1);
  overlay.dispose();
});

it('keeps a fifteen-year reference dated and removes a selection excluded by the filter', async () => {
  const dataset = coverageFixture();
  dataset.snapshotMaxAge = 15;
  load.mockResolvedValue(indexOf(dataset));
  const { map } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  useReligionCoverageStore.getState().select(indexOf(dataset).observations[0]);
  overlay.update({ ...enabled(), year: 2015 });
  expect(useReligionCoverageStore.getState().selected?.time).toEqual({
    kind: 'snapshot',
    year: 2000,
  });
  overlay.update({ ...enabled(), year: 2015, religionFilter: 'none' });
  expect(useReligionCoverageStore.getState().selected).toBeNull();
  expect(useReligionCoverageStore.getState().visibleObservations).toEqual([]);
  overlay.update({ ...enabled(), year: 2016 });
  expect(useReligionCoverageStore.getState().visibleObservations).toEqual([]);
  overlay.dispose();
});

it('keeps geometry stable across years and closes an expired selected observation', async () => {
  const { map, calls, handlers, filters } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(createInitialAtlasState());
  expect(load).not.toHaveBeenCalled();
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  handlers.get('click:religion-coverage-areas')!({
    point: { x: 1, y: 1 },
    features: [{ properties: { id: 'g' } }],
    preventDefault: vi.fn(),
  });
  expect(useReligionCoverageStore.getState().selected?.id).toBe('old');
  expect(useReligionStore.getState().panelOpen).toBe(true);
  overlay.update({ ...enabled(), year: 2011 });
  expect(useReligionCoverageStore.getState().selected).toBeNull();
  expect(useReligionCoverageStore.getState().visibleObservations).toEqual([]);
  expect(filters.get('religion-coverage-areas')).toEqual(['in', ['get', 'id'], ['literal', []]]);
  expect(calls.addSource).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(1);
  overlay.dispose();
});

it('lets resources and event markers win clicks over broad coverage areas', async () => {
  const { map, handlers, foreground } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  for (const layer of [
    'resource-points',
    'resource-cluster-counts',
    'event-points',
    'event-clusters',
  ]) {
    foreground([layer]);
    handlers.get('click:religion-coverage-areas')!({
      point: { x: 1, y: 1 },
      features: [{ properties: { id: 'g' } }],
      preventDefault: vi.fn(),
    });
    expect(useReligionCoverageStore.getState().selected).toBeNull();
  }
  overlay.dispose();
});

it('shows both substantial religions with disjoint hatch colours even at catalogue indices zero and eight', async () => {
  const dataset = coverageFixture();
  const [first, second, neutral] = dataset.traditions;
  dataset.traditions = [
    first,
    ...Array.from({ length: 7 }, (_, index) => ({ ...first, id: `filler-${index}` })),
    second,
    neutral,
  ];
  // Guyana's documented composition has no majority and two substantial religions.
  dataset.observations[0].shares = [
    { traditionId: 'a', share: 0.4929 },
    { traditionId: 'b', share: 0.3567 },
    { traditionId: 'none', share: 0.1504 },
  ];
  load.mockResolvedValue(indexOf(dataset));
  const { map, layers, filters, calls } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  const active = [...layers.values()].filter(
    (layer) =>
      layer.id.startsWith('religion-coverage-hatch-') &&
      JSON.stringify(filters.get(layer.id)).includes('"g"'),
  );
  expect(active).toHaveLength(1);
  const patternId = (active[0] as { paint: { 'fill-pattern': string } }).paint['fill-pattern'];
  const image = calls.addImage.mock.calls.find(([id]) => id === patternId)?.[1] as {
    data: Uint8Array;
  };
  const colours = new Set<string>();
  for (let offset = 0; offset < image.data.length; offset += 4)
    if (image.data[offset + 3])
      colours.add(Array.from(image.data.slice(offset, offset + 3)).join(','));
  expect([...colours].sort()).toEqual(['0,255,0', '255,0,0']);
  overlay.update({ ...enabled(), religionFilter: 'b' });
  const filtered = [...layers.values()].filter(
    (layer) =>
      layer.id.startsWith('religion-coverage-hatch-') &&
      JSON.stringify(filters.get(layer.id)).includes('"g"'),
  );
  expect(filtered).toHaveLength(1);
  const filteredId = (filtered[0] as { paint: { 'fill-pattern': string } }).paint['fill-pattern'];
  const filteredImage = calls.addImage.mock.calls.find(([id]) => id === filteredId)?.[1] as {
    data: Uint8Array;
  };
  const filteredColours = new Set<string>();
  for (let offset = 0; offset < filteredImage.data.length; offset += 4)
    if (filteredImage.data[offset + 3])
      filteredColours.add(Array.from(filteredImage.data.slice(offset, offset + 3)).join(','));
  expect([...filteredColours]).toEqual(['0,255,0']);
  expect(calls.addSource).toHaveBeenCalledTimes(1);
  overlay.dispose();
});

it('does not reopen hidden coverage when its request resolves and supports retry', async () => {
  let resolve!: (value: ReturnType<typeof indexOf>) => void;
  load.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { map, layers } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  overlay.update({ ...enabled(), religionView: 'history' });
  resolve(indexOf(coverageFixture()));
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  for (const layer of layers.values()) expect(layer.layout?.visibility).toBe('none');
  expect(useReligionCoverageStore.getState().selected).toBeNull();
  overlay.dispose();
  load.mockRejectedValueOnce(new Error('offline'));
  const retry = startReligionCoverageOverlay(map);
  retry.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('error'));
  useReligionCoverageStore.getState().retry();
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  retry.dispose();
});

it('uses a seamless power-of-two texture for three substantial religions with every colour visible', async () => {
  const dataset = coverageFixture();
  dataset.traditions[2] = { ...dataset.traditions[2], id: 'c', color: '#0000ff', kind: 'religion' };
  dataset.observations[0].shares = [
    { traditionId: 'a', share: 0.4 },
    { traditionId: 'b', share: 0.3 },
    { traditionId: 'c', share: 0.3 },
  ];
  load.mockResolvedValue(indexOf(dataset));
  const { map, layers, filters, calls } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  const active = [...layers.values()].filter(
    (layer) =>
      layer.id.startsWith('religion-coverage-hatch-') &&
      JSON.stringify(filters.get(layer.id)).includes('"g"'),
  );
  expect(active).toHaveLength(1);
  const id = (active[0] as { paint: { 'fill-pattern': string } }).paint['fill-pattern'];
  const texture = calls.addImage.mock.calls.find(([imageId]) => imageId === id)?.[1] as {
    width: number;
    height: number;
    data: Uint8Array;
  };
  expect(texture.width).toBe(32);
  expect(texture.height).toBe(32);
  const colours = new Set<string>();
  for (let offset = 0; offset < texture.data.length; offset += 4)
    if (texture.data[offset + 3])
      colours.add(Array.from(texture.data.slice(offset, offset + 3)).join(','));
  expect([...colours].sort()).toEqual(['0,0,255', '0,255,0', '255,0,0']);
  overlay.dispose();
});

it('loads the region detail once, keeps it across entries and retries a failure', async () => {
  const dataset = coverageFixture();
  dataset.observations.push({
    ...dataset.observations[0],
    id: 'new',
    time: { kind: 'snapshot', year: 2005 },
  });
  const split = splitReligionCoverage(dataset);
  load.mockResolvedValue(split.index);
  const fetched = new Set<string>();
  regionLoad.mockImplementation((regionId: string) => {
    fetched.add(regionId);
    return Promise.resolve(split.regions.find((row) => row.regionId === regionId));
  });
  const { map } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  const store = useReligionCoverageStore.getState();
  store.select(split.index.observations[0]);
  await vi.waitFor(() =>
    expect(useReligionCoverageStore.getState().detail?.shares).toHaveLength(2),
  );
  useReligionCoverageStore.getState().select(split.index.observations[1]);
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().detail?.id).toBe('new'));
  expect([...fetched]).toEqual(['r']);

  regionLoad.mockRejectedValueOnce(new Error('offline'));
  useReligionCoverageStore.getState().select(split.index.observations[0]);
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().detailStatus).toBe('error'));
  useReligionCoverageStore.getState().retryDetail();
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().detailStatus).toBe('ready'));
  overlay.dispose();
});

it('ignores a region response that arrives after the selection changed', async () => {
  let resolve!: (value: unknown) => void;
  regionLoad.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const split = splitReligionCoverage(coverageFixture());
  const { map } = mapDouble();
  const overlay = startReligionCoverageOverlay(map);
  overlay.update(enabled());
  await vi.waitFor(() => expect(useReligionCoverageStore.getState().status).toBe('ready'));
  useReligionCoverageStore.getState().select(split.index.observations[0]);
  useReligionCoverageStore.getState().select(null);
  resolve(split.regions[0]);
  await Promise.resolve();
  expect(useReligionCoverageStore.getState().detail).toBeNull();
  expect(useReligionCoverageStore.getState().detailStatus).toBe('idle');
  overlay.dispose();
});
