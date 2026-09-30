import type { FeatureCollection, Geometry } from 'geojson';
import type {
  ExpressionSpecification,
  Map as MapInstance,
  MapLayerMouseEvent,
  PointLike,
} from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { thematicMilestonesAt, type ThematicTimeModel } from '@/lib/thematic/time';
import { publishMilestones, type MilestoneStore } from '@/lib/thematic/store';
import {
  milestoneLayerIds,
  milestoneSpriteIds,
  type MilestoneEmblem,
  type MilestoneLayerIds,
} from './milestone-ids';
import { raiseThematicLayers } from './thematic-stack';

export interface MilestoneTheme {
  id: string;
  color: string;
  symbol: string;
}

export type { MilestoneEmblem } from './milestone-ids';

export interface MilestoneLike {
  id: string;
  kind: string;
  year: number;
  endYear?: number;
  coordinates: [number, number];
  fromId?: string;
  closesId?: string;
  area?: { ring: [number, number][] };
}

export interface MilestoneCorpus<M extends MilestoneLike> {
  themes: readonly MilestoneTheme[];
  milestones: readonly M[];
  themeIdOf: (milestone: M) => string;
  /** Emblem a kind is drawn with: plain, origin double ring, divided dash or closing slash. */
  emblemOf: (kind: string) => MilestoneEmblem;
}

/**
 * Below this zoom, later milestones are drawn as dots so founding centres stay legible.
 * icon-image is a layout property: MapLibre evaluates it at the integer tile zoom
 * (the floor of the map zoom for this 512 px GeoJSON source), so zooms here are integers.
 */
export const MILESTONE_DETAIL_ZOOM = 3;
/** Milestones within about 10 km (same city or holy site) overlap until street-level zooms. */
const SHARED_PLACE_DEGREES = 0.1;
/** Fanned medallions touch: the origin double ring is 44 px across at icon-size 1. */
const FAN_SPACING = 46;
/** Screen distance at which two medallions no longer hide each other. */
const EMBLEM_CLEARANCE = 36;
/** From this zoom every milestone is drawn as its medallion. */
const FULL_DETAIL_ZOOM = 7;
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
// Later milestones at a shared place fan out around the earliest, which keeps its position.
// `fan` counts every theme; `fanOwn` only the filtered theme's own milestones.
const fanOffset = (property: 'fan' | 'fanOwn'): ExpressionSpecification => [
  'match',
  ['get', property],
  1,
  ['literal', [FAN_SPACING, 0]],
  2,
  ['literal', [-FAN_SPACING, 0]],
  3,
  ['literal', [0, FAN_SPACING]],
  4,
  ['literal', [0, -FAN_SPACING]],
  5,
  ['literal', [FAN_SPACING, FAN_SPACING]],
  ['literal', [0, 0]],
];
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

const mercatorY = (latitude: number) =>
  (Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) * 180) / Math.PI;

/**
 * Stable fan index for milestones drawn at the same place. Later milestones are only
 * visible once the earliest one is, so the anchor is always on screen with them.
 */
export function milestoneFanIndex<M extends MilestoneLike>(
  corpus: MilestoneCorpus<M>,
  sameTheme = false,
): Map<string, number> {
  const ordered = [...corpus.milestones].sort(
    (a, b) => a.year - b.year || a.id.localeCompare(b.id),
  );
  const anchors: { coordinates: [number, number]; theme: string; members: number }[] = [];
  const fan = new Map<string, number>();
  for (const stage of ordered) {
    const anchor = anchors.find(
      (item) =>
        (!sameTheme || item.theme === corpus.themeIdOf(stage)) &&
        Math.hypot(
          item.coordinates[0] - stage.coordinates[0],
          item.coordinates[1] - stage.coordinates[1],
        ) < SHARED_PLACE_DEGREES,
    );
    if (anchor) fan.set(stage.id, Math.min(anchor.members++, 5));
    else {
      anchors.push({ coordinates: stage.coordinates, theme: corpus.themeIdOf(stage), members: 1 });
      fan.set(stage.id, 0);
    }
  }
  return fan;
}

