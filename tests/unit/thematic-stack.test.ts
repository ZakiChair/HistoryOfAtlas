import { expect, it, vi } from 'vitest';
import type { Map as MapInstance } from 'maplibre-gl';
import {
  isTerritoryLabelLayer,
  raiseThematicLayers,
  THEMATIC_STACK,
} from '../../components/map/thematic-stack';

function styleDouble(ids: string[]) {
  const order = [...ids];
  const moveLayer = vi.fn((id: string) => {
    order.splice(order.indexOf(id), 1);
    order.push(id);
  });
  const map = {
    getLayer: (id: string) => (order.includes(id) ? { id } : undefined),
    getStyle: () => ({ layers: order.map((id) => ({ id })) }),
    moveLayer,
  };
  return { map: map as unknown as MapInstance, order, moveLayer };
}

it('keeps zones and routes under resource symbols, religious emblems and territory names on top', () => {
  const { map, order } = styleDouble([
    'land',
    'resource-clusters',
    'resource-points',
    'resource-selected',
    'religion-areas',
    'religion-routes',
    'religion-milestones',
    'territory-1600-label',
  ]);
  raiseThematicLayers(map);
  expect(order).toEqual([
    'land',
    'religion-areas',
    'religion-routes',
    'resource-clusters',
    'resource-points',
    'resource-selected',
    'religion-milestones',
    'territory-1600-label',
  ]);
});

it('does not move layers that are already stacked, so playback does not churn the style', () => {
  const { map, moveLayer } = styleDouble(['land', ...THEMATIC_STACK, 'snapshot-1600-label']);
  raiseThematicLayers(map);
  raiseThematicLayers(map);
  expect(moveLayer).not.toHaveBeenCalled();
});

it('restacks after a historical territory layer is inserted above the overlays', () => {
  const { map, order, moveLayer } = styleDouble([
    'land',
    ...THEMATIC_STACK,
    'territory-1500-label',
    'territory-1600-fill',
  ]);
  raiseThematicLayers(map);
  expect(order).toEqual(['land', 'territory-1600-fill', ...THEMATIC_STACK, 'territory-1500-label']);
  moveLayer.mockClear();
  raiseThematicLayers(map);
  expect(moveLayer).not.toHaveBeenCalled();
});

it('keeps territory names above pictograms when a thematic overlay is installed after them', () => {
  // Europe in 1600 at zoom 2.6: the dated territory names were drawn first, then the
  // resource and religion overlays added their symbols at the top of the style.
  const { map, order, moveLayer } = styleDouble([
    'land',
    'territory-1600-fill',
    'territory-1600-border',
    'territory-1600-label',
    'event-points',
    ...THEMATIC_STACK,
  ]);
  raiseThematicLayers(map);
  expect(order.slice(-THEMATIC_STACK.length - 1)).toEqual([
    ...THEMATIC_STACK,
    'territory-1600-label',
  ]);
  expect(order.indexOf('territory-1600-fill')).toBeLessThan(order.indexOf('religion-areas'));
  // A newly dated snapshot adds its label at the top: already in order, nothing moves.
  order.push('snapshot-1650-label');
  moveLayer.mockClear();
  raiseThematicLayers(map);
  expect(moveLayer).not.toHaveBeenCalled();
});

it('recognises only territory frame labels', () => {
  expect(isTerritoryLabelLayer('territory-1600-label')).toBe(true);
  expect(isTerritoryLabelLayer('snapshot--500-label')).toBe(true);
  expect(isTerritoryLabelLayer('territory-1600-fill')).toBe(false);
  expect(isTerritoryLabelLayer('event-icons')).toBe(false);
  expect(isTerritoryLabelLayer('resource-cluster-counts')).toBe(false);
});
