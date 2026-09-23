import { Matrix4 } from 'three';
import { MercatorCoordinate } from 'maplibre-gl';

const EARTH_RADIUS = 6_371_008.8;

type ProjectionFrame = {
  mainMatrix: ArrayLike<number>;
  fallbackMatrix: ArrayLike<number>;
  projectionTransition: number;
};

/** Focused scenes stay loaded while panning, but must not draw through the globe. */
export function battleAnchorIsVisible(
  coords: [number, number],
  projection: { projectionTransition: number; clippingPlane: ArrayLike<number> },
): boolean {
  // During flattening the map deliberately relaxes horizon clipping as well.
  if (projection.projectionTransition <= 0.999) return true;
  const longitude = (coords[0] * Math.PI) / 180;
  const latitude = (coords[1] * Math.PI) / 180;
  const plane = projection.clippingPlane;
  return (
    Math.sin(longitude) * Math.cos(latitude) * plane[0] +
      Math.sin(latitude) * plane[1] +
      Math.cos(longitude) * Math.cos(latitude) * plane[2] +
      plane[3] >=
    0
  );
}

/** Match MapLibre's projectTileFor3D blend before homogeneous perspective division. */
export function battleProjectionMatrix(
  coords: [number, number],
  projection: ProjectionFrame,
  scale: number,
  referenceLongitude = coords[0],
): Matrix4 {
  const transition = projection.projectionTransition;
  const main = new Matrix4()
    .fromArray(projection.mainMatrix)
    .multiply(battleModelMatrix(coords, transition > 0, scale, referenceLongitude));
  if (transition <= 0 || transition > 0.999) return main;

  const fallback = new Matrix4()
    .fromArray(projection.fallbackMatrix)
    .multiply(battleModelMatrix(coords, false, scale, referenceLongitude));
  for (let index = 0; index < 16; index++)
    main.elements[index] =
      fallback.elements[index] * (1 - transition) + main.elements[index] * transition;
  return main;
}

/** Local metre coordinates, using the MapLibre 6 projection actually rendered this frame. */
export function battleModelMatrix(
  coords: [number, number],
  globe: boolean,
  scale: number,
  referenceLongitude = coords[0],
): Matrix4 {
  if (globe) {
    return new Matrix4()
      .makeRotationY((coords[0] * Math.PI) / 180)
      .multiply(new Matrix4().makeRotationX((-coords[1] * Math.PI) / 180))
      .multiply(new Matrix4().makeTranslation(0, 0, 1))
      .multiply(new Matrix4().makeRotationX(Math.PI / 2))
      .multiply(
        new Matrix4().makeScale(scale / EARTH_RADIUS, scale / EARTH_RADIUS, scale / EARTH_RADIUS),
      );
  }
  // MapLibre repeats its flat world; place the model in the same visible copy as its marker.
  const longitude = coords[0] + 360 * Math.round((referenceLongitude - coords[0]) / 360);
  const mercator = MercatorCoordinate.fromLngLat([longitude, coords[1]], 0);
  const meters = mercator.meterInMercatorCoordinateUnits() * scale;
  return new Matrix4()
    .makeTranslation(mercator.x, mercator.y, mercator.z)
    .multiply(new Matrix4().makeRotationZ(Math.PI))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new Matrix4().makeScale(-meters, meters, meters));
}
