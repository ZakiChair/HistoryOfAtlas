import { useAtlasStore } from './store';
import type { HistoricalEvent, Campaign } from './schema';

export function openEvent(
  event: Pick<HistoricalEvent, 'id' | 'start' | 'coords'>,
  options: { preserveContext?: boolean; showDetails?: boolean } = {},
) {
  const state = useAtlasStore.getState();
  state.patchState({
    year: event.start.year,
    selectedEvent: options.showDetails === false ? null : event.id,
    selectedEntity: null,
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
