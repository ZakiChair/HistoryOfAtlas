import type { Map as MapInstance, PointLike } from 'maplibre-gl';
export const RELIGION_SOURCE = 'religion-history';
export const RELIGION_POINTS = 'religion-milestones';
export const RELIGION_ROUTES = 'religion-routes';
export const RELIGION_AREAS = 'religion-areas';
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
  return (
    Boolean(map.getLayer(RELIGION_POINTS)) &&
    map.queryRenderedFeatures(point, { layers: [RELIGION_POINTS] }).length > 0
  );
}
