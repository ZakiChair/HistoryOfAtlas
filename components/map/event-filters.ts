import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { temporalWindow } from '@/lib/map-time';
import { CONFLICT_EVENT_TYPES } from '@/lib/event-visibility';

// Hiding battles hides every armed conflict, so no conflict marker remains on the map.
const WITHOUT_CONFLICTS: ExpressionSpecification = [
  '!',
  ['in', ['get', 'type'], ['literal', CONFLICT_EVENT_TYPES]],
];

/**
 * `markers` thins minor events on wide views so individual symbols stay legible.
 * `density` (heatmap, and cluster counts up to MAX_DENSITY_CLUSTER_SPAN) keeps every event above
 * the reader's own importance threshold, so the aggregate describes the whole corpus, not the
 * thinned sample.
 */
export type EventFilterPurpose = 'markers' | 'density';

/** Importance below which markers are thinned at this zoom; density ignores the zoom. */
export function minimumEventImportance(
  state: AtlasState,
  purpose: EventFilterPurpose = 'markers',
): number {
  if (purpose === 'density' || state.selectedWar || state.battleMode)
    return state.filters.minImportance;
  return Math.max(state.filters.minImportance, Math.max(0, 75 - state.camera.zoom * 10));
}

/**
 * Widest time window, in years, whose cluster counts use the density set. Clustering queries
 * every matching rendered feature on the main thread at each idle: the densest 100-year window
 * (1845–1945) holds about 4,900 events and the default ±3-year view at most about 1,100, but
 * 1700–2000 holds about 10,600. Wider periods count the zoom-thinned marker sample instead,
 * and their labels say so (clusterCountsThinned).
 */
export const MAX_DENSITY_CLUSTER_SPAN = 100;

/** Group counts use the density set unless the period is too wide to query at every idle. */
export function clusterFilterPurpose(state: AtlasState): EventFilterPurpose {
  const span = state.range
    ? state.range[1] - state.range[0]
    : 2 * temporalWindow(state.speed, state.playing);
  return span <= MAX_DENSITY_CLUSTER_SPAN ? 'density' : 'markers';
}

/** True when group counts leave out minor events, so a count must not claim every event. */
export function clusterCountsThinned(state: AtlasState): boolean {
  return (
    minimumEventImportance(state, clusterFilterPurpose(state)) >
    minimumEventImportance(state, 'density')
  );
}

export function eventFilter(
  state: AtlasState,
  purpose: EventFilterPurpose = 'markers',
): FilterSpecification {
  const window = temporalWindow(state.speed, state.playing);
  const from = state.range?.[0] ?? state.year - window;
  const to = state.range?.[1] ?? state.year + window;
  const result: unknown[] = [
    'all',
    ['<=', ['get', 'start'], to],
    ['>=', ['get', 'end'], from],
    ['>=', ['get', 'importance'], minimumEventImportance(state, purpose)],
  ];
  if (!state.battlesVisible) result.push(WITHOUT_CONFLICTS);
  if (state.filters.types.length)
    result.push(['in', ['get', 'type'], ['literal', state.filters.types]]);
  if (state.filters.eras.length)
    result.push(['in', ['get', 'era'], ['literal', state.filters.eras]]);
  if (state.filters.regions.length)
    result.push(['in', ['get', 'region'], ['literal', state.filters.regions]]);
  if (state.selectedWar)
    result.push([
      'any',
      ['==', ['get', 'parentWar'], state.selectedWar],
      ['==', ['get', 'id'], state.selectedWar],
      ['in', `|${state.selectedWar}|`, ['coalesce', ['get', 'wars'], '']],
    ]);
  if (state.filters.entity)
    result.push(['in', `|${state.filters.entity}|`, ['coalesce', ['get', 'entities'], '']]);
  return result as FilterSpecification;
}

/** The ring marks the open dossier, or else the active story step shown without its dossier. */
export function selectedEventFilter(state: AtlasState): FilterSpecification {
  const id = state.selectedEvent ?? (state.storyId ? state.highlightedEvent : null);
  const selected: ExpressionSpecification = ['==', ['get', 'id'], id ?? ''];
  return state.battlesVisible ? selected : ['all', selected, WITHOUT_CONFLICTS];
}
