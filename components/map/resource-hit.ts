import type { Map as MapInstance, PointLike } from 'maplibre-gl';

export const RESOURCE_SOURCE = 'strategic-resources';
export const RESOURCE_POINTS = 'resource-points';
export const RESOURCE_CLUSTERS = 'resource-clusters';
export const RESOURCE_COUNTS = 'resource-cluster-counts';

const hit = (map: MapInstance, point: PointLike, ids: string[]) => {
  const layers = ids.filter((id) => map.getLayer(id));
  return layers.length > 0 && map.queryRenderedFeatures(point, { layers }).length > 0;
};

export function hasResourceAt(map: MapInstance, point: PointLike): boolean {
  return hit(map, point, [RESOURCE_POINTS, RESOURCE_CLUSTERS, RESOURCE_COUNTS]);
}

/** Group count cartouches are drawn above religious emblems and keep the clicks they cover. */
export function hasResourceCountAt(map: MapInstance, point: PointLike): boolean {
  return hit(map, point, [RESOURCE_COUNTS]);
}
