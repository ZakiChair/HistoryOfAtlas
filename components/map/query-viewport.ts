import type { Map as MapInstance, MapGeoJSONFeature } from 'maplibre-gl';

/**
 * Large query rectangles undercount features on MapLibre's globe projection.
 * Query bounded screen rectangles instead, retaining MapLibre's visibility and
 * layer filters. Call after a rendered frame, at a bounded cadence; no source
 * corpus is downloaded.
 */
export function queryViewportFeatures(map: MapInstance, layers: string[]): MapGeoJSONFeature[] {
  if (map.getProjection().type !== 'globe') return map.queryRenderedFeatures({ layers });
  const { clientWidth: width, clientHeight: height } = map.getCanvas();
  const features: MapGeoJSONFeature[] = [];
  const seen = new Set<string>();
  for (let x = 0; x < width; x += 256) {
    for (let y = 0; y < height; y += 256) {
      const results = map.queryRenderedFeatures(
        [
          [x, y],
          [Math.min(width, x + 256), Math.min(height, y + 256)],
        ],
        { layers },
      );
      for (const feature of results) {
        const id = feature.properties.id ?? feature.id;
        if (id !== undefined) {
          const key = `${feature.source}/${feature.sourceLayer}/${String(id)}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        features.push(feature);
      }
    }
  }
  return features;
}
