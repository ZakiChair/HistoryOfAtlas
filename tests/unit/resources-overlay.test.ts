import { beforeEach, expect, it, vi } from 'vitest';
import type { Map as MapInstance, LayerSpecification } from 'maplibre-gl';
import { startResourceOverlay } from '../../components/map/resource-overlay';
import { useResourceStore } from '../../lib/resources/store';
import type { ResourceDataset } from '../../lib/resources/types';

const getDataset = vi.hoisted(() => vi.fn());
const spriteEnsure = vi.hoisted(() => vi.fn());
const spriteDispose = vi.hoisted(() => vi.fn());
vi.mock('../../lib/resources/client', () => ({ getResourceDataset: getDataset }));
vi.mock('../../components/map/resource-sprites', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/map/resource-sprites')>()),
  createResourceSprites: () => ({ ensure: spriteEnsure, dispose: spriteDispose }),
}));

const dataset: ResourceDataset = {
  version: 1,
  downloadedAt: '2026-09-23',
  description: 'Inventory',
  sources: [
    { id: 's', name: 'Source', year: 2009, license: 'Public domain', url: 'https://example.org' },
  ],
  sites: [
    {
      id: 'one',
      name: 'Mine',
      coordinates: [12, 34],
      categories: ['copper', 'gold'],
      sourceId: 's',
      sourceUrl: 'https://example.org/mine',
      sourceYear: 2009,
      periods: [
        { fromYear: 1800, toYear: 1900, sourceUrl: 'https://example.org/history' },
        { fromYear: 1950, toYear: 2000, sourceUrl: 'https://example.org/history' },
      ],
    },
  ],
};

function mapDouble() {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<string, unknown>();
  const handlers = new Map<string, (event: unknown) => void>();
  const cursor = { cursor: '' };
  const map = {
    addSource: vi.fn((id: string, source: object) =>
      sources.set(id, {
        ...source,
        setData: vi.fn().mockResolvedValue(undefined),
        getClusterExpansionZoom: vi.fn().mockResolvedValue(5),
      }),
    ),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    moveLayer: (id: string) => {
      const layer = layers.get(id)!;
      layers.delete(id);
      layers.set(id, layer);
    },
    removeLayer: (id: string) => layers.delete(id),
    setLayoutProperty: (id: string, property: string, value: string) => {
      const layer = layers.get(id)!;
      layer.layout = { ...layer.layout, [property]: value };
    },
    setFilter: vi.fn(),
    on: (
      event: string,
      id: string | ((event: unknown) => void),
      handler?: (event: unknown) => void,
    ) =>
      handlers.set(
        typeof id === 'string' ? `${event}:${id}` : event,
        typeof id === 'string' ? handler! : id,
      ),
    off: (event: string, id: string | ((event: unknown) => void)) =>
      handlers.delete(typeof id === 'string' ? `${event}:${id}` : event),
    getCanvas: () => ({ style: cursor }),
    triggerRepaint: vi.fn(),
    isSourceLoaded: () => true,
  };
  return { map: map as unknown as MapInstance, layers, sources, handlers };
}

beforeEach(() => {
  getDataset.mockReset();
  spriteEnsure.mockReset();
  spriteDispose.mockReset();
  useResourceStore.setState({ status: 'idle', selected: null, revision: 0, categoryFilter: null });
});

