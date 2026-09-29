import type { Map as MapInstance, PointLike } from 'maplibre-gl';

/** Only small interactive emblems intercept clicks; broad presence zones do not. */
export function hasMilestoneEmblemAt(
  map: MapInstance,
  point: PointLike,
  pointsLayer: string,
): boolean {
  return (
    Boolean(map.getLayer(pointsLayer)) &&
    map.queryRenderedFeatures(point, { layers: [pointsLayer] }).length > 0
  );
}
