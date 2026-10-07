import type { Map as MapInstance, PointLike } from 'maplibre-gl';
export const CONTEXT_SOURCE = 'historical-context';
export const CONTEXT_LINES = 'context-lines';
export const CONTEXT_POINTS = 'context-points';
export const CONTEXT_LABELS = 'context-labels';
export const CONTEXT_LAYERS = [CONTEXT_LINES, CONTEXT_POINTS, CONTEXT_LABELS];
export function hasContextAt(map: MapInstance, point: PointLike) {
  const layers = CONTEXT_LAYERS.filter((id) => map.getLayer(id));
  return layers.length > 0 && map.queryRenderedFeatures(point, { layers }).length > 0;
}