it('filters before clustering without losing period totals or the selected site chronology', async () => {
  const coal = { ...dataset.sites[0], id: 'coal', categories: ['coal'] as const };
  getDataset.mockResolvedValue({
    ...dataset,
    sites: [dataset.sites[0], { ...coal, categories: [...coal.categories] }],
  });
  const { map, sources, handlers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  const source = sources.get('strategic-resources') as { setData: ReturnType<typeof vi.fn> };
  useResourceStore.getState().setCategoryFilter('copper');
  const features = source.setData.mock.calls.at(-1)![0].features;
  expect(features.map((feature: { id: string }) => feature.id)).toEqual(['one']);
  expect(features[0].properties).toMatchObject({ iconKey: 'copper', categories: ['copper'] });
  expect(spriteEnsure.mock.calls.at(-1)![0][0].categories).toEqual(['copper']);
  expect(useResourceStore.getState()).toMatchObject({
    sitesCount: 2,
    filteredSitesCount: 1,
    categoryCounts: { copper: 1, gold: 1, coal: 1 },
  });
  await Promise.resolve();
  handlers.get('render')!({});
  handlers.get('click:resource-points')!({
    features: [{ properties: { id: 'one' } }],
    preventDefault: vi.fn(),
  });
  expect(useResourceStore.getState().selected?.categories).toEqual(['copper', 'gold']);
  expect(useResourceStore.getState().selected?.periods).toEqual(dataset.sites[0].periods);
  useResourceStore.getState().setCategoryFilter('coal');
  expect(useResourceStore.getState().selected).toBeNull();
  expect(source.setData.mock.calls.at(-1)![0].features[0].properties.iconKey).toBe('coal');
  useResourceStore.getState().setCategoryFilter(null);
  expect(source.setData.mock.calls.at(-1)![0].features).toHaveLength(2);
  expect(useResourceStore.getState().filteredSitesCount).toBe(2);
  overlay.dispose();
});

it('keeps known commodities and the category choice across years and layer toggles', async () => {
  const site = {
    ...dataset.sites[0],
    periods: [
      { ...dataset.sites[0].periods[0], categories: ['copper'] },
      { ...dataset.sites[0].periods[1], categories: ['gold'] },
    ],
  };
  getDataset.mockResolvedValue({ ...dataset, sites: [site] });
  useResourceStore.getState().setCategoryFilter('copper');
  const { map, sources } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  const source = sources.get('strategic-resources') as { setData: ReturnType<typeof vi.fn> };
  overlay.update(true, 1960);
  expect(source.setData).not.toHaveBeenCalled();
  expect(useResourceStore.getState()).toMatchObject({
    categoryFilter: 'copper',
    sitesCount: 1,
    filteredSitesCount: 1,
    categoryCounts: { copper: 1, gold: 1 },
  });
  overlay.update(false, 1960);
  overlay.update(true, 1960, [1850, 1960]);
  expect(source.setData).not.toHaveBeenCalled();
  expect(useResourceStore.getState().categoryFilter).toBe('copper');
  overlay.dispose();
});

it('applies a category chosen while the initial dataset is still downloading', async () => {
  let resolve!: (data: ResourceDataset) => void;
  getDataset.mockReturnValue(new Promise<ResourceDataset>((done) => (resolve = done)));
  const { map, sources } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  useResourceStore.getState().setCategoryFilter('gold');
  resolve(dataset);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  const source = sources.get('strategic-resources') as {
    data: { features: { properties: object }[] };
  };
  expect(source.data.features[0].properties).toMatchObject({
    iconKey: 'gold',
    categories: ['gold'],
  });
  expect(useResourceStore.getState().categoryCounts).toEqual({ copper: 1, gold: 1 });
  overlay.dispose();
});

it('keeps a late response hidden after deactivation, then reuses it with working selection', async () => {
  let resolve!: (data: ResourceDataset) => void;
  getDataset.mockReturnValue(
    new Promise<ResourceDataset>((done) => {
      resolve = done;
    }),
  );
  const { map, layers, handlers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(false, 1850);
  expect(getDataset).not.toHaveBeenCalled();
  overlay.update(true, 1850);
  expect(useResourceStore.getState().status).toBe('loading');
  overlay.update(false, 1850);
  resolve(dataset);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  expect([...layers.values()].every((layer) => layer.layout?.visibility === 'none')).toBe(true);
  const click = { features: [{ properties: { id: 'one' } }], preventDefault: vi.fn() };
  handlers.get('click:resource-points')!(click);
  expect(useResourceStore.getState().selected).toBeNull();
  overlay.update(true, 1850);
  handlers.get('click:resource-points')!(click);
  expect(useResourceStore.getState().selected?.id).toBe('one');
  expect(useResourceStore.getState().categoryCounts).toEqual({ copper: 1, gold: 1 });
  overlay.update(false, 1850);
  expect(useResourceStore.getState().selected).toBeNull();
  expect(getDataset).toHaveBeenCalledTimes(1);
  overlay.dispose();
  expect(layers.size).toBe(0);
  expect(handlers.size).toBe(0);
  expect(spriteDispose).toHaveBeenCalledOnce();
});

it('adds later known commodities to pictograms without hiding previously known resources', async () => {
  const site = {
    ...dataset.sites[0],
    periods: [
      { ...dataset.sites[0].periods[0], categories: ['copper'] as const },
      { ...dataset.sites[0].periods[1], categories: ['gold'] as const },
    ].map((period) => ({ ...period, categories: [...period.categories] })),
  };
  getDataset.mockResolvedValue({ ...dataset, sites: [site] });
  const { map, sources, handlers, layers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  const source = sources.get('strategic-resources') as {
    data: { features: { properties: object }[] };
    setData: ReturnType<typeof vi.fn>;
  };
  expect(source.data.features[0].properties).toMatchObject({
    iconKey: 'copper',
    categories: ['copper'],
  });
  expect(layers.get('resource-points')?.type).toBe('symbol');
  expect(layers.get('resource-clusters')?.type).toBe('symbol');
  handlers.get('click:resource-points')!({
    features: [{ properties: { id: site.id } }],
    preventDefault: vi.fn(),
  });

  overlay.update(true, 1960);
  expect(source.setData.mock.calls[0][0].features[0].properties).toMatchObject({
    iconKey: 'copper-gold',
    categories: ['copper', 'gold'],
  });
  expect(spriteEnsure.mock.calls.at(-1)?.[0][0].categories).toEqual(['copper', 'gold']);
  expect(spriteEnsure.mock.invocationCallOrder.at(-1)).toBeLessThan(
    source.setData.mock.invocationCallOrder[0],
  );
  expect(useResourceStore.getState().selected?.categories).toEqual(['copper', 'gold']);
  overlay.dispose();
});

it('does not attach layers or publish state after disposal during loading', async () => {
  let resolve!: (data: ResourceDataset) => void;
  getDataset.mockReturnValue(
    new Promise<ResourceDataset>((done) => {
      resolve = done;
    }),
  );
  const { map, layers } = mapDouble();
  const overlay = startResourceOverlay(map, false);
  overlay.update(true, 1850);
  overlay.dispose();
  resolve(dataset);
  await Promise.resolve();
  expect(map.addSource).not.toHaveBeenCalled();
  expect(layers.size).toBe(0);
  expect(useResourceStore.getState().status).toBe('idle');
});

it('selects a foreground site without expanding an overlapping group on the same click', async () => {
  getDataset.mockResolvedValue(dataset);
  const { map, sources, handlers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  const event = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    features: [{ properties: { id: 'one' } }] as object[],
  };
  // MapLibre delegates layer clicks by mutating the same event object.
  handlers.get('click:resource-points')!(event);
  event.features = [
    { properties: { cluster_id: 1 }, geometry: { type: 'Point', coordinates: [12, 34] } },
  ];
  handlers.get('click:resource-clusters')!(event);
  const source = sources.get('strategic-resources') as {
    getClusterExpansionZoom: ReturnType<typeof vi.fn>;
  };
  expect(useResourceStore.getState().selected?.id).toBe('one');
  expect(source.getClusterExpansionZoom).not.toHaveBeenCalled();
  event.defaultPrevented = false;
  handlers.get('click:resource-clusters')!(event);
  expect(source.getClusterExpansionZoom).toHaveBeenCalledWith(1);
  overlay.dispose();
});

it('recovers a failed download through the visible retry control', async () => {
  getDataset.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(dataset);
  const { map, layers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('error'));
  expect(layers.size).toBe(0);
  useResourceStore.getState().retry();
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  expect(layers.get('resource-points')?.layout?.visibility).toBe('visible');
  expect(getDataset).toHaveBeenCalledTimes(2);
  overlay.dispose();
});

it('clears a selection before the first attestation and restores it after that boundary', async () => {
  getDataset.mockResolvedValue(dataset);
  const { map, sources, handlers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  handlers.get('click:resource-points')!({
    features: [{ properties: { id: 'one' } }],
    preventDefault: vi.fn(),
  });
  expect(useResourceStore.getState().selected?.id).toBe('one');
  const source = sources.get('strategic-resources') as { setData: ReturnType<typeof vi.fn> };
  overlay.update(true, 1750);
  expect(source.setData.mock.calls[0][0].features).toEqual([]);
  expect(useResourceStore.getState().sitesCount).toBe(0);
  expect(useResourceStore.getState().totalSitesCount).toBe(1);
  expect(useResourceStore.getState().selected).toBeNull();
  expect(overlay.isReady()).toBe(false);
  await Promise.resolve();
  expect(overlay.isReady()).toBe(false);
  handlers.get('render')!({});
  expect(overlay.isReady()).toBe(true);
  overlay.update(true, 1960);
  expect(source.setData.mock.calls[1][0].features).toHaveLength(1);
  await Promise.resolve();
  handlers.get('render')!({});
  expect(overlay.isReady()).toBe(true);
  overlay.update(true, 1970);
  expect(source.setData).toHaveBeenCalledTimes(2);
  expect(useResourceStore.getState().sitesCount).toBe(1);
  expect(getDataset).toHaveBeenCalledTimes(1);
  overlay.dispose();
});

it('a late download uses the newest requested year instead of the year when loading started', async () => {
  let resolve!: (data: ResourceDataset) => void;
  getDataset.mockReturnValue(
    new Promise<ResourceDataset>((done) => {
      resolve = done;
    }),
  );
  const { map, sources } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  overlay.update(true, 1750);
  resolve(dataset);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  expect(
    (sources.get('strategic-resources') as { data: { features: unknown[] } }).data.features,
  ).toEqual([]);
  expect(useResourceStore.getState().sitesCount).toBe(0);
  overlay.dispose();
});

it('does not release playback for an older period when source updates finish out of order', async () => {
  getDataset.mockResolvedValue(dataset);
  const { map, sources, handlers, layers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  let finishOld!: () => void;
  let finishCurrent!: () => void;
  const source = sources.get('strategic-resources') as { setData: ReturnType<typeof vi.fn> };
  source.setData
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCurrent = resolve;
      }),
    );
  overlay.update(true, 1750);
  overlay.update(true, 1960);
  finishOld();
  await Promise.resolve();
  handlers.get('render')?.({});
  expect(overlay.isReady()).toBe(false);
  expect(layers.get('resource-points')?.layout?.visibility).toBe('visible');
  finishCurrent();
  await Promise.resolve();
  handlers.get('render')?.({});
  expect(overlay.isReady()).toBe(true);
  expect(layers.get('resource-points')?.layout?.visibility).toBe('visible');
  expect(useResourceStore.getState().sitesCount).toBe(1);
  overlay.dispose();
});

it('keeps symbols visible during playback and commits loaded source frames without global idle', async () => {
  const stable = {
    ...dataset.sites[0],
    id: 'stable',
    periods: [{ fromYear: 1700, toYear: 2000, sourceUrl: 'https://example.org/stable' }],
  };
  getDataset.mockResolvedValue({ ...dataset, sites: [...dataset.sites, stable] });
  const { map, sources, handlers, layers } = mapDouble();
  const sourceLoaded = vi.spyOn(map, 'isSourceLoaded');
  const overlay = startResourceOverlay(map, false);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  const click = (id: string) => ({
    features: [{ properties: { id } }],
    preventDefault: vi.fn(),
  });
  handlers.get('click:resource-points')!(click('one'));
  expect(useResourceStore.getState().selected?.id).toBe('one');
  const source = sources.get('strategic-resources') as {
    setData: ReturnType<typeof vi.fn>;
    getClusterExpansionZoom: ReturnType<typeof vi.fn>;
  };
  let finish!: () => void;
  source.setData.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
  overlay.update(true, 1750);
  expect(
    source.setData.mock.calls[0][0].features.map((feature: { id: string }) => feature.id),
  ).toEqual(['stable']);
  expect(useResourceStore.getState().selected).toBeNull();
  // Hiding a symbol layer retires its placement and restarts the map's fade.
  // Keep the last complete frame while a new worker result is prepared.
  expect([...layers.values()].every((layer) => layer.layout?.visibility === 'visible')).toBe(true);
  handlers.get('render')?.({});
  expect(overlay.isReady()).toBe(false);
  for (const id of ['one', 'stable']) handlers.get('click:resource-points')!(click(id));
  handlers.get('click:resource-clusters')!({
    features: [
      { properties: { cluster_id: 1 }, geometry: { type: 'Point', coordinates: [12, 34] } },
    ],
    preventDefault: vi.fn(),
  });
  expect(useResourceStore.getState().selected).toBeNull();
  expect(source.getClusterExpansionZoom).not.toHaveBeenCalled();

  sourceLoaded.mockReturnValue(false);
  finish();
  await Promise.resolve();
  handlers.get('render')?.({});
  expect(overlay.isReady()).toBe(false);
  sourceLoaded.mockReturnValue(true);
  handlers.get('render')?.({});
  expect(overlay.isReady()).toBe(true);
  handlers.get('click:resource-points')!(click('one'));
  expect(useResourceStore.getState().selected).toBeNull();
  handlers.get('click:resource-points')!(click('stable'));
  expect(useResourceStore.getState().selected?.id).toBe('stable');
  overlay.dispose();
});

it('leaves clicks on an overlapping religious emblem to the religion layer', async () => {
  getDataset.mockResolvedValue(dataset);
  const { map, sources, handlers, layers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  // Emblems are drawn above resource symbols.
  layers.set('religion-milestones', { id: 'religion-milestones' } as LayerSpecification);
  let emblemHit = true;
  (map as unknown as { queryRenderedFeatures: () => object[] }).queryRenderedFeatures = () =>
    emblemHit ? [{ properties: { id: 'judaism-jerusalem' } }] : [];
  const event = () => ({
    point: { x: 5, y: 5 },
    defaultPrevented: false,
    preventDefault: vi.fn(),
    features: [
      {
        properties: { id: 'one', cluster_id: 1 },
        geometry: { type: 'Point', coordinates: [12, 34] },
      },
    ] as object[],
  });
  handlers.get('click:resource-points')!(event());
  handlers.get('click:resource-clusters')!(event());
  const source = sources.get('strategic-resources') as {
    getClusterExpansionZoom: ReturnType<typeof vi.fn>;
  };
  expect(useResourceStore.getState().selected).toBeNull();
  expect(source.getClusterExpansionZoom).not.toHaveBeenCalled();
  emblemHit = false;
  handlers.get('click:resource-points')!(event());
  expect(useResourceStore.getState().selected?.id).toBe('one');
  overlay.dispose();
});

it('expands a group from its count cartouche even where a religious emblem is drawn', async () => {
  getDataset.mockResolvedValue(dataset);
  const { map, sources, handlers, layers } = mapDouble();
  const overlay = startResourceOverlay(map, true);
  overlay.update(true, 1850);
  await vi.waitFor(() => expect(useResourceStore.getState().status).toBe('ready'));
  expect(layers.get('resource-cluster-counts')?.layout).toMatchObject({
    'icon-text-fit': 'both',
    'text-field': ['get', 'point_count_abbreviated'],
  });
  layers.set('religion-milestones', { id: 'religion-milestones' } as LayerSpecification);
  (map as unknown as { queryRenderedFeatures: () => object[] }).queryRenderedFeatures = () => [
    { properties: { id: 'judaism-jerusalem' } },
  ];
  const event = {
    point: { x: 5, y: 5 },
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    features: [
      { properties: { cluster_id: 1 }, geometry: { type: 'Point', coordinates: [12, 34] } },
    ] as object[],
  };
  handlers.get('click:resource-cluster-counts')!(event);
  const source = sources.get('strategic-resources') as {
    getClusterExpansionZoom: ReturnType<typeof vi.fn>;
  };
  expect(source.getClusterExpansionZoom).toHaveBeenCalledWith(1);
  // The group pictogram underneath does not expand a second time for the same click.
  handlers.get('click:resource-clusters')!(event);
  expect(source.getClusterExpansionZoom).toHaveBeenCalledTimes(1);
  overlay.dispose();
});
