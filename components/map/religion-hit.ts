import type { Map as MapInstance, PointLike } from 'maplibre-gl';
export const RELIGION_SOURCE = 'religion-history';
export const RELIGION_POINTS = 'religion-milestones';
export const RELIGION_ROUTES = 'religion-routes';
export const RELIGION_AREAS = 'religion-areas';

/** Only small interactive emblems intercept clicks; broad presence zones do not. */
export function hasReligionAt(map: MapInstance, point: PointLike): boolean {
  return (
    Boolean(map.getLayer(RELIGION_POINTS)) &&
    map.queryRenderedFeatures(point, { layers: [RELIGION_POINTS] }).length > 0
  );
}
