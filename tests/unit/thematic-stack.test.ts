import { expect, it, vi } from 'vitest';
import type { Map as MapInstance } from 'maplibre-gl';
import { raiseThematicLayers, THEMATIC_STACK } from '../../components/map/thematic-stack';

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

it('keeps zones and routes under resource symbols, and religious emblems on top', () => {
  const { map, order } = styleDouble([
    'land',
    'resource-clusters',
    'resource-points',
    'resource-selected',
    'religion-areas',
    'religion-routes',
    'religion-milestones',
    'territory-label',
  ]);
  raiseThematicLayers(map);
  expect(order).toEqual([
    'land',
    'territory-label',
    'religion-areas',
    'religion-routes',
    'resource-clusters',
    'resource-points',
    'resource-selected',
    'religion-milestones',
  ]);
});

it('does not move layers that are already stacked, so playback does not churn the style', () => {
  const { map, moveLayer } = styleDouble(['land', ...THEMATIC_STACK]);
  raiseThematicLayers(map);
  raiseThematicLayers(map);
  expect(moveLayer).not.toHaveBeenCalled();
});

it('restacks after a historical territory layer is inserted above the overlays', () => {
  const { map, order, moveLayer } = styleDouble(['land', ...THEMATIC_STACK, 'cliopatria-900-fill']);
  raiseThematicLayers(map);
  expect(order).toEqual(['land', 'cliopatria-900-fill', ...THEMATIC_STACK]);
  moveLayer.mockClear();
  raiseThematicLayers(map);
  expect(moveLayer).not.toHaveBeenCalled();
});
