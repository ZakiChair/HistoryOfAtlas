import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapInstance,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { getResourceDataset } from '@/lib/resources/client';
import { publishResourceDataset, useResourceStore } from '@/lib/resources/store';
import {
  RESOURCE_CATEGORIES,
  type ResourceDataset,
  type ResourceSite,
} from '@/lib/resources/types';
import { resourcesInPeriod } from '@/lib/resources/time';
import { RESOURCE_CLUSTERS, RESOURCE_POINTS, RESOURCE_SOURCE } from './resource-hit';
import { createResourceSprites, resourceIconKey } from './resource-sprites';

const SELECTED = 'resource-selected';
const LAYERS = [RESOURCE_CLUSTERS, RESOURCE_POINTS, SELECTED];
const ICON_SIZE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  1,
  0.8,
  7,
  1,
  12,
  1.1,
];
const categoryCounts = RESOURCE_CATEGORIES.map((category) => ['get', `category-${category}`]);
// Count each active resource once per site. Stable category order breaks ties.
const clusterIcon: ExpressionSpecification = [
  'case',
  ...RESOURCE_CATEGORIES.flatMap((category) => [
    ['==', ['get', `category-${category}`], ['max', ...categoryCounts]],
    `resource-group-${category}`,
  ]),
  'resource-group-oil',
] as ExpressionSpecification;

export function resourceFeatures(sites: ResourceSite[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: sites.map((site) => ({
      type: 'Feature',
      id: site.id,
      geometry: { type: 'Point', coordinates: site.coordinates },
      properties: {
        id: site.id,
        iconKey: resourceIconKey(site.categories),
        categories: site.categories,
      },
    })),
  };
}

