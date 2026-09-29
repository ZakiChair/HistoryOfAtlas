import type { FeatureCollection, Geometry } from 'geojson';
import type { ExpressionSpecification, Map as MapInstance } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import type { ReligionDataset, ReligionMilestone } from '@/lib/religions/types';
import { getReligionDataset } from '@/lib/religions/client';
import { RELIGION_ROUTE_FADE_RATE, RELIGION_TIME } from '@/lib/religions/time';
import { thematicHorizon } from '@/lib/thematic/time';
import { useReligionStore } from '@/lib/religions/store';
import { milestoneLayerIds } from './milestone-ids';
import { hasResourceAt, hasResourceCountAt } from './resource-hit';
import { createReligionSprites } from './religion-sprites';
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
import { startReligionCoverageOverlay } from './religion-coverage-overlay';

export const RELIGION_IDS = milestoneLayerIds('religion');
export const RELIGION_DETAIL_ZOOM = MILESTONE_DETAIL_ZOOM;

export const religionCorpus = (dataset: ReligionDataset): MilestoneCorpus<ReligionMilestone> => ({
  themes: dataset.traditions,
  milestones: dataset.milestones,
  themeIdOf: (milestone) => milestone.traditionId,
  originKind: 'origin',
});

export const religionFanIndex = (dataset: ReligionDataset, sameTradition = false) =>
  milestoneFanIndex(religionCorpus(dataset), sameTradition);

export const religionDetailZooms = (dataset: ReligionDataset, sameTradition = false) =>
  milestoneDetailZooms(religionCorpus(dataset), sameTradition);

export const religionFeatures = (dataset: ReligionDataset): FeatureCollection<Geometry> =>
  milestoneFeatures(religionCorpus(dataset));

/** `scale` × the age fade of each feature at `horizon`, evaluated per feature by MapLibre. */
export const religionAgeOpacity = (horizon: number, scale = 1, rate = 1): ExpressionSpecification =>
  RELIGION_TIME.opacity(horizon, scale, rate);

/** Paint-only age fade for every religion layer; the selection keeps full opacity. */
export const religionAgePaint = (horizon: number, theme: AtlasState['theme']) =>
  milestoneAgePaint(RELIGION_IDS, RELIGION_TIME, horizon, theme, RELIGION_ROUTE_FADE_RATE);

export const religionFilter = (shape: string, state: AtlasState): ExpressionSpecification =>
  milestoneFilter(
    shape,
    thematicHorizon(state.year, state.range),
    state.religionFilter,
    RELIGION_TIME,
  );

export const religionView = (state: AtlasState): MilestoneOverlayView => ({
  active: state.religionsVisible && state.religionView === 'history',
  layerVisible: state.religionsVisible,
  filter: state.religionFilter,
  routesVisible: state.religionRoutesVisible,
  areasVisible: state.religionAreasVisible,
  horizon: thematicHorizon(state.year, state.range),
  theme: state.theme,
});

export const startReligionHistoryOverlay = (map: MapInstance) =>
  startMilestoneOverlay(map, {
    prefix: 'religion',
    store: useReligionStore,
    load: getReligionDataset,
    corpus: religionCorpus,
    time: RELIGION_TIME,
    routeFadeRate: RELIGION_ROUTE_FADE_RATE,
    createSprites: createReligionSprites,
    view: religionView,
    hasForegroundAt: hasResourceCountAt,
    keepsPointerAt: hasResourceAt,
  });

/** Each corpus loads only when its mode is first enabled; its geometry survives mode changes. */
export function startReligionOverlay(map: MapInstance) {
  let history: ReturnType<typeof startReligionHistoryOverlay> | undefined;
  let coverage: ReturnType<typeof startReligionCoverageOverlay> | undefined;
  let disposed = false;
  return {
    update(state: AtlasState) {
      if (disposed) return;
      if (state.religionView === 'history') {
        coverage?.update(state);
        if (state.religionsVisible) history ??= startReligionHistoryOverlay(map);
        history?.update(state);
      } else {
        history?.update(state);
        if (state.religionsVisible) coverage ??= startReligionCoverageOverlay(map);
        coverage?.update(state);
      }
    },
    isReady: () => (history?.isReady() ?? true) && (coverage?.isReady() ?? true),
    dispose() {
      disposed = true;
      history?.dispose();
      coverage?.dispose();
    },
  };
}
