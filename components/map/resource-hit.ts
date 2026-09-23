import type { Map as MapInstance, PointLike } from 'maplibre-gl';

export const RESOURCE_SOURCE = 'strategic-resources';
export const RESOURCE_POINTS = 'resource-points';
export const RESOURCE_CLUSTERS = 'resource-clusters';

export function hasResourceAt(map: MapInstance, point: PointLike): boolean {
  const layers = [RESOURCE_POINTS, RESOURCE_CLUSTERS].filter((id) => map.getLayer(id));
  return layers.length > 0 && map.queryRenderedFeatures(point, { layers }).length > 0;
}
