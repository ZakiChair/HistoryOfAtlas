import type {
  GeoJSONSource,
  Map as MapInstance,
  MapMouseEvent,
  ExpressionSpecification,
} from 'maplibre-gl';
import { useAtlasStore, type AtlasState } from '@/lib/store';
import { ensureContext, useContextStore } from '@/lib/context/store';
import { contextFeatures } from '@/lib/context/map';
import { selectedTerritorySubject } from '@/lib/context/types';
import {
  CONTEXT_LAYERS,
  CONTEXT_SOURCE,
  CONTEXT_LINES,
  CONTEXT_POINTS,
  CONTEXT_LABELS,
} from './context-hit';
import { raiseThematicLayers } from './thematic-stack';

export function startContextOverlay(map: MapInstance) {
  let disposed = false;
  let previousKey = '';
  let requestedKey = '';
  let previousData: unknown;
  const empty = { type: 'FeatureCollection' as const, features: [] };
  map.addSource(CONTEXT_SOURCE, { type: 'geojson', data: empty });
  const colour: ExpressionSpecification = [
    'match',
    ['get', 'kind'],
    'trade',
    '#8cc7c0',
    'migration',
    '#aab7ee',
    'forced-migration',
    '#e3a592',
    '#d4b880',
  ];
  map.addLayer({
    id: CONTEXT_LINES,
    type: 'line',
    source: CONTEXT_SOURCE,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': colour,
      'line-width': 3,
      'line-dasharray': [2, 2],
      'line-opacity': 0.85,
    },
  });
  map.addLayer({
    id: CONTEXT_POINTS,
    type: 'circle',
    source: CONTEXT_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#d4b880',
      'circle-stroke-color': '#071b29',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: CONTEXT_LABELS,
    type: 'symbol',
    source: CONTEXT_SOURCE,
    filter: ['==', ['get', 'id'], ''],
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ['get', 'title'], ''],
      'text-font': ['Atlas UI'],
      'text-size': 12,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-max-width': 18,
    },
    paint: { 'text-color': '#eee9dc', 'text-halo-color': '#071b29', 'text-halo-width': 2 },
  });

  const render = (state: AtlasState) => {
    if (disposed) return;
    const { revision } = useContextStore.getState();
    const request = `${state.contextView}:${revision}`;
    if (state.contextView && request !== requestedKey) {
      requestedKey = request;
      void ensureContext(state.contextView);
    }
    // A validated cached corpus can publish synchronously while switching tabs.
    const { loaded } = useContextStore.getState();
    const key = JSON.stringify([
      state.contextView,
      state.contextSelection,
      state.year,
      state.range,
      state.boundarySource,
      state.locale,
      state.battleMode,
    ]);
    if (key !== previousKey || loaded !== previousData) {
      previousKey = key;
      previousData = loaded;
      (map.getSource(CONTEXT_SOURCE) as GeoJSONSource).setData(contextFeatures(loaded, state));
      // A territory's population record has no feature of its own to highlight.
      const selection = selectedTerritorySubject(state.contextSelection)
        ? null
        : state.contextSelection;
      const selected: ExpressionSpecification = ['==', ['get', 'id'], selection ?? ''];
      map.setFilter(CONTEXT_LABELS, selected);
      map.setPaintProperty(CONTEXT_LINES, 'line-width', ['case', selected, 5, 3]);
      map.setPaintProperty(
        CONTEXT_LINES,
        'line-opacity',
        selection ? ['case', selected, 1, 0.4] : 0.85,
      );
      const coverage = state.contextView === 'coverage';
      map.setPaintProperty(
        CONTEXT_POINTS,
        'circle-radius',
        coverage ? 3 : ['case', selected, 9, 6],
      );
      map.setPaintProperty(
        CONTEXT_POINTS,
        'circle-color',
        coverage ? ['case', ['get', 'documented'], '#8cc7c0', 'rgba(0,0,0,0)'] : '#d4b880',
      );
      map.setPaintProperty(
        CONTEXT_POINTS,
        'circle-stroke-color',
        coverage ? ['case', ['get', 'documented'], '#335957', '#8c9ca6'] : '#071b29',
      );
      map.setPaintProperty(CONTEXT_POINTS, 'circle-stroke-width', coverage ? 1 : 2);
    }
    map.setPaintProperty(
      CONTEXT_LABELS,
      'text-color',
      state.theme === 'dark' ? '#eee9dc' : '#283b42',
    );
    map.setPaintProperty(
      CONTEXT_LABELS,
      'text-halo-color',
      state.theme === 'dark' ? '#071b29' : '#f7f3e9',
    );
    raiseThematicLayers(map);
  };
  const click = (event: MapMouseEvent) => {
    const feature = map.queryRenderedFeatures(event.point, { layers: CONTEXT_LAYERS })[0];
    if (!feature) return;
    event.preventDefault();
    useAtlasStore.getState().patchState({
      contextSelection: String(feature.properties.id),
      playing: false,
      campaignPlaying: false,
    });
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', click);
  for (const id of [CONTEXT_LINES, CONTEXT_POINTS]) {
    map.on('mouseenter', id, enter);
    map.on('mouseleave', id, leave);
  }
  const unsubscribe = useContextStore.subscribe((state, previous) => {
    if (state.loaded !== previous.loaded || state.revision !== previous.revision)
      render(useAtlasStore.getState());
  });
  return {
    update: render,
    isReady: () =>
      !useAtlasStore.getState().contextView ||
      useContextStore.getState().status === 'error' ||
      Boolean(map.isSourceLoaded(CONTEXT_SOURCE)),
    dispose: () => {
      disposed = true;
      unsubscribe();
      map.off('click', click);
      for (const id of [CONTEXT_LINES, CONTEXT_POINTS]) {
        map.off('mouseenter', id, enter);
        map.off('mouseleave', id, leave);
      }
      for (const id of [...CONTEXT_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(CONTEXT_SOURCE)) map.removeSource(CONTEXT_SOURCE);
    },
  };
}
