import type { Map as MapInstance } from 'maplibre-gl';

/**
 * Broad religious zones and routes sit beneath dense resource symbols; the
 * sparse religious emblems stay on top so both layers remain readable together. Resource
 * group counts stay above everything, so a group covered by an emblem is still announced.
 * Historical territory layers are inserted as the year changes, so each overlay
 * restores this order after them.
 */
export const THEMATIC_STACK = [
  'religion-areas',
  'religion-area-outlines',
  'religion-route-casing',
  'religion-routes',
  'religion-route-directions',
  'resource-clusters',
  'resource-points',
  'resource-selected',
  'religion-milestones',
  'religion-selection-emblem',
  'religion-selection',
  'resource-cluster-counts',
] as const;

export function raiseThematicLayers(map: MapInstance) {
  const present = THEMATIC_STACK.filter((id) => map.getLayer(id));
  const order = map.getStyle().layers?.map((layer) => layer.id) ?? [];
  const tail = order.slice(order.length - present.length);
  if (present.every((id, index) => tail[index] === id)) return;
  for (const id of present) map.moveLayer(id);
}
