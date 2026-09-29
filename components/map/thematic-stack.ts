import type { Map as MapInstance } from 'maplibre-gl';

/**
 * Broad religious and epidemic zones and routes sit beneath dense resource symbols; the
 * sparse emblems stay on top so both layers remain readable together. Epidemic emblems
 * close the emblem row, above religious ones. Resource
 * group counts stay above everything, so a group covered by an emblem is still announced.
 * Historical territory layers are inserted as the year changes, so each overlay
 * restores this order after them.
 */
export const THEMATIC_STACK = [
  'religion-coverage-areas',
  'religion-coverage-outlines',
  'religion-coverage-selection',
  'religion-areas',
  'religion-area-outlines',
  'religion-route-casing',
  'religion-routes',
  'religion-route-directions',
  'epidemic-areas',
  'epidemic-area-outlines',
  'epidemic-route-casing',
  'epidemic-routes',
  'epidemic-route-directions',
  'resource-clusters',
  'resource-points',
  'resource-selected',
  'religion-milestones',
  'religion-selection-emblem',
  'religion-selection',
  'epidemic-milestones',
  'epidemic-selection-emblem',
  'epidemic-selection',
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
  const order = map.getStyle().layers?.map((layer) => layer.id) ?? [];
  const stack: string[] = [...THEMATIC_STACK];
  const hatches = order.filter((id) => id.startsWith('religion-coverage-hatch-'));
  stack.splice(1, 0, ...hatches);
  // Unlike small history symbols, broad demographic fills must not veil event markers.
  if (map.getLayer('religion-coverage-areas'))
    stack.splice(
      3 + hatches.length,
      0,
      ...order.filter(
        (id) => id.startsWith('event-') && id !== 'event-heat' && id !== 'event-trails',
      ),
    );
  const present = stack.filter((id) => map.getLayer(id));
  if (!present.length) return;
  const wanted = [...present, ...order.filter(isTerritoryLabelLayer)];
  const tail = order.slice(order.length - wanted.length);
  if (wanted.every((id, index) => tail[index] === id)) return;
  for (const id of wanted) map.moveLayer(id);
}
