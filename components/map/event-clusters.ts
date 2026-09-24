import type { GeoJSONSource, Map as MapInstance, MapLayerMouseEvent, PointLike } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { wrapLongitude } from '@/lib/map-boundaries';
import { MAX_CLUSTER_INPUT, type ClusterResponse, type ScreenEvent } from './cluster-events';
import { EMPTY_FEATURE_FILTER } from './style-filters';
import { queryViewportFeatures } from './query-viewport';
import { hasResourceAt } from './resource-hit';
import { hasReligionAt } from './religion-hit';

export const EVENT_QUERY_LAYER = 'event-cluster-query';
const SOURCE = 'event-clusters';
const GROUPS = 'event-cluster-groups';
const SINGLETONS = 'event-cluster-singletons';
const COUNTS = 'event-cluster-counts';
const NORMAL_LAYERS = ['event-halo', 'event-points', 'event-icons', 'event-symbols'];
const MAX_ZOOM = 3.5;

type Options = {
  getState: () => { playing: boolean; mode: string };
  selectEvent: (id: string) => void;
  reducedMotion: boolean;
};

export type EventClustering = {
  invalidate: () => void;
  isActive: () => boolean;
  hasFeatureAt: (point: PointLike) => boolean;
  destroy: () => void;
};

/** Clusters only the rendered, already filtered PMTiles viewport. No event corpus is downloaded. */
export function attachEventClustering(map: MapInstance, options: Options): EventClustering {
  let disposed = false,
    failed = false,
    active = false,
    dirty = true,
    busy = false;
  let generation = 0;
  let publishGeneration: number | null = null;
  let worker: Worker | null = null;

  map.addLayer({
    id: EVENT_QUERY_LAYER,
    type: 'circle',
    source: 'events',
    'source-layer': 'events',
    maxzoom: MAX_ZOOM,
    filter: EMPTY_FEATURE_FILTER,
    paint: { 'circle-radius': 6, 'circle-opacity': 0, 'circle-stroke-width': 0 },
  });
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    maxzoom: 4,
    tolerance: 0,
  });
  map.addLayer({
    id: GROUPS,
    type: 'circle',
    source: SOURCE,
    maxzoom: MAX_ZOOM,
    filter: ['>', ['get', 'count'], 1],
    paint: {
      'circle-radius': ['step', ['get', 'count'], 15, 10, 18, 100, 22, 1000, 27],
      'circle-color': '#193948',
      'circle-stroke-color': '#d4b880',
      'circle-stroke-width': 1.6,
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
      'circle-opacity-transition': { duration: 0 },
      'circle-stroke-opacity-transition': { duration: 0 },
    },
  });
  map.addLayer({
    id: SINGLETONS,
    type: 'circle',
    source: SOURCE,
    maxzoom: MAX_ZOOM,
    filter: ['==', ['get', 'count'], 1],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'importance'], 0, 3, 100, 6],
      'circle-color': [
        'match',
        ['get', 'type'],
        'siege',
        '#d99386',
        'naval',
        '#92c7d8',
        'treaty',
        '#b8c990',
        'campaign',
        '#cba9da',
        'war',
        '#db9d85',
        '#e7bd78',
      ],
      'circle-stroke-width': 1.4,
      'circle-stroke-color': '#fff0c8',
      'circle-opacity': 0,
      'circle-stroke-opacity': 0,
      'circle-opacity-transition': { duration: 0 },
      'circle-stroke-opacity-transition': { duration: 0 },
    },
  });
  map.addLayer({
    id: COUNTS,
    type: 'symbol',
    source: SOURCE,
    maxzoom: MAX_ZOOM,
    filter: ['>', ['get', 'count'], 1],
    layout: {
      'text-field': ['to-string', ['get', 'count']],
      'text-font': ['Atlas UI'],
      'text-size': 11,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#f6ecd5',
      'text-opacity': 0,
      'text-opacity-transition': { duration: 0 },
    },
  });

  const eligible = () =>
    !disposed &&
    !failed &&
    !options.getState().playing &&
    options.getState().mode !== 'heatmap' &&
    map.getZoom() < MAX_ZOOM &&
    !map.isMoving();

  const showClusters = (show: boolean) => {
    active = show;
    for (const id of [GROUPS, SINGLETONS]) {
      map.setPaintProperty(id, 'circle-opacity', show ? 0.96 : 0);
      map.setPaintProperty(id, 'circle-stroke-opacity', show ? 0.9 : 0);
    }
    map.setPaintProperty(COUNTS, 'text-opacity', show ? 1 : 0);
    const visibility = show || options.getState().mode === 'heatmap' ? 'none' : 'visible';
    for (const id of NORMAL_LAYERS)
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
  };

  const invalidate = () => {
    if (disposed) return;
    generation += 1;
    publishGeneration = null;
    dirty = true;
    if (active) showClusters(false);
    map.triggerRepaint();
  };

  const fail = () => {
    failed = true;
    busy = false;
    publishGeneration = null;
    worker?.terminate();
    worker = null;
    if (!disposed) showClusters(false);
  };

  const receive = (event: MessageEvent<ClusterResponse>) => {
    busy = false;
    if (disposed) return;
    const { token, clusters, overflow } = event.data;
    if (token !== generation || !eligible()) {
      map.triggerRepaint();
      return;
    }
    if (overflow || !clusters.length) return;
    const data: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: clusters.map((cluster) => {
        const center =
          cluster.count === 1
            ? { lng: cluster.representative.lon, lat: cluster.representative.lat }
            : map.unproject([cluster.x, cluster.y]);
        return {
          type: 'Feature',
          id: `cluster-${cluster.id}`,
          geometry: { type: 'Point', coordinates: [wrapLongitude(center.lng), center.lat] },
          properties: {
            eventId: cluster.id,
            count: cluster.count,
            type: cluster.representative.type,
            importance: cluster.representative.importance,
          },
        };
      }),
    };
    // Keep vector markers until both the GeoJSON worker and its visible tiles are ready.
    void (map.getSource(SOURCE) as GeoJSONSource)
      .setData(data)
      .then(() => {
        if (disposed || generation !== token || !eligible()) return;
        publishGeneration = token;
        map.triggerRepaint();
      })
      .catch(fail);
  };

  const idle = () => {
    if (!eligible()) return;
    if (publishGeneration === generation && map.isSourceLoaded(SOURCE)) {
      publishGeneration = null;
      showClusters(true);
      return;
    }
    if (!dirty || busy || !map.isSourceLoaded('events')) return;
    dirty = false;
    // Opacity-zero circle layers are queryable; visibility:none layers are not.
    // https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#queryrenderedfeatures
    // A reloading tile can still expose its previous bucket. Reapply the current
    // layer filter at query time before publishing a new cluster generation.
    const features = queryViewportFeatures(
      map,
      [EVENT_QUERY_LAYER],
      map.getFilter(EVENT_QUERY_LAYER) ?? undefined,
    );
    if (features.length > MAX_CLUSTER_INPUT) return;
    const points: ScreenEvent[] = [];
    const center = map.getCenter().lng;
    const width = map.getCanvas().clientWidth,
      height = map.getCanvas().clientHeight;
    for (const feature of features) {
      if (feature.geometry.type !== 'Point') continue;
      const id = String(feature.properties.id ?? '');
      if (!/^Q[1-9]\d*$/.test(id)) continue;
      const [lon, lat] = feature.geometry.coordinates;
      const projected = map.project([lon + Math.round((center - lon) / 360) * 360, lat]);
      if (
        projected.x < -6 ||
        projected.y < -6 ||
        projected.x > width + 6 ||
        projected.y > height + 6
      )
        continue;
      points.push({
        id,
        x: projected.x,
        y: projected.y,
        lon,
        lat,
        type: String(feature.properties.type),
        importance: Number(feature.properties.importance),
      });
    }
    if (!points.length) return;
    try {
      if (!worker) {
        worker = new Worker(new URL('./cluster.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = receive;
        worker.onerror = fail;
      }
      busy = true;
      worker.postMessage({ token: generation, points });
    } catch {
      fail();
    }
  };

  const click = (event: MapLayerMouseEvent) => {
    if (hasResourceAt(map, event.point) || hasReligionAt(map, event.point)) return;
    if (!active) return;
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== 'Point') return;
    event.preventDefault();
    if (Number(feature.properties.count) === 1)
      options.selectEvent(String(feature.properties.eventId));
    else
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: Math.min(4.5, map.getZoom() + 1.5),
        duration: options.reducedMotion ? 0 : 500,
      });
  };
  const enter = () => {
    if (active) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('idle', idle);
  map.on('movestart', invalidate);
  map.on('resize', invalidate);
  for (const id of [GROUPS, SINGLETONS]) {
    map.on('click', id, click);
    map.on('mouseenter', id, enter);
    map.on('mouseleave', id, leave);
  }
  return {
    invalidate,
    isActive: () => active,
    hasFeatureAt: (point) =>
      active && map.queryRenderedFeatures(point, { layers: [GROUPS, SINGLETONS] }).length > 0,
    destroy: () => {
      disposed = true;
      generation += 1;
      worker?.terminate();
      worker = null;
      map.off('idle', idle);
      map.off('movestart', invalidate);
      map.off('resize', invalidate);
      for (const id of [GROUPS, SINGLETONS]) {
        map.off('click', id, click);
        map.off('mouseenter', id, enter);
        map.off('mouseleave', id, leave);
      }
      for (const id of [EVENT_QUERY_LAYER, GROUPS, SINGLETONS, COUNTS])
        if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    },
  };
}
