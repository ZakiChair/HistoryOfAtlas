import type { Map as MapInstance } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { thematicHorizon } from '@/lib/thematic/time';
import { getEpidemicDataset } from '@/lib/epidemics/client';
import { useEpidemicStore } from '@/lib/epidemics/store';
import { EPIDEMIC_ROUTE_FADE_RATE, EPIDEMIC_TIME } from '@/lib/epidemics/time';
import type { EpidemicDataset, EpidemicMilestone } from '@/lib/epidemics/types';
import { milestoneLayerIds } from './milestone-ids';
import {
  milestoneAgePaint,
  milestoneDetailZooms,
  milestoneFanIndex,
  milestoneFeatures,
  milestoneFilter,
  MILESTONE_DETAIL_ZOOM,
  startMilestoneOverlay,
  type MilestoneCorpus,
  type MilestoneOverlayView,
} from './milestone-overlay';
import { EPIDEMIC_POINTS, hasEpidemicAt } from './epidemic-hit';
import { createEpidemicSprites } from './epidemic-sprites';
import { hasResourceAt, hasResourceCountAt } from './resource-hit';
import { hasReligionAt } from './religion-hit';

export const EPIDEMIC_IDS = milestoneLayerIds('epidemic');
export const EPIDEMIC_DETAIL_ZOOM = MILESTONE_DETAIL_ZOOM;

export const epidemicCorpus = (dataset: EpidemicDataset): MilestoneCorpus<EpidemicMilestone> => ({
  themes: dataset.diseases,
  milestones: dataset.milestones,
  themeIdOf: (milestone) => milestone.diseaseId,
  emblemOf: (kind) =>
    kind === 'emergence' ? 'origin' : kind === 'eradication' ? 'closing' : 'plain',
});

export const epidemicFanIndex = (dataset: EpidemicDataset, sameDisease = false) =>
  milestoneFanIndex(epidemicCorpus(dataset), sameDisease);
export const epidemicDetailZooms = (dataset: EpidemicDataset, sameDisease = false) =>
  milestoneDetailZooms(epidemicCorpus(dataset), sameDisease);
export const epidemicFeatures = (dataset: EpidemicDataset) =>
  milestoneFeatures(epidemicCorpus(dataset));
export const epidemicFilter = (year: number, disease: string | null = null) =>
  milestoneFilter('point', year, disease, EPIDEMIC_TIME);
export const epidemicAgePaint = (horizon: number, theme: 'dark' | 'light' = 'dark') =>
  milestoneAgePaint(EPIDEMIC_IDS, EPIDEMIC_TIME, horizon, theme, EPIDEMIC_ROUTE_FADE_RATE);

/** Epidemics yield to resource counts and to whichever foreground emblem sits on top. */
export function epidemicView(state: AtlasState): MilestoneOverlayView {
  return {
    active: state.epidemicsVisible,
    layerVisible: state.epidemicsVisible,
    filter: state.epidemicFilter,
    routesVisible: true,
    areasVisible: true,
    horizon: thematicHorizon(state.year, state.range),
    theme: state.theme,
  };
}

export const startEpidemicOverlay = (map: MapInstance) =>
  startMilestoneOverlay(map, {
    prefix: 'epidemic',
    store: useEpidemicStore,
    load: getEpidemicDataset,
    corpus: epidemicCorpus,
    time: EPIDEMIC_TIME,
    routeFadeRate: EPIDEMIC_ROUTE_FADE_RATE,
    createSprites: createEpidemicSprites,
    view: epidemicView,
    hasForegroundAt: hasResourceCountAt,
    keepsPointerAt: (m, point) => hasResourceAt(m, point) || hasReligionAt(m, point),
  });

export { EPIDEMIC_POINTS, hasEpidemicAt };