/** Filter dated exploitation evidence before clustering, so cluster counts respect time. */
export function startResourceOverlay(map: MapInstance, reducedMotion: boolean) {
  const sprites = createResourceSprites(map);
  let active = false;
  let disposed = false;
  let loading = false;
  let installed = false;
  let sourceUpdating = false;
  let sourceRevision = 0;
  let committedRevision = -1;
  let year = 1812;
  let range: [number, number] | null = null;
  let dataset: ResourceDataset | undefined;
  let membership = '';
  let sites = new Map<string, ResourceSite>();

  const applySelection = () => {
    if (installed)
      map.setFilter(SELECTED, [
        'all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'id'], useResourceStore.getState().selected?.id ?? ''],
      ]);
  };
  const applyVisibility = () => {
    if (!installed) return;
    for (const id of LAYERS) map.setLayoutProperty(id, 'visibility', active ? 'visible' : 'none');
    // Historical territory sources are replaced as the year changes. Keep site markers above them.
    if (active && map.getStyle().layers?.at(-1)?.id !== SELECTED)
      for (const id of LAYERS) map.moveLayer(id);
  };
  const select = (event: MapLayerMouseEvent) => {
    if (!active || disposed || sourceUpdating) return;
    const site = sites.get(String(event.features?.[0]?.properties?.id ?? ''));
    if (site) {
      event.preventDefault();
      useResourceStore.getState().select(site);
    }
  };
  const expand = async (event: MapLayerMouseEvent) => {
    // Site symbols sit above groups and their click handler runs first.
    if (!active || disposed || sourceUpdating || event.defaultPrevented) return;
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== 'Point') return;
    event.preventDefault();
    const revision = sourceRevision;
    try {
      const source = map.getSource(RESOURCE_SOURCE) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      if (!active || disposed || sourceUpdating || revision !== sourceRevision) return;
      const center = [...feature.geometry.coordinates] as [number, number];
      center[0] += Math.round((map.getCenter().lng - center[0]) / 360) * 360;
      map.easeTo({ center, zoom: Math.min(zoom, 15), duration: reducedMotion ? 0 : 500 });
    } catch {
      // A navigation can retire the source while the worker answers a cluster click.
    }
  };
  const enter = () => {
    if (active && !sourceUpdating) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  const removeLayers = () => {
    installed = false;
    sourceUpdating = false;
    membership = '';
    for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(RESOURCE_SOURCE)) map.removeSource(RESOURCE_SOURCE);
    sprites.dispose();
  };
  const snapshot = () => {
    const periodSites = resourcesInPeriod(dataset!, year, range);
    const category = useResourceStore.getState().categoryFilter;
    const visibleSites = category
      ? periodSites.filter((site) => site.categories.includes(category))
      : periodSites;
    sites = new Map(visibleSites.map((site) => [site.id, site]));
    const selected = useResourceStore.getState().selected;
    if (selected) useResourceStore.getState().select(sites.get(selected.id) ?? null);
    publishResourceDataset(dataset!, periodSites, visibleSites.length);
    // Filter before clustering and use the chosen pictogram for every member.
    // The selection map retains all active commodities and the full chronology.
    return category
      ? visibleSites.map((site) => ({ ...site, categories: [category] }))
      : visibleSites;
  };
  const snapshotKey = (visibleSites: ResourceSite[]) =>
    visibleSites.map((site) => `${site.id}:${site.categories.join(',')}`).join('|');
  const updatePeriod = () => {
    if (!dataset || !installed) return;
    const visibleSites = snapshot();
    const key = snapshotKey(visibleSites);
    if (key === membership) return;
    sprites.ensure(visibleSites);
    membership = key;
    const revision = ++sourceRevision;
    sourceUpdating = true;
    // Keep the last frame while MapLibre replaces the source. Hiding symbol
    // layers here retires their placement and restarts the fade every year.
    leave();
    void (map.getSource(RESOURCE_SOURCE) as GeoJSONSource)
      .setData(resourceFeatures(visibleSites))
      .then(() => {
        if (disposed || revision !== sourceRevision) return;
        // setData completes the source worker; rendered tiles settle in a later frame.
        committedRevision = revision;
        map.triggerRepaint();
      })
      .catch((error) => {
        if (disposed || revision !== sourceRevision) return;
        removeLayers();
        useResourceStore.setState({ status: 'error', error: String(error) });
      });
  };
  const publishSettledPeriod = () => {
    if (
      disposed ||
      !installed ||
      !sourceUpdating ||
      committedRevision !== sourceRevision ||
      !map.isSourceLoaded(RESOURCE_SOURCE)
    )
      return;
    sourceUpdating = false;
    // The resource source is ready even if unrelated symbols are still fading.
    // Repaint so the render queue can release playback after this committed frame.
    map.triggerRepaint();
  };
  const load = async () => {
    if (loading || installed || disposed || !active) return;
    loading = true;
    useResourceStore.setState({ status: 'loading', error: null });
    try {
      const loaded = await getResourceDataset();
      if (disposed) return;
      dataset = loaded;
      const visibleSites = snapshot();
      membership = snapshotKey(visibleSites);
      sprites.ensure(visibleSites);
      map.addSource(RESOURCE_SOURCE, {
        type: 'geojson',
        data: resourceFeatures(visibleSites),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 8,
        clusterProperties: Object.fromEntries(
          RESOURCE_CATEGORIES.map((category) => [
            `category-${category}`,
            ['+', ['case', ['in', category, ['get', 'categories']], 1, 0]],
          ]),
        ),
      });
      map.addLayer({
        id: RESOURCE_CLUSTERS,
        type: 'symbol',
        source: RESOURCE_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          visibility: active ? 'visible' : 'none',
          'icon-image': clusterIcon,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Atlas UI'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport',
        },
        paint: { 'text-color': '#ecf7ea' },
      });
      map.addLayer({
        id: RESOURCE_POINTS,
        type: 'symbol',
        source: RESOURCE_SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          visibility: active ? 'visible' : 'none',
          'icon-image': ['concat', 'resource-site-', ['get', 'iconKey']],
          'icon-size': ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
      });
      map.addLayer({
        id: SELECTED,
        type: 'symbol',
        source: RESOURCE_SOURCE,
        filter: ['==', ['get', 'id'], ''],
        layout: {
          visibility: active ? 'visible' : 'none',
          'icon-image': ['concat', 'resource-selection-', ['get', 'iconKey']],
          'icon-size': ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
      });
      installed = true;
      applyVisibility();
      applySelection();
    } catch (error) {
      if (disposed) return;
      removeLayers();
      useResourceStore.setState({ status: 'error', error: String(error) });
    } finally {
      loading = false;
    }
  };

  map.on('click', RESOURCE_POINTS, select);
  map.on('click', RESOURCE_CLUSTERS, expand);
  map.on('render', publishSettledPeriod);
  for (const id of [RESOURCE_POINTS, RESOURCE_CLUSTERS]) {
    map.on('mouseenter', id, enter);
    map.on('mouseleave', id, leave);
  }
  const unsubscribe = useResourceStore.subscribe((state, previous) => {
    if (state.selected !== previous.selected) applySelection();
    if (state.revision !== previous.revision) void load();
    if (active && state.categoryFilter !== previous.categoryFilter) updatePeriod();
  });

  return {
    update(visible: boolean, nextYear: number, nextRange: [number, number] | null = null) {
      const wasActive = active;
      const changedPeriod =
        year !== nextYear || range?.[0] !== nextRange?.[0] || range?.[1] !== nextRange?.[1];
      year = nextYear;
      range = nextRange;
      active = visible;
      if (!active && wasActive) {
        useResourceStore.getState().select(null);
        leave();
      }
      applyVisibility();
      if (active && (!wasActive || changedPeriod)) updatePeriod();
      if (active && !wasActive) void load();
    },
    isReady: () =>
      !active || (!sourceUpdating && (!installed || map.isSourceLoaded(RESOURCE_SOURCE))),
    dispose() {
      disposed = true;
      unsubscribe();
      map.off('click', RESOURCE_POINTS, select);
      map.off('click', RESOURCE_CLUSTERS, expand);
      map.off('render', publishSettledPeriod);
      for (const id of [RESOURCE_POINTS, RESOURCE_CLUSTERS]) {
        map.off('mouseenter', id, enter);
        map.off('mouseleave', id, leave);
      }
      removeLayers();
      sites.clear();
      useResourceStore.setState({ status: 'idle', selected: null });
    },
  };
}
