import type { FeatureCollection, Geometry } from 'geojson';
import type { ExpressionSpecification, Map as MapInstance, MapLayerMouseEvent } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import type { ReligionDataset } from '@/lib/religions/types';
import { getReligionDataset } from '@/lib/religions/client';
import { religionMilestonesAt } from '@/lib/religions/time';
import { publishReligionDataset, useReligionStore } from '@/lib/religions/store';
import { RELIGION_SOURCE, RELIGION_POINTS, RELIGION_ROUTES, RELIGION_AREAS } from './religion-hit';
import { hasResourceAt, hasResourceCountAt } from './resource-hit';
import { createReligionSprites, RELIGION_SELECTION_RING } from './religion-sprites';
import { raiseThematicLayers } from './thematic-stack';

const OUTLINES = 'religion-area-outlines';
const CASING = 'religion-route-casing';
const ARROWS = 'religion-route-directions';
const SELECTION = 'religion-selection';
const SELECTED_EMBLEM = 'religion-selection-emblem';
const LAYERS = [
  RELIGION_AREAS,
  OUTLINES,
  CASING,
  RELIGION_ROUTES,
  ARROWS,
  RELIGION_POINTS,
  SELECTED_EMBLEM,
  SELECTION,
];
const ROUTE_LAYERS = new Set([CASING, RELIGION_ROUTES, ARROWS]);
const AREA_LAYERS = new Set([RELIGION_AREAS, OUTLINES]);
// Medallions stay small on the whole-world view and reach full size at regional zooms.
const EMBLEM_SIZE: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  1,
  ['case', ['get', 'origin'], 0.56, 0.5],
  3,
  ['case', ['get', 'origin'], 0.72, 0.62],
  5,
  ['case', ['get', 'origin'], 0.98, 0.8],
  8,
  ['case', ['get', 'origin'], 1.18, 1],
];
/** Milestones within about 10 km (same city or holy site) overlap until street-level zooms. */
const SHARED_PLACE_DEGREES = 0.1;
/** Fanned medallions touch: the origin double ring is 44 px across at icon-size 1. */
const FAN_SPACING = 46;
// Later milestones at a shared place fan out around the earliest, which keeps its position.
// `fan` counts every tradition; `fanOwn` only the filtered tradition's own milestones.
const fanOffset = (property: 'fan' | 'fanOwn'): ExpressionSpecification => [
  'match',
  ['get', property],
  1,
  ['literal', [FAN_SPACING, 0]],
  2,
  ['literal', [-FAN_SPACING, 0]],
  3,
  ['literal', [0, FAN_SPACING]],
  ['literal', [0, 0]],
];
/**
 * Below this zoom, later milestones are drawn as dots so founding centres stay legible.
 * icon-image is a layout property: MapLibre evaluates it at the integer tile zoom
 * (the floor of the map zoom for this 512 px GeoJSON source), so zooms here are integers.
 */
export const RELIGION_DETAIL_ZOOM = 3;
/** Screen distance at which two medallions no longer hide each other. */
const EMBLEM_CLEARANCE = 36;
/** From this zoom every milestone is drawn as its medallion. */
const FULL_DETAIL_ZOOM = 7;
const DOT_IMAGE: ExpressionSpecification = ['concat', 'religion-dot-', ['get', 'tradition']];
const DETAIL_IMAGE: ExpressionSpecification = [
  'case',
  ['get', 'origin'],
  ['concat', 'religion-origin-', ['get', 'tradition']],
  ['concat', 'religion-', ['get', 'tradition']],
];
/**
 * A milestone stays a dot until its zoom (`detail`, or `detailOwn` under a tradition
 * filter) separates it from every more prominent neighbour. Unfiltered world views also
 * reduce every later milestone to a dot; a filtered tradition shows its emblems at once.
 */
