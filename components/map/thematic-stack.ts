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

/** `${frame.id}-label` of a territory frame (lib/map-boundaries.ts: `territory-…`, `snapshot-…`). */
export function isTerritoryLabelLayer(id: string): boolean {
  return /^(?:territory|snapshot)-.+-label$/.test(id);
}

/**
 * Territory names end above the stack: thematic pictograms ignore placement, so drawn over a
 * name they would cut it ("K▮gdom of England"). Moves happen only when the order is wrong, so
 * the per-frame calls during playback do not churn the style.
 */
export function raiseThematicLayers(map: MapInstance) {
  const present = THEMATIC_STACK.filter((id) => map.getLayer(id));
  if (!present.length) return;
  const order = map.getStyle().layers?.map((layer) => layer.id) ?? [];
  const wanted = [...present, ...order.filter(isTerritoryLabelLayer)];
  const tail = order.slice(order.length - wanted.length);
  if (wanted.every((id, index) => tail[index] === id)) return;
  for (const id of wanted) map.moveLayer(id);
}
