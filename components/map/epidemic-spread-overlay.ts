import type { ExpressionSpecification, Map as MapInstance } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { thematicHorizon } from '@/lib/thematic/time';
import {
  EPIDEMIC_FRONT_TIME,
  EPIDEMIC_TIME,
  epidemicFrontsAt,
  latestEpidemicFrontIds,
} from '@/lib/epidemics/time';
import { useEpidemicStore } from '@/lib/epidemics/store';
import type { EpidemicDataset } from '@/lib/epidemics/types';
import { epidemicSpreadFeatures } from './epidemic-spread';
import { raiseThematicLayers } from './thematic-stack';

export const EPIDEMIC_SPREAD_SOURCE = 'epidemic-spread';
export const EPIDEMIC_FRONT_FILL = 'epidemic-fronts';
export const EPIDEMIC_FRONT_OUTLINE = 'epidemic-front-outlines';
export const EPIDEMIC_HALO = 'epidemic-halos';
export const EPIDEMIC_FRONT_LABEL = 'epidemic-front-labels';
const LAYERS = [
  EPIDEMIC_FRONT_FILL,
  EPIDEMIC_FRONT_OUTLINE,
  EPIDEMIC_HALO,
  EPIDEMIC_FRONT_LABEL,
] as const;

const HALO_PAINT = { dark: '#08202b', light: '#f1eddc' } as const;

interface SpreadView {
  active: boolean;
  horizon: number;
  filter: string | null;
  theme: 'dark' | 'light';
}

const frontFilter = (
  horizon: number,
  filter: string | null,
  latest: string[] | null,
): ExpressionSpecification => {
  const clauses: ExpressionSpecification[] = [
    ['==', ['get', 'shape'], 'front'],
    EPIDEMIC_FRONT_TIME.filter(horizon),
  ];
  if (filter) clauses.push(['==', ['get', 'theme'], filter]);
  if (latest) clauses.push(['in', ['get', 'id'], ['literal', latest]] as ExpressionSpecification);
  return ['all', ...clauses];
};

const haloFilter = (horizon: number, filter: string | null): ExpressionSpecification => {
  const clauses: ExpressionSpecification[] = [
    ['==', ['get', 'shape'], 'halo'],
    EPIDEMIC_TIME.filter(horizon),
  ];
  if (filter) clauses.push(['==', ['get', 'theme'], filter]);
  return ['all', ...clauses];
};

/**
 * Dated halos and cumulative spread fronts, drawn under the milestone emblems.
 * Geometry is installed once; time moves filters and fades, never the source.
 */