const emblemImage = (filter: string | null): ExpressionSpecification => {
  const property = filter ? 'detailOwn' : 'detail';
  const level = (zoom: number): ExpressionSpecification => [
    'case',
    ['>', ['get', property], zoom],
    DOT_IMAGE,
    !filter && zoom < RELIGION_DETAIL_ZOOM
      ? ['case', ['get', 'origin'], DETAIL_IMAGE, DOT_IMAGE]
      : DETAIL_IMAGE,
  ];
  const steps = Array.from({ length: FULL_DETAIL_ZOOM - 1 }, (_, index) => [
    index + 1,
    level(index + 1),
  ]);
  return [
    'step',
    ['zoom'],
    level(0),
    ...steps.flat(),
    FULL_DETAIL_ZOOM,
    DETAIL_IMAGE,
  ] as ExpressionSpecification;
};
/** Crowded milestones (drawn as dots while crowded) sit above medallions, then origins. */
const EMBLEM_SORT_KEY: ExpressionSpecification = [
  'case',
  ['>', ['get', 'detail'], 0],
  2,
  ['get', 'origin'],
  1,
  0,
];
const emblemSortKey = (properties: Record<string, unknown> | null | undefined) =>
  Number(properties?.detail) > 0 ? 2 : properties?.origin ? 1 : 0;
// A dark casing on the dark theme, a translucent ink one on the pale paper theme.
const THEME_PAINT = {
  dark: { casing: '#08202b', casingOpacity: 0.55, hatch: 0.42 },
  light: { casing: '#2b2a22', casingOpacity: 0.3, hatch: 0.7 },
} as const;
const emblemOffset = (filter: string | null) => fanOffset(filter ? 'fanOwn' : 'fan');

/**
 * Stable fan index for milestones drawn at the same place. Later milestones are only
 * visible once the earliest one is, so the anchor is always on screen with them.
 */
export function religionFanIndex(
  dataset: ReligionDataset,
  sameTradition = false,
): Map<string, number> {
  const ordered = [...dataset.milestones].sort(
    (a, b) => a.year - b.year || a.id.localeCompare(b.id),
  );
  const anchors: { coordinates: [number, number]; tradition: string; members: number }[] = [];
  const fan = new Map<string, number>();
  for (const stage of ordered) {
    const anchor = anchors.find(
      (item) =>
        (!sameTradition || item.tradition === stage.traditionId) &&
        Math.hypot(
          item.coordinates[0] - stage.coordinates[0],
          item.coordinates[1] - stage.coordinates[1],
        ) < SHARED_PLACE_DEGREES,
    );
    if (anchor) fan.set(stage.id, Math.min(anchor.members++, 3));
    else {
      anchors.push({ coordinates: stage.coordinates, tradition: stage.traditionId, members: 1 });
      fan.set(stage.id, 0);
    }
  }
  return fan;
}

const mercatorY = (latitude: number) =>
  (Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) * 180) / Math.PI;

/**
 * Integer zoom from which each milestone's medallion clears every more prominent
 * neighbour (origins first, then earlier milestones). Milestones sharing one place are
 * fanned instead, so they are not counted here.
 */
export function religionDetailZooms(
  dataset: ReligionDataset,
  sameTradition = false,
): Map<string, number> {
  const rank = (stage: ReligionDataset['milestones'][number]) =>
    [stage.kind === 'origin' ? 0 : 1, stage.year, stage.id] as const;
  const before = (
    a: ReligionDataset['milestones'][number],
    b: ReligionDataset['milestones'][number],
  ) => {
    const [left, right] = [rank(a), rank(b)];
    return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]);
  };
  const zooms = new Map<string, number>();
  for (const stage of dataset.milestones) {
    let nearest = Infinity;
    for (const other of dataset.milestones) {
      if (other === stage || before(other, stage) >= 0) continue;
      if (sameTradition && other.traditionId !== stage.traditionId) continue;
      let dx = Math.abs(other.coordinates[0] - stage.coordinates[0]);
      dx = Math.min(dx, 360 - dx);
      const distance = Math.hypot(
        dx,
        mercatorY(other.coordinates[1]) - mercatorY(stage.coordinates[1]),
      );
      if (Math.hypot(dx, other.coordinates[1] - stage.coordinates[1]) < SHARED_PLACE_DEGREES)
        continue;
      nearest = Math.min(nearest, distance);
    }
    // 512 px tiles: one degree spans 512 * 2^zoom / 360 pixels.
    const zoom = Math.ceil(Math.log2(EMBLEM_CLEARANCE / ((nearest * 512) / 360)));
    zooms.set(stage.id, Math.min(Math.max(zoom, 0), FULL_DETAIL_ZOOM));
  }
  return zooms;
}