/**
 * Integer zoom from which each milestone's medallion clears every more prominent
 * neighbour (origins first, then earlier milestones). Milestones sharing one place are
 * fanned instead, so they are not counted here.
 */
export function milestoneDetailZooms<M extends MilestoneLike>(
  corpus: MilestoneCorpus<M>,
  sameTheme = false,
): Map<string, number> {
  const rank = (stage: M) =>
    [corpus.emblemOf(stage.kind) === 'origin' ? 0 : 1, stage.year, stage.id] as const;
  const before = (a: M, b: M) => {
    const [left, right] = [rank(a), rank(b)];
    return left[0] - right[0] || left[1] - right[1] || left[2].localeCompare(right[2]);
  };
  const zooms = new Map<string, number>();
  for (const stage of corpus.milestones) {
    let nearest = Infinity;
    for (const other of corpus.milestones) {
      if (other === stage || before(other, stage) >= 0) continue;
      if (sameTheme && corpus.themeIdOf(other) !== corpus.themeIdOf(stage)) continue;
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

export function milestoneFeatures<M extends MilestoneLike>(
  corpus: MilestoneCorpus<M>,
): FeatureCollection<Geometry> {
  const themes = new Map(corpus.themes.map((item) => [item.id, item]));
  const milestones = new Map(corpus.milestones.map((item) => [item.id, item]));
  const fan = milestoneFanIndex(corpus);
  const fanOwn = milestoneFanIndex(corpus, true);
  const detail = milestoneDetailZooms(corpus);
  const detailOwn = milestoneDetailZooms(corpus, true);
  // A closing milestone dims its target from its own year; the earliest closer wins.
  const closedBy = new Map<string, number>();
  for (const stage of corpus.milestones)
    if (stage.closesId)
      closedBy.set(stage.closesId, Math.min(closedBy.get(stage.closesId) ?? Infinity, stage.year));
  const features: FeatureCollection<Geometry>['features'] = [];
  for (const stage of corpus.milestones) {
    const theme = themes.get(corpus.themeIdOf(stage))!;
    const closedYear = closedBy.get(stage.id);
    const properties = {
      id: stage.id,
      theme: corpus.themeIdOf(stage),
      year: stage.year,
      ...(stage.endYear !== undefined ? { endYear: stage.endYear } : {}),
      ...(closedYear !== undefined ? { closedYear } : {}),
      color: theme.color,
      emblem: corpus.emblemOf(stage.kind),
      origin: corpus.emblemOf(stage.kind) === 'origin',
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

export function milestoneFilter(
  shape: string,
  horizon: number,
  theme: string | null,
  time: ThematicTimeModel,
): ExpressionSpecification {
  const clauses: ExpressionSpecification[] = [
    ['==', ['get', 'shape'], shape],
    time.filter(horizon),
  ];
  if (theme) clauses.push(['==', ['get', 'theme'], theme]);
  return ['all', ...clauses];
}

/** A centre closed by a later contraction stays drawn but dimmed, never erased. */
export const CLOSED_OPACITY = 0.3;
const closedFade = (
  expression: ExpressionSpecification,
  horizon: number,
): ExpressionSpecification => [
  'case',
  ['all', ['has', 'closedYear'], ['<=', ['get', 'closedYear'], horizon]],
  ['*', expression, CLOSED_OPACITY],
  expression,
];

/** Paint-only age fade for every milestone layer; the selection keeps full opacity. */
export function milestoneAgePaint(
  ids: MilestoneLayerIds,
  time: ThematicTimeModel,
  horizon: number,
  theme: 'dark' | 'light',
  routeFadeRate: number,
) {
  const paint = THEME_PAINT[theme];
  return [
    [ids.points, 'icon-opacity', closedFade(time.opacity(horizon), horizon)],
    [ids.areas, 'fill-opacity', closedFade(time.opacity(horizon, paint.hatch), horizon)],
    [ids.outlines, 'line-opacity', closedFade(time.opacity(horizon, 0.9), horizon)],
    [ids.casing, 'line-opacity', time.opacity(horizon, paint.casingOpacity, routeFadeRate)],
    [ids.routes, 'line-opacity', time.opacity(horizon, 0.95, routeFadeRate)],
    [ids.arrows, 'icon-opacity', time.opacity(horizon, 1, routeFadeRate)],
  ] as const;
}

export interface MilestoneOverlayView {
  /** This overlay is drawn. */
  active: boolean;
  /** The layer itself is on (another view of it may be active instead). */
  layerVisible: boolean;
  filter: string | null;
  routesVisible: boolean;
  areasVisible: boolean;
  horizon: number;
  theme: 'dark' | 'light';
}

export interface MilestoneOverlayOptions<D, M extends MilestoneLike> {
  prefix: string;
  store: MilestoneStore<D, M>;
  load: () => Promise<D>;
  corpus: (dataset: D) => MilestoneCorpus<M>;
  time: ThematicTimeModel;
  routeFadeRate: number;
  createSprites: (map: MapInstance) => {
    ensure(themes: readonly MilestoneTheme[]): void;
    dispose(): void;
  };
  view: (state: AtlasState) => MilestoneOverlayView;
  /** Layers above the emblems whose hits take the click first (resource count cartouches). */
  hasForegroundAt?: (map: MapInstance, point: PointLike) => boolean;
  /** Neighbouring symbols that keep the pointer when it leaves an emblem. */
  keepsPointerAt?: (map: MapInstance, point: PointLike) => boolean;
}

/** Geometry is installed once. Time changes filter stable sources instead of removing symbols. */
export function startMilestoneOverlay<D, M extends MilestoneLike>(
  map: MapInstance,
  options: MilestoneOverlayOptions<D, M>,
) {
  const ids = milestoneLayerIds(options.prefix);
  const sprites = options.createSprites(map);
  const spriteIds = milestoneSpriteIds(options.prefix);
  const LAYERS = [
    ids.areas,
    ids.outlines,
    ids.casing,
    ids.routes,
    ids.arrows,
    ids.points,
    ids.selectedEmblem,
    ids.selection,
  ];
  const ROUTE_LAYERS = new Set([ids.casing, ids.routes, ids.arrows]);
  const AREA_LAYERS = new Set([ids.areas, ids.outlines]);
  const DOT_IMAGE: ExpressionSpecification = ['concat', spriteIds.prefixes.dot, ['get', 'theme']];
  const DETAIL_IMAGE: ExpressionSpecification = spriteIds.emblemImage;
  /**
   * A milestone stays a dot until its zoom (`detail`, or `detailOwn` under a theme
   * filter) separates it from every more prominent neighbour. Unfiltered world views also
   * reduce every later milestone to a dot; a filtered theme shows its emblems at once.
   */
  const emblemImage = (filter: string | null): ExpressionSpecification => {
    const property = filter ? 'detailOwn' : 'detail';
    const level = (zoom: number): ExpressionSpecification => [
      'case',
      ['>', ['get', property], zoom],
      DOT_IMAGE,
      !filter && zoom < MILESTONE_DETAIL_ZOOM
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
  const { store, time, routeFadeRate } = options;
  let view: MilestoneOverlayView | undefined;
  let dataset: D | undefined;
  let corpus: MilestoneCorpus<M> | undefined;
  let installed = false;
  let loading = false;
  let disposed = false;
  let filterKey = '';
  let ageKey = '';
  let theme: MilestoneOverlayView['theme'] | undefined;
  let emblemFilter: string | null = null;

  const selection = () => {
    if (!installed || !view) return;
    const filter: ExpressionSpecification = [
      'all',
      milestoneFilter('point', view.horizon, view.filter, time),
      ['==', ['get', 'id'], store.getState().selected?.id ?? ''],
    ];
    // The selected milestone always shows its medallion, even where it is generalised to a dot.
    map.setFilter(ids.selectedEmblem, filter);
    map.setFilter(ids.selection, filter);
  };
  const refresh = () => {
    if (!installed || !dataset || !corpus || !view) return;
    const active = view.active;
    for (const id of LAYERS) {
      const enabled =
        active &&
        (ROUTE_LAYERS.has(id)
          ? view.routesVisible
          : AREA_LAYERS.has(id)
            ? view.areasVisible
            : true);
      map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
    }
    // Territory snapshots are inserted over time. Keep zones and routes beneath
    // resource pictograms, and the sparse emblems above them.
    if (active) raiseThematicLayers(map);
    if (view.theme !== theme) {
      theme = view.theme;
      map.setPaintProperty(ids.casing, 'line-color', THEME_PAINT[theme].casing);
    }
    // Paint only, with the date filter below: older attestations fade without rewriting
    // or hiding the geometry. Hidden layers wait until they are shown again.
    const age = `${view.horizon}:${view.theme}`;
    if (active && age !== ageKey) {
      ageKey = age;
      for (const [id, property, value] of milestoneAgePaint(
        ids,
        time,
        view.horizon,
        view.theme,
        routeFadeRate,
      ))
        map.setPaintProperty(id, property, value);
    }
    const key = `${view.horizon}:${view.filter ?? ''}`;
    if (active && key !== filterKey) {
      filterKey = key;
      publishMilestones(
        store,
        dataset,
        thematicMilestonesAt(corpus.milestones, view.horizon, time, corpus.themeIdOf, view.filter),
      );
      map.setFilter(ids.points, milestoneFilter('point', view.horizon, view.filter, time));
      map.setFilter(ids.casing, milestoneFilter('route', view.horizon, view.filter, time));
      map.setFilter(ids.routes, milestoneFilter('route', view.horizon, view.filter, time));
      map.setFilter(ids.arrows, milestoneFilter('route', view.horizon, view.filter, time));
      map.setFilter(ids.areas, milestoneFilter('area', view.horizon, view.filter, time));
      map.setFilter(ids.outlines, milestoneFilter('area', view.horizon, view.filter, time));
      // Layout only: switching the emblem form never rewrites or hides the geometry.
      if (view.filter !== emblemFilter) {
        emblemFilter = view.filter;
        map.setLayoutProperty(ids.points, 'icon-image', emblemImage(emblemFilter));
        for (const id of [ids.points, ids.selectedEmblem, ids.selection])
          map.setLayoutProperty(id, 'icon-offset', emblemOffset(emblemFilter));
      }
      selection();
    }
  };
  const clear = () => {
    installed = false;
    filterKey = '';
    ageKey = '';
    for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(ids.source)) map.removeSource(ids.source);
    sprites.dispose();
  };
  const load = async () => {
    if (loading || installed || disposed || !view?.active) return;
    loading = true;
    store.setState({ status: 'loading', error: null });
    try {
      dataset = await options.load();
      if (disposed) return;
      corpus = options.corpus(dataset);
      sprites.ensure(corpus.themes);
      map.addSource(ids.source, { type: 'geojson', data: milestoneFeatures(corpus) });
      theme = view!.theme;
      emblemFilter = view!.filter;
      map.addLayer({
        id: ids.areas,
        type: 'fill',
        source: ids.source,
        filter: milestoneFilter('area', view!.horizon, view!.filter, time),
        paint: {
          'fill-pattern': ['concat', spriteIds.prefixes.hatch, ['get', 'theme']],
          'fill-opacity': THEME_PAINT[theme].hatch,
          'fill-opacity-transition': { duration: 0 },
        },
      });
      map.addLayer({
        id: ids.outlines,
        type: 'line',
        source: ids.source,
        filter: milestoneFilter('area', view!.horizon, view!.filter, time),
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
        id: ids.casing,
        type: 'line',
        source: ids.source,
        filter: milestoneFilter('route', view!.horizon, view!.filter, time),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': THEME_PAINT[theme].casing,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 4, 3.6, 8, 4.6],
          'line-opacity': THEME_PAINT[theme].casingOpacity,
        },
      });
      map.addLayer({
        id: ids.routes,
        type: 'line',
        source: ids.source,
        filter: milestoneFilter('route', view!.horizon, view!.filter, time),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 4, 2.2, 8, 2.8],
          'line-opacity': 0.95,
          'line-dasharray': [2.5, 1.5],
        },
      });
      map.addLayer({
        id: ids.arrows,
        type: 'symbol',
        source: ids.source,
        filter: milestoneFilter('route', view!.horizon, view!.filter, time),
        layout: {
          'symbol-placement': 'line-center',
          'icon-image': ['concat', spriteIds.prefixes.arrow, ['get', 'theme']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 4, 0.9, 8, 1.1],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-rotation-alignment': 'map',
          'icon-keep-upright': false,
        },
      });
      map.addLayer({
        id: ids.points,
        type: 'symbol',
        source: ids.source,
        filter: milestoneFilter('point', view!.horizon, view!.filter, time),
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
        id: ids.selectedEmblem,
        type: 'symbol',
        source: ids.source,
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
        id: ids.selection,
        type: 'symbol',
        source: ids.source,
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'icon-image': spriteIds.selectionRing,
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
      if (!view?.active) publishMilestones(store, dataset, []);
      selection();
      map.triggerRepaint();
    } catch (error) {
      if (disposed) return;
      clear();
      store.setState({ status: 'error', error: String(error) });
    } finally {
      loading = false;
    }
  };
  const select = (event: MapLayerMouseEvent) => {
    // Emblems are drawn above resource symbols, so they take the click first,
    // except under the resource group count cartouches drawn above them.
    if (
      !view?.active ||
      disposed ||
      !installed ||
      (options.hasForegroundAt?.(map, event.point) ?? false)
    )
      return;
    // Queried symbols come back in reverse source order, ignoring symbol-sort-key:
    // pick the hit with the highest sort key, i.e. the emblem drawn on top.
    const top = [...(event.features ?? [])].sort(
      (a, b) => emblemSortKey(b.properties) - emblemSortKey(a.properties),
    )[0];
    const id = String(top?.properties?.id ?? '');
    const stage = store.getState().visibleMilestones.find((item) => item.id === id);
    if (stage) {
      event.preventDefault();
      store.getState().select(stage);
    }
  };
  const enter = () => {
    if (view?.active) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = (event?: MapLayerMouseEvent) => {
    // Moving from an emblem onto a touching resource symbol keeps the pointer.
    if (event && (options.keepsPointerAt?.(map, event.point) ?? false)) return;
    map.getCanvas().style.cursor = '';
  };
  map.on('click', ids.points, select);
  map.on('mouseenter', ids.points, enter);
  map.on('mouseleave', ids.points, leave);
  const unsubscribe = store.subscribe((next, previous) => {
    if (next.selected !== previous.selected) selection();
    if (next.revision !== previous.revision) void load();
  });
  return {
    update(next: AtlasState) {
      const wasActive = view?.active;
      view = options.view(next);
      if (!view.active && wasActive) {
        if (!view.layerVisible) store.getState().setPanelOpen(false);
        else store.getState().select(null);
        leave();
      }
      refresh();
      if (view.active && !wasActive) void load();
    },
    isReady: () => !view?.active || !installed || map.isSourceLoaded(ids.source),
    dispose() {
      disposed = true;
      unsubscribe();
      map.off('click', ids.points, select);
      map.off('mouseenter', ids.points, enter);
      map.off('mouseleave', ids.points, leave);
      clear();
      store.setState({
        status: 'idle',
        selected: null,
        panelOpen: false,
        visibleMilestones: [],
      });
    },
  };
}
