import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { temporalWindow } from '@/lib/map-time';
import { BATTLE_EVENT_TYPES } from '@/lib/event-visibility';

const WITHOUT_BATTLES: ExpressionSpecification = [
  '!',
  ['in', ['get', 'type'], ['literal', BATTLE_EVENT_TYPES]],
];

export function eventFilter(state: AtlasState): FilterSpecification {
  const window = temporalWindow(state.speed, state.playing);
  const from = state.range?.[0] ?? state.year - window;
  const to = state.range?.[1] ?? state.year + window;
  const result: unknown[] = [
    'all',
    ['<=', ['get', 'start'], to],
    ['>=', ['get', 'end'], from],
    [
      '>=',
      ['get', 'importance'],
      state.selectedWar || state.battleMode
        ? state.filters.minImportance
        : Math.max(state.filters.minImportance, Math.max(0, 75 - state.camera.zoom * 10)),
    ],
  ];
  if (!state.battlesVisible) result.push(WITHOUT_BATTLES);
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

export function selectedEventFilter(state: AtlasState): FilterSpecification {
  const selected: ExpressionSpecification = ['==', ['get', 'id'], state.selectedEvent ?? ''];
  return state.battlesVisible ? selected : ['all', selected, WITHOUT_BATTLES];
}