export function religionFeatures(dataset: ReligionDataset): FeatureCollection<Geometry> {
  const traditions = new Map(dataset.traditions.map((item) => [item.id, item]));
  const milestones = new Map(dataset.milestones.map((item) => [item.id, item]));
  const fan = religionFanIndex(dataset);
  const fanOwn = religionFanIndex(dataset, true);
  const detail = religionDetailZooms(dataset);
  const detailOwn = religionDetailZooms(dataset, true);
  const features: FeatureCollection<Geometry>['features'] = [];
  for (const stage of dataset.milestones) {
    const tradition = traditions.get(stage.traditionId)!;
    const properties = {
      id: stage.id,
      tradition: stage.traditionId,
      year: stage.year,
      color: tradition.color,
      origin: stage.kind === 'origin',
    };
    features.push({
      type: 'Feature',
      id: `${stage.id}-point`,
      geometry: { type: 'Point', coordinates: stage.coordinates },
      properties: {
        ...properties,
        shape: 'point',
        fan: fan.get(stage.id) ?? 0,
        fanOwn: fanOwn.get(stage.id) ?? 0,
        detail: detail.get(stage.id) ?? 0,
        detailOwn: detailOwn.get(stage.id) ?? 0,
      },
    });
    if (stage.area)
      features.push({
        type: 'Feature',
        id: `${stage.id}-area`,
        geometry: { type: 'Polygon', coordinates: [stage.area.ring] },
        properties: { ...properties, shape: 'area' },
      });
    if (stage.fromId) {
      const from = milestones.get(stage.fromId)!;
      // Shortest wrapped longitude avoids sending a Pacific connection across Europe.
      const destination = [...stage.coordinates];
      destination[0] += Math.round((from.coordinates[0] - destination[0]) / 360) * 360;
      features.push({
        type: 'Feature',
        id: `${stage.id}-route`,
        geometry: { type: 'LineString', coordinates: [from.coordinates, destination] },
        properties: { ...properties, shape: 'route' },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function religionFilter(shape: string, state: AtlasState): ExpressionSpecification {
  const clauses: ExpressionSpecification[] = [
    ['==', ['get', 'shape'], shape],
    ['<=', ['get', 'year'], state.range ? Math.max(...state.range) : state.year],
  ];
  if (state.religionFilter) clauses.push(['==', ['get', 'tradition'], state.religionFilter]);
  return ['all', ...clauses];
}

/** Geometry is installed once. Time changes filter stable sources instead of removing symbols. */
export function startReligionOverlay(map: MapInstance) {
  const sprites = createReligionSprites(map);
  let state: AtlasState | undefined;
  let dataset: ReligionDataset | undefined;
  let installed = false;
  let loading = false;
  let disposed = false;
  let filterKey = '';
  let theme: AtlasState['theme'] | undefined;
  let emblemFilter: string | null = null;

  const selection = () => {
    if (!installed || !state) return;
    const filter: ExpressionSpecification = [
      'all',
      religionFilter('point', state),
      ['==', ['get', 'id'], useReligionStore.getState().selected?.id ?? ''],
    ];
    // The selected milestone always shows its medallion, even where it is generalised to a dot.
    map.setFilter(SELECTED_EMBLEM, filter);
    map.setFilter(SELECTION, filter);
  };
  const refresh = () => {
    if (!installed || !dataset || !state) return;
    const active = state.religionsVisible;
    for (const id of LAYERS) {
      const enabled =
        active &&
        (ROUTE_LAYERS.has(id)
          ? state.religionRoutesVisible
          : AREA_LAYERS.has(id)
            ? state.religionAreasVisible
            : true);
      map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
    }
    // Territory snapshots are inserted over time. Keep zones and routes beneath
    // resource pictograms, and the sparse emblems above them.
    if (active) raiseThematicLayers(map);
    if (state.theme !== theme) {
      theme = state.theme;
      map.setPaintProperty(CASING, 'line-color', THEME_PAINT[theme].casing);
      map.setPaintProperty(CASING, 'line-opacity', THEME_PAINT[theme].casingOpacity);
      map.setPaintProperty(RELIGION_AREAS, 'fill-opacity', THEME_PAINT[theme].hatch);
    }
    const key = `${state.range ? Math.max(...state.range) : state.year}:${state.religionFilter ?? ''}`;
    if (active && key !== filterKey) {
      filterKey = key;
      publishReligionDataset(
        dataset,
        religionMilestonesAt(dataset, state.year, state.range, state.religionFilter),
      );
      map.setFilter(RELIGION_POINTS, religionFilter('point', state));
      map.setFilter(CASING, religionFilter('route', state));
      map.setFilter(RELIGION_ROUTES, religionFilter('route', state));
      map.setFilter(ARROWS, religionFilter('route', state));
      map.setFilter(RELIGION_AREAS, religionFilter('area', state));
      map.setFilter(OUTLINES, religionFilter('area', state));
      // Layout only: switching the emblem form never rewrites or hides the geometry.
      if (state.religionFilter !== emblemFilter) {
        emblemFilter = state.religionFilter;
        map.setLayoutProperty(RELIGION_POINTS, 'icon-image', emblemImage(emblemFilter));
        for (const id of [RELIGION_POINTS, SELECTED_EMBLEM, SELECTION])
          map.setLayoutProperty(id, 'icon-offset', emblemOffset(emblemFilter));
      }
      selection();
    }
  };
  const clear = () => {
    installed = false;
    filterKey = '';
    for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(RELIGION_SOURCE)) map.removeSource(RELIGION_SOURCE);
    sprites.dispose();
  };
  const load = async () => {
    if (loading || installed || disposed || !state?.religionsVisible) return;
    loading = true;
    useReligionStore.setState({ status: 'loading', error: null });
    try {
      dataset = await getReligionDataset();
      if (disposed) return;
      sprites.ensure(dataset.traditions);
      map.addSource(RELIGION_SOURCE, { type: 'geojson', data: religionFeatures(dataset) });
      theme = state.theme;
      emblemFilter = state.religionFilter;
      map.addLayer({
        id: RELIGION_AREAS,
        type: 'fill',
        source: RELIGION_SOURCE,
        filter: religionFilter('area', state),
        paint: {
          'fill-pattern': ['concat', 'religion-hatch-', ['get', 'tradition']],
          'fill-opacity': THEME_PAINT[theme].hatch,
          'fill-opacity-transition': { duration: 0 },
        },
      });
      map.addLayer({
        id: OUTLINES,
        type: 'line',
        source: RELIGION_SOURCE,
        filter: religionFilter('area', state),
        // Dotted, so approximate zones never read as the dashed political borders.
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 6, 2.2],
          'line-opacity': 0.9,
          'line-dasharray': [0.2, 2.2],
        },
      });
      // A contrasting casing keeps dashed routes visible over every territory colour.
      map.addLayer({
        id: CASING,
        type: 'line',
        source: RELIGION_SOURCE,
        filter: religionFilter('route', state),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': THEME_PAINT[theme].casing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 4, 3.6, 8, 4.6],
          'line-opacity': THEME_PAINT[theme].casingOpacity,
        },
      });
      map.addLayer({
        id: RELIGION_ROUTES,
        type: 'line',
        source: RELIGION_SOURCE,
        filter: religionFilter('route', state),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 4, 2.2, 8, 2.8],
          'line-opacity': 0.95,
          'line-dasharray': [2.5, 1.5],
        },
      });
      map.addLayer({
        id: ARROWS,
        type: 'symbol',
        source: RELIGION_SOURCE,
        filter: religionFilter('route', state),
        layout: {
          'symbol-placement': 'line-center',
          'icon-image': ['concat', 'religion-arrow-', ['get', 'tradition']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 4, 0.9, 8, 1.1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-rotation-alignment': 'map',
          'icon-keep-upright': false,
        },
      });
      map.addLayer({
        id: RELIGION_POINTS,
        type: 'symbol',
        source: RELIGION_SOURCE,
        filter: religionFilter('point', state),
        layout: {
          'icon-image': emblemImage(emblemFilter),
          'icon-size': EMBLEM_SIZE,
          'icon-offset': emblemOffset(emblemFilter),
          'symbol-sort-key': EMBLEM_SORT_KEY,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
      });
      map.addLayer({
        id: SELECTED_EMBLEM,
        type: 'symbol',
        source: RELIGION_SOURCE,
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'icon-image': DETAIL_IMAGE,
          'icon-size': EMBLEM_SIZE,
          'icon-offset': emblemOffset(emblemFilter),
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
      });
      map.addLayer({
        id: SELECTION,
        type: 'symbol',
        source: RELIGION_SOURCE,
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'icon-image': RELIGION_SELECTION_RING,
          'icon-size': EMBLEM_SIZE,
          'icon-offset': emblemOffset(emblemFilter),
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
        // An ink halo separates the ring from an origin's own double ring and from routes.
        paint: {
          'icon-color': ['get', 'color'],
          'icon-halo-color': '#09222e',
          'icon-halo-width': 1.2,
        },
      });
      installed = true;
      refresh();
      if (!state.religionsVisible) publishReligionDataset(dataset, []);
      selection();
      map.triggerRepaint();
    } catch (error) {
      if (disposed) return;
      clear();
      useReligionStore.setState({ status: 'error', error: String(error) });
    } finally {
      loading = false;
    }
  };
  const select = (event: MapLayerMouseEvent) => {
    // Emblems are drawn above resource symbols, so they take the click first,
    // except under the resource group count cartouches drawn above them.
    if (!state?.religionsVisible || disposed || !installed || hasResourceCountAt(map, event.point))
      return;
    // Queried symbols come back in reverse source order, ignoring symbol-sort-key:
    // pick the hit with the highest sort key, i.e. the emblem drawn on top.
    const top = [...(event.features ?? [])].sort(
      (a, b) => emblemSortKey(b.properties) - emblemSortKey(a.properties),
    )[0];
    const id = String(top?.properties?.id ?? '');
    const stage = useReligionStore.getState().visibleMilestones.find((item) => item.id === id);
    if (stage) {
      event.preventDefault();
      useReligionStore.getState().select(stage);
    }
  };
  const enter = () => {
    if (state?.religionsVisible) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = (event?: MapLayerMouseEvent) => {
    // Moving from an emblem onto a touching resource symbol keeps the pointer.
    if (event && hasResourceAt(map, event.point)) return;
    map.getCanvas().style.cursor = '';
  };
  map.on('click', RELIGION_POINTS, select);
  map.on('mouseenter', RELIGION_POINTS, enter);
  map.on('mouseleave', RELIGION_POINTS, leave);
  const unsubscribe = useReligionStore.subscribe((next, previous) => {
    if (next.selected !== previous.selected) selection();
    if (next.revision !== previous.revision) void load();
  });
  return {
    update(next: AtlasState) {
      const wasActive = state?.religionsVisible;
      state = next;
      if (!next.religionsVisible && wasActive) {
        useReligionStore.getState().setPanelOpen(false);
        leave();
      }
      refresh();
      if (next.religionsVisible && !wasActive) void load();
    },
    isReady: () => !state?.religionsVisible || !installed || map.isSourceLoaded(RELIGION_SOURCE),
    dispose() {
      disposed = true;
      unsubscribe();
      map.off('click', RELIGION_POINTS, select);
      map.off('mouseenter', RELIGION_POINTS, enter);
      map.off('mouseleave', RELIGION_POINTS, leave);
      clear();
      useReligionStore.setState({
        status: 'idle',
        selected: null,
        panelOpen: false,
        visibleMilestones: [],
      });
    },
  };
}
