import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3, Vector4 } from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import {
  battleModelMatrix,
  battleProjectionMatrix,
  battleAnchorIsVisible,
} from '../../lib/battles/projection';

describe('battle geographic anchoring', () => {
  it('hides a loaded battlefield behind the actual globe horizon', () => {
    // Plane normal faces Greenwich; its offset models a finite-distance camera.
    const projection = { projectionTransition: 1, clippingPlane: [0, 0, 1, -0.25] };
    expect(battleAnchorIsVisible([0, 0], projection)).toBe(true);
    expect(battleAnchorIsVisible([45, 0], projection)).toBe(true);
    expect(battleAnchorIsVisible([90, 0], projection)).toBe(false);
    expect(battleAnchorIsVisible([180, 0], projection)).toBe(false);
    expect(battleAnchorIsVisible([0, 90], projection)).toBe(false);
    expect(battleAnchorIsVisible([180, 0], { ...projection, projectionTransition: 0 })).toBe(true);
    expect(battleAnchorIsVisible([180, 0], { ...projection, projectionTransition: 0.25 })).toBe(
      true,
    );
  });
  it.each([
    [0, 0.5, 0.5, 0],
    [0.25, 0.375, 0.375, 0.25],
    [0.5, 0.25, 0.25, 0.5],
    [1, 0, 0, 1],
  ])('keeps the battlefield on the map throughout transition %s', (transition, x, y, z) => {
    const matrix = battleProjectionMatrix(
      [0, 0],
      {
        mainMatrix: new Matrix4().elements,
        fallbackMatrix: new Matrix4().elements,
        projectionTransition: transition,
      },
      7,
    );
    const origin = new Vector4(0, 0, 0, 1).applyMatrix4(matrix);
    expect(origin.x).toBeCloseTo(x, 12);
    expect(origin.y).toBeCloseTo(y, 12);
    expect(origin.z).toBeCloseTo(z, 12);
    expect(origin.w).toBe(1);
  });

  it('blends homogeneous coordinates before perspective division', () => {
    // Different projection distances make averaging screen positions incorrect.
    const globe = new Matrix4().elements;
    globe[15] = 4;
    const matrix = battleProjectionMatrix(
      [0, 0],
      {
        mainMatrix: globe,
        fallbackMatrix: new Matrix4().elements,
        projectionTransition: 0.5,
      },
      7,
    );
    const origin = new Vector3().applyMatrix4(matrix);
    expect(origin.toArray()).toEqual([0.1, 0.1, 0.2]);
  });

  it('uses the visible Mercator world copy on either side of the date line', () => {
    const east = new Vector3().applyMatrix4(battleModelMatrix([-179, 10], false, 7, 179));
    const west = new Vector3().applyMatrix4(battleModelMatrix([179, 10], false, 7, -179));
    expect(east.x).toBeCloseTo(MercatorCoordinate.fromLngLat([181, 10]).x, 12);
    expect(west.x).toBeCloseTo(MercatorCoordinate.fromLngLat([-181, 10]).x, 12);
    const globeEast = battleModelMatrix([-179, 10], true, 7, 179);
    const globeWest = battleModelMatrix([-179, 10], true, 7, -179);
    expect(globeEast.elements).toEqual(globeWest.elements);
  });
  it.each([
    [0, 0],
    [4.4, 50.6],
    [-77.2, 39.8],
    [140, -35],
  ] as [number, number][])(
    'anchors a Mercator scene at longitude %s, latitude %s with local Y pointing upward',
    (longitude, latitude) => {
      const coords: [number, number] = [longitude, latitude];
      const matrix = battleModelMatrix(coords, false, 7);
      const origin = new Vector3().applyMatrix4(matrix);
      const expected = MercatorCoordinate.fromLngLat(coords);
      expect(origin.x).toBeCloseTo(expected.x, 12);
      expect(origin.y).toBeCloseTo(expected.y, 12);
      expect(origin.z).toBeCloseTo(0, 12);
      const up = new Vector3(0, 1, 0).applyMatrix4(matrix).sub(origin);
      expect(up.z).toBeCloseTo(expected.meterInMercatorCoordinateUnits() * 7, 12);
      expect(up.x).toBeCloseTo(0, 12);
      expect(up.y).toBeCloseTo(0, 12);
    },
  );
  it.each([
    [0, 0],
    [90, 0],
    [0, 90],
    [-77.2, 39.8],
  ] as [number, number][])(
    'anchors a globe scene at longitude %s, latitude %s with a radial upright model',
    (longitude, latitude) => {
      const matrix = battleModelMatrix([longitude, latitude], true, 7);
      const origin = new Vector3().applyMatrix4(matrix);
      const lon = (longitude * Math.PI) / 180;
      const lat = (latitude * Math.PI) / 180;
      const expected = new Vector3(
        Math.sin(lon) * Math.cos(lat),
        Math.sin(lat),
        Math.cos(lon) * Math.cos(lat),
      );
      expect(origin.distanceTo(expected)).toBeLessThan(1e-12);
      const up = new Vector3(0, 1, 0).applyMatrix4(matrix).sub(origin);
      expect(up.clone().normalize().dot(expected)).toBeCloseTo(1, 9);
      expect(up.length()).toBeCloseTo(7 / 6_371_008.8, 12);
    },
  );
  it('uses the same east/south basis in both projections at the equator', () => {
    const mercator = battleModelMatrix([0, 0], false, 7);
    const globe = battleModelMatrix([0, 0], true, 7);
    const direction = (matrix: typeof mercator, point: Vector3) =>
      point.applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix)).normalize();
    expect(direction(mercator, new Vector3(1, 0, 0)).x).toBeCloseTo(1);
    expect(direction(globe, new Vector3(1, 0, 0)).x).toBeCloseTo(1);
    expect(direction(mercator, new Vector3(0, 0, 1)).y).toBeCloseTo(1);
    expect(direction(globe, new Vector3(0, 0, 1)).y).toBeCloseTo(-1);
  });
});
