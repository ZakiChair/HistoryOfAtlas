import { useAtlasStore } from './store';
import type { HistoricalEvent, Campaign } from './schema';
import { getEvent } from './data-client';
import { focusBattle } from './battles/navigation';
import { isBattleEventType } from './event-visibility';

type NavigableEvent = Pick<HistoricalEvent, 'id' | 'start' | 'coords'> &
  Partial<Pick<HistoricalEvent, 'type'>>;

/** A detail/dialog owns one navigator so later choices supersede earlier network replies. */
export function createEventNavigation(load: (id: string) => Promise<NavigableEvent> = getEvent) {
  let sequence = 0;
  return {
    async open(id: string, options: { preserveContext?: boolean; isCurrent?: () => boolean } = {}) {
      const request = ++sequence;
      const current = () => request === sequence && (options.isCurrent?.() ?? true);
      try {
        const event = await load(id);
        if (!current()) return false;
        openEvent(event, options);
        return true;
      } catch (error) {
        if (!current()) return false;
        throw error;
      }
    },
    cancel() {
      sequence += 1;
    },
  };
}

export function openPerson(id: string, options: { preserveContext?: boolean } = {}) {
  if (!/^Q[1-9]\d*$/.test(id)) return;
  useAtlasStore.getState().patchState({
    selectedPerson: id,
    playing: false,
    campaignPlaying: false,
    entityFollowing: false,
    ...(options.preserveContext === false
      ? {
          selectedEvent: null,
          selectedEntity: null,
          selectedWar: null,
          campaignId: null,
          storyId: null,
        }
      : {}),
  });
}

export function openEvent(
  event: NavigableEvent,
  options: { preserveContext?: boolean; showDetails?: boolean } = {},
) {
  const state = useAtlasStore.getState();
  if (state.battleMode && isBattleEventType(event.type)) {
    focusBattle(event);
    return;
  }
  state.patchState({
    battleMode: false,
    ...(isBattleEventType(event.type) ? { battlesVisible: true } : {}),
    year: event.start.year,
    selectedEvent: options.showDetails === false ? null : event.id,
    selectedEntity: null,
    selectedPerson: null,
    playing: false,
    mode: 'events',
    range: null,
    ...(!options.preserveContext ? { selectedWar: null, campaignId: null, storyId: null } : {}),
    ...(event.coords
      ? {
          camera: {
            ...state.camera,
            lon: event.coords[0],
            lat: event.coords[1],
            zoom: Math.max(state.camera.zoom, 4),
          },
        }
      : {}),
  });
}

export function openCampaign(campaign: Campaign, step = 0) {
  step = Math.max(
    0,
    Math.min(campaign.steps.length - 1, Math.floor(Number.isFinite(step) ? step : 0)),
  );
  const target = campaign.steps[Math.min(step, campaign.steps.length - 1)];
  if (!target) return;
  const state = useAtlasStore.getState();
  state.patchState({
    campaignId: campaign.id,
    storyId: null,
    campaignStep: step,
    selectedEvent: null,
    selectedEntity: null,
    selectedPerson: null,
    selectedWar: null,
    year: target.date.year,
    mode: 'events',
    range: null,
    playing: false,
    projection: 'mercator',
    camera: {
      ...state.camera,
      lon: target.coords[0],
      lat: target.coords[1],
      zoom: 3.6,
      bearing: 0,
      pitch: 0,
    },
  });
}