export function startEpidemicSpreadOverlay(map: MapInstance) {
  let view: SpreadView | undefined;
  let installed = false;
  let disposed = false;
  let key = '';

  const refresh = () => {
    if (!installed || !view) return;
    for (const id of LAYERS)
      map.setLayoutProperty(id, 'visibility', view.active ? 'visible' : 'none');
    if (!view.active) return;
    raiseThematicLayers(map);
    const dataset = useEpidemicStore.getState().dataset;
    const next = `${view.horizon}:${view.filter ?? ''}:${view.theme}`;
    if (!dataset || next === key) return;
    key = next;
    const { horizon, filter } = view;
    const latest = latestEpidemicFrontIds(epidemicFrontsAt(dataset, horizon, filter), horizon);
    map.setFilter(EPIDEMIC_FRONT_FILL, frontFilter(horizon, filter, latest));
    map.setFilter(EPIDEMIC_FRONT_OUTLINE, frontFilter(horizon, filter, null));
    map.setFilter(EPIDEMIC_FRONT_LABEL, frontFilter(horizon, filter, null));
    map.setFilter(EPIDEMIC_HALO, haloFilter(horizon, filter));
    map.setPaintProperty(
      EPIDEMIC_FRONT_FILL,
      'fill-opacity',
      EPIDEMIC_FRONT_TIME.opacity(horizon, 0.22),
    );
    map.setPaintProperty(
      EPIDEMIC_FRONT_OUTLINE,
      'line-opacity',
      EPIDEMIC_FRONT_TIME.opacity(horizon, 0.85),
    );
    map.setPaintProperty(
      EPIDEMIC_FRONT_LABEL,
      'text-opacity',
      EPIDEMIC_FRONT_TIME.opacity(horizon, 0.95),
    );
    map.setPaintProperty(EPIDEMIC_FRONT_LABEL, 'text-halo-color', HALO_PAINT[view.theme]);
    map.setPaintProperty(EPIDEMIC_HALO, 'circle-opacity', EPIDEMIC_TIME.opacity(horizon, 0.42));
    map.setPaintProperty(
      EPIDEMIC_HALO,
      'circle-stroke-opacity',
      EPIDEMIC_TIME.opacity(horizon, 0.85),
    );
    map.setPaintProperty(EPIDEMIC_HALO, 'circle-stroke-width', [
      'case',
      ['<=', ['-', horizon, ['get', 'year']], 1],
      2.2,
      1.0,
    ]);
  };

  const install = (dataset: EpidemicDataset) => {
    if (installed || disposed) return;
    installed = true;
    map.addSource(EPIDEMIC_SPREAD_SOURCE, {
      type: 'geojson',
      data: epidemicSpreadFeatures(dataset),
    });
    map.addLayer({
      id: EPIDEMIC_FRONT_FILL,
      type: 'fill',
      source: EPIDEMIC_SPREAD_SOURCE,
      filter: frontFilter(view?.horizon ?? 0, view?.filter ?? null, []),
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': EPIDEMIC_FRONT_TIME.opacity(view?.horizon ?? 0, 0.22),
        'fill-opacity-transition': { duration: 0 },
      },
    });
    map.addLayer({
      id: EPIDEMIC_FRONT_OUTLINE,
      type: 'line',
      source: EPIDEMIC_SPREAD_SOURCE,
      filter: frontFilter(view?.horizon ?? 0, view?.filter ?? null, null),
      // Solid: hatched area outlines are dotted and routes dashed, fronts read differently.
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.1, 6, 2.0],
        'line-opacity': EPIDEMIC_FRONT_TIME.opacity(view?.horizon ?? 0, 0.85),
        'line-opacity-transition': { duration: 0 },
      },
    });
    map.addLayer({
      id: EPIDEMIC_HALO,
      type: 'circle',
      source: EPIDEMIC_SPREAD_SOURCE,
      filter: haloFilter(view?.horizon ?? 0, view?.filter ?? null),
      paint: {
        'circle-radius': [
          'interpolate',
          ['exponential', 2],
          ['zoom'],
          0,
          ['get', 'r0'],
          22,
          ['*', ['get', 'r0'], 4194304],
        ],
        'circle-color': ['get', 'color'],
        'circle-opacity': EPIDEMIC_TIME.opacity(view?.horizon ?? 0, 0.42),
        'circle-opacity-transition': { duration: 0 },
        'circle-blur': 0.45,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': [
          'case',
          ['<=', ['-', view?.horizon ?? 0, ['get', 'year']], 1],
          2.2,
          1.0,
        ],
        'circle-stroke-opacity': EPIDEMIC_TIME.opacity(view?.horizon ?? 0, 0.85),
        'circle-stroke-opacity-transition': { duration: 0 },
        'circle-pitch-alignment': 'map',
      },
    });
    map.addLayer({
      id: EPIDEMIC_FRONT_LABEL,
      type: 'symbol',
      source: EPIDEMIC_SPREAD_SOURCE,
      filter: frontFilter(view?.horizon ?? 0, view?.filter ?? null, null),
      layout: {
        'symbol-placement': 'line',
        'text-field': ['to-string', ['get', 'year']],
        'text-font': ['Atlas Serif'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 12],
        'symbol-spacing': 350,
        'text-letter-spacing': 0.08,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': HALO_PAINT[view?.theme ?? 'dark'],
        'text-halo-width': 1.2,
        'text-opacity': EPIDEMIC_FRONT_TIME.opacity(view?.horizon ?? 0, 0.95),
        'text-opacity-transition': { duration: 0 },
      },
    });
    refresh();
    map.triggerRepaint();
  };

  const unsubscribe = useEpidemicStore.subscribe((state, previous) => {
    if (!installed && state.dataset && state.dataset !== previous.dataset) install(state.dataset);
  });
  return {
    update(next: AtlasState) {
      view = {
        active: next.epidemicsVisible && next.epidemicSpreadVisible,
        horizon: thematicHorizon(next.year, next.range),
        filter: next.epidemicFilter,
        theme: next.theme,
      };
      const dataset = useEpidemicStore.getState().dataset;
      if (dataset) install(dataset);
      refresh();
    },
    isReady: () => !view?.active || !installed || map.isSourceLoaded(EPIDEMIC_SPREAD_SOURCE),
    dispose() {
      disposed = true;
      unsubscribe();
      installed = false;
      for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(EPIDEMIC_SPREAD_SOURCE)) map.removeSource(EPIDEMIC_SPREAD_SOURCE);
    },
  };
}
