import type { Map as MapInstance, PointLike } from 'maplibre-gl';
import { milestoneLayerIds } from './milestone-ids';
import { hasMilestoneEmblemAt } from './milestone-hit';

const RELIGION_IDS = milestoneLayerIds('religion');
export const RELIGION_SOURCE = RELIGION_IDS.source;
export const RELIGION_POINTS = RELIGION_IDS.points;
export const RELIGION_ROUTES = RELIGION_IDS.routes;
export const RELIGION_AREAS = RELIGION_IDS.areas;
export const RELIGION_COVERAGE_SOURCE = 'religion-coverage';
export const RELIGION_COVERAGE_AREAS = 'religion-coverage-areas';

/** Broad coverage intercepts territory clicks, but never foreground event/resource markers. */
export function hasReligionCoverageAt(map: MapInstance, point: PointLike): boolean {
  return (
    Boolean(map.getLayer(RELIGION_COVERAGE_AREAS)) &&
    map.queryRenderedFeatures(point, { layers: [RELIGION_COVERAGE_AREAS] }).length > 0
  );
}

/** Only small interactive emblems intercept clicks; broad presence zones do not. */
export function hasReligionAt(map: MapInstance, point: PointLike): boolean {
  return hasMilestoneEmblemAt(map, point, RELIGION_POINTS);
}
