import type { FeatureCollection, Geometry } from 'geojson';
import type { ExpressionSpecification, Map as MapInstance, MapLayerMouseEvent } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import type { ReligionDataset } from '@/lib/religions/types';
import { getReligionDataset } from '@/lib/religions/client';
import { religionMilestonesAt } from '@/lib/religions/time';
import { publishReligionDataset, useReligionStore } from '@/lib/religions/store';
import { RELIGION_SOURCE, RELIGION_POINTS, RELIGION_ROUTES, RELIGION_AREAS } from './religion-hit';
import { createReligionSprites } from './religion-sprites';
import { hasResourceAt } from './resource-hit';

const OUTLINES = 'religion-area-outlines';
const ARROWS = 'religion-route-directions';
const SELECTION = 'religion-selection';
const LAYERS = [RELIGION_AREAS, OUTLINES, RELIGION_ROUTES, ARROWS, RELIGION_POINTS, SELECTION];

export function religionFeatures(dataset: ReligionDataset): FeatureCollection<Geometry> {
  const traditions = new Map(dataset.traditions.map((item) => [item.id, item]));
  const milestones = new Map(dataset.milestones.map((item) => [item.id, item]));
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
      properties: { ...properties, shape: 'point' },
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

  const selection = () => {
    if (!installed || !state) return;
    map.setFilter(SELECTION, [
      'all',
      religionFilter('point', state),
      ['==', ['get', 'id'], useReligionStore.getState().selected?.id ?? ''],
    ]);
  };
  const refresh = () => {
    if (!installed || !dataset || !state) return;
    const active = state.religionsVisible;
    for (const id of LAYERS) {
      const enabled =
        active &&
        (id === RELIGION_ROUTES || id === ARROWS
          ? state.religionRoutesVisible
          : id === RELIGION_AREAS || id === OUTLINES
            ? state.religionAreasVisible
            : true);
      map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
    }
    // Territory snapshots are inserted over time. Keep zones above fills, beneath thematic markers.
    if (active) {
      const before = map.getLayer('resource-clusters') ? 'resource-clusters' : undefined;
      const order = map.getStyle().layers?.map((layer) => layer.id) ?? [];
      const end = before ? order.indexOf(before) : order.length;
      if (!LAYERS.every((id, index) => order[end - LAYERS.length + index] === id))
        for (const id of LAYERS) map.moveLayer(id, before);
    }
    const key = `${state.range ? Math.max(...state.range) : state.year}:${state.religionFilter ?? ''}`;
    if (active && key !== filterKey) {
      filterKey = key;
      publishReligionDataset(
        dataset,
        religionMilestonesAt(dataset, state.year, state.range, state.religionFilter),
      );
      map.setFilter(RELIGION_POINTS, religionFilter('point', state));
      map.setFilter(RELIGION_ROUTES, religionFilter('route', state));
      map.setFilter(ARROWS, religionFilter('route', state));
      map.setFilter(RELIGION_AREAS, religionFilter('area', state));
      map.setFilter(OUTLINES, religionFilter('area', state));
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
      map.addLayer({
        id: RELIGION_AREAS,
        type: 'fill',
        source: RELIGION_SOURCE,
        filter: religionFilter('area', state),
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.16,
          'fill-opacity-transition': { duration: 0 },
        },
      });
      map.addLayer({
        id: OUTLINES,
        type: 'line',
        source: RELIGION_SOURCE,
        filter: religionFilter('area', state),
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1,
          'line-opacity': 0.55,
          'line-dasharray': [3, 3],
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
          'line-width': 2,
          'line-opacity': 0.85,
          'line-dasharray': [2, 2],
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
          'icon-size': 0.75,
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
          'icon-image': ['concat', 'religion-', ['get', 'tradition']],
          'icon-size': ['case', ['get', 'origin'], 1.1, 0.8],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
      });
      map.addLayer({
        id: SELECTION,
        type: 'circle',
        source: RELIGION_SOURCE,
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 23,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
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
    if (!state?.religionsVisible || disposed || !installed || hasResourceAt(map, event.point))
      return;
    const id = String(event.features?.[0]?.properties?.id ?? '');
    const stage = useReligionStore.getState().visibleMilestones.find((item) => item.id === id);
    if (stage) {
      event.preventDefault();
      useReligionStore.getState().select(stage);
    }
  };
  const enter = () => {
    if (state?.religionsVisible) map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
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
